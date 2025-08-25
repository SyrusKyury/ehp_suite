/**
 * @file hex-editor.js
 * Adds methods for the hex editor to the global App object.
 */

App.editorState = {
    buffer: null,
    filename: '',
    modifiedOffsets: new Set(),
    selectedOffset: null,
    history: [],
    historyIndex: -1,
    isDirty: false,
    structTemplates: { // Template di esempio
        "Vector3": [
            { "name": "x", "type": "float32" },
            { "name": "y", "type": "float32" },
            { "name": "z", "type": "float32" }
        ],
        "Simple EHP Header": [
            { "name": "Magic", "type": "uint32" },
            { "name": "Total Size", "type": "uint32" },
            { "name": "Magic 2", "type": "uint32" },
            { "name": "File Count", "type": "uint32" },
        ]
    }
};

App.openHexEditor = async function(filename) {
    if (!App.state.zipObject) return;
    const file = App.state.zipObject.file(filename);
    if (!file) {
        App.log(`Error: File ${filename} not found.`);
        return;
    }

    // Marca il file come in modifica nel file manager
    document.querySelectorAll('.file-item.editing').forEach(el => el.classList.remove('editing'));
    document.querySelector(`.file-item[data-filename="${filename}"]`)?.classList.add('editing');

    App.DOM.statusDiv.textContent = `Opening editor for ${filename}...`;
    const buffer = await file.async("arraybuffer");
    
    // Inizializza/resetta lo stato
    App.editorState.buffer = buffer.slice(0);
    App.editorState.filename = filename;
    App.editorState.modifiedOffsets.clear();
    App.editorState.selectedOffset = 0;
    App.editorState.history = [];
    App.editorState.historyIndex = -1;
    App.editorState.isDirty = false;

    App.DOM.hexFilename.textContent = filename;
    App.renderHexHeader();
    App.renderHexView();
    App.populateStructTemplates();
    App.updateSelection(0, 'instant');
    App.DOM.hexModal.style.display = 'flex';
    App.DOM.hexModal.focus();
    document.body.classList.add('modal-open');

    App.DOM.statusDiv.textContent = `Editor opened. Use arrow keys to navigate.`;
};

App.closeHexEditor = function() {
    if (App.editorState.isDirty && !confirm("You have unsaved changes. Are you sure you want to close without saving them to the project?")) {
        return;
    }
    App.DOM.hexModal.style.display = 'none';
    document.body.classList.remove('modal-open');
    App.editorState.buffer = null;
    
    const activeFileItem = document.querySelector('.file-item.editing');
    if (activeFileItem) activeFileItem.classList.remove('editing');
};

// --- LOGICA DI RENDERING E SELEZIONE ---

App.renderHexHeader = function() {
    let hexHeader = '';
    let asciiHeader = '';
    for (let i = 0; i < 16; i++) {
        hexHeader += `<span>${i.toString(16).padStart(2, '0').toUpperCase()}</span>`;
        asciiHeader += `<span>${i.toString(16).toUpperCase()}</span>`;
    }
    App.DOM.hexHeaderRow.innerHTML = `<span class="hex-offset">Offset</span><div class="header-bytes">${hexHeader}</div><div class="header-ascii">${asciiHeader}</div>`;
};

