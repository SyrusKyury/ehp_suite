/**
 * @file utils.js
 * Contains utility functions, constants, and the global application object.
 */

// --- GLOBAL CONTAINER OBJECT ---
const App = {};

// --- GLOBAL CONSTANTS ---
App.EHP_MAGIC = 0x03504845;
App.EHP_MAGIC2 = 0x20544F4E; // "NOT " in Little Endian

// --- GLOBAL APPLICATION STATE ---
App.state = {
    zipObject: null // Will hold the JSZip instance
};

// --- DOM ELEMENT REFERENCES (will be populated on DOMContentLoaded) ---
App.DOM = {};

/**
 * Finds and stores references to all necessary DOM elements.
 * This function must be called only after the DOM is fully loaded.
 */
App.initializeDOM = function() {
    App.DOM = {
        // Main App
        dropZone: document.getElementById('drop-zone'),
        statusDiv: document.getElementById('status'),
        customModeCheckbox: document.getElementById('custom-mode-check'),
        logPanel: document.getElementById('log-panel'),
        clearLogBtn: document.getElementById('clear-log-btn'),
        
        // File Pickers
        selectFileLink: document.getElementById('select-file-link'),
        selectFolderLink: document.getElementById('select-folder-link'),
        createEmptyLink: document.getElementById('create-empty-link'),
        filePicker: document.getElementById('file-picker'),
        folderPicker: document.getElementById('folder-picker'),
        addFilePicker: document.getElementById('add-file-picker'),
        
        // File Manager
        fileManager: document.getElementById('file-manager'),
        fileListContainer: document.getElementById('file-list-container'),
        addFileBtn: document.getElementById('add-file-btn'),
        repackBtn: document.getElementById('repack-btn'),

        // Hex Editor
        hexModal: document.getElementById('hex-editor-modal'),
        hexView: document.getElementById('hex-editor-view'),
        hexHeaderRow: document.getElementById('hex-editor-header-row'),
        hexFilename: document.getElementById('hex-editor-filename'),
        hexCloseBtn: document.getElementById('hex-editor-close-btn'),
        hexSaveBtn: document.getElementById('hex-save-btn'),
        hexSaveAsBtn: document.getElementById('hex-save-as-btn'),
        hexSearchType: document.getElementById('hex-search-type'),
        hexSearchInput: document.getElementById('hex-search-input'),
        hexReplaceInput: document.getElementById('hex-replace-input'),
        hexSearchBtn: document.getElementById('hex-search-btn'),
        hexReplaceBtn: document.getElementById('hex-replace-btn'),
        hexReplaceAllBtn: document.getElementById('hex-replace-all-btn'),
        hexGotoInput: document.getElementById('hex-goto-input'),
        hexGotoBtn: document.getElementById('hex-goto-btn'),

        // Hex Inspector & Sub-panels
        inspectorPanel: document.getElementById('hex-inspector-panel'),
        inspectorContent: document.getElementById('inspector-content'),
        structParserPanel: document.getElementById('struct-parser-panel'),
        structTemplateSelect: document.getElementById('struct-template-select'),
        structApplyBtn: document.getElementById('struct-apply-btn'),
        structView: document.getElementById('struct-view'),
        calculatorPanel: document.getElementById('calculator-panel'),
        calcHexInput: document.getElementById('calc-hex'),
        calcDecInput: document.getElementById('calc-dec'),
        calcBinInput: document.getElementById('calc-bin'),
        calcCharInput: document.getElementById('calc-char'),
        calcBytesInput: document.getElementById('calc-bytes'),
        calcEndianRadios: document.getElementsByName('calc-endian'),

        // Pointer Editor Modal
        pointerEditorModal: document.getElementById('pointer-editor-modal'),
        pointerEditorFilename: document.getElementById('pointer-editor-filename'),
        pointerEditorView: document.getElementById('pointer-editor-view'),
        pointerEditorSaveBtn: document.getElementById('pointer-editor-save-btn'),
        pointerEditorCloseBtn: document.getElementById('pointer-editor-close-btn'),
        
        // Preview Modal
        previewModal: document.getElementById('preview-modal'),
        previewFilename: document.getElementById('preview-filename'),
        previewContent: document.getElementById('preview-content'),
        previewCloseBtn: document.getElementById('preview-close-btn'),
    };
};

// --- UTILITY FUNCTIONS ---

App.log = function(message) {
    if (App.DOM.logPanel) {
        App.DOM.logPanel.textContent += `[${new Date().toLocaleTimeString()}] ${message}\n`;
        App.DOM.logPanel.scrollTop = App.DOM.logPanel.scrollHeight;
    }
    console.log(message);
};

App.triggerDownload = function(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

App.readNullTerminatedString = function(dataView, offset) {
    let bytes = [];
    let currentOffset = offset;
    while (currentOffset < dataView.byteLength) {
        const byte = dataView.getUint8(currentOffset++);
        if (byte === 0) break;
        bytes.push(byte);
    }
    return new TextDecoder().decode(new Uint8Array(bytes));
};

App.customSort = function(a, b) {
    const nameA = a.name;
    const nameB = b.name;
    const transform = (s) => s.replace(/_/g, '@');
    return transform(nameA).localeCompare(transform(nameB), undefined, { numeric: true, sensitivity: 'base' });
};

App.alignTo16 = function(value) {
    return (value + 0xF) & ~0xF;
};