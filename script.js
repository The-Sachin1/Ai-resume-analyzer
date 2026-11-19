// Original working PDF.js worker setup (100% reliable on GitHub Pages)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const resumeInput = document.getElementById('resumeInput');
const fileStatus = document.getElementById('fileStatus');
const apiKeyInput = document.getElementById('apiKey');
const detectedBadge = document.getElementById('detectedBadge');
const jobDescInput = document.getElementById('jobDesc');
const analyzeBtn = document.getElementById('analyzeBtn');
const instantScanBtn = document.getElementById('instantScanBtn');
const loadingText = document.getElementById('loadingText');
const resultSection = document.getElementById('resultSection');

const modeBadge = document.getElementById('modeBadge');
const scoreDisplay = document.getElementById('scoreDisplay');
const summaryText = document.getElementById('summaryText');
const missingKeywordsList = document.getElementById('missingKeywords');
const tipsList = document.getElementById('tipsList');
const suggestedBulletsList = document.getElementById('suggestedBulletsList');
const copyBulletsBtn = document.getElementById('copyBulletsBtn');

let extractedResumeText = "";

// Live API Provider Auto-Detection
apiKeyInput.addEventListener('input', () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
        detectedBadge.textContent = "Auto-detects Gemini, Groq, OpenAI, OpenRouter, Claude, DeepSeek, Mistral & more";
        detectedBadge.className = "text-xs text-indigo-400";
        return;
    }
    const provider = detectProvider(key);
    detectedBadge.textContent = `✅ Detected: ${provider.label}`;
    detectedBadge.className = "text-xs text-emerald-400 font-medium";
});

function detectProvider(apiKey) {
    if (apiKey.startsWith("AIza") || apiKey.startsWith("AQ.")) {
        return { id: "gemini", label: "Google Gemini API" };
    }
    if (apiKey.startsWith("gsk_")) {
        return { id: "groq", label: "Groq Cloud API" };
    }
    if (apiKey.startsWith("sk-or-")) {
        return { id: "openrouter", label: "OpenRouter API" };
    }
    if (apiKey.startsWith("sk-ant-")) {
        return { id: "anthropic", label: "Anthropic Claude API" };
    }
    if (apiKey.startsWith("xai-")) {
        return { id: "xai", label: "xAI Grok API" };
    }
    if (apiKey.startsWith("csk-")) {
        return { id: "cerebras", label: "Cerebras Cloud API" };
    }
    if (apiKey.startsWith("pplx-")) {
        return { id: "perplexity", label: "Perplexity AI API" };
    }
    if (apiKey.startsWith("sk-")) {
        return { id: "openai_or_deepseek", label: "OpenAI / DeepSeek API" };
    }
    return { id: "universal", label: "Universal Multi-Provider Scan (Auto-Routing)" };
}

// Original working PDF Upload & Extraction Logic
resumeInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    fileStatus.classList.remove('hidden');
    fileStatus.textContent = "PDF padhi ja rahi hai...";
    fileStatus.className = "text-xs text-amber-400 mt-4";

    try {
        extractedResumeText = await extractTextFromPDF(file);
        fileStatus.textContent = `✅ "${file.name}" ready hai! (${extractedResumeText.length} characters mile)`;
        fileStatus.className = "text-xs text-emerald-400 mt-4";
    } catch (error) {
        console.error("PDF Error:", error);
        fileStatus.textContent = "❌ PDF padhne mein dikkat aayi: " + error.message;
        fileStatus.className = "text-xs text-rose-400 mt-4";
    }
});

async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(" ");
        fullText += pageText + "\n";
    }

    return fullText.trim();
}

function safeParseAIJson(rawText) {
    try {
        return JSON.parse(rawText);
    } catch {
        const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1) {
            return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
        }
        throw new Error("AI response format parse nahi ho paya. Dobara try karein.");
    }
}

analyzeBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const jobDesc = jobDescInput.value.trim();

    if (!extractedResumeText) {
        alert("Pehle apna Resume (PDF) upload karo!");
        return;
    }
    if (!jobDesc) {
        alert("Job Description paste karna zaroori hai!");
        return;
    }
    if (!apiKey) {
        alert("API key khali hai! Koi bhi API key daalo ya 'Instant ATS Scan (No API Key)' use karo.");
        return;
    }

    const provider = detectProvider(apiKey);
    setLoading(true, `${provider.label} se resume analyze ho raha hai...`);

    try {
        const prompt = buildPrompt(extractedResumeText, jobDesc);
        const result = await routeUniversalAI(provider.id, apiKey, prompt);
        displayResults(result.data, `${result.providerName} (${result.modelUsed})`);
    } catch (error) {
        console.error("Analysis Error:", error);
        alert(`Error: ${error.message}\n\nTip: Bina API key ke 'Instant ATS Scan (No API Key)' button bhi 100% kaam karta hai.`);
    } finally {
        setLoading(false);
    }
});

