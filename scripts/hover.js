let hoverImageTimeout;

function isMobileOrTablet() {
    return window.innerWidth <= 1024;
}

function showImage(element, imageUrl, isFoilPage) {
    clearTimeout(hoverImageTimeout);

    // Remove any existing hover image display
    const existingHoverImageDiv = document.getElementById('hover-image-display');
    if (existingHoverImageDiv) {
        existingHoverImageDiv.remove();
    }

    const hoverImageDiv = document.createElement('div');
    hoverImageDiv.id = 'hover-image-display';
    hoverImageDiv.className = 'hover-image';

    const hoverImage = document.createElement('img');
    hoverImage.style.maxWidth = '100%';
    hoverImage.style.height = 'auto';
    hoverImage.oncontextmenu = () => false;
    hoverImage.style.pointerEvents = 'none';

    const hoverImageText = document.createElement('div');
    hoverImageText.id = 'hover-image-text';
    hoverImageText.style.padding = '10px';
    hoverImageText.style.textAlign = 'center';
    hoverImageText.style.color = '#555';
    hoverImageText.style.marginTop = '15px';
    hoverImageText.textContent = 'Card Image Not Available';

    hoverImageDiv.appendChild(hoverImage);
    hoverImageDiv.appendChild(hoverImageText);

    hoverImage.onerror = () => {
        hoverImage.style.display = 'none';
        hoverImageText.style.display = 'block';
    };

    if (imageUrl) {
        hoverImage.src = imageUrl;
        hoverImage.style.display = 'block';
        hoverImageText.style.display = 'none';
        if (isFoilPage) {
            hoverImageDiv.classList.add('foil-sheen');
        } else {
            hoverImageDiv.classList.remove('foil-sheen');
        }
    } else {
        hoverImage.src = '';
        hoverImage.style.display = 'none';
        hoverImageText.style.display = 'block';
        hoverImageDiv.classList.remove('foil-sheen');
    }

    document.body.appendChild(hoverImageDiv);
    hoverImageDiv.style.display = 'block';

    const rect = element.getBoundingClientRect();
    hoverImageDiv.style.position = 'absolute';
    hoverImageDiv.style.top = `${rect.bottom + window.scrollY + 5}px`;
    hoverImageDiv.style.left = `${rect.left + window.scrollX}px`;
}

function hideImage() {
    clearTimeout(hoverImageTimeout); // Clear any pending showImage timeouts

    const hoverImageDiv = document.getElementById('hover-image-display');
    if (hoverImageDiv) {
        hoverImageDiv.remove();
    }
}

function showModalImage(imageUrl, isFoilPage) {
    const modalOverlay = document.getElementById('mobile-image-modal');
    const modalImage = modalOverlay.querySelector('.modal-image');
    const modalNoImageText = modalOverlay.querySelector('.modal-no-image-text');

    modalImage.onerror = () => {
        modalImage.style.display = 'none';
        modalNoImageText.style.display = 'block';
        modalImage.classList.remove('foil-sheen');
    };

    if (imageUrl) {
        modalImage.src = imageUrl;
        modalImage.style.display = 'block';
        modalNoImageText.style.display = 'none';
        if (isFoilPage) {
            modalImage.classList.add('foil-sheen');
        } else {
            modalImage.classList.remove('foil-sheen');
        } 
    } else {
        modalImage.src = '';
        modalImage.style.display = 'none'; // Ensure image is hidden
        modalNoImageText.style.display = 'block';
        modalImage.classList.remove('foil-sheen');
    }
    modalOverlay.style.display = 'flex';
}

function hideModalImage() {
    const modalOverlay = document.getElementById('mobile-image-modal');
    const modalImage = modalOverlay.querySelector('.modal-image');
    const modalNoImageText = modalOverlay.querySelector('.modal-no-image-text'); // Get the text element
    modalOverlay.style.display = 'none';
    modalImage.classList.remove('foil-sheen');
    modalNoImageText.style.display = 'none'; // Hide the text element explicitly
}
