// PDF to Excel Logic
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileReadyContainer = document.getElementById('file-ready-container');
const processingState = document.getElementById('processing-state');
const successState = document.getElementById('success-state');
const convertBtn = document.getElementById('convert-btn');
const downloadBtn = document.getElementById('download-btn');

let pdfData = null;
let excelBlob = null;

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

        const wb = XLSX.utils.book_new();

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Simple heuristic: one row per text line detected
            let currentY = -1;
            let rows = [];
            let currentRow = [];

            // Sort by Y coordinate, then by X
            const items = textContent.items.sort((a, b) => {
                if (Math.abs(a.transform[5] - b.transform[5]) < 5) {
                    return a.transform[4] - b.transform[4];
                }
                return b.transform[5] - a.transform[5];
            });

            items.forEach(item => {
                if (currentY === -1 || Math.abs(item.transform[5] - currentY) > 5) {
                    if (currentRow.length > 0) rows.push(currentRow);
                    currentRow = [item.str];
                    currentY = item.transform[5];
                } else {
                    currentRow.push(item.str);
                }
            });
            if (currentRow.length > 0) rows.push(currentRow);

            const ws = XLSX.utils.aoa_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, `Page ${i}`);
        }

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        excelBlob = new Blob([wbout], { type: 'application/octet-stream' });

        processingState.style.display = 'none';
        successState.style.display = 'block';

        saveToHistory(pdfData.name, 'PDF to Excel');

    } catch (err) {
        console.error('Excel extraction error:', err);
        alert('Magic failed! Excel extraction error: ' + err.message);
        processingState.style.display = 'none';
        fileReadyContainer.style.display = 'block';
    }
};

downloadBtn.onclick = () => {
    if (!excelBlob) return;
    const url = URL.createObjectURL(excelBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pdfData.name.replace('.pdf', '.xlsx');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
