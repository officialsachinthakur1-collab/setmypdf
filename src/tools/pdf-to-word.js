// PDF to Word Logic
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileReadyContainer = document.getElementById('file-ready-container');
const processingState = document.getElementById('processing-state');
const successState = document.getElementById('success-state');
const convertBtn = document.getElementById('convert-btn');
const downloadBtn = document.getElementById('download-btn');

let pdfData = null;
let wordBlob = null;

// Handle history saving for Recent Activity
function saveToHistory(filename, toolName) {
    try {
        const history = JSON.parse(localStorage.getItem('pdf_magic_history')) || [];
        history.unshift({
            filename: filename,
            tool: toolName,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('pdf_magic_history', JSON.stringify(history.slice(0, 10)));
    } catch (e) { console.error('History save error', e); }
}

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        pdfData = file;
        document.getElementById('file-name').textContent = file.name;
        document.getElementById('file-size').textContent = (file.size / 1024).toFixed(1) + ' KB';
        dropZone.style.display = 'none';
        fileReadyContainer.style.display = 'block';
    }
};

dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent-color)'; };
dropZone.ondragleave = () => { dropZone.style.borderColor = 'var(--glass-border)'; };
dropZone.ondrop = (e) => { e.preventDefault(); fileInput.files = e.dataTransfer.files; fileInput.onchange({ target: fileInput }); };

convertBtn.onclick = async () => {
    if (!pdfData) return;

    try {
        fileReadyContainer.style.display = 'none';
        processingState.style.display = 'block';

        const arrayBuffer = await pdfData.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = "";

        const progressBar = document.getElementById('pdf-word-progress-bar');
        const progressText = document.getElementById('pdf-word-progress-text');

        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.innerText = '0%';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += `<p>${pageText}</p><br clear="all" style="page-break-before:always">`;

            const percent = Math.round((i / pdf.numPages) * 100);
            if (progressBar) progressBar.style.width = percent + '%';
            if (progressText) progressText.innerText = percent + '%';
        }

        // Create a basic Word document using HTML format (Word opens this perfectly)
        const header = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset='utf-8'><title>Exported Doc</title></head>
            <body style="font-family: 'Times New Roman', serif;">
        `;
        const footer = "</body></html>";
        const finalHtml = header + fullText + footer;

        wordBlob = new Blob(['\ufeff', finalHtml], {
            type: 'application/msword'
        });

        processingState.style.display = 'none';
        successState.style.display = 'block';

        saveToHistory(pdfData.name, 'PDF to Word');

    } catch (err) {
        console.error('Word conversion error:', err);
        alert('Magic failed! Word conversion error: ' + err.message);
        processingState.style.display = 'none';
        fileReadyContainer.style.display = 'block';
    }
};

downloadBtn.onclick = () => {
    if (!wordBlob) return;
    const url = URL.createObjectURL(wordBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pdfData.name.replace('.pdf', '.doc');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
