// Magic Redactor (Privacy Pro) - Core Logic (Robust Version)
import { PDFDocument, rgb } from 'pdf-lib';

// Global State
let pdfData = null;
let pdfDoc = null;
let pdfDocLib = null;
let redactions = [];
let redaactionMode = 'blur';

// Elements
const fileInput = document.getElementById('file-input');
const pdfContainer = document.getElementById('pdf-container');
const redactionList = document.getElementById('redaction-list');
const saveBtn = document.getElementById('save-btn');
const clearAllBtn = document.getElementById('clear-all');
const modeBtns = document.querySelectorAll('.mode-btn');

// Init PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// Mode Switching
modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        redactionMode = btn.dataset.mode;
        console.log('Mode set to:', redaactionMode);
    });
});

clearAllBtn.onclick = () => {
    redactions = [];
    updateUI();
};

// File Upload
fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        pdfContainer.innerHTML = '<div style="margin-top: 10rem;"><h3>Loading Document...</h3><p>Preparing professional privacy tools.</p></div>';
        pdfData = await file.arrayBuffer();

        // Load for preview (using copy to prevent detachment)
        pdfDoc = await pdfjsLib.getDocument({ data: pdfData.slice(0) }).promise;
        // Load for processing
        pdfDocLib = await PDFDocument.load(pdfData);

        renderPages();
    } catch (err) {
        console.error('Core Load Error:', err);
        alert('Error loading PDF. Please ensure it is not password protected or corrupted.');
        pdfContainer.innerHTML = '<h3>Failed to load document.</h3>';
    }
};

async function renderPages() {
    pdfContainer.innerHTML = '';
    console.log('Pages to render:', pdfDoc.numPages);

    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });

        const wrapper = document.createElement('div');
        wrapper.className = 'page-container';
        wrapper.style.cssText = `width: ${viewport.width}px; height: ${viewport.height}px;`;

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

        const layer = document.createElement('div');
        layer.className = 'redaction-layer';
        layer.id = `page-layer-${i}`;

        const dragBox = document.createElement('div');
        dragBox.className = 'drag-box';

        wrapper.appendChild(canvas);
        wrapper.appendChild(layer);
        wrapper.appendChild(dragBox);
        pdfContainer.appendChild(wrapper);

        setupInteraction(wrapper, dragBox, i, viewport);
    }
    updateUI();
}

function setupInteraction(wrapper, dragBox, pageNum, viewport) {
    wrapper.onmousedown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();

        const rect = wrapper.getBoundingClientRect();
        const startX = e.clientX - rect.left;
        const startY = e.clientY - rect.top;

        dragBox.style.display = 'block';
        dragBox.style.left = startX + 'px';
        dragBox.style.top = startY + 'px';
        dragBox.style.width = '0px';
        dragBox.style.height = '0px';

        const moveHandler = (me) => {
            const curX = me.clientX - rect.left;
            const curY = me.clientY - rect.top;

            const w = curX - startX;
            const h = curY - startY;

            dragBox.style.width = Math.abs(w) + 'px';
            dragBox.style.height = Math.abs(h) + 'px';
            dragBox.style.left = (w > 0 ? startX : curX) + 'px';
            dragBox.style.top = (h > 0 ? startY : curY) + 'px';
        };

        const upHandler = () => {
            window.removeEventListener('mousemove', moveHandler);
            window.removeEventListener('mouseup', upHandler);

            const fw = parseFloat(dragBox.style.width);
            const fh = parseFloat(dragBox.style.height);

            if (fw > 5 && fh > 5) {
                const newRedaction = {
                    page: pageNum,
                    x: parseFloat(dragBox.style.left),
                    y: parseFloat(dragBox.style.top),
                    w: fw,
                    h: fh,
                    mode: redaactionMode,
                    canvasW: viewport.width,
                    canvasH: viewport.height
                };
                redactions.push(newRedaction);
                console.log('Action recorded:', newRedaction);
                updateUI();
            }
            dragBox.style.display = 'none';
        };

        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('mouseup', upHandler);
    };
}

