/**
 * Flood DAS - Main Application JavaScript
 * ========================================
 * Smart City Urban Flood Monitoring System
 * 
 * Features:
 * - Interactive Leaflet map with GIS layers
 * - Real-time data updates via polling/WebSocket
 * - Chart.js visualizations
 * - Alert management
 */

// ============================================
// Configuration
// ============================================

const CONFIG = {
    API_URL: 'http://localhost:8000',
    WS_URL: 'ws://localhost:8000/ws',
    UPDATE_INTERVAL: 5000, // Poll every 5 seconds
    MAP_CENTER: [17.4898, 78.4340], // GHMC Zone 12 center (from QGIS data)
    MAP_ZOOM: 12, // Adjusted for full zone coverage
    MAX_CHART_POINTS: 30
};

// ============================================
// Global State
// ============================================

let map = null;
let layers = {
    watershed: null,
    streams: null,
    floodZones: null,
    sensors: null
};
let charts = {
    rainfall: null,
    waterLevel: null,
    discharge: null
};
let websocket = null;
let isConnected = false;

// Chart data arrays
let chartData = {
    labels: [],
    rainfall: [],
    waterLevel: [],
    discharge: []
};

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🌊 Flood DAS - Initializing...');
    
    initDateTime();
    initMap();
    initCharts();
    loadGeoJSONLayers();
    initWebSocket();
    startPolling();
    
    // Initial data fetch
    fetchCurrentStatus();
    fetchAlerts();
    fetchHistoricalData();
    
    console.log('✓ Flood DAS - Ready');
});

// ============================================
// Date/Time Display
// ============================================

function initDateTime() {
    updateDateTime();
    setInterval(updateDateTime, 1000);
}

function updateDateTime() {
    const now = new Date();
    document.getElementById('current-date').textContent = now.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
    document.getElementById('current-time').textContent = now.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// ============================================
// Map Initialization
// ============================================

function initMap() {
    // Initialize Leaflet map
    map = L.map('map', {
        center: CONFIG.MAP_CENTER,
        zoom: CONFIG.MAP_ZOOM,
        zoomControl: true
    });
    
    // Add dark theme tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);
    
    // Initialize layer control buttons
    initLayerControls();
    
    console.log('✓ Map initialized');
}

function initLayerControls() {
    document.getElementById('btn-watershed').addEventListener('click', () => toggleLayer('watershed'));
    document.getElementById('btn-streams').addEventListener('click', () => toggleLayer('streams'));
    document.getElementById('btn-flood-zones').addEventListener('click', () => toggleLayer('floodZones'));
    document.getElementById('btn-sensors').addEventListener('click', () => toggleLayer('sensors'));
}

function toggleLayer(layerName) {
    const btn = document.getElementById(`btn-${layerName.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
    
    if (layers[layerName]) {
        if (map.hasLayer(layers[layerName])) {
            map.removeLayer(layers[layerName]);
            btn.classList.remove('active');
        } else {
            map.addLayer(layers[layerName]);
            btn.classList.add('active');
        }
    }
}

// ============================================
// GeoJSON Layer Loading
// ============================================

async function loadGeoJSONLayers() {
    try {
        // Load watershed boundary
        await loadWatershed();
        
        // Load streams
        await loadStreams();
        
        // Load flood zones
        await loadFloodZones();
        
        // Load sensors
        await loadSensors();
        
        console.log('✓ All GeoJSON layers loaded');
    } catch (error) {
        console.error('Error loading GeoJSON layers:', error);
        // Try loading from local files if API fails
        loadLocalGeoJSON();
    }
}

async function loadWatershed() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/geojson/watershed`);
        const data = await response.json();
        
        layers.watershed = L.geoJSON(data, {
            style: {
                color: '#2980b9',
                weight: 3,
                fillColor: '#2980b9',
                fillOpacity: 0.1,
                dashArray: '5, 5'
            },
            onEachFeature: (feature, layer) => {
                layer.bindPopup(`
                    <div class="popup-title">${feature.properties.name}</div>
                    <div class="popup-row">
                        <span class="popup-label">Area:</span>
                        <span class="popup-value">${feature.properties.area_km2} km²</span>
                    </div>
                    <div class="popup-row">
                        <span class="popup-label">Runoff Coeff:</span>
                        <span class="popup-value">${feature.properties.runoff_coeff}</span>
                    </div>
                    <div class="popup-row">
                        <span class="popup-label">Land Use:</span>
                        <span class="popup-value">${feature.properties.land_use}</span>
                    </div>
                `);
            }
        });
        
        layers.watershed.addTo(map);
        document.getElementById('btn-watershed').classList.add('active');
    } catch (error) {
        console.warn('Could not load watershed from API:', error);
    }
}

