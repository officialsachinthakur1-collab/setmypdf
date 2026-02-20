const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileReadyContainer = document.getElementById('file-ready-container');
const processingState = document.getElementById('processing-state');
const successState = document.getElementById('success-state');
const convertBtn = document.getElementById('convert-btn');
const downloadBtn = document.getElementById('download-btn');
const previewContainer = document.getElementById('preview-hidden');

let excelData = null;
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

fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        excelData = file;
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
    if (!excelData) return;

    try {
        fileReadyContainer.style.display = 'none';
        processingState.style.display = 'block';

        const data = await excelData.arrayBuffer();
        const workbook = XLSX.read(data);

        let fullHtml = '';
        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const html = XLSX.utils.sheet_to_html(worksheet);
            fullHtml += `<h2 style="color: #217346; border-bottom: 2px solid #217346; padding-bottom: 10px;">${sheetName}</h2>${html}<hr style="margin: 30px 0;">`;
        });

        previewContainer.innerHTML = `
            <style>
                table { border-collapse: collapse; width: 100%; margin-bottom: 20px; font-family: sans-serif; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
            </style>
            <div style="padding: 20px;">
                <h1 style="text-align: center; color: #333;">Excel Export</h1>
                ${fullHtml}
            </div>
        `;
        previewContainer.style.display = 'block';

        const opt = {
            margin: 0.5,
            filename: excelData.name.replace(/\.[^/.]+$/, "") + ".pdf",
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
        };

        const pdfWorker = html2pdf().from(previewContainer).set(opt);
        pdfBlob = await pdfWorker.output('blob');

        previewContainer.style.display = 'none';
        processingState.style.display = 'none';
        successState.style.display = 'block';

        saveToHistory(excelData.name, 'Excel to PDF');

    } catch (err) {
        console.error('Excel conversion error:', err);
        alert('Magic failed! Excel conversion error: ' + err.message);
        processingState.style.display = 'none';
        fileReadyContainer.style.display = 'block';
    }
};

downloadBtn.onclick = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = excelData.name.replace(/\.[^/.]+$/, "") + ".pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
