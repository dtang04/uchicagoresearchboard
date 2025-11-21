// API Service Module
// Handles all communication with the backend API

// Get API base URL from config.js (set as window.API_BASE_URL)
const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001/api';

// Cache for department data (to avoid repeated API calls)
let departmentDataCache = {
    data: null,
    timestamp: null,
    ttl: 5 * 60 * 1000 // 5 minutes in milliseconds
};

/**
 * Get all departments data from backend
 * @returns {Promise<Object>} Object with department names as keys and arrays of professors/labs as values
 */
async function getAllDepartmentsData() {
    // Check cache first
    if (departmentDataCache.data && departmentDataCache.timestamp) {
        const age = Date.now() - departmentDataCache.timestamp;
        if (age < departmentDataCache.ttl) {
            return departmentDataCache.data;
        }
    }
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch(`${API_BASE_URL}/departments`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        const departments = data.departments || {};
        
        // Update cache
        departmentDataCache.data = departments;
        departmentDataCache.timestamp = Date.now();
        
        return departments;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('[API Service] Request timeout - backend may not be running');
        } else {
            console.error('[API Service] Error fetching all departments:', error);
        }
        return {};
    }
}

/**
 * Get department data by name from backend
 * @param {string} departmentName - Name of the department
 * @returns {Promise<Array>} Array of professor/lab objects
 */
async function getDepartmentData(departmentName) {
    if (!departmentName) {
        return [];
    }
    
    const normalized = departmentName.toLowerCase().trim();
    const startTime = performance.now();
    
    // Check cache first
    if (departmentDataCache.data && departmentDataCache.timestamp) {
        const age = Date.now() - departmentDataCache.timestamp;
        if (age < departmentDataCache.ttl && departmentDataCache.data[normalized]) {
            console.log(`[API Service] Cache hit for ${departmentName} (${(performance.now() - startTime).toFixed(2)}ms)`);
            return departmentDataCache.data[normalized];
        }
    }
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const fetchStart = performance.now();
        const response = await fetch(`${API_BASE_URL}/departments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                department: departmentName
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        const professors = data.data || [];
        const fetchTime = performance.now() - fetchStart;
        
        console.log(`[API Service] Fetched ${departmentName}: ${professors.length} results in ${fetchTime.toFixed(2)}ms`);
        
        // Update cache
        if (!departmentDataCache.data) {
            departmentDataCache.data = {};
        }
        departmentDataCache.data[normalized] = professors;
        departmentDataCache.timestamp = Date.now();
        
        return professors;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('[API Service] Request timeout - backend may not be running');
        } else {
            console.error('[API Service] Error fetching department data:', error);
        }
        return [];
    }
}

/**
 * Get list of all available department names
 * @returns {Promise<Array<string>>} Array of department names
 */
async function getDepartmentList() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch(`${API_BASE_URL}/departments/list`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.departments || [];
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('[API Service] Request timeout - backend may not be running');
        } else {
            console.error('[API Service] Error fetching department list:', error);
        }
        return [];
    }
}

/**
 * Clear the department data cache
 */
function clearDepartmentCache() {
    departmentDataCache.data = null;
    departmentDataCache.timestamp = null;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        getAllDepartmentsData, 
        getDepartmentData, 
        getDepartmentList,
        clearDepartmentCache
    };
}

