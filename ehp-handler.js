/**
 * @file ehp-handler.js
 * Adds methods for handling EHP archives to the global App object.
 */

App.handleUnpack = async function(file) {
    App.log(`Starting extraction of ${file.name}`);
    try {
        const buffer = await file.arrayBuffer();
        const dataView = new DataView(buffer);
        if (dataView.getUint32(0, true) !== App.EHP_MAGIC) throw new Error('Invalid magic number. Not an EHP file.');

        const fileCount = dataView.getInt32(12, true);
        App.log(`Found ${fileCount} files. Analyzing...`);

        const fileInfos = [];
        const offsetToFileInfo = new Map();
        for (let i = 0; i < fileCount; i++) {
            const infoPointer = dataView.getInt32(16 + i * 8, true);
            const fileOffset = dataView.getInt32(20 + i * 8, true);
            const filename = App.readNullTerminatedString(dataView, infoPointer);
            const fileSize = dataView.getInt32(infoPointer + filename.length + 1, true);
            const info = { filename, fileSize, fileOffset };
            fileInfos.push(info);
            offsetToFileInfo.set(fileOffset, info);
        }

        App.state.zipObject = new JSZip();

        for (const info of fileInfos) {
            const fileData = buffer.slice(info.fileOffset, info.fileOffset + info.fileSize);
            const isCustomMode = App.DOM.customModeCheckbox.checked;

            // --- LOGICA DI ESTRAZIONE CORRETTA ---
            const isAnimPtrs = info.filename === 'all-ptrs.txt';
            const isAnimEtcPtrs = info.filename === 'alletc-ptrs.txt';

            if (isCustomMode && (isAnimPtrs || isAnimEtcPtrs)) {
                // È un file puntatore speciale e la modalità custom è attiva
                App.log(`Dereferencing (custom mode) ${info.filename}...`);
                const textData = App.dereferencePtrsFile(info, fileData, offsetToFileInfo);
                
                // Crea il nuovo nome file leggibile
                const newFilename = isAnimPtrs ? '_anim-ptrs.txt' : '_animetc-ptrs.txt';
                
                App.state.zipObject.file(newFilename, textData, { binary: false }); // Salva come testo
                App.log(`Created custom pointer file: ${newFilename}`);
            } else {
                // È un file normale o la modalità custom è disattivata
                App.state.zipObject.file(info.filename, fileData, { binary: true });
            }
        }

        App.DOM.statusDiv.textContent = 'Extraction complete. You can now manage the files below.';
        App.renderFileManager(); 
    } catch (error) {
        App.log(`ERROR: ${error.message}`);
        App.DOM.statusDiv.textContent = 'Error during extraction.';
    }
};

