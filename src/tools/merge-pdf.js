import { PDFDocument } from 'pdf-lib';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileListContainer = document.getElementById('file-list-container');
const fileList = document.getElementById('file-list');
const mergeBtn = document.getElementById('merge-btn');
const addMoreBtn = document.getElementById('add-more-btn');
const processingState = document.getElementById('processing-state');
const successState = document.getElementById('success-state');
const downloadBtn = document.getElementById('download-btn');

let selectedFiles = [];
let mergedBlobUrl = null;

// Handle history saving for Recent Activity
function saveToHistory(filename, toolName) {
    try {
        const history = JSON.parse(localStorage.getItem('pdf_magic_history')) || [];
        // Prevent exact duplicates sequentially though not strictly required
        history.unshift({
            filename: filename,
            tool: toolName,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('pdf_magic_history', JSON.stringify(history.slice(0, 10))); // keep last 10
    } catch (e) { console.error('History save error', e); }
}

// Handle File Selection
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

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
    handleFiles(e.dataTransfer.files);
});

addMoreBtn.addEventListener('click', () => fileInput.click());

function handleFiles(files) {
    const newFiles = Array.from(files).filter(file => file.type === 'application/pdf');
    selectedFiles = [...selectedFiles, ...newFiles];
    updateFileList();
}

function updateFileList() {
    if (selectedFiles.length > 0) {
        dropZone.hidden = true;
        fileListContainer.hidden = false;
        successState.hidden = true;

        fileList.innerHTML = '';
        selectedFiles.forEach((file, index) => {
            const card = document.createElement('div');
            card.className = 'file-card';
            card.innerHTML = `
                <div class="file-card-info">
                    <span class="file-icon">📄</span>
                    <span class="file-name">${file.name}</span>
                </div>
                <button class="remove-btn" data-index="${index}">✕</button>
            `;
            fileList.appendChild(card);
        });

        // Add remove handlers
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                selectedFiles.splice(index, 1);
                updateFileList();
            });
        });
    } else {
        dropZone.hidden = false;
        fileListContainer.hidden = true;
        successState.hidden = true;
    }
}

// Merge Logic
mergeBtn.addEventListener('click', async () => {
    if (selectedFiles.length < 2) {
        alert('Please select at least 2 PDF files to merge.');
        return;
    }

    fileListContainer.hidden = true;
    processingState.hidden = false;

    try {
        const mergedPdf = await PDFDocument.create();
        const progressBar = document.getElementById('merge-progress-bar');
        const progressText = document.getElementById('merge-progress-text');

        let completed = 0;
        const total = selectedFiles.length;

        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.innerText = '0%';

        for (const file of selectedFiles) {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));

            completed++;
            const percent = Math.round((completed / total) * 100);
            if (progressBar) progressBar.style.width = percent + '%';
            if (progressText) progressText.innerText = percent + '%';
        }

        const mergedPdfBytes = await mergedPdf.save();

        // Prepare Blob URL but don't download yet
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        if (mergedBlobUrl) URL.revokeObjectURL(mergedBlobUrl);
        mergedBlobUrl = URL.createObjectURL(blob);

        // Save to Recent Activity
        const docName = selectedFiles.length === 2 ? `${selectedFiles[0].name} + 1 other` : `${selectedFiles.length} Merged Documents`;
        saveToHistory(docName, 'Merge PDF');

        // Update UI to Success State
        processingState.hidden = true;
        successState.hidden = false;
        lucide.createIcons(); // Re-initialize to render the success icon

    } catch (error) {
        console.error('Error merging PDFs:', error);
        alert('An error occurred while merging your PDFs. Please try again.');
        processingState.hidden = true;
        fileListContainer.hidden = false;
    }
});

// Download Handler
downloadBtn.addEventListener('click', () => {
    if (mergedBlobUrl) {
        const a = document.createElement('a');
        a.href = mergedBlobUrl;
        a.download = `merged-document-${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
});
