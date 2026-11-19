pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const resumeInput = document.getElementById('resumeInput');
const fileStatus = document.getElementById('fileStatus');
const apiProviderSelect = document.getElementById('apiProvider');
const apiKeyInput = document.getElementById('apiKey');
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

// Update placeholder dynamically based on selected AI provider
apiProviderSelect.addEventListener('change', () => {
    const placeholders = {
        gemini: "Google Gemini API key paste karo (AIza...)...",
        groq: "Free Groq API key paste karo (gsk_...)...",
        openai: "OpenAI API key paste karo (sk-...)...",
        openrouter: "OpenRouter API key paste karo (sk-or-...)..."
    };
    apiKeyInput.placeholder = placeholders[apiProviderSelect.value];
});

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
        fileStatus.textContent = "❌ PDF padhne mein dikkat aayi. Koi aur PDF try karo.";
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

// 1. Deep AI Scan (Gemini, Groq, OpenAI, OpenRouter)
analyzeBtn.addEventListener('click', async () => {
    const provider = apiProviderSelect.value;
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
        alert("API key khali hai! Key daalo ya neeche 'Instant ATS Scan (No API Key)' button use karo.");
        return;
    }

    setLoading(true, `AI (${provider.toUpperCase()}) tumhara resume scan kar raha hai...`);

    try {
        const prompt = buildPrompt(extractedResumeText, jobDesc);
        let analysisResult;

        if (provider === 'gemini') {
            analysisResult = await analyzeWithGemini(apiKey, prompt);
        } else {
            analysisResult = await analyzeWithOpenAICompatible(provider, apiKey, prompt);
        }

        displayResults(analysisResult, `AI Deep Analysis (${provider.toUpperCase()})`);
    } catch (error) {
        console.error("Analysis Error:", error);
        alert(`API Error: ${error.message}\n\nTip: Aap bina key ke 'Instant ATS Scan (No API Key)' bhi try kar sakte hain.`);
    } finally {
        setLoading(false);
    }
});

// 2. Zero-API-Key Instant ATS Keyword Engine (Recruiter-Friendly Live Demo)
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
    displayResults(result, "Instant Keyword ATS Mode (No API Key)");
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
    
    Return ONLY valid JSON with these exact keys:
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

async function analyzeWithGemini(apiKey, prompt) {
    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    let lastError = null;

    for (const model of models) {
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
            return JSON.parse(rawText);
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}

async function analyzeWithOpenAICompatible(provider, apiKey, prompt) {
    const endpoints = {
        groq: { url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile" },
        openai: { url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
        openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", model: "meta-llama/llama-3.3-70b-instruct:free" }
    };

    const config = endpoints[provider];
    const response = await fetch(config.url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: config.model,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || `Request failed for ${provider}`);
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
}

// Local Client-Side ATS Matcher (Works 100% Offline / Without Any API Key)
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
        summary: `Instant ATS Keyword Scan complete: Resume matched ${matched.length} out of ${jdWords.length} key terms from the Job Description. Enter a free Gemini or Groq API key above for deep AI sentence rewriting.`,
        missingKeywords: missing.slice(0, 8).length ? missing.slice(0, 8) : ["None — Great Keyword Coverage!"],
        tips: [
            "Ensure top missing keywords from the Job Description appear naturally in your Skills or Project bullet points.",
            "Keep measurable impact metrics (e.g., payload sizes, performance gains, CGPA) visible on a single page.",
            "Use Deep AI Analyze with a free Gemini or Groq key for tailored resume bullet generation."
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
    result.missingKeywords.forEach(keyword => {
        const li = document.createElement('li');
        li.textContent = keyword;
        li.className = "bg-rose-950 text-rose-300 border border-rose-800 text-xs font-medium px-3 py-1 rounded-full";
        missingKeywordsList.appendChild(li);
    });

    tipsList.innerHTML = "";
    result.tips.forEach(tip => {
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
        const textToCopy = result.suggestedBullets.map(b => `• ${b}`).join("\n");
        navigator.clipboard.writeText(textToCopy);
        copyBulletsBtn.textContent = "✅ Copied!";
        setTimeout(() => copyBulletsBtn.textContent = "Copy Bullets", 2000);
    };

    resultSection.classList.remove('hidden');
}