// LinkedIn Carousel Creator - Core Logic
// Renders PDF pages to high-res square slides with branding overlays

const fileInput = document.getElementById('file-input');
const slidesContainer = document.getElementById('slides-container');
const socialHandleInput = document.getElementById('social-handle');
const fullNameInput = document.getElementById('full-name');
const avatarInput = document.getElementById('avatar-input');
const colorDots = document.querySelectorAll('.color-dot');
const themeCards = document.querySelectorAll('[data-theme]');
const frameCards = document.querySelectorAll('[data-frame]');
const exportBtn = document.getElementById('export-btn');

let pdfDoc = null;
let accentColor = '#7c4dff';
let currentTheme = 'light';
let currentFrame = 'minimal';
let socialHandle = '';
let fullName = '';
let avatarImg = null;

// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// Branding Updates
socialHandleInput.oninput = (e) => {
    socialHandle = e.target.value;
    renderSlides();
};

colorDots.forEach(dot => {
    dot.onclick = () => {
        colorDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        accentColor = dot.dataset.color;
        renderSlides();
    };
});

fullNameInput.oninput = (e) => {
    fullName = e.target.value;
    renderSlides();
};

avatarInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                avatarImg = img;
                renderSlides();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
};

themeCards.forEach(card => {
    card.onclick = () => {
        themeCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        currentTheme = card.dataset.theme;
        renderSlides();
    };
});

frameCards.forEach(card => {
    card.onclick = () => {
        frameCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        currentFrame = card.dataset.frame;
        renderSlides();
    };
});

// File Handling
fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        exportBtn.disabled = false;
        renderSlides();
    } catch (err) {
        alert('Failed to load PDF: ' + err.message);
    }
};

async function renderSlides() {
    if (!pdfDoc) return;

    slidesContainer.innerHTML = '';

    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);

        // We want Square slides (1080x1080) for LinkedIn/Instagram
        const slideSize = 1080;
        const viewport = page.getViewport({ scale: 2.0 }); // Render higher than target for crispness

        const wrapper = document.createElement('div');
        wrapper.className = 'slide-preview';

        const canvas = document.createElement('canvas');
        canvas.width = slideSize;
        canvas.height = slideSize;
        const ctx = canvas.getContext('2d');

        // 1. Draw Background based on Theme
        if (currentTheme === 'dark') {
            ctx.fillStyle = '#121212';
            ctx.fillRect(0, 0, slideSize, slideSize);
        } else if (currentTheme === 'gradient_accent') {
            const grad = ctx.createLinearGradient(0, 0, slideSize, slideSize);
            grad.addColorStop(0, accentColor);
            grad.addColorStop(1, '#ffffff');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, slideSize, slideSize);

            // Add a slight white overlay to ensure text readability if gradient is too strong
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.fillRect(0, 0, slideSize, slideSize);
        } else {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, slideSize, slideSize);

            // Subtle shadow base for light theme
            ctx.shadowColor = 'rgba(0,0,0,0.05)';
            ctx.shadowBlur = 50;
            ctx.fillRect(50, 50, slideSize - 100, slideSize - 100);
            ctx.shadowColor = 'transparent';
        }

        // 2. Render PDF Content (Centered)
        // Calculate fit scale (we want it to take up about 80% width and 70% height to be safe)
        const baseViewport = page.getViewport({ scale: 1.0 });
        const maxWidth = slideSize * 0.82;
        const maxHeight = slideSize * 0.72;

        // Calculate the absolute best scale so NEITHER width NOR height exceeds our bounds
        const scaleX = maxWidth / baseViewport.width;
        const scaleY = maxHeight / baseViewport.height;
        let scale = Math.min(scaleX, scaleY);

        // Render at 2x for sharpness
        const renderViewport = page.getViewport({ scale: scale * 2 });

        const pdfCanvas = document.createElement('canvas');
        pdfCanvas.width = renderViewport.width;
        pdfCanvas.height = renderViewport.height;
        await page.render({ canvasContext: pdfCanvas.getContext('2d'), viewport: renderViewport }).promise;

        // Draw onto main canvas, scaling it back down to fit the actual slideSize
        const drawWidth = renderViewport.width / 2;
        const drawHeight = renderViewport.height / 2;

        const dx = (slideSize - drawWidth) / 2;
        const dy = (slideSize - drawHeight) / 2;

        // Use crisp scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(pdfCanvas, dx, dy - 20, drawWidth, drawHeight); // Shifted slightly up (-20)

        // 3. Apply Theme Branding
        applyBranding(ctx, i, pdfDoc.numPages);

        wrapper.appendChild(canvas);
        slidesContainer.appendChild(wrapper);
    }
    lucide.createIcons();
}

function applyBranding(ctx, pageNum, totalPages) {
    const size = 1080;
    const isDark = currentTheme === 'dark';
    const textColor = isDark ? '#ffffff' : '#000000';
    const subTextColor = isDark ? '#aaaaaa' : '#666666';

    // Draw Accent Bar
    ctx.fillStyle = accentColor;
    ctx.fillRect(0, 0, size, 15); // Top thin bar

    if (currentFrame === 'bordered') {
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 40;
        ctx.strokeRect(20, 20, size - 40, size - 40);
    }

    // Avatar & Author Info
    let textStartX = 60;

    if (avatarImg) {
        const avatarSize = 80;
        const avatarX = 60;
        const avatarY = size - 110;

        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();

        // Add subtle border to avatar
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 4;
        ctx.stroke();

        textStartX = avatarX + avatarSize + 20;
    }

    if (fullName || socialHandle) {
        const nameY = size - 75;
        const handleY = size - 45;

        if (fullName) {
            ctx.font = '700 28px "Outfit", sans-serif';
            ctx.fillStyle = textColor;
            ctx.textAlign = 'left';
            ctx.fillText(fullName, textStartX, nameY);
        }

        if (socialHandle) {
            ctx.font = '500 22px "Outfit", sans-serif';
            ctx.fillStyle = fullName ? subTextColor : textColor;
            ctx.textAlign = 'left';
            ctx.fillText(socialHandle, textStartX, fullName ? handleY : nameY + 10);
        }
    }

    // Branding "Created with PDF Magic"
    ctx.font = '800 28px "Outfit", sans-serif';
    ctx.fillStyle = accentColor;
    ctx.textAlign = 'right';
    ctx.fillText('⚡ PDF Magic', size - 60, 80);

    // Page Number Indicator
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0';
    ctx.beginPath();
    ctx.roundRect(size - 140, size - 100, 80, 45, 10);
    ctx.fill();

    ctx.font = '700 22px "Outfit", sans-serif';
    ctx.fillStyle = isDark ? '#ffffff' : '#666';
    ctx.textAlign = 'center';
    ctx.fillText(`${pageNum}/${totalPages}`, size - 100, size - 70);

    // Swipe Indicator (except on last page)
    if (pageNum < totalPages) {
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(size - 40, size / 2 - 20);
        ctx.lineTo(size - 20, size / 2);
        ctx.lineTo(size - 40, size / 2 + 20);
        ctx.stroke();
    }
}

// Export Handling
exportBtn.onclick = async () => {
    if (!pdfDoc) return;

    const zip = new JSZip();
    const slideCanvases = slidesContainer.querySelectorAll('canvas');

    for (let i = 0; i < slideCanvases.length; i++) {
        const dataUrl = slideCanvases[i].toDataURL('image/png', 1.0);
        const data = dataUrl.split(',')[1];
        zip.file(`slide-${i + 1}.png`, data, { base64: true });
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `linkedin-carousel-${Date.now()}.zip`;
    link.click();
};
