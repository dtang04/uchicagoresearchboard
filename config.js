// Configuration for API endpoints
// Automatically detects if running locally or in production

(function() {
    // Check if we're in production (hosted on a domain, not localhost)
    const isProduction = window.location.hostname !== 'localhost' && 
                         window.location.hostname !== '127.0.0.1' &&
                         !window.location.hostname.startsWith('192.168.');
    
    if (isProduction) {
        // In production, use the same origin (backend should be on same domain)
        // Or use environment variable if set via window.API_BASE_URL
        window.API_BASE_URL = window.API_BASE_URL || `${window.location.protocol}//${window.location.host}/api`;
    } else {
        // In development, use localhost
        window.API_BASE_URL = 'http://localhost:3001/api';
    }
})();