instantScanBtn.addEventListener('click', () => {
    const jobDesc = jobDescInput.value.trim();

    if (!extractedResumeText) {
        alert("Pehle apna Resume (PDF) upload karo!");
        return;
    }
    if (!jobDesc) {
        alert("Job Description paste karna zaroori hai!");
        return;
    }

    const result = runLocalATSEngine(extractedResumeText, jobDesc);
    displayResults(result, "Instant ATS Scan (No API Key)");
});

function setLoading(isLoading, text = "") {
    analyzeBtn.disabled = isLoading;
    instantScanBtn.disabled = isLoading;
    analyzeBtn.classList.toggle('opacity-50', isLoading);
    instantScanBtn.classList.toggle('opacity-50', isLoading);
    if (isLoading) {
        loadingText.textContent = text;
        loadingText.classList.remove('hidden');
        resultSection.classList.add('hidden');
    } else {
        loadingText.classList.add('hidden');
    }
}

function buildPrompt(resumeText, jobDescription) {
    return `
    Act as an expert Technical Recruiter and Applicant Tracking System (ATS). 
    Compare the following Resume against the Job Description.
    
    Return ONLY valid JSON (no markdown, no extra commentary) with these exact keys:
    {
        "score": (number between 0 and 100 representing ATS match percentage),
        "summary": (2-3 sentences explaining overall fit and main strengths/gaps),
        "missingKeywords": (array of 5-8 important technical or soft skill keywords from the Job Description that are missing or weak in the Resume),
        "tips": (array of 3-4 actionable bullet points to improve the resume specifically for this role),
        "suggestedBullets": (array of 3 strong, ATS-optimized resume bullet points tailored to this Job Description using action verbs and relevant keywords)
    }

    RESUME:
    ${resumeText}

    JOB DESCRIPTION:
    ${jobDescription}
    `;
}

// All OpenAI-Compatible Providers Registry
const OPENAI_COMPATIBLE_PROVIDERS = [
    {
        id: "groq",
        name: "Groq Cloud",
        url: "https://api.groq.com/openai/v1/chat/completions",
        modelsUrl: "https://api.groq.com/openai/v1/models",
        fallbackModels: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"]
    },
    {
        id: "openai",
        name: "OpenAI",
        url: "https://api.openai.com/v1/chat/completions",
        fallbackModels: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-3.5-turbo"]
    },
    {
        id: "openrouter",
        name: "OpenRouter",
        url: "https://openrouter.ai/api/v1/chat/completions",
        fallbackModels: ["meta-llama/llama-3.3-70b-instruct:free", "google/gemini-2.0-flash-exp:free", "openai/gpt-4o-mini"]
    },
    {
        id: "deepseek",
        name: "DeepSeek",
        url: "https://api.deepseek.com/chat/completions",
        fallbackModels: ["deepseek-chat"]
    },
    {
        id: "mistral",
        name: "Mistral AI",
        url: "https://api.mistral.ai/v1/chat/completions",
        fallbackModels: ["mistral-small-latest", "open-mistral-nemo"]
    },
    {
        id: "xai",
        name: "xAI Grok",
        url: "https://api.x.ai/v1/chat/completions",
        fallbackModels: ["grok-2-latest", "grok-beta"]
    },
    {
        id: "cerebras",
        name: "Cerebras",
        url: "https://api.cerebras.ai/v1/chat/completions",
        fallbackModels: ["llama-3.3-70b", "llama3.1-8b"]
    },
    {
        id: "perplexity",
        name: "Perplexity",
        url: "https://api.perplexity.ai/chat/completions",
        fallbackModels: ["sonar", "sonar-pro"]
    },
    {
        id: "together",
        name: "Together AI",
        url: "https://api.together.xyz/v1/chat/completions",
        fallbackModels: ["meta-llama/Llama-3.3-70B-Instruct-Turbo-Free", "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo"]
    },
    {
        id: "fireworks",
        name: "Fireworks AI",
        url: "https://api.fireworks.ai/inference/v1/chat/completions",
        fallbackModels: ["accounts/fireworks/models/llama-v3p3-70b-instruct"]
    }
];

