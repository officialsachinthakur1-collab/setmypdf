import { PDFDocument, degrees } from 'pdf-lib';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const rotateConfigContainer = document.getElementById('rotate-config-container');
const fileNameDisplay = document.getElementById('selected-file-name');
const rotateBtn = document.getElementById('rotate-btn');
const processingState = document.getElementById('processing-state');
const successState = document.getElementById('success-state');
const downloadBtn = document.getElementById('download-btn');
const rotateOptions = document.querySelectorAll('.rotate-option');
const currentSelectionText = document.getElementById('current-selection');

let selectedFile = null;
let rotatedBlobUrl = null;
let rotationDegrees = 0;

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
    fileNameDisplay.textContent = file.name;

    dropZone.hidden = true;
    rotateConfigContainer.hidden = false;
    successState.hidden = true;
}

// Rotation Degree Selection
rotateOptions.forEach(btn => {
    btn.addEventListener('click', () => {
        // Reset others
        rotateOptions.forEach(b => b.style.borderColor = 'var(--glass-border)');

        rotationDegrees = parseInt(btn.dataset.degree);
        btn.style.borderColor = 'var(--accent-color)';
        currentSelectionText.textContent = `Selected: ${rotationDegrees}° Clockwise`;
    });
});

// Rotate Logic
rotateBtn.addEventListener('click', async () => {
    if (rotationDegrees === 0) {
        alert('Please select a rotation degree.');
        return;
    }

    rotateConfigContainer.hidden = true;
    processingState.hidden = false;

    try {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();

        pages.forEach((page) => {
            const currentRotation = page.getRotation().angle;
            page.setRotation(degrees(currentRotation + rotationDegrees));
        });

        const rotatedPdfBytes = await pdfDoc.save();

        const blob = new Blob([rotatedPdfBytes], { type: 'application/pdf' });
        if (rotatedBlobUrl) URL.revokeObjectURL(rotatedBlobUrl);
        rotatedBlobUrl = URL.createObjectURL(blob);

        saveToHistory(selectedFile.name, 'Rotate PDF');

        processingState.hidden = true;
        successState.hidden = false;
        lucide.createIcons();
    } catch (error) {
        console.error('Error rotating PDF:', error);
        alert('An error occurred while rotating the PDF.');
        processingState.hidden = true;
        rotateConfigContainer.hidden = false;
    }
});

downloadBtn.addEventListener('click', () => {
    if (rotatedBlobUrl) {
        const a = document.createElement('a');
        a.href = rotatedBlobUrl;
        a.download = `rotated-${selectedFile.name}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
});
