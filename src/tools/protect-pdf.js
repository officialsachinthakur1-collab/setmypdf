import { PDFDocument } from 'pdf-lib';
import { encryptPDF } from '../lib/pdf-encrypt-lite/index.js';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const setupContainer = document.getElementById('setup-container');
const selectedFileName = document.getElementById('selected-file-name');
const changeFileBtn = document.getElementById('change-file-btn');
const pdfPassword = document.getElementById('pdf-password');
const togglePassword = document.getElementById('toggle-password');
const protectBtn = document.getElementById('protect-btn');
const processingState = document.getElementById('processing-state');
const successState = document.getElementById('success-state');
const downloadBtn = document.getElementById('download-btn');

let selectedFile = null;
let protectedBlobUrl = null;

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

changeFileBtn.addEventListener('click', () => {
    selectedFile = null;
    dropZone.hidden = false;
    setupContainer.hidden = true;
    fileInput.value = '';
});

function handleFile(file) {
    if (file && file.type === 'application/pdf') {
        selectedFile = file;
        selectedFileName.textContent = file.name;
        dropZone.hidden = true;
        setupContainer.hidden = false;
        successState.hidden = true;
        pdfPassword.value = '';
    }
}

// Password Visibility Toggle
togglePassword.addEventListener('click', () => {
    const type = pdfPassword.type === 'password' ? 'text' : 'password';
    pdfPassword.type = type;
    const icon = type === 'password' ? 'eye' : 'eye-off';
    togglePassword.innerHTML = `<i data-lucide="${icon}" style="width: 20px;"></i>`;
    lucide.createIcons();
});

// Protection Logic
protectBtn.addEventListener('click', async () => {
    const password = pdfPassword.value;
    if (!password) {
        alert('Please enter a password to protect the PDF.');
        return;
    }

    setupContainer.hidden = true;
    processingState.hidden = false;

    try {
        const arrayBuffer = await selectedFile.arrayBuffer();

        // Try to load. If it's already encrypted, pdf-lib usually throws an error
        let pdfDoc;
        try {
            pdfDoc = await PDFDocument.load(arrayBuffer);
        } catch (loadError) {
            if (loadError.message.toLowerCase().includes('password') || loadError.message.toLowerCase().includes('encrypted')) {
                throw new Error('This PDF is already password protected.');
            }
            throw loadError;
        }

        // Apply encryption using the local lite library
        const pdfBytes = new Uint8Array(arrayBuffer);
        const protectedBytes = await encryptPDF(pdfBytes, password);

        const blob = new Blob([protectedBytes], { type: 'application/pdf' });
        if (protectedBlobUrl) URL.revokeObjectURL(protectedBlobUrl);
        protectedBlobUrl = URL.createObjectURL(blob);

        saveToHistory(selectedFile.name, 'Secure PDF');

        processingState.hidden = true;
        successState.hidden = false;
        lucide.createIcons();

    } catch (error) {
        console.error('Error protecting PDF:', error);
        alert('An error occurred while protecting your PDF. Please try again.');
        processingState.hidden = true;
        setupContainer.hidden = false;
    }
});

downloadBtn.addEventListener('click', () => {
    if (protectedBlobUrl) {
        const a = document.createElement('a');
        a.href = protectedBlobUrl;
        a.download = `protected-${selectedFile.name}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
});