App.renderHexView = function() {
    const { buffer } = App.editorState;
    const view = App.DOM.hexView;
    const dataView = new DataView(buffer);
    let html = '';
    for (let i = 0; i < buffer.byteLength; i += 16) {
        const offset = i.toString(16).padStart(8, '0').toUpperCase();
        let hexBytes = '';
        let asciiChars = '';
        for (let j = 0; j < 16; j++) {
            if (i + j < buffer.byteLength) {
                const byte = dataView.getUint8(i + j);
                const currentOffset = i + j;
                const char = (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
                const escapedChar = char.replace(/&/g, "&amp;").replace(/</g, "&lt;");
                hexBytes += `<span class="byte-hex" data-offset="${currentOffset}">${byte.toString(16).padStart(2, '0').toUpperCase()}</span>`;
                asciiChars += `<span class="byte-ascii" data-offset="${currentOffset}">${escapedChar}</span>`;
            } else {
                hexBytes += `<span class="byte-hex placeholder"></span>`;
                asciiChars += `<span class="byte-ascii placeholder"></span>`;
            }
        }
        html += `<div class="hex-row"><span class="hex-offset">${offset}</span><div class="hex-bytes">${hexBytes}</div><div class="hex-ascii">${asciiChars}</div></div>`;
    }
    view.innerHTML = html;
    App.addByteEventListeners();
    App.editorState.modifiedOffsets.forEach(offset => {
        view.querySelectorAll(`[data-offset="${offset}"]`).forEach(el => el.classList.add('modified'));
    });
};

App.addByteEventListeners = function() {
    App.DOM.hexView.querySelectorAll('.byte-hex, .byte-ascii').forEach(el => {
        if (el.classList.contains('placeholder')) return;

        el.addEventListener('click', (e) => {
            const offset = parseInt(e.target.dataset.offset);
            App.updateSelection(offset);
        });
        el.addEventListener('dblclick', (e) => {
            const offset = parseInt(e.target.dataset.offset);
            App.updateSelection(offset);
            App.createByteEditor(e.target);
        });
    });
};

App.updateSelection = function(newOffset, scrollBehavior = 'smooth') {
    const { buffer } = App.editorState;
    if (newOffset < 0 || newOffset >= buffer.byteLength) return;

    App.DOM.hexView.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    App.editorState.selectedOffset = newOffset;
    const newSelected = App.DOM.hexView.querySelectorAll(`[data-offset="${newOffset}"]`);
    newSelected.forEach(el => el.classList.add('selected'));
    newSelected[0]?.scrollIntoView({ behavior: scrollBehavior, block: 'nearest' });

    App.updateInspector();
    App.applyStructTemplate();
};

App.updateInspector = function() {
    const { buffer, selectedOffset } = App.editorState;
    if (selectedOffset === null) {
        App.DOM.inspectorContent.innerHTML = 'No selection.';
        return;
    }

    const dataView = new DataView(buffer);
    let html = '';
    const canRead = (bytes) => selectedOffset + bytes <= buffer.byteLength;
    const addRow = (label, value) => { html += `<div class="inspector-row"><span class="inspector-label">${label}</span><span class="inspector-value">${value}</span></div>`; };

    addRow('Offset (Hex)', `0x${selectedOffset.toString(16).toUpperCase()}`);
    addRow('Offset (Dec)', selectedOffset);
    html += '<hr>';
    
    if (canRead(1)) addRow('Int8', dataView.getInt8(selectedOffset));
    if (canRead(1)) addRow('UInt8', dataView.getUint8(selectedOffset));
    if (canRead(2)) addRow('Int16 LE', dataView.getInt16(selectedOffset, true));
    if (canRead(2)) addRow('UInt16 LE', dataView.getUint16(selectedOffset, true));
    if (canRead(4)) addRow('Int32 LE', dataView.getInt32(selectedOffset, true));
    if (canRead(4)) addRow('UInt32 LE', dataView.getUint32(selectedOffset, true));
    if (canRead(4)) addRow('Float32 LE', dataView.getFloat32(selectedOffset, true).toPrecision(7));
    if (canRead(8)) addRow('Float64 LE', dataView.getFloat64(selectedOffset, true).toPrecision(15));
    html += '<hr>';
    
    if (canRead(2)) addRow('Int16 BE', dataView.getInt16(selectedOffset, false));
    if (canRead(4)) addRow('Int32 BE', dataView.getInt32(selectedOffset, false));

    App.DOM.inspectorContent.innerHTML = html;
};

// --- LOGICA DI MODIFICA E STORICO (UNDO/REDO) ---

App.createByteEditor = function(target) {
    if (document.getElementById('byte-editor-input')) return;
    const input = document.createElement('input');
    input.id = 'byte-editor-input';
    input.type = 'text';
    const rect = target.getBoundingClientRect();
    input.style.left = `${rect.left}px`;
    input.style.top = `${rect.top}px`;
    input.style.width = `${rect.width}px`;
    input.style.height = `${rect.height}px`;

    const isHex = target.classList.contains('byte-hex');
    input.maxLength = isHex ? 2 : 1;
    input.value = isHex ? target.textContent : (target.textContent === '.' ? '' : target.textContent);
    const offset = parseInt(target.dataset.offset);

    const saveAndClose = () => {
        if (!document.body.contains(input)) return;
        App.updateByteValue(offset, input.value, isHex);
        input.remove();
    };

    input.addEventListener('blur', saveAndClose);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveAndClose();
        } else if (e.key === 'Escape') {
            input.remove();
        }
    });

    document.body.appendChild(input);
    input.focus();
    input.select();
};

