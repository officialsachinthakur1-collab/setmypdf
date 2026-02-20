import { PDFDocument } from 'pdf-lib';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileReadyContainer = document.getElementById('file-ready-container');
const fileNameDisplay = document.getElementById('selected-file-name');
const originalSizeBadge = document.getElementById('original-size-badge');
const compressBtn = document.getElementById('compress-btn');
const processingState = document.getElementById('processing-state');
const successState = document.getElementById('success-state');
const downloadBtn = document.getElementById('download-btn');
const savingsText = document.getElementById('savings-text');
const newSizeDisplay = document.getElementById('new-size-display');

let selectedFile = null;
let compressedBlobUrl = null;

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

// Initialize PDF.js worker for rendering
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

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

function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function handleFile(file) {
    if (!file || file.type !== 'application/pdf') {
        alert('Please select a valid PDF file.');
        return;
    }
    selectedFile = file;

    fileNameDisplay.textContent = file.name;
    originalSizeBadge.textContent = formatSize(file.size);

    dropZone.hidden = true;
    fileReadyContainer.hidden = false;
    successState.hidden = true;
}

/**
 * Aggressive Compression (Flattening Method)
 * Since client-side compression without a native engine is limited, 
 * we use the 'Flatten' approach:
 * 1. Render each page to an image using pdf.js at a moderate resolution.
 * 2. Compress those images as JPEGs.
 * 3. Re-assemble as a new PDF using pdf-lib.
 * Result: Massive size reduction (at the cost of selectable text).
 */
compressBtn.addEventListener('click', async () => {
    fileReadyContainer.hidden = true;
    processingState.hidden = false;

    try {
        const arrayBuffer = await selectedFile.arrayBuffer();

        // Load document for rendering
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdfJS = await loadingTask.promise;
        const totalPages = pdfJS.numPages;

        // Create new PDF for output
        const outPdf = await PDFDocument.create();

        // Compression settings
        const scale = 1.25; // Good balance between readability and size
        const quality = 0.5; // Medium JPEG quality

        const progressBar = document.getElementById('compress-progress-bar');
        const progressText = document.getElementById('compress-progress-text');

        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.innerText = '0%';

        for (let i = 1; i <= totalPages; i++) {
            const page = await pdfJS.getPage(i);
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport }).promise;

            // Convert to compressed JPEG data URL
            const imageDataUrl = canvas.toDataURL('image/jpeg', quality);
            const imageBytes = await fetch(imageDataUrl).then(res => res.arrayBuffer());

            const image = await outPdf.embedJpg(imageBytes);
            const newPage = outPdf.addPage([image.width, image.height]);
            newPage.drawImage(image, {
                x: 0,
                y: 0,
                width: image.width,
                height: image.height,
            });

            const percent = Math.round((i / totalPages) * 100);
            if (progressBar) progressBar.style.width = percent + '%';
            if (progressText) progressText.innerText = percent + '%';
        }

        const compressedPdfBytes = await outPdf.save();
        const compressedSize = compressedPdfBytes.length;

        // Calculate real savings
        let savings = Math.round(((selectedFile.size - compressedSize) / selectedFile.size) * 100);
        if (savings < 0) savings = 0; // In case original was already super tiny

        const blob = new Blob([compressedPdfBytes], { type: 'application/pdf' });
        if (compressedBlobUrl) URL.revokeObjectURL(compressedBlobUrl);
        compressedBlobUrl = URL.createObjectURL(blob);

        savingsText.textContent = `Your file size has been reduced by ${savings}%.`;
        newSizeDisplay.textContent = formatSize(compressedSize);

        saveToHistory(selectedFile.name, 'Compress PDF');

        processingState.hidden = true;
        successState.hidden = false;
        lucide.createIcons();
    } catch (error) {
        console.error('Error during aggressive compression:', error);
        alert('Could not compress this specific PDF. It might be already highly optimized.');
        processingState.hidden = true;
        fileReadyContainer.hidden = false;
    }
});

downloadBtn.addEventListener('click', () => {
    if (compressedBlobUrl) {
        const a = document.createElement('a');
        a.href = compressedBlobUrl;
        a.download = `compressed-${selectedFile.name}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
});
