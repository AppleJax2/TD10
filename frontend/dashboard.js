// API Base URL (consistency)
const API_BASE_URL = /* import.meta.env.VITE_API_URL || */ 'http://localhost:5000';

// Global state for models (simple approach for now)
let userModels = [];

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const logoutButton = document.getElementById('logoutButton');
    const createModelForm = document.getElementById('createModelForm');
    const modelListContainer = document.getElementById('modelList');
    const noModelsMessage = document.getElementById('noModelsMessage');

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
            modelListContainer.innerHTML = '<p class="text-danger">Failed to load models.</p>';
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
            });
        }
    }

    function createModelElement(model) {
        const div = document.createElement('div');
        div.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
        div.innerHTML = `
            <div>
                <h5 class="mb-1">${model.name} (${model.symbol || 'N/A'})</h5>
                <small>Type: ${model.algorithmType || 'N/A'} | Status: <span class="badge bg-${getStatusColor(model.status)}">${model.status || 'unknown'}</span></small>
            </div>
            <div>
                <button class="btn btn-sm btn-success me-2 train-button" data-model-id="${model._id}" data-symbol="${model.symbol}" ${model.status === 'training' ? 'disabled' : ''}>
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
        // Add delete listener later
        // const deleteButton = div.querySelector('.delete-button');
        // if (deleteButton) { deleteButton.addEventListener('click', handleDeleteModel); }

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
        const modelName = document.getElementById('modelName').value;
        const modelSymbol = document.getElementById('modelSymbol').value.toUpperCase();
        const modelType = document.getElementById('modelType').value;

        // Basic validation
        if (!modelName || !modelSymbol || !modelType) {
            alert('Please fill in all required fields.');
            return;
        }

        const newModelData = {
            name: modelName,
            symbol: modelSymbol,
            algorithmType: modelType,
            // Hardcode features/target for now - make these form inputs later
            features: ['close', 'volume'], 
            target: 'next_day_direction' 
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
            alert(`Failed to create model: ${error.message}`);
        }
    });

    // --- Model Training --- 
    async function handleTrainModel(event) {
        const button = event.currentTarget;
        const modelId = button.dataset.modelId;
        const symbol = button.dataset.symbol;

        if (!modelId) {
            console.error('Model ID not found for training button');
            return;
        }

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
            alert(result.message || `Training started for model ${modelId}. Check status.`);
            
            // Update the model status locally and re-render (optimistic update)
            const modelIndex = userModels.findIndex(m => m._id === modelId);
            if (modelIndex > -1) {
                userModels[modelIndex].status = 'training';
                renderModelList();
            }
            // TODO: Implement polling or websockets to get real-time training status updates
            // For now, the user has to refresh or we manually update after a delay
            // setTimeout(fetchModels, 10000); // Simple poll after 10s

        } catch (error) {
            console.error('Error initiating training:', error);
            alert(`Failed to start training: ${error.message}`);
            // Reset button state on error
            button.disabled = false;
            button.innerHTML = 'Train';
            // Optionally update model status to 'error' locally if needed
        }
    }

    // --- Initial Load --- 
    fetchModels();
}); 