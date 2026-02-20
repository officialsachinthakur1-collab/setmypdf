// PDF to Social Card Logic
const fileInput = document.getElementById('file-input');
const uploadSection = document.getElementById('upload-section');
const editorSection = document.getElementById('editor-section');
const pdfRenderContainer = document.getElementById('pdf-render-container');
const canvas = document.getElementById('social-canvas');
const ctx = canvas.getContext('2d');
const cardTextArea = document.getElementById('card-text');
const gradientSelector = document.getElementById('gradient-selector');
const fontBtns = document.querySelectorAll('.font-btn');
const downloadBtn = document.getElementById('download-btn');

let selectedFile = null;
let pdfDoc = null;
let currentFont = 'Outfit';
let currentGradient = { colors: ['#7c4dff', '#448aff'], name: 'Purple Night' };

// Premium Gradients
const gradients = [
    { colors: ['#7c4dff', '#448aff'], name: 'Purple Night' },
    { colors: ['#ff5252', '#7c4dff'], name: 'Sunset' },
    { colors: ['#00c6ff', '#0072ff'], name: 'Deep Sea' },
    { colors: ['#f83600', '#f9d423'], name: 'Fire' },
    { colors: ['#2af598', '#009efd'], name: 'Aqua' },
    { colors: ['#b224ef', '#7579ff'], name: 'Galaxy' },
    { colors: ['#0d0f14', '#2d3436'], name: 'Solid Dark' },
    { colors: ['#6a11cb', '#2575fc'], name: 'Oceanic' }
];

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Populate Gradients
gradients.forEach((g, idx) => {
    const opt = document.createElement('div');
    opt.className = `gradient-opt ${idx === 0 ? 'active' : ''}`;
    opt.style.background = `linear-gradient(135deg, ${g.colors[0]}, ${g.colors[1]})`;
    opt.onclick = () => {
        document.querySelectorAll('.gradient-opt').forEach(el => el.classList.remove('active'));
        opt.classList.add('active');
        currentGradient = g;
        drawCard();
    };
    gradientSelector.appendChild(opt);
});

// Font Switching
fontBtns.forEach(btn => {
    btn.onclick = () => {
        fontBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFont = btn.dataset.font;
        drawCard();
    };
});

// Handle File Selection
fileInput.onchange = (e) => handleFile(e.target.files[0]);

async function handleFile(file) {
    if (!file || file.type !== 'application/pdf') return;
    selectedFile = file;

    uploadSection.hidden = true;
    editorSection.hidden = false;

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    pdfDoc = await loadingTask.promise;

    renderPDF();
}

async function renderPDF() {
    pdfRenderContainer.innerHTML = '';
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });

        const pageCanvas = document.createElement('canvas');
        pageCanvas.className = 'pdf-page-render';
        const context = pageCanvas.getContext('2d');
        pageCanvas.height = viewport.height;
        pageCanvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;
        pdfRenderContainer.appendChild(pageCanvas);
    }
}

// Text selection logic
document.addEventListener('mouseup', () => {
    const selection = window.getSelection().toString().trim();
    if (selection && selection.length > 5) {
        cardTextArea.value = selection;
        drawCard();
    }
});

cardTextArea.oninput = drawCard;

// Main Canvas Drawing
function drawCard() {
    const text = cardTextArea.value || 'Select text from the PDF to create your social card...';

    // 1. Draw Background Gradient
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, currentGradient.colors[0]);
    grad.addColorStop(1, currentGradient.colors[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Add subtle pattern/glass effect
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(80, 80, canvas.width - 160, canvas.height - 160, 40);
    } else {
        ctx.rect(80, 80, canvas.width - 160, canvas.height - 160);
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3. Draw Text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';

    // Dynamic Font Sizing
    let fontSize = 60;
    if (text.length < 50) fontSize = 80;
    if (text.length > 200) fontSize = 40;

    ctx.font = `700 ${fontSize}px '${currentFont}', sans-serif`;

    const maxWidth = canvas.width - 240;
    const lineHeight = fontSize * 1.4;
    wrapText(ctx, `"${text}"`, canvas.width / 2, canvas.height / 2 - 20, maxWidth, lineHeight);

    // 4. Branding
    ctx.font = `600 30px 'Outfit', sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('Created with PDFMagic', canvas.width / 2, canvas.height - 130);
}

// Helper: Wrap Text for Canvas
function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    const lines = [];

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = context.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            lines.push(line);
            line = words[n] + ' ';
        } else {
            line = testLine;
        }
    }
    lines.push(line);

    // Center the block vertically
    const totalHeight = lines.length * lineHeight;
    let startY = y - (totalHeight / 2);

    for (let k = 0; k < lines.length; k++) {
        context.fillText(lines[k], x, startY);
        startY += lineHeight;
    }
}

// Initial draw
drawCard();

// Download
downloadBtn.onclick = () => {
    const link = document.createElement('a');
    link.download = `pdf-magic-card-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
};