async function loadStreams() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/geojson/streams`);
        const data = await response.json();
        
        layers.streams = L.geoJSON(data, {
            style: (feature) => ({
                color: '#3498db',
                weight: feature.properties.stream_order >= 3 ? 4 : 2,
                opacity: 0.8
            }),
            onEachFeature: (feature, layer) => {
                layer.bindPopup(`
                    <div class="popup-title">${feature.properties.name}</div>
                    <div class="popup-row">
                        <span class="popup-label">Stream Order:</span>
                        <span class="popup-value">${feature.properties.stream_order}</span>
                    </div>
                    <div class="popup-row">
                        <span class="popup-label">Length:</span>
                        <span class="popup-value">${feature.properties.length_km} km</span>
                    </div>
                    <div class="popup-row">
                        <span class="popup-label">Type:</span>
                        <span class="popup-value">${feature.properties.type}</span>
                    </div>
                `);
            }
        });
        
        layers.streams.addTo(map);
        document.getElementById('btn-streams').classList.add('active');
    } catch (error) {
        console.warn('Could not load streams from API:', error);
    }
}

async function loadFloodZones() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/geojson/flood_zones`);
        const data = await response.json();
        
        layers.floodZones = L.geoJSON(data, {
            style: (feature) => ({
                color: feature.properties.risk_color,
                weight: 2,
                fillColor: feature.properties.risk_color,
                fillOpacity: 0.3
            }),
            onEachFeature: (feature, layer) => {
                layer.bindPopup(`
                    <div class="popup-title">${feature.properties.name}</div>
                    <div class="popup-row">
                        <span class="popup-label">Risk Level:</span>
                        <span class="popup-value" style="color: ${feature.properties.risk_color}; font-weight: bold;">
                            ${feature.properties.risk_level.toUpperCase()}
                        </span>
                    </div>
                    <div class="popup-row">
                        <span class="popup-label">Flood Depth:</span>
                        <span class="popup-value">${feature.properties.flood_depth_potential_m} m</span>
                    </div>
                    <div class="popup-row">
                        <span class="popup-label">Population at Risk:</span>
                        <span class="popup-value">${feature.properties.population_at_risk.toLocaleString()}</span>
                    </div>
                `);
            }
        });
        
        layers.floodZones.addTo(map);
        document.getElementById('btn-flood-zones').classList.add('active');
    } catch (error) {
        console.warn('Could not load flood zones from API:', error);
    }
}

