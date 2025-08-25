/**
 * @file main.js
 * The application's entry point. Initializes the UI event listeners.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Inizializza tutti i riferimenti al DOM e la calcolatrice
    App.initializeDOM();
    App.initializeCalculator();

    /**
     * Resets the UI to a clean state before a new operation.
     */
    function prepareForNewOperation() {
        App.DOM.fileManager.style.display = 'none';
        App.DOM.statusDiv.textContent = 'Initializing...';
        App.DOM.logPanel.textContent = '';
        App.state.zipObject = null;
    }

    // --- MAIN APP & FILE MANAGER LISTENERS ---

    App.DOM.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); App.DOM.dropZone.classList.add('dragover'); });
    App.DOM.dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); App.DOM.dropZone.classList.remove('dragover'); });
    App.DOM.dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        App.DOM.dropZone.classList.remove('dragover');
        prepareForNewOperation();
        const items = e.dataTransfer.items;
        if (!items || items.length === 0) return;
        const entry = items[0].webkitGetAsEntry();
        if (entry.isFile) {
            entry.file(file => {
                if (file.name.toLowerCase().endsWith('.ehp')) {
                    App.handleUnpack(file);
                } else {
                    App.log('Error: Please provide an .ehp file for extraction.');
                    App.DOM.statusDiv.textContent = 'Error.';
                }
            });
        } else if (entry.isDirectory) {
            const files = await App.getAllFiles(items);
            App.handlePack(files);
        }
    });

    App.DOM.selectFileLink.addEventListener('click', (e) => { e.preventDefault(); App.DOM.filePicker.click(); });
    App.DOM.selectFolderLink.addEventListener('click', (e) => { e.preventDefault(); App.DOM.folderPicker.click(); });
    App.DOM.createEmptyLink.addEventListener('click', (e) => {
        e.preventDefault();
        prepareForNewOperation();
        App.createEmptyProject();
    });

    App.DOM.filePicker.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            prepareForNewOperation();
            App.handleUnpack(e.target.files[0]);
        }
        e.target.value = null;
    });

    App.DOM.folderPicker.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            prepareForNewOperation();
            App.handlePack(Array.from(e.target.files));
        }
        e.target.value = null;
    });

    App.DOM.clearLogBtn.addEventListener('click', () => { App.DOM.logPanel.textContent = ''; });
    App.DOM.addFileBtn.addEventListener('click', () => App.DOM.addFilePicker.click());
    App.DOM.addFilePicker.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            App.addFilesToProject(Array.from(e.target.files));
        }
        e.target.value = null;
    });
    App.DOM.repackBtn.addEventListener('click', App.repackEHP);

    // --- HEX EDITOR LISTENERS ---
    
    App.DOM.hexCloseBtn.addEventListener('click', App.closeHexEditor);
    App.DOM.hexSaveBtn.addEventListener('click', () => {
        if (App.state.zipObject && App.editorState.filename) {
            App.log(`Saving changes for ${App.editorState.filename} to project...`);
            App.state.zipObject.file(App.editorState.filename, App.editorState.buffer, { binary: true });
            App.editorState.isDirty = false;
            App.renderFileManager(); 
            App.DOM.statusDiv.textContent = `Changes to ${App.editorState.filename} saved.`;
            App.closeHexEditor();
        }
    });
    App.DOM.hexSaveAsBtn.addEventListener('click', () => {
        const blob = new Blob([App.editorState.buffer]);
        App.triggerDownload(blob, App.editorState.filename);
        App.log(`File ${App.editorState.filename} downloaded directly.`);
    });
    App.DOM.hexGotoBtn.addEventListener('click', () => {
        const offsetHex = App.DOM.hexGotoInput.value;
        const offset = parseInt(offsetHex, 16);
        if (!isNaN(offset)) {
            App.updateSelection(offset, 'instant');
        } else {
            App.log(`Error: "${offsetHex}" is not a valid hexadecimal offset.`);
        }
    });

    App.DOM.hexSearchBtn.addEventListener('click', () => {
        const type = App.DOM.hexSearchType.value;
        const value = App.DOM.hexSearchInput.value;
        const dataView = new DataView(App.editorState.buffer);
        const uint8View = new Uint8Array(App.editorState.buffer);
        App.DOM.hexView.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
        let foundCount = 0;
        try {
            switch (type) {
                case 'hex':
                    const searchBytes = value.split(/\s+/).map(s => parseInt(s, 16)).filter(n => !isNaN(n));
                    if (searchBytes.length === 0) return;
                    foundCount = App.findAndHighlight(uint8View, searchBytes);
                    break;
                case 'text':
                    const textBytes = new TextEncoder().encode(value);
                    foundCount = App.findAndHighlight(uint8View, Array.from(textBytes));
                    break;
                default:
                    const numValue = type.includes('float') ? parseFloat(value) : parseInt(value);
                    if (isNaN(numValue)) throw new Error("Invalid numeric value.");
                    const typeMap = {
                        int8: { size: 1, method: 'getInt8' }, uint8: { size: 1, method: 'getUint8' },
                        int16: { size: 2, method: 'getInt16' }, uint16: { size: 2, method: 'getUint16' },
                        int32: { size: 4, method: 'getInt32' }, uint32: { size: 4, method: 'getUint32' },
                        float32: { size: 4, method: 'getFloat32' }, float64: { size: 8, method: 'getFloat64' },
                    };
                    const searchType = typeMap[type];
                    for (let i = 0; i <= App.editorState.buffer.byteLength - searchType.size; i++) {
                        const val = dataView[searchType.method](i, true);
                        const isMatch = type.includes('float') ? Math.abs(val - numValue) < 1e-6 : val === numValue;
                        if (isMatch) {
                            foundCount++;
                            for(let j = 0; j < searchType.size; j++) { App.highlightByte(i + j); }
                        }
                    }
                    break;
            }
            App.log(`Found ${foundCount} occurrences.`);
        } catch (e) {
            App.log(`Search error: ${e.message}`);
        }
    });

    App.DOM.hexReplaceBtn.addEventListener('click', () => App.runReplace(false));
    App.DOM.hexReplaceAllBtn.addEventListener('click', () => App.runReplace(true));

    // Structure Parser listeners
    App.DOM.structTemplateSelect.addEventListener('change', App.applyStructTemplate);
    App.DOM.structApplyBtn.addEventListener('click', App.applyStructTemplate);

    // Keyboard shortcuts for the entire window
    document.addEventListener('keydown', (e) => {
        if (App.DOM.hexModal.style.display === 'none') return;
        if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); App.undo(); }
        if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); App.redo(); }
    });

    // Keyboard navigation and actions within the editor
    App.DOM.hexModal.addEventListener('keydown', (e) => {
        if (document.activeElement.tagName === 'INPUT' || e.ctrlKey) {
            return;
        }
        if (App.editorState.selectedOffset === null) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            const selectedElement = App.DOM.hexView.querySelector('.byte-hex.selected');
            if (selectedElement) {
                App.createByteEditor(selectedElement);
            }
            return;
        }

        let newOffset = App.editorState.selectedOffset;
        let handled = false;
        switch (e.key) {
            case 'ArrowUp': newOffset -= 16; handled = true; break;
            case 'ArrowDown': newOffset += 16; handled = true; break;
            case 'ArrowLeft': newOffset -= 1; handled = true; break;
            case 'ArrowRight': newOffset += 1; handled = true; break;
            case 'PageUp': newOffset -= (16 * 10); handled = true; break;
            case 'PageDown': newOffset += (16 * 10); handled = true; break;
            case 'Home': newOffset = 0; handled = true; break;
            case 'End': newOffset = App.editorState.buffer.byteLength - 1; handled = true; break;
        }
        
        if (handled) {
            e.preventDefault();
            App.updateSelection(newOffset, 'auto');
        }
    });

    // --- POINTER EDITOR & PREVIEW LISTENERS ---
    
    App.DOM.pointerEditorCloseBtn.addEventListener('click', App.closePointerEditor);
    App.DOM.pointerEditorSaveBtn.addEventListener('click', App.savePointerFile);
    App.DOM.previewCloseBtn.addEventListener('click', App.closePreview);

    // --- GLOBAL UNSAVED CHANGES WARNING ---
    window.addEventListener('beforeunload', (e) => {
        if (App.editorState.isDirty) {
            e.preventDefault();
            e.returnValue = ''; // Standard per la maggior parte dei browser
            return ''; // Per browser più vecchi
        }
    });

    App.log("Application initialized and ready.");
});