document.addEventListener('DOMContentLoaded', function () {
    const imageEl = document.getElementById('fullsizeImage');
    const errorEl = document.getElementById('viewError');
    const captionEl = document.getElementById('viewCaption');
    const backLink = document.getElementById('viewBackLink');

    if (!imageEl) {
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const rawVariant = params.get('variant') || 'desktop';
    const rawFile = params.get('file') || '';

    const variant = rawVariant.toLowerCase();
    const allowedVariants = new Set(['desktop', 'mobile']);

    function showError(message) {
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
        imageEl.style.display = 'none';
    }

    if (!rawFile) {
        showError('Missing photo identifier.');
        return;
    }

    if (!allowedVariants.has(variant)) {
        showError('Unknown photo variant.');
        return;
    }

    let decodedFilename;
    try {
        decodedFilename = decodeURIComponent(rawFile);
    } catch (err) {
        decodedFilename = rawFile;
    }

    const assetsBase = document.body.getAttribute('data-assets-base') || '../assets';
    const sanitizedBase = assetsBase.replace(/\/$/, '');
    const encodedFilename = encodeURIComponent(decodedFilename);
    const imagePath = sanitizedBase + '/photos/' + variant + '/' + encodedFilename;

    imageEl.src = imagePath;
    imageEl.alt = decodedFilename;

    imageEl.addEventListener('error', function () {
        showError('We could not load that photo.');
    });

    document.title = 'AllGasNoBrakes - ' + decodedFilename;

    if (captionEl) {
        captionEl.textContent = decodedFilename;
    }

    if (backLink) {
        backLink.setAttribute('href', '../');
    }
});
