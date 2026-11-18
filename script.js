pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const resumeInput = document.getElementById('resumeInput');
const fileStatus = document.getElementById('fileStatus');
const apiKeyInput = document.getElementById('apiKey');
const jobDescInput = document.getElementById('jobDesc');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingText = document.getElementById('loadingText');
const resultSection = document.getElementById('resultSection');

const scoreDisplay = document.getElementById('scoreDisplay');
const summaryText = document.getElementById('summaryText');
const missingKeywordsList = document.getElementById('missingKeywords');
const tipsList = document.getElementById('tipsList');
const suggestedBulletsList = document.getElementById('suggestedBulletsList');
const copyBulletsBtn = document.getElementById('copyBulletsBtn');

let extractedResumeText = "";

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

analyzeBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const jobDesc = jobDescInput.value.trim();

    if (!apiKey) {
        alert("Pehle apni Gemini API Key paste karo!");
        return;
    }
    if ((!apiKey.startsWith("AIza") && !apiKey.startsWith("AQ.")) || apiKey.includes(" ")) {
        alert("Invalid API Key format! Sahi Gemini API key paste karo (bina space ke).");
        return;
    }
    if (!extractedResumeText) {
        alert("Pehle apna Resume (PDF) upload karo!");
        return;
    }
    if (!jobDesc) {
        alert("Job Description paste karna zaroori hai!");
        return;
    }

    analyzeBtn.disabled = true;
    analyzeBtn.classList.add('opacity-50', 'cursor-not-allowed');
    loadingText.classList.remove('hidden');
    resultSection.classList.add('hidden');

    try {
        const analysisResult = await analyzeWithGemini(apiKey, extractedResumeText, jobDesc);
        displayResults(analysisResult);
    } catch (error) {
        console.error("Analysis Error:", error);
        alert("Error: " + error.message);
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        loadingText.classList.add('hidden');
    }
});

async function analyzeWithGemini(apiKey, resumeText, jobDescription) {
    const models = ["gemini-3.8-flash", "gemini-3.8-flash-lite", "gemini-3.5-flash"];

    const prompt = `
    Act as an expert Technical Recruiter and Applicant Tracking System (ATS). 
    Compare the following Resume against the Job Description.
    
    Provide a strict, realistic evaluation in JSON format with these exact keys:
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

    let lastError = null;

    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || `Failed on ${model}`);
            }

            const data = await response.json();
            const rawText = data.candidates[0].content.parts[0].text;
            console.log(`Success using model: ${model}`);
            return JSON.parse(rawText);

        } catch (error) {
            console.warn(`${model} busy/failed, trying next...`, error.message);
            lastError = error;
        }
    }

    throw lastError;
}

function displayResults(result) {
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
    resultSection.classList.add('fade-in');
}