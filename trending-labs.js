// Trending Labs Detection Module
// Fetches trending labs from backend database

// Cache for trending labs data (to avoid repeated API calls)
let trendingLabsCache = {
    data: null,
    timestamp: null,
    ttl: 5 * 60 * 1000 // 5 minutes in milliseconds (reduced for faster updates)
};

/**
 * Get trending labs for a department from backend database
 * @param {string} departmentName - Name of the department
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Array<string>>} Array of lab names or professor names that are trending
 */
async function getTrendingLabs(departmentName, signal = null) {
    if (signal && signal.aborted) {
        return [];
    }
    
    const normalizedDept = departmentName.toLowerCase().trim();
    
    // Check cache first
    if (trendingLabsCache.data && trendingLabsCache.timestamp) {
        const age = Date.now() - trendingLabsCache.timestamp;
        if (age < trendingLabsCache.ttl && trendingLabsCache.data[normalizedDept]) {
            return trendingLabsCache.data[normalizedDept];
        }
    }
    
    if (signal && signal.aborted) {
        return [];
    }
    
    try {
        const trendingData = await fetchTrendingLabsFromBackend(departmentName, signal);
        
        if (signal && signal.aborted) {
            return [];
        }
        
        // Update cache
        if (!trendingLabsCache.data) {
            trendingLabsCache.data = {};
        }
        trendingLabsCache.data[normalizedDept] = trendingData;
        trendingLabsCache.timestamp = Date.now();
        
        return trendingData;
    } catch (error) {
        if (error.name === 'AbortError') {
            return [];
        }
        console.error('Error fetching trending labs:', error);
        return [];
    }
}

/**
 * Clear trending labs cache (useful after tracking clicks)
 */
function clearTrendingLabsCache() {
    trendingLabsCache.data = null;
    trendingLabsCache.timestamp = null;
}

/**
 * Fetch trending labs from backend API
 * @param {string} departmentName - Name of the department
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Array<string>>} Array of trending lab names
 */
async function fetchTrendingLabsFromBackend(departmentName, signal = null) {
    try {
        if (signal && signal.aborted) {
            return [];
        }
        
        const normalizedDept = departmentName.toLowerCase().trim();
        const API_BASE = window.API_BASE_URL || 'http://localhost:3001/api';
        
        const response = await fetch(`${API_BASE}/trending-labs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                department: normalizedDept
            }),
            signal: signal || undefined
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.trendingLabs || [];
    } catch (error) {
        if (error.name === 'AbortError') {
            return [];
        }
        console.error('[Trending Labs] Backend API error:', error.message);
        return [];
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getTrendingLabs, clearTrendingLabsCache };
}
