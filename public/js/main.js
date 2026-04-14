// DOM Elements
const apiStatus = document.getElementById('api-status');
const dbStatus = document.getElementById('db-status');
const apiDot = apiStatus.querySelector('.status-dot');
const apiText = apiStatus.querySelector('.status-text');
const dbDot = dbStatus.querySelector('.status-dot');
const dbText = dbStatus.querySelector('.status-text');

// Check API Health
async function checkAPIHealth() {
    try {
        const response = await fetch('/api/health', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            apiDot.classList.add('online');
            apiDot.classList.remove('offline');
            apiText.textContent = `API Online - ${data.environment || 'development'}`;
            console.log('API Health Check:', data);
        } else {
            throw new Error('API returned error');
        }
    } catch (error) {
        apiDot.classList.add('offline');
        apiDot.classList.remove('online');
        apiText.textContent = 'API Offline';
        console.error('API Health Check Failed:', error.message);
    }
}

// Check Database Status (indirectly through API)
async function checkDatabaseStatus() {
    try {
        const response = await fetch('/api/health', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // If API is running, assume DB is connected
        if (data.success && data.database === 'connected') {
            dbDot.classList.add('online');
            dbDot.classList.remove('offline');
            dbText.textContent = 'Database Connected';
            console.log('Database Status:', data);
        } else {
            throw new Error('Database connection issue');
        }
    } catch (error) {
        dbDot.classList.add('offline');
        dbDot.classList.remove('online');
        dbText.textContent = 'Database Disconnected';
        console.error('Database Status Check Failed:', error.message);
    }
}

// Initialize checks when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Tutor Availability System - Phase 9');
    
    // Run health checks
    checkAPIHealth();
    checkDatabaseStatus();
    
    // Set up periodic checks (every 30 seconds)
    setInterval(() => {
        checkAPIHealth();
        checkDatabaseStatus();
    }, 30000);
});

// Utility function for future API calls
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(endpoint, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'API request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API Call Error:', error);
        throw error;
    }
}

// Export for use in other modules
window.tutorSystem = {
    apiCall,
    checkAPIHealth,
    checkDatabaseStatus
};