function updateUI() {
    console.log('Syncing UI... Current redactions:', redactions.length);

    // 1. Clear Page Layers
    document.querySelectorAll('.redaction-layer').forEach(l => l.innerHTML = '');

    // 2. Clear & Update Sidebar
    if (redactions.length === 0) {
        redactionList.innerHTML = '<p style="text-align: center; color: #555; font-size: 0.8rem; margin-top: 3rem;">Click & drag on doc to redact</p>';
        saveBtn.disabled = true;
        saveBtn.textContent = 'Apply & Download';
    } else {
        redactionList.innerHTML = '';
        saveBtn.disabled = false;
        saveBtn.textContent = `Apply & Download (${redactions.length})`;

        redactions.forEach((r, idx) => {
            // Draw Box on Page
            const layer = document.getElementById(`page-layer-${r.page}`);
            if (layer) {
                const box = document.createElement('div');
                Object.assign(box.style, {
                    position: 'absolute',
                    left: `${r.x}px`,
                    top: `${r.y}px`,
                    width: `${r.w}px`,
                    height: `${r.h}px`,
                    pointerEvents: 'none',
                    zIndex: '1000'
                });

                if (r.mode === 'blur') {
                    box.style.background = 'rgba(124, 77, 255, 0.2)';
                    box.style.backdropFilter = 'blur(15px)';
                    box.style.webkitBackdropFilter = 'blur(15px)';
                    box.style.border = '2px solid #7c4dff';
                    box.style.boxShadow = '0 0 15px rgba(124, 77, 255, 0.4)';
                } else {
                    box.style.background = '#000';
                    box.style.border = '1px solid #444';
                }
                layer.appendChild(box);
            }

            // Create Sidebar Item
            const item = document.createElement('div');
            item.className = 'undo-item';
            item.style.animation = 'fadeInUp 0.3s ease-out forwards';
            item.innerHTML = `
                <span>P${r.page}: ${r.mode}</span>
                <button onclick="window.removeRedaction(${idx})">✕</button>
            `;
            redactionList.appendChild(item);
        });
    }
}

// Global removal function
window.removeRedaction = (i) => {
    redactions.splice(i, 1);
    updateUI();
};

// Process & Download
saveBtn.onclick = async () => {
    if (!pdfData || redactions.length === 0) return;

    try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Securing Data...';

        const cleanDoc = await PDFDocument.load(pdfData);
        const pages = cleanDoc.getPages();
        for (const r of redactions) {
            const page = pages[r.page - 1];
            const { width, height } = page.getSize();
            const rotation = page.getRotation().angle;

            console.log(`Page ${r.page} size: ${width}x${height}, rotation: ${rotation}`);

            const scaleX = width / r.canvasW;
            const scaleY = height / r.canvasH;

            // PDF origin is bottom-left. Canvas origin is top-left.
            const x = r.x * scaleX;
            const y = height - (r.y * scaleY) - (r.h * scaleY);
            const w = r.w * scaleX;
            const h = r.h * scaleY;

            console.log(`Mapped [${r.x},${r.y},${r.w},${r.h}] to [${x},${y},${w},${h}]`);

            if (r.mode === 'blackout') {
                page.drawRectangle({ x, y, width: w, height: h, color: rgb(0, 0, 0) });
            } else {
                // Heavier opaque blur simulation for PDF
                // Real blur requires image manipulation, but for now we use strong opaque blocks
                page.drawRectangle({
                    x, y, width: w, height: h,
                    color: rgb(0.95, 0.95, 0.95),
                    opacity: 0.9 // Very high opacity to ensure text is covered
                });
                // Add some 'noise' rectangles for better obscuring
                for (let j = 0; j < 3; j++) {
                    page.drawRectangle({
                        x, y, width: w, height: h,
                        color: rgb(0.8, 0.8, 0.8),
                        opacity: 0.1
                    });
                }
            }
        }

        const bytes = await cleanDoc.save();
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `redacted_doc_${Date.now()}.pdf`;
        link.click();

        saveBtn.textContent = 'Success!';
        setTimeout(() => updateUI(), 2000);
    } catch (err) {
        console.error('Save Failure:', err);
        alert('Could not save PDF: ' + err.message);
        updateUI();
    }
};