async function loadSensors() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/geojson/sensors`);
        const data = await response.json();
        
        layers.sensors = L.geoJSON(data, {
            pointToLayer: (feature, latlng) => {
                const icon = L.divIcon({
                    html: `<i class="fas fa-${feature.properties.type === 'rain_gauge' ? 'cloud-rain' : 'water'}" 
                              style="color: ${feature.properties.color}; font-size: 20px;"></i>`,
                    className: 'sensor-marker-icon',
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                });
                return L.marker(latlng, { icon });
            },
            onEachFeature: (feature, layer) => {
                const props = feature.properties;
                layer.bindPopup(`
                    <div class="popup-title">
                        <i class="fas fa-${props.type === 'rain_gauge' ? 'cloud-rain' : 'water'}" 
                           style="color: ${props.color}"></i>
                        ${props.name}
                    </div>
                    <div class="popup-row">
                        <span class="popup-label">Type:</span>
                        <span class="popup-value">${props.type === 'rain_gauge' ? 'Rain Gauge' : 'Water Level Sensor'}</span>
                    </div>
                    <div class="popup-row">
                        <span class="popup-label">Location:</span>
                        <span class="popup-value">${props.location}</span>
                    </div>
                    <div class="popup-row">
                        <span class="popup-label">Status:</span>
                        <span class="popup-value" style="color: #27ae60;">${props.status}</span>
                    </div>
                    <div class="popup-row">
                        <span class="popup-label">Installed:</span>
                        <span class="popup-value">${props.installed_date}</span>
                    </div>
                `);
            }
        });
        
        layers.sensors.addTo(map);
        document.getElementById('btn-sensors').classList.add('active');
    } catch (error) {
        console.warn('Could not load sensors from API:', error);
    }
}

function loadLocalGeoJSON() {
    console.log('Attempting to load local GeoJSON files...');
    // Fallback for when API is not available
    // In production, this would load from local files
}

// ============================================
// Chart Initialization
// ============================================

function initCharts() {
    const chartConfig = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 300
        },
        scales: {
            x: {
                display: false
            },
            y: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)'
                },
                ticks: {
                    color: '#a0aec0',
                    font: { size: 10 }
                }
            }
        },
        plugins: {
            legend: {
                display: false
            }
        }
    };
    
    // Rainfall Chart
    charts.rainfall = new Chart(document.getElementById('rainfall-chart'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            ...chartConfig,
            scales: {
                ...chartConfig.scales,
                y: {
                    ...chartConfig.scales.y,
                    suggestedMin: 0,
                    suggestedMax: 100
                }
            }
        }
    });
    
    // Water Level Chart
    charts.waterLevel = new Chart(document.getElementById('water-level-chart'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: '#9b59b6',
                backgroundColor: 'rgba(155, 89, 182, 0.2)',
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            ...chartConfig,
            scales: {
                ...chartConfig.scales,
                y: {
                    ...chartConfig.scales.y,
                    suggestedMin: 0,
                    suggestedMax: 5
                }
            }
        }
    });
    
    // Discharge Chart
    charts.discharge = new Chart(document.getElementById('discharge-chart'), {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: 'rgba(0, 212, 255, 0.6)',
                borderColor: '#00d4ff',
                borderWidth: 1
            }]
        },
        options: {
            ...chartConfig,
            scales: {
                ...chartConfig.scales,
                y: {
                    ...chartConfig.scales.y,
                    suggestedMin: 0
                }
            }
        }
    });
    
    console.log('✓ Charts initialized');
}

// ============================================
// WebSocket Connection
// ============================================

function initWebSocket() {
    try {
        websocket = new WebSocket(CONFIG.WS_URL);
        
        websocket.onopen = () => {
            console.log('✓ WebSocket connected');
            setConnectionStatus(true);
        };
        
        websocket.onclose = () => {
            console.log('WebSocket disconnected');
            setConnectionStatus(false);
            // Attempt reconnection after 5 seconds
            setTimeout(initWebSocket, 5000);
        };
        
        websocket.onerror = (error) => {
            console.warn('WebSocket error:', error);
            setConnectionStatus(false);
        };
        
        websocket.onmessage = (event) => {
            handleWebSocketMessage(JSON.parse(event.data));
        };
    } catch (error) {
        console.warn('WebSocket initialization failed:', error);
        setConnectionStatus(false);
    }
}

function handleWebSocketMessage(data) {
    console.log('WS Message:', data.type);
    
    if (data.type === 'rainfall_update') {
        updateMetric('rainfall', data.rainfall_mm);
        updateMetric('discharge', data.discharge_m3s);
        addChartData(data.rainfall_mm, null, data.discharge_m3s);
    } else if (data.type === 'water_level_update') {
        updateMetric('water-level', data.level_m);
        addChartData(null, data.level_m, null);
    }
    
    // Check for new alerts
    if (data.alerts && data.alerts.length > 0) {
        data.alerts.forEach(alert => {
            showAlertBanner(alert);
        });
        fetchAlerts(); // Refresh alert list
    }
    
    // Update last update time
    updateLastUpdateTime();
}

function setConnectionStatus(connected) {
    isConnected = connected;
    const statusEl = document.getElementById('connection-status');
    
    if (connected) {
        statusEl.className = 'connection-status connected';
        statusEl.innerHTML = '<i class="fas fa-circle"></i><span>Connected</span>';
    } else {
        statusEl.className = 'connection-status disconnected';
        statusEl.innerHTML = '<i class="fas fa-circle"></i><span>Disconnected</span>';
    }
}

// ============================================
// Polling (Fallback for WebSocket)
// ============================================

function startPolling() {
    setInterval(() => {
        fetchCurrentStatus();
        fetchAlerts();
    }, CONFIG.UPDATE_INTERVAL);
}

// ============================================
// API Data Fetching
// ============================================

async function fetchCurrentStatus() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/current_status`);
        const data = await response.json();
        
        updateMetric('rainfall', data.latest_rainfall_mm);
        updateMetric('water-level', data.latest_water_level_m);
        updateMetric('discharge', data.latest_discharge_m3s);
        updateRiskLevel(data.risk_level, data.status_message);
        
        // Update connection status if polling works
        if (!isConnected) {
            setConnectionStatus(true);
        }
        
        updateLastUpdateTime();
    } catch (error) {
        console.warn('Error fetching status:', error);
        setConnectionStatus(false);
    }
}

