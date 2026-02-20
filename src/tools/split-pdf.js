import { PDFDocument } from 'pdf-lib';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const splitConfigContainer = document.getElementById('split-config-container');
const fileNameDisplay = document.getElementById('selected-file-name');
const pageCountBadge = document.getElementById('page-count-badge');
const splitBtn = document.getElementById('split-btn');
const pageRangeInput = document.getElementById('page-range');
const processingState = document.getElementById('processing-state');
const successState = document.getElementById('success-state');
const downloadBtn = document.getElementById('download-btn');

let selectedFile = null;
let mergedBlobUrl = null;
let totalPages = 0;

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
fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-active');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-active');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-active');
    handleFile(e.dataTransfer.files[0]);
});

async function handleFile(file) {
    if (!file || file.type !== 'application/pdf') {
        alert('Please select a valid PDF file.');
        return;
    }
    selectedFile = file;

    // Load PDF to get page count
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        totalPages = pdf.getPageCount();

        fileNameDisplay.textContent = file.name;
        pageCountBadge.textContent = `${totalPages} Pages`;

        dropZone.hidden = true;
        splitConfigContainer.hidden = false;
        successState.hidden = true;
    } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Could not read PDF file.');
    }
}

// Helper: Parse page ranges (e.g., "1, 3-5, 8")
function parsePageRanges(input, maxPages) {
    const pages = new Set();
    const parts = input.split(',').map(p => p.trim());

    for (const part of parts) {
        if (/^\d+$/.test(part)) {
            const p = parseInt(part);
            if (p >= 1 && p <= maxPages) pages.add(p - 1);
        } else if (/^\d+-\d+$/.test(part)) {
            const [start, end] = part.split('-').map(p => parseInt(p));
            const s = Math.min(start, end);
            const e = Math.max(start, end);
            for (let i = s; i <= e; i++) {
                if (i >= 1 && i <= maxPages) pages.add(i - 1);
            }
        }
    }
    return Array.from(pages).sort((a, b) => a - b);
}

// Split Logic
splitBtn.addEventListener('click', async () => {
    const rangeInput = pageRangeInput.value.trim();
    if (!rangeInput) {
        alert('Please specify pages to extract.');
        return;
    }

    const pageIndices = parsePageRanges(rangeInput, totalPages);
    if (pageIndices.length === 0) {
        alert('No valid pages found in the range specified.');
        return;
    }

    splitConfigContainer.hidden = true;
    processingState.hidden = false;

    try {
        const sourceArrayBuffer = await selectedFile.arrayBuffer();
        const sourcePdf = await PDFDocument.load(sourceArrayBuffer);

        const splitPdf = await PDFDocument.create();

        const progressBar = document.getElementById('split-progress-bar');
        const progressText = document.getElementById('split-progress-text');

        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.innerText = '0%';

        let completed = 0;
        const totalToCopy = pageIndices.length;

        for (const index of pageIndices) {
            const [copiedPage] = await splitPdf.copyPages(sourcePdf, [index]);
            splitPdf.addPage(copiedPages);

            completed++;
            const percent = Math.round((completed / totalToCopy) * 100);
            if (progressBar) progressBar.style.width = percent + '%';
            if (progressText) progressText.innerText = percent + '%';
        }

        const splitPdfBytes = await splitPdf.save();

        const blob = new Blob([splitPdfBytes], { type: 'application/pdf' });
        if (mergedBlobUrl) URL.revokeObjectURL(mergedBlobUrl);
        mergedBlobUrl = URL.createObjectURL(blob);

        saveToHistory(selectedFile.name, 'Split PDF');

        processingState.hidden = true;
        successState.hidden = false;
        lucide.createIcons();
    } catch (error) {
        console.error('Error splitting PDF:', error);
        alert('An error occurred while splitting the PDF.');
        processingState.hidden = true;
        splitConfigContainer.hidden = false;
    }
});

downloadBtn.addEventListener('click', () => {
    if (mergedBlobUrl) {
        const a = document.createElement('a');
        a.href = mergedBlobUrl;
        a.download = `extracted-pages-${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
});
