// static/script.js
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    const fileCounter = document.getElementById('fileCounter');
    const addFilesBtn = document.getElementById('addFilesBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const mergeBtn = document.getElementById('mergeBtn');
    const statusBar = document.getElementById('statusBar');
    const resultModal = document.getElementById('resultModal');
    const closeBtn = document.querySelector('.close-btn');
    const downloadBtn = document.getElementById('downloadBtn');
    const filenameInput = document.getElementById('filenameInput');
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    // Session variables
    let sessionId = null;
    let files = [];
    
    // Initialize
    function init() {
        // Generate a session ID
        sessionId = generateUUID();
        updateFileCounter();
        updateMergeButton();
    }
    
    // Event Listeners
    addFilesBtn.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', handleFileInputChange);
    
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('is-active');
    });
    
    dropArea.addEventListener('dragleave', () => {
        dropArea.classList.remove('is-active');
    });
    
    dropArea.addEventListener('drop', handleFileDrop);
    
    clearAllBtn.addEventListener('click', clearAllFiles);
    
    mergeBtn.addEventListener('click', mergePDFs);
    
    closeBtn.addEventListener('click', () => {
        resultModal.style.display = 'none';
    });
    
    downloadBtn.addEventListener('click', downloadMergedPDF);
    
    // Event handler for file input change
    function handleFileInputChange(e) {
        const selectedFiles = Array.from(e.target.files);
        uploadFiles(selectedFiles);
        // Reset file input for future uploads
        fileInput.value = '';
    }
    
    // Event handler for file drop
    function handleFileDrop(e) {
        e.preventDefault();
        dropArea.classList.remove('is-active');
        
        const droppedFiles = Array.from(e.dataTransfer.files);
        const pdfFiles = droppedFiles.filter(file => file.type === 'application/pdf');
        
        if (pdfFiles.length) {
            uploadFiles(pdfFiles);
        } else {
            updateStatus('Only PDF files are allowed', 'error');
        }
    }
    
    // Upload files function
    function uploadFiles(selectedFiles) {
        if (!selectedFiles.length) return;
        
        showLoading('Uploading files...');
        
        const uploadPromises = selectedFiles.map(file => {
            return uploadFile(file);
        });
        
        Promise.all(uploadPromises)
            .then(() => {
                hideLoading();
                updateStatus(`${selectedFiles.length} files uploaded successfully`);
                fetchFilesList();
            })
            .catch(error => {
                hideLoading();
                console.error('Upload error:', error);
                updateStatus('Error uploading files', 'error');
            });
    }
    
    // Upload a single file
    function uploadFile(file) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('session_id', sessionId);
            
            fetch('/upload', {
                method: 'POST',
                body: formData,
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    resolve(data);
                } else {
                    reject(new Error(data.message));
                }
            })
            .catch(error => {
                reject(error);
            });
        });
    }
    
    // Fetch the list of files for this session
    function fetchFilesList() {
        fetch(`/files?session_id=${sessionId}`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    files = data.files;
                    renderFileList();
                }
            })
            .catch(error => {
                console.error('Error fetching files:', error);
                updateStatus('Error fetching file list', 'error');
            });
    }
    
    // Render the file list
    function renderFileList() {
        fileList.innerHTML = '';
        
        if (files.length === 0) {
            fileList.innerHTML = '<div class="file-item empty-list">No files added yet</div>';
            updateFileCounter();
            updateMergeButton();
            return;
        }
        
        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <div class="file-name">
                    <i class="fas fa-file-pdf"></i>
                    <span>${file.name}</span>
                </div>
                <button class="remove-btn" data-id="${file.id}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            fileList.appendChild(fileItem);
        });
        
        // Add event listeners for remove buttons
        document.querySelectorAll('.remove-btn').forEach(button => {
            button.addEventListener('click', function() {
                const fileId = this.getAttribute('data-id');
                removeFile(fileId);
            });
        });
        
        updateFileCounter();
        updateMergeButton();
    }
    
    // Remove a file
    function removeFile(fileId) {
        showLoading('Removing file...');
        
        fetch('/remove', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: sessionId,
                file_id: fileId
            }),
        })
        .then(response => response.json())
        .then(data => {
            hideLoading();
            if (data.status === 'success') {
                updateStatus('File removed');
                fetchFilesList();
            } else {
                updateStatus(data.message, 'error');
            }
        })
        .catch(error => {
            hideLoading();
            console.error('Error removing file:', error);
            updateStatus('Error removing file', 'error');
        });
    }
    
    // Clear all files
    function clearAllFiles() {
        if (files.length === 0) return;
        
        showLoading('Clearing files...');
        
        fetch('/clear', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: sessionId
            }),
        })
        .then(response => response.json())
        .then(data => {
            hideLoading();
            if (data.status === 'success') {
                files = [];
                renderFileList();
                updateStatus('All files cleared');
            } else {
                updateStatus(data.message, 'error');
            }
        })
        .catch(error => {
            hideLoading();
            console.error('Error clearing files:', error);
            updateStatus('Error clearing files', 'error');
        });
    }
    
    // Merge PDFs
    function mergePDFs() {
        if (files.length === 0) {
            updateStatus('No files to merge', 'error');
            return;
        }
        
        showLoading('Merging PDFs...');
        
        fetch('/merge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: sessionId
            }),
        })
        .then(response => response.json())
        .then(data => {
            hideLoading();
            if (data.status === 'success') {
                updateStatus('PDFs merged successfully');
                showResultModal();
            } else {
                updateStatus(data.message, 'error');
            }
        })
        .catch(error => {
            hideLoading();
            console.error('Error merging PDFs:', error);
            updateStatus('Error merging PDFs', 'error');
        });
    }
    
    // Download merged PDF
    function downloadMergedPDF() {
        // Get filename from input
        let filename = filenameInput.value.trim();
        if (!filename) {
            filename = 'merged.pdf';
        } else if (!filename.toLowerCase().endsWith('.pdf')) {
            filename += '.pdf';
        }
        
        showLoading('Preparing download...');
        
        fetch('/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: sessionId,
                filename: filename
            }),
        })
        .then(response => response.json())
        .then(data => {
            hideLoading();
            if (data.status === 'success') {
                // Redirect to download URL
                window.location.href = `/download/${sessionId}/${data.download_token}/${encodeURIComponent(filename)}`;
                resultModal.style.display = 'none';
                updateStatus('Download started');
                // Clear the file list after successful download
                setTimeout(() => {
                    clearAllFiles();
                }, 1000);
            } else {
                updateStatus(data.message, 'error');
            }
        })
        .catch(error => {
            hideLoading();
            console.error('Error downloading file:', error);
            updateStatus('Error downloading file', 'error');
        });
    }
    
    // Show result modal
    function showResultModal() {
        // Set default filename based on date
        const now = new Date();
        const defaultFilename = `merged_${now.getFullYear()}-${(now.getMonth() + 1)
            .toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}.pdf`;
        filenameInput.value = defaultFilename;
        
        resultModal.style.display = 'flex';
    }
    
    // Update file counter
    function updateFileCounter() {
        fileCounter.textContent = `Files selected: ${files.length}`;
    }
    
    // Update merge button state
    function updateMergeButton() {
        if (files.length < 2) {
            mergeBtn.disabled = true;
            mergeBtn.title = 'Add at least 2 PDF files to merge';
        } else {
            mergeBtn.disabled = false;
            mergeBtn.title = 'Merge selected PDF files';
        }
    }
    
    // Update status bar
    function updateStatus(message, type = 'info') {
        statusBar.textContent = message;
        
        // Reset previous classes
        statusBar.classList.remove('error', 'success');
        
        // Add appropriate class based on type
        if (type === 'error') {
            statusBar.classList.add('error');
            statusBar.style.color = 'var(--error-color)';
        } else if (type === 'success') {
            statusBar.classList.add('success');
            statusBar.style.color = 'var(--success-color)';
        } else {
            statusBar.style.color = '#666';
        }
        
        // Auto-clear status after 5 seconds
        setTimeout(() => {
            statusBar.textContent = 'Ready to merge PDFs';
            statusBar.style.color = '#666';
            statusBar.classList.remove('error', 'success');
        }, 5000);
    }
    
    // Show loading overlay
    function showLoading(message = 'Processing...') {
        document.querySelector('.loading-overlay p').textContent = message;
        loadingOverlay.style.display = 'flex';
    }
    
    // Hide loading overlay
    function hideLoading() {
        loadingOverlay.style.display = 'none';
    }
    
    // Generate UUID for session
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    // Initialize the app
    init();
});