App.updateByteValue = function(offset, newValue, isHex, recordHistory = true) {
    const dataView = new DataView(App.editorState.buffer);
    const oldValue = dataView.getUint8(offset);
    let byteValue;

    if (isHex) {
        byteValue = parseInt(newValue, 16);
        if (isNaN(byteValue)) return;
    } else {
        if (newValue.length === 0) return;
        byteValue = newValue.charCodeAt(0);
        if (isNaN(byteValue)) return;
    }

    if (oldValue === byteValue) return;

    if (recordHistory) {
        if (App.editorState.historyIndex < App.editorState.history.length - 1) {
            App.editorState.history.splice(App.editorState.historyIndex + 1);
        }
        App.editorState.history.push({ offset, oldValue, newValue: byteValue });
        App.editorState.historyIndex++;
        App.editorState.isDirty = true;
    }

    dataView.setUint8(offset, byteValue);
    App.editorState.modifiedOffsets.add(offset);

    const hexEl = App.DOM.hexView.querySelector(`.byte-hex[data-offset="${offset}"]`);
    const asciiEl = App.DOM.hexView.querySelector(`.byte-ascii[data-offset="${offset}"]`);
    hexEl.textContent = byteValue.toString(16).padStart(2, '0').toUpperCase();
    const char = (byteValue >= 32 && byteValue <= 126) ? String.fromCharCode(byteValue) : '.';
    asciiEl.textContent = char.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    hexEl.classList.add('modified');
    asciiEl.classList.add('modified');
    App.updateInspector();
};

App.undo = function() {
    const { history, historyIndex } = App.editorState;
    if (historyIndex < 0) {
        App.log("Nothing to undo.");
        return;
    }
    const lastChange = history[historyIndex];
    App.updateByteValue(lastChange.offset, lastChange.oldValue.toString(16), true, false);
    App.editorState.historyIndex--;
    App.updateSelection(lastChange.offset);
    App.log(`Undo: Reverted byte at 0x${lastChange.offset.toString(16)} to 0x${lastChange.oldValue.toString(16)}.`);
};

App.redo = function() {
    const { history, historyIndex } = App.editorState;
    if (historyIndex >= history.length - 1) {
        App.log("Nothing to redo.");
        return;
    }
    App.editorState.historyIndex++;
    const nextChange = history[App.editorState.historyIndex];
    App.updateByteValue(nextChange.offset, nextChange.newValue.toString(16), true, false);
    App.updateSelection(nextChange.offset);
    App.log(`Redo: Changed byte at 0x${nextChange.offset.toString(16)} to 0x${nextChange.newValue.toString(16)}.`);
};

// --- LOGICA DELLA CALCOLATRICE ---

App.initializeCalculator = function() {
    const inputs = [App.DOM.calcHexInput, App.DOM.calcDecInput, App.DOM.calcBinInput, App.DOM.calcCharInput];
    inputs.forEach(input => {
        if(input) {
            input.addEventListener('input', (e) => App.updateCalculator(e.target));
        }
    });
    if(App.DOM.calcEndianRadios) {
        App.DOM.calcEndianRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                const activeInput = inputs.find(input => input && input.value.trim() !== '');
                if (activeInput) {
                    App.updateCalculator(activeInput);
                }
            });
        });
    }
};

App.updateCalculator = function(sourceInput) {
    let decValue;

    if (!sourceInput || sourceInput.value.trim() === '') {
        App.clearCalculator(sourceInput);
        return;
    }

    if (sourceInput.id === 'calc-char') {
        decValue = sourceInput.value.charCodeAt(0);
        if (isNaN(decValue)) { App.clearCalculator(sourceInput); return; }
    } else {
        const base = parseInt(sourceInput.dataset.base, 10);
        decValue = parseInt(sourceInput.value.replace(/\s/g, ''), base);
        if (isNaN(decValue)) { App.clearCalculator(sourceInput); return; }
    }

    const isLittleEndian = document.getElementById('calc-le').checked;
    
    if (sourceInput.id !== 'calc-hex') App.DOM.calcHexInput.value = decValue.toString(16).toUpperCase();
    if (sourceInput.id !== 'calc-dec') App.DOM.calcDecInput.value = decValue.toString(10);
    if (sourceInput.id !== 'calc-bin') App.DOM.calcBinInput.value = decValue.toString(2);
    
    if (sourceInput.id !== 'calc-char') {
        if (decValue >= 32 && decValue <= 126) App.DOM.calcCharInput.value = String.fromCharCode(decValue);
        else App.DOM.calcCharInput.value = '';
    }

    let byteString = '';
    if (decValue >= 0) {
        let hex = decValue.toString(16);
        if (hex.length % 2 !== 0) hex = '0' + hex;
        
        let bytes = [];
        for (let i = 0; i < hex.length; i += 2) {
            bytes.push(hex.substring(i, i + 2));
        }

        if (isLittleEndian) bytes.reverse();
        byteString = bytes.join(' ').toUpperCase();
    }
    App.DOM.calcBytesInput.value = byteString;
};

App.clearCalculator = function(sourceInput) {
    const inputs = [App.DOM.calcHexInput, App.DOM.calcDecInput, App.DOM.calcBinInput, App.DOM.calcCharInput, App.DOM.calcBytesInput];
    inputs.forEach(input => {
        if (input && input !== sourceInput) {
            input.value = '';
        }
    });
};

