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
    const chartContainer = document.getElementById('chartContainer');
    const chartElement = document.getElementById('chart');
    const signalInfoDiv = document.getElementById('signalInfo');
    const signalDataSpan = document.getElementById('signalData');

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
        // Example initial data - replace with fetched data
        priceSeries.setData([
             { time: '2022-01-01', open: 100, high: 105, low: 98, close: 102 },
             { time: '2022-01-02', open: 102, high: 103, low: 99, close: 100 },
        ]);
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
            const response = await fetch(`${API_BASE_URL}/api/models`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch models');
            const models = await response.json();
            
            modelSelect.innerHTML = '<option selected disabled value="">Choose...</option>'; // Reset
            models.filter(m => m.status === 'trained').forEach(model => { // Only show trained models
                const option = document.createElement('option');
                option.value = model._id;
                option.textContent = `${model.name} (${model.symbol})`;
                option.dataset.symbol = model.symbol; // Store symbol for easy access
                modelSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error populating models:', error);
            modelSelect.innerHTML = '<option disabled>Error loading models</option>';
        }
    }
    
    // Auto-fill symbol when a model is selected
    modelSelect.addEventListener('change', (event) => {
        const selectedOption = event.target.selectedOptions[0];
        if (selectedOption && selectedOption.dataset.symbol) {
            symbolInput.value = selectedOption.dataset.symbol;
        }
    });

    // --- Load Chart Button Handler ---
    loadChartButton.addEventListener('click', () => {
        const selectedModelId = modelSelect.value;
        const symbol = symbolInput.value.toUpperCase();

        if (!symbol) {
            alert('Please enter a symbol.');
            return;
        }
        // Model selection is optional for just viewing price, mandatory for signals
        
        console.log(`Loading chart for symbol: ${symbol}, Model: ${selectedModelId || 'None'}`);
        
        // Stop previous updates if any
        if (liveUpdateInterval) clearInterval(liveUpdateInterval);
        signalMarkers = []; // Clear old markers
        signalInfoDiv.style.display = 'none';

        // TODO: Fetch HISTORICAL data first to populate the chart initially
        // For now, we just re-initialize with dummy data
        initializeChart(); 
        
        // Start live updates
        startLiveUpdates(symbol, selectedModelId);
    });

    // --- Live Data Simulation & Signal Fetching ---
    let lastTimestamp = Math.floor(new Date('2022-01-02').getTime() / 1000);
    let lastClosePrice = 100;

    function startLiveUpdates(symbol, modelId) {
        liveUpdateInterval = setInterval(async () => {
            try {
                // 1. Fetch latest price (using dummy endpoint for now)
                const priceResponse = await fetch(`${API_BASE_URL}/api/data/price?symbol=${symbol}`, {
                     headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!priceResponse.ok) throw new Error('Failed to fetch price');
                const priceData = await priceResponse.json();
                const currentPrice = parseFloat(priceData.price);
                
                // Create a new data point (simulate OHLC)
                lastTimestamp += 60; // Simulate 1 minute interval
                const newDataPoint = {
                    time: lastTimestamp,
                    open: lastClosePrice,
                    high: Math.max(lastClosePrice, currentPrice) + Math.random() * 2, // Simulate wick
                    low: Math.min(lastClosePrice, currentPrice) - Math.random() * 2, // Simulate wick
                    close: currentPrice
                };
                priceSeries.update(newDataPoint);
                lastClosePrice = currentPrice;

                // 2. If a model is selected, fetch signal
                if (modelId) {
                    const signalResponse = await fetch(`${API_BASE_URL}/api/data/signal?modelId=${modelId}&price=${currentPrice}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!signalResponse.ok) {
                         console.error('Failed to fetch signal');
                    } else {
                        const signalData = await signalResponse.json();
                        console.log('Received Signal:', signalData);
                        displaySignal(signalData, newDataPoint.time);
                    }
                }

            } catch (error) {
                console.error('Error during live update:', error);
                // Optionally stop updates on error
                // if (liveUpdateInterval) clearInterval(liveUpdateInterval);
                // alert('Live updates failed.');
            }
        }, 5000); // Update every 5 seconds (adjust interval as needed)
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
            text: `${signal.direction} @ ${signal.value.toFixed(2)} (Conf: ${signal.confidence})`
        };
        
        signalMarkers.push(marker);
        priceSeries.setMarkers(signalMarkers); // Update markers on the series

        // Update signal info display
        signalDataSpan.textContent = `${signal.direction} at ${signal.value.toFixed(2)} (Confidence: ${signal.confidence * 100}%)`;
        signalInfoDiv.className = `mt-3 alert ${signal.direction === 'BUY' ? 'alert-success' : 'alert-danger'}`;
        signalInfoDiv.style.display = 'block';
    }

    // --- Initial Setup --- 
    initializeChart(); // Draw initial chart structure
    fetchModelsForSelect(); // Populate model dropdown

}); 