async function routeUniversalAI(providerId, apiKey, prompt) {
    if (providerId === "gemini") {
        return await runGeminiUniversal(apiKey, prompt);
    }
    if (providerId === "anthropic") {
        return await runAnthropicUniversal(apiKey, prompt);
    }
    if (providerId === "openai_or_deepseek") {
        try {
            return await runOpenAICompatibleProvider(OPENAI_COMPATIBLE_PROVIDERS.find(p => p.id === "openai"), apiKey, prompt);
        } catch {
            return await runOpenAICompatibleProvider(OPENAI_COMPATIBLE_PROVIDERS.find(p => p.id === "deepseek"), apiKey, prompt);
        }
    }

    const directMatch = OPENAI_COMPATIBLE_PROVIDERS.find(p => p.id === providerId);
    if (directMatch) {
        return await runOpenAICompatibleProvider(directMatch, apiKey, prompt);
    }

    // Full Universal Sweep for any personal / custom / unknown prefix API key
    try {
        return await runGeminiUniversal(apiKey, prompt);
    } catch {}

    try {
        return await runAnthropicUniversal(apiKey, prompt);
    } catch {}

    let lastErr = new Error("API Key kisi bhi provider par verify nahi ho payi. Kripya valid key check karein.");
    for (const provider of OPENAI_COMPATIBLE_PROVIDERS) {
        try {
            return await runOpenAICompatibleProvider(provider, apiKey, prompt);
        } catch (err) {
            lastErr = err;
        }
    }

    try {
        return await runCohereUniversal(apiKey, prompt);
    } catch {}

    throw lastErr;
}

// 1. Google Gemini Universal (Auto-discovers active models on key)
async function runGeminiUniversal(apiKey, prompt) {
    let modelsToTry = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-2.5-pro"];

    try {
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (listRes.ok) {
            const listData = await listRes.json();
            const activeModels = (listData.models || [])
                .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
                .map(m => m.name.replace("models/", ""))
                .filter(name => name.includes("gemini") && !name.includes("embedding") && !name.includes("vision"));

            const sorted = [
                ...activeModels.filter(m => m.includes("flash")),
                ...activeModels.filter(m => !m.includes("flash"))
            ];
            if (sorted.length > 0) {
                modelsToTry = [...new Set(sorted)];
            }
        }
    } catch {}

    let lastError = null;
    for (const model of modelsToTry) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: "application/json" }
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || `Failed on ${model}`);
            }

            const data = await response.json();
            const rawText = data.candidates[0].content.parts[0].text;
            return { data: safeParseAIJson(rawText), providerName: "Google Gemini", modelUsed: model };
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError;
}

