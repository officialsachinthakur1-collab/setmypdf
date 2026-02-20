// ID Card Magic - Core Logic
// Integrated with PDF.js for rendering and Canvas for cropping

const fileInput = document.getElementById('file-input');
const pdfCropper = document.getElementById('pdf-cropper');
const pdfCanvasContainer = document.getElementById('pdf-canvas-container');
const cropperStatus = document.getElementById('cropper-status');
const confirmCropBtn = document.getElementById('confirm-crop');
const cancelCropBtn = document.getElementById('cancel-crop');
const exportBtn = document.getElementById('export-btn');
const cardFront = document.getElementById('card-front');
const cardBack = document.getElementById('card-back');
const templateBtns = document.querySelectorAll('.template-btn');

const labelFront = document.getElementById('label-front');
const labelBack = document.getElementById('label-back');

let currentTemplate = 'aadhar';
let pdfDoc = null;
let currentCropTarget = 'front'; // 'front' or 'back'
let capturedCrops = { front: null, back: null };

// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// Selection state
let isSelecting = false;
let selectionStart = { x: 0, y: 0 };
let activeSelectionBox = null;
let activeCanvas = null;

// Template Handling
templateBtns.forEach(btn => {
    btn.onclick = () => {
        templateBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTemplate = btn.dataset.template;
        updateUI();
    };
});

// File Handling
fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        openCropper();
    } catch (err) {
        if (err.name === 'PasswordException') {
            const password = prompt('This PDF is password protected. Please enter the password:');
            if (password) {
                try {
                    pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer, password }).promise;
                    openCropper();
                } catch (innerErr) {
                    alert('Incorrect password.');
                }
            }
        } else {
            alert('Failed to load PDF: ' + err.message);
        }
    }
};

async function openCropper() {
    pdfCanvasContainer.innerHTML = '';
    pdfCropper.style.display = 'flex';
    currentCropTarget = 'front';
    updateCropperStatus();

    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // High res for cropping

        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'page-item';

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const selectionBox = document.createElement('div');
        selectionBox.className = 'selection-box';

        pageWrapper.appendChild(canvas);
        pageWrapper.appendChild(selectionBox);
        pdfCanvasContainer.appendChild(pageWrapper);

        await page.render({ canvasContext: context, viewport }).promise;

        // Interaction Logic
        pageWrapper.onmousedown = (e) => startSelection(e, canvas, selectionBox);
    }
}

function startSelection(e, canvas, selectionBox) {
    isSelecting = true;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    selectionStart = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
        rawX: e.clientX - rect.left,
        rawY: e.clientY - rect.top
    };

    activeCanvas = canvas;
    activeSelectionBox = selectionBox;

    // Reset other boxes
    document.querySelectorAll('.selection-box').forEach(box => {
        if (box !== selectionBox) box.style.display = 'none';
    });

    selectionBox.style.display = 'block';
    selectionBox.style.left = selectionStart.rawX + 'px';
    selectionBox.style.top = selectionStart.rawY + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';

    window.onmousemove = (moveEvent) => updateSelection(moveEvent, rect);
    window.onmouseup = endSelection;
}

function updateSelection(e, rect) {
    if (!isSelecting) return;

    const currentX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const currentY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const width = currentX - selectionStart.rawX;
    const height = currentY - selectionStart.rawY;

    activeSelectionBox.style.width = Math.abs(width) + 'px';
    activeSelectionBox.style.height = Math.abs(height) + 'px';
    activeSelectionBox.style.left = (width > 0 ? selectionStart.rawX : currentX) + 'px';
    activeSelectionBox.style.top = (height > 0 ? selectionStart.rawY : currentY) + 'px';

    confirmCropBtn.disabled = false;
}

function endSelection() {
    isSelecting = false;
    window.onmousemove = null;
    window.onmouseup = null;
}

confirmCropBtn.onclick = () => {
    if (!activeCanvas || !activeSelectionBox) return;

    const boxRect = activeSelectionBox.getBoundingClientRect();
    const canvasRect = activeCanvas.getBoundingClientRect();

    // Calculate coordinates on the internal 2x scale canvas
    const scale = activeCanvas.width / canvasRect.width;

    const cropX = (boxRect.left - canvasRect.left) * scale;
    const cropY = (boxRect.top - canvasRect.top) * scale;
    const cropW = boxRect.width * scale;
    const cropH = boxRect.height * scale;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cropW;
    tempCanvas.height = cropH;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(activeCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const dataUrl = tempCanvas.toDataURL('image/png');

    if (currentCropTarget === 'front') {
        capturedCrops.front = dataUrl;
        cardFront.innerHTML = `<img src="${dataUrl}" style="width:100%; height:100%; object-fit:cover;">`;
        labelFront.innerHTML = 'Front: <span style="color:#00c853;">Captured</span>';

        // Ask for back or Done
        if (confirm('Front side captured! Do you want to capture the Back side?')) {
            currentCropTarget = 'back';
            updateCropperStatus();
            confirmCropBtn.disabled = true;
            activeSelectionBox.style.display = 'none';
        } else {
            closeCropper();
        }
    } else {
        capturedCrops.back = dataUrl;
        cardBack.innerHTML = `<img src="${dataUrl}" style="width:100%; height:100%; object-fit:cover;">`;
        labelBack.innerHTML = 'Back: <span style="color:#00c853;">Captured</span>';
        closeCropper();
    }

    checkReady();
};

function updateCropperStatus() {
    cropperStatus.innerHTML = `Selecting: <b style="color:#00c853;">${currentCropTarget === 'front' ? 'Front Side' : 'Back Side'}</b>`;
}

function closeCropper() {
    pdfCropper.style.display = 'none';
    document.getElementById('capture-status').style.display = 'block';
}

cancelCropBtn.onclick = () => {
    pdfCropper.style.display = 'none';
};

function checkReady() {
    if (capturedCrops.front) {
        exportBtn.disabled = false;
    }
}

function updateUI() {
    // Reset if needed, or update aspect ratios in CSS if necessary
}

// Export Results
exportBtn.onclick = async () => {
    // Basic export: Create a single image with both sides or separate
    // In a real app, we'd generate a 4x6 PDF as well.
    const combinedCanvas = document.createElement('canvas');

    // Standard Card Size is 85.6 x 54mm. At 300DPI, that's ~1011 x 638px
    const cardW = 1011;
    const cardH = 638;

    combinedCanvas.width = cardW;
    combinedCanvas.height = cardH * (capturedCrops.back ? 2 : 1) + (capturedCrops.back ? 50 : 0);
    const ctx = combinedCanvas.getContext('2d');
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);

    const drawSide = (imgSrc, yOffset) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, yOffset, cardW, cardH);
                resolve();
            };
            img.src = imgSrc;
        });
    };

    await drawSide(capturedCrops.front, 0);
    if (capturedCrops.back) {
        await drawSide(capturedCrops.back, cardH + 50);
    }

    const link = document.createElement('a');
    link.download = `pdfmagic-id-card-${currentTemplate}.png`;
    link.href = combinedCanvas.toDataURL('image/png', 1.0);
    link.click();
};