App.renderFileManager = async function() {
    if (!App.state.zipObject) return;
    
    App.DOM.fileListContainer.innerHTML = '';
    const files = App.state.zipObject.files;
    const fileList = Object.keys(files).filter(name => !files[name].dir).sort();

    for (const filename of fileList) {
        const file = files[filename];
        const content = await file.async("uint8array");
        const fileSize = content.length;

        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.dataset.filename = filename;
        
        const fileNameSpan = document.createElement('span');
        fileNameSpan.className = 'file-name';
        fileNameSpan.textContent = filename;
        fileNameSpan.title = filename;
        
        const fileSizeSpan = document.createElement('span');
        fileSizeSpan.className = 'file-size';
        fileSizeSpan.textContent = `${fileSize} bytes`;

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'file-actions';

        const previewIcon = document.createElement('span');
        previewIcon.className = 'action-icon preview';
        previewIcon.title = 'Preview File';
        previewIcon.innerHTML = `<svg xmlns="http://www.w.org/2000/svg" viewBox="0 0 24 24"><path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z" /></svg>`;
        previewIcon.addEventListener('click', () => App.showPreview(filename));
        actionsDiv.appendChild(previewIcon);

        if (filename.endsWith('-ptrs.txt') && App.DOM.customModeCheckbox.checked) {
            const pointerIcon = document.createElement('span');
            pointerIcon.className = 'action-icon pointer-edit';
            pointerIcon.title = 'Edit Pointers';
            pointerIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M13.9,11.5L12,9.6L10.1,11.5L12,13.4L13.9,11.5M19.3,16.9L16.9,19.3L14.5,16.9L16.9,14.5L19.3,16.9M2,2V13H4V22H22V2H20V11H18V2H16V13H14V2H12V7H10V2H8V13H6V2H4V13H2V2Z" /></svg>`;
            pointerIcon.addEventListener('click', () => App.openPointerEditor(filename));
            actionsDiv.appendChild(pointerIcon);
        }
        
        const editIcon = document.createElement('span');
        editIcon.className = 'action-icon edit';
        editIcon.title = 'Edit File in Hex Editor';
        editIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M14.06,9L15,9.94L5.92,19H5V18.08L14.06,9M17.66,3C17.41,3 17.15,3.1 16.96,3.29L15.13,5.12L18.88,8.87L20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18.17,3.09 17.92,3 17.66,3M14.06,6.19L3,17.25V21H6.75L17.81,9.94L14.06,6.19Z" /></svg>`;
        editIcon.addEventListener('click', () => App.openHexEditor(filename));
        
        const renameIcon = document.createElement('span');
        renameIcon.className = 'action-icon rename';
        renameIcon.title = 'Rename File';
        renameIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21.4,13.1L20,11.7L18.6,13.1L17.9,12.4L19.3,11L17.9,9.6L18.6,8.9L20,10.3L21.4,8.9L22.1,9.6L20.7,11L22.1,12.4L21.4,13.1M17,5V2H9V5H2V7H4V21H16V7H18V5H17M14,19H6V7H14V19Z" /></svg>`;
        renameIcon.addEventListener('click', () => App.renameFileInProject(filename));
        
        const downloadIcon = document.createElement('span');
        downloadIcon.className = 'action-icon download';
        downloadIcon.title = 'Download File';
        downloadIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z" /></svg>`;
        downloadIcon.addEventListener('click', async () => {
            const fileData = await App.state.zipObject.file(filename).async('blob');
            App.triggerDownload(fileData, filename);
        });

        const deleteIcon = document.createElement('span');
        deleteIcon.className = 'action-icon delete';
        deleteIcon.title = 'Remove File';
        deleteIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" /></svg>`;
        deleteIcon.addEventListener('click', () => App.removeFileFromProject(filename));
        
        actionsDiv.appendChild(editIcon);
        actionsDiv.appendChild(renameIcon);
        actionsDiv.appendChild(downloadIcon);
        actionsDiv.appendChild(deleteIcon);

        fileItem.appendChild(fileNameSpan);
        fileItem.appendChild(fileSizeSpan);
        fileItem.appendChild(actionsDiv);
        App.DOM.fileListContainer.appendChild(fileItem);
    }

    App.DOM.fileManager.style.display = 'block';
};

App.createEmptyProject = function() {
    App.state.zipObject = new JSZip();
    App.log("Created a new empty project.");
    App.DOM.statusDiv.textContent = "Empty project created. Add files to begin.";
    App.renderFileManager();
};

App.addFilesToProject = async function(files) {
    if (!App.state.zipObject) {
        App.state.zipObject = new JSZip();
    }
    let addedCount = 0;
    for (const file of files) {
        if (App.state.zipObject.file(file.name)) {
            App.log(`Warning: File "${file.name}" already exists. Skipping.`);
            continue;
        }
        App.state.zipObject.file(file.name, file);
        addedCount++;
    }
    App.log(`Added ${addedCount} new file(s) to the project.`);
    await App.renderFileManager();
};

App.removeFileFromProject = async function(filename) {
    if (confirm(`Are you sure you want to remove "${filename}" from the project?`)) {
        App.state.zipObject.remove(filename);
        App.log(`Removed "${filename}" from the project.`);
        await App.renderFileManager();
    }
};

App.renameFileInProject = async function(oldName) {
    const newName = prompt(`Enter the new name for "${oldName}":`, oldName);
    if (newName && newName.trim() !== "" && newName !== oldName) {
        if (App.state.zipObject.file(newName)) {
            alert(`Error: A file named "${newName}" already exists.`);
            return;
        }
        const fileObject = App.state.zipObject.file(oldName);
        const content = await fileObject.async('uint8array');
        App.state.zipObject.remove(oldName);
        App.state.zipObject.file(newName, content, { binary: true });
        App.log(`Renamed "${oldName}" to "${newName}".`);
        await App.renderFileManager();
    }
};

