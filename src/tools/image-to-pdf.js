import { PDFDocument } from 'pdf-lib';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileListContainer = document.getElementById('file-list-container');
const imageGrid = document.getElementById('image-grid');
const convertBtn = document.getElementById('convert-btn');
const addMoreBtn = document.getElementById('add-more-btn');
const processingState = document.getElementById('processing-state');
const successState = document.getElementById('success-state');
const downloadBtn = document.getElementById('download-btn');

let selectedFiles = [];
let pdfBlobUrl = null;

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
    const newFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    selectedFiles = [...selectedFiles, ...newFiles];
    updateImageGrid();
}

function updateImageGrid() {
    if (selectedFiles.length > 0) {
        dropZone.hidden = true;
        fileListContainer.hidden = false;
        successState.hidden = true;

        imageGrid.innerHTML = '';
        selectedFiles.forEach((file, index) => {
            const card = document.createElement('div');
            card.className = 'file-card';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'center';
            card.style.padding = '1rem';

            const reader = new FileReader();
            reader.onload = (e) => {
                card.innerHTML = `
                    <img src="${e.target.result}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 8px; margin-bottom: 0.8rem;">
                    <div style="width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.75rem; text-align: center;">${file.name}</div>
                    <button class="remove-btn" data-index="${index}" style="margin-top: 0.5rem;">✕</button>
                `;
            };
            reader.readAsDataURL(file);

            imageGrid.appendChild(card);
        });

        // Use event delegation for remove buttons as images load asynchronously
        imageGrid.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-btn')) {
                const index = parseInt(e.target.dataset.index);
                selectedFiles.splice(index, 1);
                updateImageGrid();
            }
        });
    } else {
        dropZone.hidden = false;
        fileListContainer.hidden = true;
    }
}

// Convert Logic
convertBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) {
        alert('Please select at least one image.');
        return;
    }

    fileListContainer.hidden = true;
    processingState.hidden = false;

    try {
        const pdfDoc = await PDFDocument.create();

        const progressBar = document.getElementById('image-pdf-progress-bar');
        const progressText = document.getElementById('image-pdf-progress-text');

        let completed = 0;
        const total = selectedFiles.length;

        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.innerText = '0%';

        for (const file of selectedFiles) {
            const arrayBuffer = await file.arrayBuffer();
            let image;

            if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
                image = await pdfDoc.embedJpg(arrayBuffer);
            } else if (file.type === 'image/png') {
                image = await pdfDoc.embedPng(arrayBuffer);
            } else {
                continue; // Skip unsupported formats
            }

            const page = pdfDoc.addPage([image.width, image.height]);
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: image.width,
                height: image.height,
            });

            completed++;
            const percent = Math.round((completed / total) * 100);
            if (progressBar) progressBar.style.width = percent + '%';
            if (progressText) progressText.innerText = percent + '%';
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });

        if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
        pdfBlobUrl = URL.createObjectURL(blob);

        const docName = selectedFiles.length === 1 ? selectedFiles[0].name : `${selectedFiles.length} Images`;
        saveToHistory(docName, 'Image to PDF');

        processingState.hidden = true;
        successState.hidden = false;
        lucide.createIcons();
    } catch (error) {
        console.error('Error creating PDF from images:', error);
        alert('An error occurred during PDF creation.');
        processingState.hidden = true;
        fileListContainer.hidden = false;
    }
});

downloadBtn.addEventListener('click', () => {
    if (pdfBlobUrl) {
        const a = document.createElement('a');
        a.href = pdfBlobUrl;
        a.download = `images-to-pdf-${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
});
