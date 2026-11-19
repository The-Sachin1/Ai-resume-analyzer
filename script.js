resumeInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    fileStatus.classList.remove('hidden');
    fileStatus.textContent = "PDF padhi ja rahi hai...";
    fileStatus.className = "text-xs text-amber-400 mt-4";

    try {
        extractedResumeText = await extractTextFromPDF(file);
        if (!extractedResumeText || extractedResumeText.length < 20) {
            throw new Error("PDF mein readable text nahi mila (shayed scanned image PDF hai).");
        }
        fileStatus.textContent = `✅ "${file.name}" ready hai! (${extractedResumeText.length} characters mile)`;
        fileStatus.className = "text-xs text-emerald-400 mt-4";
    } catch (error) {
        console.error("PDF Error:", error);
        fileStatus.textContent = `❌ PDF Error: ${error.message}`;
        fileStatus.className = "text-xs text-rose-400 mt-4";
    }
});

async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    try {
        // Run directly without external worker so neither CORS nor CDN worker issues can block it
        const loadingTask = pdfjsLib.getDocument({
            data: uint8Array,
            disableWorker: true,
            useSystemFonts: true
        });
        const pdf = await loadingTask.promise;
        let fullText = "";

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(" ");
            fullText += pageText + "\n";
        }

        if (fullText.trim().length > 20) {
            return fullText.trim();
        }
    } catch (pdfJsErr) {
        console.warn("pdf.js primary parse warning:", pdfJsErr);
    }

    // Fallback: Raw PDF text stream extractor (works even if PDF font/header tables are quirky)
    const rawDecoder = new TextDecoder("latin1");
    const rawPdfString = rawDecoder.decode(uint8Array);
    const textMatches = rawPdfString.match(/\(([^()\\]{2,})\)/g) || [];
    const fallbackText = textMatches
        .map(s => s.slice(1, -1))
        .filter(s => /[a-zA-Z]{2,}/.test(s))
        .join(" ");

    if (fallbackText.trim().length > 30) {
        return fallbackText.trim();
    }

    throw new Error("Is PDF ko parse nahi kar paye. Ek baar 'Sachin_Sharma_Single_Page_ATS_Resume.pdf' try karein.");
}