App.dereferencePtrsFile = function(info, fileData, offsetToFileInfo) {
    const dataView = new DataView(fileData);
    let outputText = '';
    if (info.filename.includes('all-ptrs.txt')) {
        const animPtrsSizes = { 0xAB4: 6, 0x724: 5, 0x3B0: 4, 0xAD4: 3, 0xA38: 2, 0x5EC: 1 };
        const gameVersion = animPtrsSizes[info.fileSize];
        if (gameVersion) {
            outputText += `TF${gameVersion}\n`;
            App.log(`Detected Tag Force ${gameVersion} format for ${info.filename}`);
        }
    }
    let ptrsContent = [];
    for (let i = 0; i < info.fileSize; i += 4) {
        if (i + 4 > info.fileSize) break;
        const offset = dataView.getInt32(i, true);
        if (offset === -1) { ptrsContent.push('END'); break; }
        else if (offset === 0) { ptrsContent.push('NULL'); }
        else {
            const referencedFile = offsetToFileInfo.get(offset);
            ptrsContent.push(referencedFile ? referencedFile.filename : `UNKNOWN_OFFSET_0x${offset.toString(16).toUpperCase()}`);
        }
    }
    if (info.filename.startsWith('all') || info.filename.startsWith('alletc')) {
         outputText += ptrsContent.map((name, index) => `${index.toString(16).toUpperCase()} = ${name}`).join('\n');
    } else {
        outputText += ptrsContent.join('\n');
    }
    return new TextEncoder().encode(outputText);
};

App.handlePack = async function(files) {
    App.log(`Creating a new project from ${files.length} files...`);
    App.state.zipObject = new JSZip();
    for (const file of files) {
        const normalizedFileName = file.webkitRelativePath ? file.webkitRelativePath.substring(file.webkitRelativePath.indexOf('/') + 1) : file.name;
        if (normalizedFileName === "") continue;
        App.state.zipObject.file(normalizedFileName, file);
    }
    App.DOM.statusDiv.textContent = `Project created with ${files.length} files.`;
    App.renderFileManager();
};

