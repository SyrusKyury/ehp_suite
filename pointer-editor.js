/**
 * @file pointer-editor.js
 * Adds methods for the graphical pointer editor to the global App object.
 */

// Stato per l'editor di puntatori
App.pointerEditorState = {
    filename: null,
    isCustomFormat: false,
    header: '', // Es. "TF6"
    pointers: [] // { index: string, target: string }
};

App.openPointerEditor = async function(filename) {
    if (!App.state.zipObject) return;
    const file = App.state.zipObject.file(filename);
    if (!file) {
        App.log(`Error: Cannot open pointer editor for "${filename}", file not found.`);
        return;
    }

    App.DOM.pointerEditorFilename.textContent = filename;
    const view = App.DOM.pointerEditorView;
    view.innerHTML = '<p>Loading pointers...</p>';
    App.DOM.pointerEditorModal.style.display = 'flex';
    document.body.classList.add('modal-open');

    // Analizza il file di testo
    const textContent = await file.async('string');
    const lines = textContent.split('\n').map(l => l.trim()).filter(Boolean);

    App.pointerEditorState.filename = filename;
    App.pointerEditorState.header = '';
    App.pointerEditorState.pointers = [];

    // Controlla se il formato è custom (con '=') o standard
    App.pointerEditorState.isCustomFormat = textContent.includes('=');
    
    if (lines[0] && lines[0].toUpperCase().startsWith('TF')) {
        App.pointerEditorState.header = lines.shift();
    }

    lines.forEach((line, i) => {
        if (App.pointerEditorState.isCustomFormat) {
            const parts = line.split('=');
            if (parts.length === 2) {
                App.pointerEditorState.pointers.push({
                    index: parts[0].trim(),
                    target: parts[1].trim()
                });
            }
        } else {
            // Per il formato standard, l'indice è semplicemente la posizione nella lista
            App.pointerEditorState.pointers.push({
                index: i.toString(),
                target: line
            });
        }
    });

    App.renderPointerEditor();
};

App.renderPointerEditor = function() {
    const view = App.DOM.pointerEditorView;
    view.innerHTML = ''; // Pulisci la vista

    // Prepara la lista di opzioni per il menu a tendina una sola volta
    const fileOptions = ['NULL', 'END'];
    const projectFiles = Object.keys(App.state.zipObject.files).filter(name => !App.state.zipObject.files[name].dir);
    fileOptions.push(...projectFiles.sort());
    
    const optionsHTML = fileOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('');

    App.pointerEditorState.pointers.forEach(pointer => {
        const row = document.createElement('div');
        row.className = 'pointer-row';

        const label = document.createElement('label');
        // Se è custom, usa l'indice esadecimale, altrimenti l'indice decimale
        const displayIndex = App.pointerEditorState.isCustomFormat ? `0x${pointer.index}` : pointer.index;
        label.textContent = `Ptr[${displayIndex}]:`;
        
        const select = document.createElement('select');
        select.innerHTML = optionsHTML;
        select.value = pointer.target; // Imposta il valore corrente

        row.appendChild(label);
        row.appendChild(select);
        view.appendChild(row);
    });
};

App.savePointerFile = async function() {
    let newContent = '';
    if (App.pointerEditorState.header) {
        newContent += App.pointerEditorState.header + '\n';
    }

    const rows = App.DOM.pointerEditorView.querySelectorAll('.pointer-row');
    const newPointers = [];

    rows.forEach((row, i) => {
        const select = row.querySelector('select');
        const target = select.value;
        
        if (App.pointerEditorState.isCustomFormat) {
            // Mantieni l'indice esadecimale originale
            const index = App.pointerEditorState.pointers[i].index;
            newPointers.push(`${index} = ${target}`);
        } else {
            newPointers.push(target);
        }
    });

    newContent += newPointers.join('\n');

    const filename = App.pointerEditorState.filename;
    App.state.zipObject.file(filename, newContent, { binary: false });
    
    App.log(`Saved changes to pointer file "${filename}".`);
    App.closePointerEditor();
};

App.closePointerEditor = function() {
    App.DOM.pointerEditorModal.style.display = 'none';
    document.body.classList.remove('modal-open');
};