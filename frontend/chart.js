// API Base URL
const API_BASE_URL = /* import.meta.env.VITE_API_URL || */ 'http://localhost:5000';

// Lightweight Charts instance and series
let chart = null;
let priceSeries = null;
let signalMarkers = []; // Store markers to manage them

// Interval timer for live updates
let liveUpdateInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const logoutButton = document.getElementById('logoutButton');
    const modelSelect = document.getElementById('modelSelect');
    const symbolInput = document.getElementById('symbolInput');
    const loadChartButton = document.getElementById('loadChartButton');
    const loadChartSpinner = document.getElementById('loadChartSpinner');
    const chartContainer = document.getElementById('chartContainer');
    const chartElement = document.getElementById('chart');
    const signalInfoDiv = document.getElementById('signalInfo');
    const signalDataSpan = document.getElementById('signalData');
    const statusIndicator = document.getElementById('statusIndicator');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
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

    // --- Authentication & Logout ---
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userEmail');
        if (liveUpdateInterval) clearInterval(liveUpdateInterval);
        window.location.href = 'index.html';
    });

    // --- Initialize Chart --- 
    function initializeChart() {
        if (chart) { // If chart exists, remove it before creating new
            chart.remove();
            chart = null;
        }
        chart = LightweightCharts.createChart(chartElement, {
            width: chartContainer.clientWidth,
            height: chartContainer.clientHeight,
            layout: {
                backgroundColor: '#ffffff',
                textColor: '#333',
            },
            grid: {
                vertLines: {
                    color: '#f0f0f0',
                },
                horzLines: {
                    color: '#f0f0f0',
                },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false, // Adjust based on data frequency
            },
        });
        priceSeries = chart.addCandlestickSeries(); // Use candlestick for price visualization
        chart.timeScale().fitContent();
    }

    // Handle window resize
    const resizeObserver = new ResizeObserver(entries => {
      if (chart && entries.length > 0 && entries[0].contentRect) {
        chart.applyOptions({ 
            width: entries[0].contentRect.width,
            height: entries[0].contentRect.height 
        });
      }
    });
    resizeObserver.observe(chartContainer);


    // --- Fetch Models for Dropdown --- 
    async function fetchModelsForSelect() {
        try {
            // Show loading state in select
            modelSelect.innerHTML = '<option selected disabled value="">Loading models...</option>';
            
            const response = await fetch(`${API_BASE_URL}/api/models`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch models');
            const models = await response.json();
            
            modelSelect.innerHTML = '<option selected disabled value="">Choose...</option>'; // Reset
            
            const trainedModels = models.filter(m => m.status === 'trained');
            
            if (trainedModels.length === 0) {
                modelSelect.innerHTML = '<option disabled selected value="">No trained models available</option>';
                showToast('No trained models found. Please train a model first.', 'warning');
                return;
            }
            
            trainedModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model._id;
                option.textContent = `${model.name} (${model.symbol})`;
                option.dataset.symbol = model.symbol; // Store symbol for easy access
                modelSelect.appendChild(option);
            });
            
            showToast(`Loaded ${trainedModels.length} trained models`, 'success', 2000);
        } catch (error) {
            modelSelect.innerHTML = '<option disabled selected value="">Error loading models</option>';
            showToast('Failed to load models', 'danger');
            updateStatus('Error: ' + error.message, 'danger');
        }
    }
    
    // Auto-fill symbol when a model is selected
    modelSelect.addEventListener('change', (event) => {
        const selectedOption = event.target.selectedOptions[0];
        if (selectedOption && selectedOption.dataset.symbol) {
            symbolInput.value = selectedOption.dataset.symbol;
        }
    });

    // --- Fetch Historical Data Function ---
    async function fetchHistoricalData(symbol, range = 100) {
        try {
            updateStatus('Fetching historical data...', 'info');
            const response = await fetch(`${API_BASE_URL}/api/data/historical/${symbol}?days=${range}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch historical data (${response.status})`);
            }
            
            const data = await response.json();
            
            if (!data || !data.historical || !Array.isArray(data.historical)) {
                throw new Error('Invalid historical data format');
            }
            
            // Transform API data to chart library format
            // FMP data is newest first, we need to reverse for chronological order
            const formattedData = data.historical
                .map(item => ({
                    time: new Date(item.date).getTime() / 1000, // Convert to UNIX timestamp
                    open: item.open,
                    high: item.high,
                    low: item.low,
                    close: item.close,
                    volume: item.volume
                }))
                .reverse(); // Reverse to get chronological order
            
            // Get the most recent closing price for future updates
            if (formattedData.length > 0) {
                lastClosePrice = formattedData[formattedData.length - 1].close;
                lastTimestamp = formattedData[formattedData.length - 1].time;
            }
            
            showToast(`Loaded ${formattedData.length} historical data points`, 'success', 2000);
            updateStatus('Historical data loaded', 'success', 3000);
            return formattedData;
        } catch (error) {
            updateStatus(`Error: ${error.message}`, 'danger');
            showToast(`Error loading data: ${error.message}`, 'danger');
            throw error;
        }
    }
    
    // --- Update Status Indicator ---
    function updateStatus(message, type = 'info', autoHideAfter = 0) {
        statusIndicator.textContent = message;
        statusIndicator.className = `mt-2 text-center alert alert-${type}`;
        statusIndicator.style.display = 'block';
        
        if (autoHideAfter > 0) {
            setTimeout(() => {
                statusIndicator.style.display = 'none';
            }, autoHideAfter);
        }
    }

    // --- Load Chart Button Handler ---
    loadChartButton.addEventListener('click', async () => {
        const selectedModelId = modelSelect.value;
        const symbol = symbolInput.value.toUpperCase();

        if (!symbol) {
            showToast('Please enter a symbol', 'warning');
            symbolInput.focus();
            return;
        }
        
        // Show loading state
        loadChartButton.disabled = true;
        loadChartSpinner.classList.remove('d-none');
        
        // Stop previous updates if any
        if (liveUpdateInterval) clearInterval(liveUpdateInterval);
        signalMarkers = []; // Clear old markers
        signalInfoDiv.style.display = 'none';

        try {
            // Initialize chart
            initializeChart();
            
            // Fetch historical data first
            const historicalData = await fetchHistoricalData(symbol);
            
            // Set the historical data to the chart
            priceSeries.setData(historicalData);
            
            // Fit chart content to view all historical data
            chart.timeScale().fitContent();
            
            // Start live updates
            startLiveUpdates(symbol, selectedModelId);
            
            // Show success message
            showToast(`Chart for ${symbol} loaded successfully`, 'success');
        } catch (error) {
            updateStatus(`Failed to load chart: ${error.message}`, 'danger');
        } finally {
            // Reset button state
            loadChartButton.disabled = false;
            loadChartSpinner.classList.add('d-none');
        }
    });

    // --- Live Data Fetching & Signal Fetching ---
    let lastTimestamp = Math.floor(Date.now() / 1000);
    let lastClosePrice = 100;

    function startLiveUpdates(symbol, modelId) {
        updateStatus('Live updates started', 'success', 3000);
        
        // Clear any existing interval
        if (liveUpdateInterval) clearInterval(liveUpdateInterval);
        
        liveUpdateInterval = setInterval(async () => {
            try {
                // 1. Fetch latest price data
                const priceResponse = await fetch(`${API_BASE_URL}/api/data/realtime/${symbol}`, {
                     headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (!priceResponse.ok) throw new Error('Failed to fetch price data');
                
                const priceData = await priceResponse.json();
                
                if (!priceData || !priceData[0]) {
                    throw new Error('Invalid price data format');
                }
                
                const quote = priceData[0];
                const currentPrice = parseFloat(quote.price);
                const currentTimestamp = Math.floor(new Date(quote.timestamp || Date.now()).getTime() / 1000);
                
                // Create a new data point
                const newDataPoint = {
                    time: currentTimestamp,
                    open: lastClosePrice,
                    high: Math.max(lastClosePrice, currentPrice),
                    low: Math.min(lastClosePrice, currentPrice),
                    close: currentPrice
                };
                
                // Update the price series with new data
                priceSeries.update(newDataPoint);
                lastClosePrice = currentPrice;
                lastTimestamp = currentTimestamp;

                // 2. If a model is selected, fetch signal
                if (modelId) {
                    try {
                        const signalEndpoint = `${API_BASE_URL}/api/models/${modelId}/signal`;
                        const signalResponse = await fetch(signalEndpoint, {
                            method: 'POST',
                            headers: { 
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                symbol: symbol,
                                price: currentPrice,
                                threshold: 0.01 // Default threshold, could be made configurable
                            })
                        });
                        
                        if (!signalResponse.ok) {
                            throw new Error(`Signal API error: ${signalResponse.status}`);
                        }
                        
                        const signalData = await signalResponse.json();
                        
                        if (signalData && signalData.signal) {
                            displaySignal(signalData.signal, currentTimestamp);
                        }
                    } catch (signalError) {
                        // We don't want to stop price updates if signal fetch fails
                        updateStatus(`Signal error: ${signalError.message}`, 'warning', 5000);
                    }
                }

            } catch (error) {
                updateStatus('Disconnected - retrying...', 'warning');
            }
        }, 60000); // Update every 60 seconds
    }

    // --- Signal Display --- 
    function displaySignal(signal, time) {
        if (!signal || !signal.direction || signal.direction === 'NEUTRAL') {
            signalInfoDiv.style.display = 'none';
            return; // Don't mark neutral signals for now
        }

        const marker = {
            time: time,
            position: signal.direction === 'BUY' ? 'belowBar' : 'aboveBar',
            color: signal.direction === 'BUY' ? '#26a69a' : '#ef5350',
            shape: signal.direction === 'BUY' ? 'arrowUp' : 'arrowDown',
            text: `${signal.direction} @ ${signal.value.toFixed(2)} (Conf: ${signal.confidence.toFixed(2)})`
        };
        
        signalMarkers.push(marker);
        priceSeries.setMarkers(signalMarkers); // Update markers on the series

        // Update signal info display
        signalDataSpan.textContent = `${signal.direction} at $${signal.currentPrice.toFixed(2)} (Confidence: ${(signal.confidence * 100).toFixed(1)}%)`;
        signalInfoDiv.className = `mt-3 alert ${signal.direction === 'BUY' ? 'alert-success' : 'alert-danger'}`;
        signalInfoDiv.style.display = 'block';
        
        // Also show toast for significant signals
        if (signal.confidence > 0.7) {
            showToast(`New ${signal.direction} signal with high confidence!`, signal.direction === 'BUY' ? 'success' : 'danger');
        }
    }

    // --- Initial Setup --- 
    initializeChart(); // Draw initial chart structure
    fetchModelsForSelect(); // Populate model dropdown

}); 