App.repackEHP = async function() {
    if (!App.state.zipObject) {
        App.log("Error: No files loaded to repack.");
        return;
    }
    App.log('Step 1/3: Analyzing project files...');
    App.DOM.statusDiv.textContent = 'Step 1/3: Analyzing files...';

    const zipFiles = App.state.zipObject.files;
    let fileMetadatas = [];
    
    // Mappa dei nomi sorgente custom ai nomi di destinazione del gioco
    const customPtrsMap = {
        "_anim-ptrs.txt": "all-ptrs.txt",
        "_animetc-ptrs.txt": "alletc-ptrs.txt"
    };
    
    for (const filename in zipFiles) {
        if (zipFiles[filename].dir) continue;
        
        let finalFilename = filename;
        // Se la modalità custom è attiva, controlla se il nome del file deve essere mappato
        if (App.DOM.customModeCheckbox.checked && customPtrsMap[filename]) {
            finalFilename = customPtrsMap[filename];
            App.log(`Mapping custom pointer file "${filename}" to "${finalFilename}".`);
        }
        
        const fileObject = zipFiles[filename];
        const content = await fileObject.async("uint8array");
        const paddingMatch = finalFilename.match(/#([0-9a-fA-F]+)\.txt$/i);
        const isPtrs = finalFilename.endsWith('-ptrs.txt');
        
        const meta = { 
            name: finalFilename, 
            content: content, 
            isPadding: !!paddingMatch, 
            isPtrs, 
            ptrsText: null, 
            binarySize: 0 
        };

        if (meta.isPadding) {
            meta.binarySize = parseInt(paddingMatch[1], 16);
        } else {
            meta.binarySize = content.length;
            if (isPtrs) {
                // Leggi il testo dal file sorgente originale, non dal file con nome finale
                meta.ptrsText = await App.state.zipObject.file(filename).async("string");
                const lines = meta.ptrsText.split('\n').filter(line => line.trim() !== '');
                let ptrCount = lines.length;
                if (lines[0] && lines[0].toUpperCase().startsWith('TF')) ptrCount--;
                meta.binarySize = ptrCount * 4;
            }
        }
        fileMetadatas.push(meta);
    }

    fileMetadatas.sort(App.customSort);
    App.log(`Found ${fileMetadatas.length} files. Step 2/3: Calculating archive layout...`);
    App.DOM.statusDiv.textContent = 'Step 2/3: Calculating layout...';
    
    const fileCount = fileMetadatas.length;
    let fileInfoBlockSize = 0;
    fileMetadatas.forEach(meta => { fileInfoBlockSize += (new TextEncoder().encode(meta.name).length + 1) + 4; });
    
    const headerSize = 16;
    const entryTableSize = (fileCount + 1) * 8;
    const dataStartOffset = App.alignTo16(headerSize + entryTableSize + fileInfoBlockSize);
    
    const filenameToOffset = new Map();
    let currentFileOffset = dataStartOffset;
    let currentInfoPointer = headerSize + entryTableSize;

    for (const meta of fileMetadatas) {
        meta.finalOffset = currentFileOffset;
        meta.finalInfoPointer = currentInfoPointer;
        filenameToOffset.set(meta.name, meta.finalOffset);
        currentInfoPointer += (new TextEncoder().encode(meta.name).length + 1) + 4;
        currentFileOffset = App.alignTo16(currentFileOffset + meta.binarySize);
    }
    const totalFileSize = currentFileOffset;

    App.log('Step 3/3: Writing data and resolving pointers...');
    App.DOM.statusDiv.textContent = 'Step 3/3: Writing data...';

    const outputBuffer = new ArrayBuffer(totalFileSize);
    const dataView = new DataView(outputBuffer);
    const uint8View = new Uint8Array(outputBuffer);
    let offset = 0;

    dataView.setUint32(offset, App.EHP_MAGIC, true); offset += 4;
    dataView.setInt32(offset, totalFileSize, true); offset += 4;
    dataView.setUint32(offset, App.EHP_MAGIC2, true); offset += 4;
    dataView.setInt32(offset, fileCount, true); offset += 4;

    for (const meta of fileMetadatas) { dataView.setInt32(offset, meta.finalInfoPointer, true); offset += 4; dataView.setInt32(offset, meta.finalOffset, true); offset += 4; }
    dataView.setInt32(offset, 0, true); offset += 4; dataView.setInt32(offset, 0, true); offset += 4;

    for (const meta of fileMetadatas) { const nameBytes = new TextEncoder().encode(meta.name); uint8View.set(nameBytes, offset); offset += nameBytes.length; dataView.setUint8(offset, 0); offset++; dataView.setInt32(offset, meta.binarySize, true); offset += 4; }

    for (const meta of fileMetadatas) {
        if (meta.isPadding) {}
        else if (meta.isPtrs) {
            App.log(`Resolving pointers for ${meta.name}...`);
            const ptrsBuffer = App.referencePtrsFile(meta, filenameToOffset);
            uint8View.set(new Uint8Array(ptrsBuffer), meta.finalOffset);
        } else {
            uint8View.set(meta.content, meta.finalOffset);
        }
    }

    App.triggerDownload(new Blob([outputBuffer]), 'repacked.ehp');
    App.log(`Repacking complete! Downloaded repacked.ehp.`);
    App.DOM.statusDiv.textContent = 'Repacking complete.';
};

App.referencePtrsFile = function(meta, filenameToOffset) {
    const lines = meta.ptrsText.split('\n').map(l => l.trim()).filter(Boolean);
    const ptrsBuffer = new ArrayBuffer(meta.binarySize);
    const ptrsDataView = new DataView(ptrsBuffer);
    let currentByteOffset = 0;
    const isCustomFormat = meta.ptrsText.includes('=');

    for (const line of lines) {
        if (line.toUpperCase().startsWith('TF')) continue;
        let targetFilename = '';
        let ptrIndex = -1;

        if (isCustomFormat) {
            const parts = line.split('=');
            if (parts.length < 2) continue;
            targetFilename = parts[1].trim();
            ptrIndex = parseInt(parts[0].trim(), 16);
        } else {
            targetFilename = line;
        }

        let offsetToWrite = 0;
        if (targetFilename.toUpperCase() === 'END') { offsetToWrite = -1; }
        else if (targetFilename.toUpperCase() === 'NULL') { offsetToWrite = 0; }
        else {
            const foundOffset = filenameToOffset.get(targetFilename);
            if (foundOffset === undefined) {
                App.log(`WARNING: File "${targetFilename}" referenced in ${meta.name} was not found!`);
                offsetToWrite = 0;
            } else { offsetToWrite = foundOffset; }
        }
        
        if (isCustomFormat) {
            if (ptrIndex * 4 < meta.binarySize) {
                ptrsDataView.setInt32(ptrIndex * 4, offsetToWrite, true);
            }
        } else {
            if (currentByteOffset < meta.binarySize) {
                ptrsDataView.setInt32(currentByteOffset, offsetToWrite, true);
                currentByteOffset += 4;
            }
        }
    }
    return ptrsBuffer;
};

App.getAllFiles = async function(items) {
    const fileList = [];
    const queue = [];
    for (const item of items) { queue.push(item.webkitGetAsEntry()); }
    while (queue.length > 0) {
        const entry = queue.shift();
        if (entry.isFile) {
            fileList.push(await new Promise((resolve, reject) => entry.file(resolve, reject)));
        } else if (entry.isDirectory) {
            const reader = entry.createReader();
            let entries;
            do {
                entries = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
                for (const subEntry of entries) { queue.push(subEntry); }
            } while (entries.length > 0);
        }
    }
    return fileList;
};