async function fetchAlerts() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/alerts?limit=10&active_only=true`);
        const alerts = await response.json();
        
        renderAlerts(alerts);
        document.getElementById('alert-count').textContent = alerts.length;
    } catch (error) {
        console.warn('Error fetching alerts:', error);
    }
}

async function fetchHistoricalData() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/history?hours=6`);
        const data = await response.json();
        
        // Populate charts with historical data
        if (data.rainfall) {
            data.rainfall.forEach(point => {
                addChartData(point.value, null, null, new Date(point.timestamp));
            });
        }
        if (data.water_level) {
            data.water_level.forEach(point => {
                addChartData(null, point.value, null, new Date(point.timestamp));
            });
        }
        if (data.discharge) {
            data.discharge.forEach(point => {
                addChartData(null, null, point.value, new Date(point.timestamp));
            });
        }
    } catch (error) {
        console.warn('Error fetching historical data:', error);
    }
}

// ============================================
// UI Updates
// ============================================

function updateMetric(metricId, value) {
    const el = document.getElementById(`${metricId}-value`);
    if (el) {
        const formattedValue = typeof value === 'number' ? 
            (metricId === 'water-level' ? value.toFixed(2) : value.toFixed(1)) : value;
        el.textContent = formattedValue;
        
        // Add visual feedback for changes
        el.classList.add('updated');
        setTimeout(() => el.classList.remove('updated'), 500);
    }
}

function updateRiskLevel(level, message) {
    const card = document.getElementById('risk-card');
    const levelEl = document.getElementById('risk-level');
    const messageEl = document.getElementById('risk-message');
    
    // Remove all risk classes
    card.classList.remove('normal', 'low', 'medium', 'high', 'critical');
    
    // Add current risk class
    const riskClass = level.toLowerCase();
    card.classList.add(riskClass);
    
    levelEl.textContent = level;
    messageEl.textContent = message;
}

function renderAlerts(alerts) {
    const container = document.getElementById('alert-list');
    
    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="no-alerts">
                <i class="fas fa-check-circle"></i>
                <p>No active alerts</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = alerts.map(alert => `
        <div class="alert-item ${alert.severity}">
            <i class="fas fa-exclamation-triangle"></i>
            <div class="alert-content">
                <div class="alert-type">${alert.alert_type}</div>
                <div class="alert-message">${alert.message}</div>
                <div class="alert-time">${formatTimestamp(alert.timestamp)}</div>
            </div>
        </div>
    `).join('');
}

function addChartData(rainfall, waterLevel, discharge, timestamp = new Date()) {
    const timeLabel = timestamp.toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    // Add to rainfall chart
    if (rainfall !== null) {
        charts.rainfall.data.labels.push(timeLabel);
        charts.rainfall.data.datasets[0].data.push(rainfall);
        
        if (charts.rainfall.data.labels.length > CONFIG.MAX_CHART_POINTS) {
            charts.rainfall.data.labels.shift();
            charts.rainfall.data.datasets[0].data.shift();
        }
        charts.rainfall.update('none');
    }
    
    // Add to water level chart
    if (waterLevel !== null) {
        charts.waterLevel.data.labels.push(timeLabel);
        charts.waterLevel.data.datasets[0].data.push(waterLevel);
        
        if (charts.waterLevel.data.labels.length > CONFIG.MAX_CHART_POINTS) {
            charts.waterLevel.data.labels.shift();
            charts.waterLevel.data.datasets[0].data.shift();
        }
        charts.waterLevel.update('none');
    }
    
    // Add to discharge chart
    if (discharge !== null) {
        charts.discharge.data.labels.push(timeLabel);
        charts.discharge.data.datasets[0].data.push(discharge);
        
        if (charts.discharge.data.labels.length > CONFIG.MAX_CHART_POINTS) {
            charts.discharge.data.labels.shift();
            charts.discharge.data.datasets[0].data.shift();
        }
        charts.discharge.update('none');
    }
}

function updateLastUpdateTime() {
    const el = document.getElementById('last-update');
    el.textContent = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// ============================================
// Alert Banner
// ============================================

function showAlertBanner(alert) {
    const banner = document.getElementById('alert-banner');
    const message = document.getElementById('alert-banner-message');
    
    message.textContent = `${alert.type}: ${alert.message || 'Check dashboard for details'}`;
    banner.classList.add('show');
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        closeAlertBanner();
    }, 10000);
}

function closeAlertBanner() {
    const banner = document.getElementById('alert-banner');
    banner.classList.remove('show');
}

// ============================================
// Utilities
// ============================================

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hrs ago`;
    
    return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ============================================
// Global Error Handler
// ============================================

window.onerror = function(msg, url, line) {
    console.error('Global error:', msg, url, line);
    return false;
};

// Make closeAlertBanner globally accessible
window.closeAlertBanner = closeAlertBanner;
