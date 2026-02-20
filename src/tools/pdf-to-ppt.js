// PDF to PPT Logic
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileReadyContainer = document.getElementById('file-ready-container');
const processingState = document.getElementById('processing-state');
const successState = document.getElementById('success-state');
const convertBtn = document.getElementById('convert-btn');
const downloadBtn = document.getElementById('download-btn');

let pdfData = null;
let pptxBlob = null;

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

// Initialize PDF.js
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
dropZone.ondrop = (e) => {
    e.preventDefault();
    fileInput.files = e.dataTransfer.files;
    fileInput.onchange({ target: fileInput });
};

convertBtn.onclick = async () => {
    if (!pdfData) return;

    try {
        fileReadyContainer.style.display = 'none';
        processingState.style.display = 'block';

        const arrayBuffer = await pdfData.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        // Initialize PptxGenJS
        const pptx = new PptxGenJS();
        pptx.layout = 'LAYOUT_WIDE';

        // Loop through all pages
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2 }); // High res rendering

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            // Convert canvas to image
            const imgData = canvas.toDataURL('image/jpeg', 0.8);

            // Add slide to PPTX
            const slide = pptx.addSlide();
            slide.addImage({ data: imgData, x: 0, y: 0, w: '100%', h: '100%' });
        }

        // Generate PPTX Blob
        const output = await pptx.write('blob');
        pptxBlob = output;

        processingState.style.display = 'none';
        successState.style.display = 'block';

        saveToHistory(pdfData.name, 'PDF to PPT');

    } catch (err) {
        console.error('PPT conversion error:', err);
        alert('Magic failed! PPT conversion error: ' + err.message);
        processingState.style.display = 'none';
        fileReadyContainer.style.display = 'block';
    }
};

downloadBtn.onclick = () => {
    if (!pptxBlob) return;
    const url = URL.createObjectURL(pptxBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pdfData.name.replace('.pdf', '.pptx');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
