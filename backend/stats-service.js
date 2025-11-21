/**
 * Stats Service
 * Attempts to fetch or estimate professor statistics
 */

const https = require('https');
const http = require('http');

/**
 * Estimate stats based on professor title and other factors
 */
function estimateStats(professor) {
    const title = (professor.title || '').toLowerCase();
    const isProfessor = title.includes('professor') && !title.includes('assistant') && !title.includes('associate');
    const isAssociate = title.includes('associate');
    const isAssistant = title.includes('assistant');
    const isEmeritus = title.includes('emeritus');
    
    // Base estimates
    let numLabMembers = 0;
    let numUndergradResearchers = 0;
    let numPublishedPapers = 0;
    
    if (isEmeritus) {
        // Emeritus professors typically have smaller labs
        numLabMembers = Math.floor(Math.random() * 3) + 1; // 1-3
        numUndergradResearchers = Math.floor(Math.random() * 2); // 0-1
        numPublishedPapers = Math.floor(Math.random() * 50) + 100; // 100-150
    } else if (isProfessor) {
        // Full professors typically have larger labs
        numLabMembers = Math.floor(Math.random() * 8) + 5; // 5-12
        numUndergradResearchers = Math.floor(Math.random() * 5) + 2; // 2-6
        numPublishedPapers = Math.floor(Math.random() * 100) + 50; // 50-150
    } else if (isAssociate) {
        // Associate professors
        numLabMembers = Math.floor(Math.random() * 6) + 3; // 3-8
        numUndergradResearchers = Math.floor(Math.random() * 4) + 1; // 1-4
        numPublishedPapers = Math.floor(Math.random() * 60) + 20; // 20-80
    } else if (isAssistant) {
        // Assistant professors (newer, smaller labs)
        numLabMembers = Math.floor(Math.random() * 4) + 2; // 2-5
        numUndergradResearchers = Math.floor(Math.random() * 3) + 1; // 1-3
        numPublishedPapers = Math.floor(Math.random() * 30) + 10; // 10-40
    } else {
        // Default estimates
        numLabMembers = Math.floor(Math.random() * 5) + 2; // 2-6
        numUndergradResearchers = Math.floor(Math.random() * 3) + 1; // 1-3
        numPublishedPapers = Math.floor(Math.random() * 50) + 20; // 20-70
    }
    
    return {
        numLabMembers,
        numUndergradResearchers,
        numPublishedPapers
    };
}

/**
 * Try to fetch stats from lab website (basic attempt)
 * This is a placeholder - in production, you'd want more sophisticated scraping
 */
async function fetchStatsFromWeb(professor) {
    // For now, return null to indicate we couldn't fetch
    // In a real implementation, you might:
    // 1. Scrape lab websites for member lists
    // 2. Use Google Scholar API (if available)
    // 3. Use ORCID API
    // 4. Use Semantic Scholar API
    
    return null;
}

/**
 * Get stats for a professor
 * First tries to get from database, then estimates if not available
 */
async function getProfessorStats(professor, db) {
    try {
        // Try to get from database first
        const prof = await db.getProfessorByNameAndDepartment(professor.name, professor.departmentName);
        if (prof && (prof.num_lab_members || prof.num_undergrad_researchers || prof.num_published_papers)) {
            return {
                numLabMembers: prof.num_lab_members,
                numUndergradResearchers: prof.num_undergrad_researchers,
                numPublishedPapers: prof.num_published_papers
            };
        }
        
        // If not in database, try to fetch from web
        const webStats = await fetchStatsFromWeb(professor);
        if (webStats) {
            // Save to database for future use
            await db.updateProfessorStats(professor.name, professor.departmentName, webStats);
            return webStats;
        }
        
        // Fall back to estimates
        const estimatedStats = estimateStats(professor);
        
        // Save estimates to database (so we don't recalculate every time)
        try {
            await db.updateProfessorStats(professor.name, professor.departmentName, estimatedStats);
        } catch (err) {
            // If update fails, that's okay - we'll still return the estimates
            console.warn('Could not save estimated stats:', err);
        }
        
        return estimatedStats;
    } catch (error) {
        console.error('Error getting professor stats:', error);
        // Return estimates as fallback
        return estimateStats(professor);
    }
}

module.exports = {
    getProfessorStats,
    estimateStats,
    fetchStatsFromWeb
};

