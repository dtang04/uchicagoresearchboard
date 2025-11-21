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
 * @returns {Promise<Array<string>>} Array of lab names or professor names that are trending
 */
async function getTrendingLabs(departmentName) {
    // Normalize department name for cache key and API call
    const normalizedDept = departmentName.toLowerCase().trim();
    
    // Check cache first
    if (trendingLabsCache.data && trendingLabsCache.timestamp) {
        const age = Date.now() - trendingLabsCache.timestamp;
        if (age < trendingLabsCache.ttl && trendingLabsCache.data[normalizedDept]) {
            console.log(`[Trending Labs] Using cached data for ${departmentName}:`, trendingLabsCache.data[normalizedDept]);
            return trendingLabsCache.data[normalizedDept];
        }
    }
    
    try {
        // Fetch trending labs from backend API
        const trendingData = await fetchTrendingLabsFromBackend(departmentName);
        
        // Update cache
        if (!trendingLabsCache.data) {
            trendingLabsCache.data = {};
        }
        trendingLabsCache.data[normalizedDept] = trendingData;
        trendingLabsCache.timestamp = Date.now();
        
        return trendingData;
    } catch (error) {
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
 * @returns {Promise<Array<string>>} Array of trending lab names
 */
async function fetchTrendingLabsFromBackend(departmentName) {
    try {
        // Normalize department name for API call
        const normalizedDept = departmentName.toLowerCase().trim();
        
        // Get API base URL from config.js
        const API_BASE = window.API_BASE_URL || 'http://localhost:3001/api';
        const API_URL = `${API_BASE}/trending-labs`;
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                department: normalizedDept
            })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        const trendingLabs = data.trendingLabs || [];
        console.log(`[Trending Labs] Backend returned for ${departmentName}:`, trendingLabs);
        return trendingLabs;
    } catch (error) {
        console.error('[Trending Labs] Backend API error:', error.message);
        return [];
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getTrendingLabs, clearTrendingLabsCache };
}
