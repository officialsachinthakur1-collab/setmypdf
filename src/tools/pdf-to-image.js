// PDF to Image Logic using pdf.js
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileReadyContainer = document.getElementById('file-ready-container');
const fileNameDisplay = document.getElementById('selected-file-name');
const pageCountBadge = document.getElementById('page-count-badge');
const convertBtn = document.getElementById('convert-btn');
const processingState = document.getElementById('processing-state');
const successState = document.getElementById('success-state');
const downloadList = document.getElementById('download-list');

let selectedFile = null;
let pdfDoc = null;

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

// Initialize PDF.js worker
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

async function handleFile(file) {
    if (!file || file.type !== 'application/pdf') {
        alert('Please select a valid PDF file.');
        return;
    }
    selectedFile = file;

    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        pdfDoc = await loadingTask.promise;

        fileNameDisplay.textContent = file.name;
        pageCountBadge.textContent = `${pdfDoc.numPages} Pages`;

        dropZone.hidden = true;
        fileReadyContainer.hidden = false;
        successState.hidden = true;
    } catch (error) {
        console.error('Error loading PDF with pdf.js:', error);
        alert('Could not read PDF file.');
    }
}

// Conversion Logic
convertBtn.addEventListener('click', async () => {
    if (!pdfDoc) return;

    fileReadyContainer.hidden = true;
    processingState.hidden = false;

    try {
        downloadList.innerHTML = '';
        const scale = 2; // High quality scale

        const progressBar = document.getElementById('pdf-image-progress-bar');
        const progressText = document.getElementById('pdf-image-progress-text');

        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.innerText = '0%';

        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport }).promise;

            const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);

            // Create Download Item for each page
            const card = document.createElement('div');
            card.className = 'file-card';
            card.style.margin = '0.5rem 0';
            card.innerHTML = `
                <div class="file-card-info">
                    <span class="file-icon">🖼️</span>
                    <span class="file-name">Page ${i}.jpg</span>
                </div>
                <a href="${imageDataUrl}" download="Page_${i}.jpg" class="secondary-btn" style="padding: 0.4rem 1rem; font-size: 0.8rem; text-decoration: none;">Download</a>
            `;
            downloadList.appendChild(card);

            const percent = Math.round((i / pdfDoc.numPages) * 100);
            if (progressBar) progressBar.style.width = percent + '%';
            if (progressText) progressText.innerText = percent + '%';
        }

        saveToHistory(selectedFile.name, 'PDF to Image');

        processingState.hidden = true;
        successState.hidden = false;
        lucide.createIcons();
    } catch (error) {
        console.error('Error rendering PDF pages:', error);
        alert('An error occurred during conversion.');
        processingState.hidden = true;
        fileReadyContainer.hidden = false;
    }
});
