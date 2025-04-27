// API Base URL (consistency)
const API_BASE_URL = /* import.meta.env.VITE_API_URL || */ 'http://localhost:5000';

// Global state for models (simple approach for now)
let userModels = [];
// Global state for managing active polling intervals
const activePolls = {};

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const logoutButton = document.getElementById('logoutButton');
    const createModelForm = document.getElementById('createModelForm');
    const modelListContainer = document.getElementById('modelList');
    const noModelsMessage = document.getElementById('noModelsMessage');
    const dashboardErrorMessagesDiv = document.getElementById('dashboardErrorMessages');

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
            // Fallback if the specific container isn't found (shouldn't happen)
            console.error("Error display container not found, logging message:", message);
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
        } catch (error) {
            console.error('Error fetching models:', error);
            // Use the new error display
            displayError(`Failed to load models: ${error.message}`, modelListContainer);
            // Ensure no models message is hidden if error occurs
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
            deleteButton.addEventListener('click', handleDeleteModel);
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
        const modelName = document.getElementById('modelName').value;
        const modelSymbol = document.getElementById('modelSymbol').value.toUpperCase();
        const modelType = document.getElementById('modelType').value;
        const featuresInput = document.getElementById('modelFeatures').value;
        const modelTarget = document.getElementById('modelTarget').value;

        // Basic validation
        if (!modelName || !modelSymbol || !modelType || !featuresInput || !modelTarget) {
            displayError('Please fill in all required fields.');
            return;
        }
        
        // Parse features (remove whitespace and filter empty strings)
        const modelFeatures = featuresInput.split(',').map(f => f.trim()).filter(f => f);
        if (modelFeatures.length === 0) {
             displayError('Please provide at least one valid feature.');
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
            console.log('Model created:', createdModel);
            userModels.push(createdModel); // Add to local list
            renderModelList(); // Re-render the list
            createModelForm.reset(); // Clear the form

        } catch (error) {
            console.error('Error creating model:', error);
            // Use the new error display
            displayError(`Failed to create model: ${error.message}`);
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
                },
                // Optionally send symbol if needed, though ideally backend gets it from model
                // body: JSON.stringify({ symbol: symbol }) 
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Training initiated:', result);
            // alert(result.message || `Training started for model ${modelId}. Check status.`); // Replaced with polling
            
            // Update the model status locally and re-render (optimistic update)
            const modelIndex = userModels.findIndex(m => m._id === modelId);
            if (modelIndex > -1) {
                userModels[modelIndex].status = 'training';
                renderModelList(); // Re-render to show 'training' and disable button
                pollModelStatus(modelId); // Start polling for status updates
            }
            
        } catch (error) {
            console.error('Error initiating training:', error);
            // alert(`Failed to start training: ${error.message}`);
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

    // --- Model Deletion --- 
    async function handleDeleteModel(event) {
        const button = event.currentTarget;
        const modelId = button.dataset.modelId;
        const modelErrorContainer = document.getElementById(`error-message-${modelId}`);
        
        clearErrors(); // Clear general errors
        clearErrors(modelErrorContainer); // Clear specific model errors

        if (!modelId) {
            console.error('Model ID not found for delete button');
            displayError('Cannot delete model: ID missing.');
            return;
        }

        // Confirmation dialog
        if (!confirm('Are you sure you want to delete this model?')) {
            return;
        }

        // Disable button temporarily
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';

        try {
            const response = await fetch(`${API_BASE_URL}/api/models/${modelId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})); // Try to parse error, default to empty obj
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            console.log('Model deleted:', modelId);
            // Remove model from local state and re-render
            userModels = userModels.filter(m => m._id !== modelId);
            renderModelList();
            // Stop polling if it was active for this model
            stopPolling(modelId);

        } catch (error) {
            console.error('Error deleting model:', error);
            displayError(`Failed to delete model: ${error.message}`, modelErrorContainer); 
            // Re-enable button on error
            button.disabled = false;
            button.innerHTML = 'Delete';
        }
    }

    // --- Polling for Model Status ---
    const POLLING_INTERVAL = 5000; // Poll every 5 seconds

    function pollModelStatus(modelId) {
        // Avoid starting multiple polls for the same model
        if (activePolls[modelId]) {
            console.log(`Polling already active for model ${modelId}`);
            return;
        }

        console.log(`Starting polling for model ${modelId}`);
        activePolls[modelId] = setInterval(async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/models/${modelId}`, { // Assuming GET /api/models/:id gives full model details
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    if (response.status === 404) {
                        console.warn(`Model ${modelId} not found during polling (might be deleted). Stopping poll.`);
                        stopPolling(modelId);
                    } else if (response.status === 401 || response.status === 403) {
                         console.error('Authentication error during polling. Redirecting.');
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
                        console.log(`Model ${modelId} finished training. Status: ${updatedModel.status}. Stopping poll.`);
                        stopPolling(modelId);
                        // Update local data and re-render ONLY if status changed
                        userModels[modelIndex] = updatedModel;
                        renderModelList(); 
                    } else if (userModels[modelIndex].status !== updatedModel.status) {
                         // Update status if it changed for other reasons (though less likely while polling)
                         userModels[modelIndex] = updatedModel;
                         renderModelList();
                    }
                    // If still training, do nothing, wait for next interval
                } else {
                    console.warn(`Model ${modelId} not found in local list during polling. Stopping poll.`);
                    stopPolling(modelId);
                }

            } catch (error) {
                console.error(`Error polling status for model ${modelId}:`, error);
                // Potentially display error, but avoid flooding UI. Maybe stop polling after N errors.
                // Display error in the specific model's error area
                const modelErrorContainer = document.getElementById(`error-message-${modelId}`);
                displayError(`Polling failed: ${error.message}`, modelErrorContainer);
                stopPolling(modelId); // Stop polling on error
            }
        }, POLLING_INTERVAL);
    }

    function stopPolling(modelId) {
        if (activePolls[modelId]) {
            console.log(`Stopping polling for model ${modelId}`);
            clearInterval(activePolls[modelId]);
            delete activePolls[modelId];
        }
    }

    // --- Initial Load --- 
    fetchModels();
}); 