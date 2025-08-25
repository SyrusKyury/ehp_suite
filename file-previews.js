/**
 * @file file-previews.js
 * Adds methods for showing file previews to the global App object.
 */

App.showPreview = async function(filename) {
    if (!App.state.zipObject) return;
    const file = App.state.zipObject.file(filename);
    if (!file) {
        App.log(`Error: Cannot generate preview for "${filename}", file not found.`);
        return;
    }

    App.DOM.previewFilename.textContent = filename;
    const contentDiv = App.DOM.previewContent;
    contentDiv.innerHTML = '<p>Loading preview...</p>';
    App.DOM.previewModal.style.display = 'flex';
    document.body.classList.add('modal-open');

    const extension = filename.split('.').pop().toLowerCase();
    
    try {
        if (['txt', 'xml', 'json'].includes(extension)) {
            const text = await file.async('string');
            const pre = document.createElement('pre');
            pre.textContent = text;
            contentDiv.innerHTML = '';
            contentDiv.appendChild(pre);
            return;
        }

        const content = await file.async('blob');
        const objectURL = URL.createObjectURL(content);

        switch (extension) {
            case 'png':
            case 'jpg':
            case 'jpeg':
            case 'gif':
            case 'bmp':
            case 'webp':
            case 'svg':
                contentDiv.innerHTML = `<img src="${objectURL}" alt="Preview for ${filename}">`;
                break;
            
            case 'gim':
                contentDiv.innerHTML = `<p><strong>.gim format is not natively supported.</strong><br>A custom JavaScript parser would be needed to display this image format.</p>`;
                break;
            
            case 'mp3':
            case 'wav':
            case 'ogg':
                contentDiv.innerHTML = `<audio controls src="${objectURL}"></audio>`;
                break;

            case 'at3':
                contentDiv.innerHTML = `<p><strong>.at3 audio format is not supported by browsers.</strong><br>Playback is not possible without a custom JavaScript decoder.</p>`;
                break;

            default:
                contentDiv.innerHTML = `<p>No preview available for the file type "<strong>.${extension}</strong>".</p>`;
                break;
        }
    } catch (error) {
        App.log(`Error generating preview for ${filename}: ${error.message}`);
        contentDiv.innerHTML = `<p>An error occurred while trying to generate the preview.</p>`;
    }
};

App.closePreview = function() {
    App.DOM.previewModal.style.display = 'none';
    // Svuota il contenuto per liberare memoria (specialmente per gli Object URL)
    App.DOM.previewContent.innerHTML = ''; 
    document.body.classList.remove('modal-open');
};