// --- LOGICA DI RICERCA E SOSTITUZIONE ---

App.findAndHighlight = function(buffer, searchArray) {
    let count = 0;
    for (let i = 0; i <= buffer.length - searchArray.length; i++) {
        let match = true;
        for (let j = 0; j < searchArray.length; j++) {
            if (buffer[i + j] !== searchArray[j]) {
                match = false;
                break;
            }
        }
        if (match) {
            count++;
            for (let j = 0; j < searchArray.length; j++) {
                App.highlightByte(i + j);
            }
        }
    }
    return count;
};

App.highlightByte = function(offset) {
    App.DOM.hexView.querySelector(`.byte-hex[data-offset="${offset}"]`)?.classList.add('highlight');
    App.DOM.hexView.querySelector(`.byte-ascii[data-offset="${offset}"]`)?.classList.add('highlight');
};

App.runReplace = function(replaceAll = false) {
    const { buffer } = App.editorState;
    const type = App.DOM.hexSearchType.value;
    const searchValue = App.DOM.hexSearchInput.value;
    const replaceValue = App.DOM.hexReplaceInput.value;

    if (!searchValue || !replaceValue) {
        App.log("Error: Both search and replace fields must be filled.");
        return;
    }
    if (type !== 'hex') {
        App.log("Error: Replace functionality is currently only supported for 'Hex String' type.");
        return;
    }
    const searchBytes = searchValue.split(/\s+/).map(s => parseInt(s, 16)).filter(n => !isNaN(n));
    const replaceBytes = replaceValue.split(/\s+/).map(s => parseInt(s, 16)).filter(n => !isNaN(n));
    if (searchBytes.length === 0 || replaceBytes.length === 0) {
        App.log("Error: Invalid hex values for search or replace.");
        return;
    }
    if (searchBytes.length !== replaceBytes.length) {
        App.log("Error: Search and replace byte sequences must have the same length.");
        return;
    }
    const uint8View = new Uint8Array(buffer);
    let replacedCount = 0;
    for (let i = 0; i <= uint8View.length - searchBytes.length; i++) {
        let match = true;
        for (let j = 0; j < searchBytes.length; j++) {
            if (uint8View[i + j] !== searchBytes[j]) {
                match = false;
                break;
            }
        }
        if (match) {
            for (let j = 0; j < replaceBytes.length; j++) {
                App.updateByteValue(i + j, replaceBytes[j].toString(16), true);
            }
            replacedCount++;
            if (!replaceAll) {
                App.updateSelection(i);
                break;
            }
            i += searchBytes.length - 1;
        }
    }
    App.log(`Replaced ${replacedCount} occurrence(s).`);
    if (replacedCount > 0) {
        App.renderHexView();
        App.updateSelection(App.editorState.selectedOffset);
    }
};

// --- LOGICA DEL PARSER DI STRUTTURE ---

App.populateStructTemplates = function() {
    const select = App.DOM.structTemplateSelect;
    if (!select) return;
    while (select.options.length > 1) select.remove(1);
    for (const name in App.editorState.structTemplates) {
        const option = new Option(name, name);
        select.add(option);
    }
};

App.applyStructTemplate = function() {
    const select = App.DOM.structTemplateSelect;
    if (!select) return;
    const templateName = select.value;
    if (!templateName) {
        App.DOM.structView.innerHTML = '';
        return;
    }
    const template = App.editorState.structTemplates[templateName];
    const { buffer, selectedOffset } = App.editorState;
    const dataView = new DataView(buffer);
    let html = '';
    let currentOffset = selectedOffset;
    const typeSizes = { 'int8': 1, 'uint8': 1, 'int16': 2, 'uint16': 2, 'int32': 4, 'uint32': 4, 'float32': 4, 'float64': 8 };

    template.forEach(field => {
        const size = typeSizes[field.type];
        if (currentOffset + size <= buffer.byteLength) {
            let value;
            switch(field.type) {
                case 'int8': value = dataView.getInt8(currentOffset); break;
                case 'uint8': value = dataView.getUint8(currentOffset); break;
                case 'int16': value = dataView.getInt16(currentOffset, true); break;
                case 'uint16': value = dataView.getUint16(currentOffset, true); break;
                case 'int32': value = dataView.getInt32(currentOffset, true); break;
                case 'uint32': value = dataView.getUint32(currentOffset, true); break;
                case 'float32': value = dataView.getFloat32(currentOffset, true).toPrecision(7); break;
                case 'float64': value = dataView.getFloat64(currentOffset, true).toPrecision(15); break;
                default: value = 'N/A';
            }
            html += `<div class="struct-row"><span class="struct-label">${field.name}</span><span class="struct-value">${value}</span></div>`;
            currentOffset += size;
        }
    });
    App.DOM.structView.innerHTML = html;
};