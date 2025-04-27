// API Base URL (consistency)
const API_BASE_URL = /* import.meta.env.VITE_API_URL || */ 'http://localhost:5000';

// Global state for models (simple approach for now)
let userModels = [];
// Global state for managing active polling intervals
const activePolls = {};
// Global variable to store model ID for deletion confirmation
let modelToDelete = null;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const logoutButton = document.getElementById('logoutButton');
    const createModelForm = document.getElementById('createModelForm');
    const createModelBtn = document.getElementById('createModelBtn');
    const modelListContainer = document.getElementById('modelList');
    const noModelsMessage = document.getElementById('noModelsMessage');
    const dashboardErrorMessagesDiv = document.getElementById('dashboardErrorMessages');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const deleteConfirmModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const globalStatusIndicator = document.getElementById('globalStatusIndicator');
    const statusMessage = document.getElementById('statusMessage');

    // --- Sidebar Toggle Functionality --- 
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('show');
    });

    // Close sidebar when clicking outside on small screens
    document.addEventListener('click', (event) => {
        const isSmallScreen = window.innerWidth < 768;
        const clickedOutsideSidebar = !sidebar.contains(event.target) && event.target !== sidebarToggle;
        
        if (isSmallScreen && clickedOutsideSidebar && sidebar.classList.contains('show')) {
            sidebar.classList.remove('show');
        }
    });

    // --- Status Toast Notifications ---
    function showToast(message, type = 'info', duration = 3000) {
        statusMessage.textContent = message;
        globalStatusIndicator.className = `toast align-items-center text-bg-${type}`;
        globalStatusIndicator.style.display = 'block';
        
        const bsToast = new bootstrap.Toast(globalStatusIndicator, {
            autohide: true,
            delay: duration
        });
        bsToast.show();
    }

    // --- Utility for Displaying Errors ---
    const displayError = (message, container = dashboardErrorMessagesDiv) => {
        const alertHtml = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        if (container) {
            container.innerHTML = alertHtml;
        } else {
            console.error("Error display container not found:", message);
            showToast("Error: " + message, 'danger');
        }
    };

    // --- Clear Errors ---
    const clearErrors = (container = dashboardErrorMessagesDiv) => {
        if (container) {
            container.innerHTML = '';
        }
    };

    // --- Authentication Check & Logout --- 
    if (!token) {
        window.location.href = 'index.html'; // Redirect to login if no token
        return;
    }

    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userEmail'); // Clean up other stored info
        window.location.href = 'index.html';
    });

    // --- Model Fetching and Display --- 
    async function fetchModels() {
        try {
            // Show loading state
            modelListContainer.innerHTML = `
                <div class="text-center p-3">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Loading models...</p>
                </div>
            `;
            noModelsMessage.style.display = 'none';
            
            const response = await fetch(`${API_BASE_URL}/api/models`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    // Token might be invalid or expired
                    localStorage.removeItem('token');
                    window.location.href = 'index.html';
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            userModels = await response.json();
            renderModelList();
            
            // Show a success message
            if (userModels.length > 0) {
                showToast(`Successfully loaded ${userModels.length} models`, 'success');
            }
        } catch (error) {
            console.error('Error fetching models:', error);
            displayError(`Failed to load models: ${error.message}`, modelListContainer);
            if (noModelsMessage) noModelsMessage.style.display = 'none'; 
        }
    }

    function renderModelList() {
        modelListContainer.innerHTML = ''; // Clear existing list
        if (userModels.length === 0) {
            noModelsMessage.style.display = 'block';
            modelListContainer.appendChild(noModelsMessage); 
        } else {
            noModelsMessage.style.display = 'none';
            userModels.forEach(model => {
                const modelElement = createModelElement(model);
                modelListContainer.appendChild(modelElement);
                // If a model was already training when page loaded, start polling its status
                if (model.status === 'training') {
                    pollModelStatus(model._id);
                }
            });
        }
    }

    function createModelElement(model) {
        const div = document.createElement('div');
        div.className = 'list-group-item list-group-item-action d-flex flex-column flex-sm-row justify-content-between align-items-sm-center'; // Adjusted for better layout
        div.innerHTML = `
            <div>
                <h5 class="mb-1">${model.name} (${model.symbol || 'N/A'})</h5>
                <small>
                    Type: ${model.algorithmType || 'N/A'} | 
                    Status: <span class="badge bg-${getStatusColor(model.status)}">${model.status || 'unknown'}</span> | 
                    Features: ${model.features ? model.features.join(', ') : 'N/A'} | 
                    Target: ${model.target || 'N/A'}
                </small>
                <div id="error-message-${model._id}" class="text-danger small mt-1"></div> <!-- Error display per model -->
            </div>
            <div class="mt-2 mt-sm-0"> <!-- Spacing for mobile -->
                <button class="btn btn-sm btn-success me-2 train-button" data-model-id="${model._id}" ${model.status === 'training' ? 'disabled' : ''}>
                    ${model.status === 'training' ? '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Training...' : 'Train'}
                </button>
                <button class="btn btn-sm btn-danger delete-button" data-model-id="${model._id}">Delete</button> 
            </div>
        `;
        
        // Add event listeners for buttons within this element
        const trainButton = div.querySelector('.train-button');
        if (trainButton) {
            trainButton.addEventListener('click', handleTrainModel);
        }
        // Add delete listener
        const deleteButton = div.querySelector('.delete-button');
        if (deleteButton) { 
            deleteButton.addEventListener('click', openDeleteConfirmation);
        }

        return div;
    }

    function getStatusColor(status) {
        switch (status) {
            case 'new': return 'secondary';
            case 'training': return 'warning';
            case 'trained': return 'success';
            case 'error': return 'danger';
            default: return 'light';
        }
    }

    // --- Model Creation --- 
    createModelForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearErrors(); // Clear previous general errors
        
        // Show loading state
        const originalBtnText = createModelBtn.innerHTML;
        createModelBtn.disabled = true;
        createModelBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Creating...';

        const modelName = document.getElementById('modelName').value;
        const modelSymbol = document.getElementById('modelSymbol').value.toUpperCase();
        const modelType = document.getElementById('modelType').value;
        const featuresInput = document.getElementById('modelFeatures').value;
        const modelTarget = document.getElementById('modelTarget').value;

        // Basic validation
        if (!modelName || !modelSymbol || !modelType || !featuresInput || !modelTarget) {
            displayError('Please fill in all required fields.');
            createModelBtn.disabled = false;
            createModelBtn.innerHTML = originalBtnText;
            return;
        }
        
        // Parse features (remove whitespace and filter empty strings)
        const modelFeatures = featuresInput.split(',').map(f => f.trim()).filter(f => f);
        if (modelFeatures.length === 0) {
             displayError('Please provide at least one valid feature.');
             createModelBtn.disabled = false;
             createModelBtn.innerHTML = originalBtnText;
             return;
        }

        const newModelData = {
            name: modelName,
            symbol: modelSymbol,
            algorithmType: modelType,
            features: modelFeatures, 
            target: modelTarget 
        };

        try {
            const response = await fetch(`${API_BASE_URL}/api/models`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newModelData)
            });

            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const createdModel = await response.json();
            userModels.push(createdModel); // Add to local list
            renderModelList(); // Re-render the list
            createModelForm.reset(); // Clear the form
            
            // Show success notification
            showToast(`Model "${modelName}" created successfully`, 'success');
        } catch (error) {
            console.error('Error creating model:', error);
            displayError(`Failed to create model: ${error.message}`);
        } finally {
            // Restore button state
            createModelBtn.disabled = false;
            createModelBtn.innerHTML = originalBtnText;
        }
    });

    // --- Model Training --- 
    async function handleTrainModel(event) {
        const button = event.currentTarget;
        const modelId = button.dataset.modelId;
        const modelErrorContainer = document.getElementById(`error-message-${modelId}`);

        if (!modelId) {
            console.error('Model ID not found for training button');
            displayError('Cannot train model: ID missing.'); // General error
            return;
        }
        
        clearErrors(modelErrorContainer); // Clear previous errors for this specific model

        // Update button state to indicate loading
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Starting...';

        try {
            const response = await fetch(`${API_BASE_URL}/api/models/${modelId}/train`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json' // Important even if body is empty/optional
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            // Update the model status locally and re-render (optimistic update)
            const modelIndex = userModels.findIndex(m => m._id === modelId);
            if (modelIndex > -1) {
                userModels[modelIndex].status = 'training';
                renderModelList(); // Re-render to show 'training' and disable button
                pollModelStatus(modelId); // Start polling for status updates
                showToast('Training started. This may take a few minutes.', 'info');
            }
            
        } catch (error) {
            console.error('Error initiating training:', error);
            displayError(`Failed to start training: ${error.message}`, modelErrorContainer);
            // Reset button state on error
            button.disabled = false;
            button.innerHTML = 'Train';
            // Optionally update model status to 'error' locally if needed
            const modelIndex = userModels.findIndex(m => m._id === modelId);
             if (modelIndex > -1) {
                 userModels[modelIndex].status = 'error'; // Mark as error locally
                 renderModelList(); // Re-render to show error status
             }
        }
    }

    // --- Model Deletion Modal --- 
    function openDeleteConfirmation(event) {
        const button = event.currentTarget;
        modelToDelete = button.dataset.modelId;
        
        if (!modelToDelete) {
            console.error('Model ID not found for delete button');
            displayError('Cannot delete model: ID missing.');
            return;
        }
        
        // Find model name for more descriptive modal
        const model = userModels.find(m => m._id === modelToDelete);
        if (model) {
            document.querySelector('#deleteConfirmModal .modal-body').textContent = 
                `Are you sure you want to delete the model "${model.name}"? This action cannot be undone.`;
        }
        
        deleteConfirmModal.show();
    }
    
    // Confirm delete button handler
    confirmDeleteBtn.addEventListener('click', handleDeleteModel);

    // --- Model Deletion --- 
    async function handleDeleteModel() {
        if (!modelToDelete) {
            console.error('No model selected for deletion');
            deleteConfirmModal.hide();
            return;
        }
        
        const modelErrorContainer = document.getElementById(`error-message-${modelToDelete}`);
        clearErrors(); // Clear general errors
        clearErrors(modelErrorContainer); // Clear specific model errors

        // Disable button and show loading indicator
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Deleting...';

        try {
            const response = await fetch(`${API_BASE_URL}/api/models/${modelToDelete}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})); // Try to parse error, default to empty obj
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            // Find model name for notification
            const modelName = userModels.find(m => m._id === modelToDelete)?.name || "Model";
            
            // Remove model from local state and re-render
            userModels = userModels.filter(m => m._id !== modelToDelete);
            renderModelList();
            
            // Stop polling if it was active for this model
            stopPolling(modelToDelete);
            
            // Show success notification
            showToast(`${modelName} deleted successfully`, 'success');
            
            // Reset and hide modal
            modelToDelete = null;
            deleteConfirmModal.hide();

        } catch (error) {
            console.error('Error deleting model:', error);
            displayError(`Failed to delete model: ${error.message}`); 
            // Modal will stay open to show the error
        } finally {
            // Reset button state
            confirmDeleteBtn.disabled = false;
            confirmDeleteBtn.innerHTML = 'Delete';
        }
    }

    // --- Polling for Model Status ---
    const POLLING_INTERVAL = 5000; // Poll every 5 seconds

    function pollModelStatus(modelId) {
        // Avoid starting multiple polls for the same model
        if (activePolls[modelId]) {
            return;
        }

        activePolls[modelId] = setInterval(async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/models/${modelId}`, { // Assuming GET /api/models/:id gives full model details
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    if (response.status === 404) {
                        stopPolling(modelId);
                    } else if (response.status === 401 || response.status === 403) {
                         stopPolling(modelId);
                         localStorage.removeItem('token');
                         window.location.href = 'index.html';
                    } else {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                    }
                    return; // Don't proceed further in this interval if error occurred
                }

                const updatedModel = await response.json();
                const modelIndex = userModels.findIndex(m => m._id === modelId);

                if (modelIndex > -1) {
                    // Check if status changed from 'training'
                    if (userModels[modelIndex].status === 'training' && updatedModel.status !== 'training') {
                        stopPolling(modelId);
                        
                        // Show toast notification based on status
                        if (updatedModel.status === 'trained') {
                            showToast(`Model "${updatedModel.name}" training completed successfully!`, 'success');
                        } else if (updatedModel.status === 'error') {
                            showToast(`Model "${updatedModel.name}" training failed.`, 'danger');
                        }
                        
                        // Update local data and re-render
                        userModels[modelIndex] = updatedModel;
                        renderModelList(); 
                    } else if (userModels[modelIndex].status !== updatedModel.status) {
                         // Update status if it changed for other reasons
                         userModels[modelIndex] = updatedModel;
                         renderModelList();
                    }
                } else {
                    stopPolling(modelId);
                }

            } catch (error) {
                console.error(`Error polling status for model ${modelId}:`, error);
                const modelErrorContainer = document.getElementById(`error-message-${modelId}`);
                displayError(`Polling failed: ${error.message}`, modelErrorContainer);
                stopPolling(modelId); // Stop polling on error
            }
        }, POLLING_INTERVAL);
    }

    function stopPolling(modelId) {
        if (activePolls[modelId]) {
            clearInterval(activePolls[modelId]);
            delete activePolls[modelId];
        }
    }

    // --- Initial Load --- 
    fetchModels();
}); 