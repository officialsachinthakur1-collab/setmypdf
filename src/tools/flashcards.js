// PDF to Flashcards - Core Logic
// Extracts text chunks from PDF and generates interactive flippable cards

const fileInput = document.getElementById('file-input');
const flashcardContainer = document.getElementById('flashcard-container');
const activeCardWrapper = document.getElementById('active-card-wrapper');
const mainCard = document.getElementById('main-card');
const cardFrontContent = document.getElementById('card-front-content');
const cardBackContent = document.getElementById('card-back-content');
const cardList = document.getElementById('card-list');
const cardCountLabel = document.getElementById('card-count');
const progressLabel = document.getElementById('progress');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const extractionStatus = document.getElementById('extraction-status');

let cards = [];
let currentIndex = 0;

// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// Interaction: Flip
mainCard.onclick = () => {
    mainCard.classList.toggle('flipped');
};

// Nav: Next/Prev
nextBtn.onclick = () => {
    if (currentIndex < cards.length - 1) {
        currentIndex++;
        showCard(currentIndex);
    }
};

prevBtn.onclick = () => {
    if (currentIndex > 0) {
        currentIndex--;
        showCard(currentIndex);
    }
};

shuffleBtn.onclick = () => {
    cards = cards.sort(() => Math.random() - 0.5);
    currentIndex = 0;
    showCard(0);
    renderCardList();
};

// File Handling
fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        flashcardContainer.style.display = 'none';
        extractionStatus.style.display = 'block';

        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        const extractedCards = await extractConceptsFromPDF(pdfDoc);

        if (extractedCards.length === 0) {
            alert('Could not find enough content to generate cards. Try a different PDF.');
            flashcardContainer.style.display = 'flex';
            extractionStatus.style.display = 'none';
            return;
        }

        cards = extractedCards;
        currentIndex = 0;

        extractionStatus.style.display = 'none';
        activeCardWrapper.style.display = 'flex';
        progressLabel.style.display = 'block';
        shuffleBtn.disabled = false;

        showCard(0);
        renderCardList();

    } catch (err) {
        console.error(err);
        alert('Failed to process PDF: ' + err.message);
        flashcardContainer.style.display = 'flex';
        extractionStatus.style.display = 'none';
    }
};

async function extractConceptsFromPDF(pdfDoc) {
    let fullText = "";
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join(" ") + "\n";
    }

    // Logic to split text into "Flashcard-able" chunks
    // For prototype: We split by sentences and group them into 3-sentence cards
    // A better implementation would use key-term extraction
    const sentences = fullText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);

    const results = [];
    for (let i = 0; i < sentences.length; i += 2) {
        if (sentences[i] && sentences[i + 1]) {
            results.push({
                front: sentences[i].substring(0, 150) + "?",
                back: sentences[i + 1].substring(0, 300)
            });
        }
    }

    return results.slice(0, 50); // Limit to 50 cards for demo
}

function showCard(index) {
    if (!cards[index]) return;

    // Reset flip state
    mainCard.classList.remove('flipped');

    // Update content
    cardFrontContent.textContent = cards[index].front;
    cardBackContent.textContent = cards[index].back;

    // Update labels
    progressLabel.textContent = `Card ${index + 1} of ${cards.length}`;

    // Update active list item
    document.querySelectorAll('.card-list-item').forEach((item, idx) => {
        if (idx === index) item.classList.add('active');
        else item.classList.remove('active');

        if (idx === index) item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
}

function renderCardList() {
    cardList.innerHTML = '';
    cardCountLabel.textContent = `${cards.length} Cards`;

    cards.forEach((card, index) => {
        const item = document.createElement('div');
        item.className = 'card-list-item';
        if (index === currentIndex) item.classList.add('active');

        const preview = card.front.length > 60 ? card.front.substring(0, 60) + "..." : card.front;
        item.textContent = `${index + 1}. ${preview}`;

        item.onclick = () => {
            currentIndex = index;
            showCard(currentIndex);
        };

        cardList.appendChild(item);
    });
}
