const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileReadyContainer = document.getElementById('file-ready-container');
const processingState = document.getElementById('processing-state');
const successState = document.getElementById('success-state');
const convertBtn = document.getElementById('convert-btn');
const downloadBtn = document.getElementById('download-btn');
const previewContainer = document.getElementById('preview-container');

let docxData = null;
let pdfBlob = null;

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

// Handle File Selection
fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.docx')) {
        docxData = file;
        document.getElementById('file-name').textContent = file.name;
        document.getElementById('file-size').textContent = (file.size / 1024).toFixed(1) + ' KB';
        dropZone.style.display = 'none';
        fileReadyContainer.style.display = 'block';
    } else {
        alert('Please select a valid .docx file.');
    }
};

// Drag & Drop
dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent-color)'; };
dropZone.ondragleave = () => { dropZone.style.borderColor = 'var(--glass-border)'; };
dropZone.ondrop = (e) => {
    e.preventDefault();
    fileInput.files = e.dataTransfer.files;
    fileInput.onchange({ target: fileInput });
};

// Convert Word to PDF
convertBtn.onclick = async () => {
    if (!docxData) return;

    try {
        fileReadyContainer.style.display = 'none';
        processingState.style.display = 'block';

        const arrayBuffer = await docxData.arrayBuffer();

        // Use Mammoth to convert Docx to HTML
        const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
        const html = result.value; // The generated HTML

        // Prepare preview for html2pdf
        previewContainer.innerHTML = `
            <div style="padding: 40px; color: #000; background: #fff; font-family: 'Times New Roman', serif;">
                ${html}
            </div>
        `;
        previewContainer.style.display = 'block';

        // Convert HTML to PDF using html2pdf.js
        const opt = {
            margin: 1,
            filename: docxData.name.replace('.docx', '.pdf'),
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        // Generate PDF
        const pdfWorker = html2pdf().from(previewContainer).set(opt);
        pdfBlob = await pdfWorker.output('blob');

        previewContainer.style.display = 'none';
        processingState.style.display = 'none';
        successState.style.display = 'block';

        saveToHistory(docxData.name, 'Word to PDF');

    } catch (err) {
        console.error('Conversion error:', err);
        alert('Magic failed! Conversion error: ' + err.message);
        processingState.style.display = 'none';
        fileReadyContainer.style.display = 'block';
    }
};

// Download
downloadBtn.onclick = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = docxData.name.replace('.docx', '.pdf');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