// 2. OpenAI-Compatible Universal Runner
async function runOpenAICompatibleProvider(provider, apiKey, prompt) {
    let modelsToTry = [...provider.fallbackModels];

    if (provider.modelsUrl) {
        try {
            const listRes = await fetch(provider.modelsUrl, {
                headers: { "Authorization": `Bearer ${apiKey}` }
            });
            if (listRes.ok) {
                const listData = await listRes.json();
                const discovered = (listData.data || [])
                    .map(m => m.id)
                    .filter(id => !id.includes("whisper") && !id.includes("tts") && !id.includes("guard") && !id.includes("embed"));
                if (discovered.length > 0) {
                    modelsToTry = [...new Set([...provider.fallbackModels, ...discovered])];
                }
            }
        } catch {}
    }

    let lastError = null;
    for (const model of modelsToTry) {
        try {
            const response = await fetch(provider.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: "user", content: prompt }]
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const rawText = data.choices[0].message.content;
            return { data: safeParseAIJson(rawText), providerName: provider.name, modelUsed: model };
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError;
}

// 3. Anthropic Claude Universal Runner
async function runAnthropicUniversal(apiKey, prompt) {
    const models = ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest"];
    let lastError = null;

    for (const model of models) {
        try {
            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "anthropic-version": "2023-06-01",
                    "anthropic-dangerous-direct-browser-access": "true"
                },
                body: JSON.stringify({
                    model: model,
                    max_tokens: 1024,
                    messages: [{ role: "user", content: prompt }]
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || `Claude HTTP ${response.status}`);
            }

            const data = await response.json();
            const rawText = data.content[0].text;
            return { data: safeParseAIJson(rawText), providerName: "Anthropic Claude", modelUsed: model };
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError;
}

// 4. Cohere Universal Runner
async function runCohereUniversal(apiKey, prompt) {
    const response = await fetch("https://api.cohere.com/v2/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "command-r-plus-08-2024",
            messages: [{ role: "user", content: prompt }]
        })
    });

    if (!response.ok) {
        throw new Error(`Cohere HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.message.content[0].text;
    return { data: safeParseAIJson(rawText), providerName: "Cohere", modelUsed: "command-r-plus" };
}

// 5. Local Client-Side ATS Matcher (100% Offline / Zero API Key)
function runLocalATSEngine(resumeText, jobDesc) {
    const stopWords = new Set(["and", "the", "for", "with", "you", "will", "are", "from", "that", "this", "have", "your", "our", "work", "role", "team", "using", "build", "strong", "skills", "experience", "knowledge", "ability", "good", "plus", "based", "into", "across", "about", "requirements", "responsibilities", "qualifications", "intern", "internship", "company", "looking", "candidate"]);
    const cleanWords = (text) => text.toLowerCase().match(/\b[a-z0-9+#.-]{2,}\b/g) || [];
    
    const jdWords = [...new Set(cleanWords(jobDesc))].filter(w => !stopWords.has(w) && isNaN(w));
    const resumeSet = new Set(cleanWords(resumeText));

    const matched = jdWords.filter(w => resumeSet.has(w));
    const missing = jdWords.filter(w => !resumeSet.has(w));

    const rawRatio = jdWords.length > 0 ? (matched.length / jdWords.length) : 0;
    const score = Math.min(96, Math.max(35, Math.round(rawRatio * 135)));

    return {
        score,
        summary: `Instant ATS Keyword Scan complete: Resume matched ${matched.length} out of ${jdWords.length} key terms from the Job Description. Paste any AI API key above for deep AI sentence rewriting.`,
        missingKeywords: missing.slice(0, 8).length ? missing.slice(0, 8) : ["None — Great Keyword Coverage!"],
        tips: [
            "Ensure top missing keywords from the Job Description appear naturally in your Skills or Project bullet points.",
            "Keep measurable impact metrics (e.g., payload sizes, performance gains, CGPA) visible on a single page.",
            "Paste any Gemini, Groq, OpenAI, Claude, or DeepSeek key above for AI-generated tailored resume bullets."
        ],
        suggestedBullets: [
            `Developed and deployed responsive web solutions aligned with ${matched.slice(0, 3).join(", ") || "modern web standards"} and clean Git workflows.`,
            `Collaborated on cross-browser UI optimization and client-side data handling to improve application responsiveness and reliability.`
        ]
    };
}

function displayResults(result, badgeLabel) {
    modeBadge.textContent = badgeLabel;
    scoreDisplay.textContent = `${result.score}%`;
    if (result.score >= 75) {
        scoreDisplay.className = "text-5xl font-extrabold text-emerald-400";
    } else if (result.score >= 50) {
        scoreDisplay.className = "text-5xl font-extrabold text-amber-400";
    } else {
        scoreDisplay.className = "text-5xl font-extrabold text-rose-400";
    }

    summaryText.textContent = result.summary;

    missingKeywordsList.innerHTML = "";
    (result.missingKeywords || []).forEach(keyword => {
        const li = document.createElement('li');
        li.textContent = keyword;
        li.className = "bg-rose-950 text-rose-300 border border-rose-800 text-xs font-medium px-3 py-1 rounded-full";
        missingKeywordsList.appendChild(li);
    });

    tipsList.innerHTML = "";
    (result.tips || []).forEach(tip => {
        const li = document.createElement('li');
        li.textContent = tip;
        tipsList.appendChild(li);
    });

    suggestedBulletsList.innerHTML = "";
    if (result.suggestedBullets) {
        result.suggestedBullets.forEach(bullet => {
            const li = document.createElement('li');
            li.textContent = bullet;
            suggestedBulletsList.appendChild(li);
        });
    }

    copyBulletsBtn.onclick = () => {
        const textToCopy = (result.suggestedBullets || []).map(b => `• ${b}`).join("\n");
        navigator.clipboard.writeText(textToCopy);
        copyBulletsBtn.textContent = "✅ Copied!";
        setTimeout(() => copyBulletsBtn.textContent = "Copy Bullets", 2000);
    };

    resultSection.classList.remove('hidden');
}