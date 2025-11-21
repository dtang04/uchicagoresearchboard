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
 * Only returns real data from database - no estimates
 */
async function getProfessorStats(professor, db) {
    try {
        // Try to get from database first
        const prof = await db.getProfessorByNameAndDepartment(professor.name, professor.departmentName);
        if (prof && (prof.num_lab_members !== null || prof.num_undergrad_researchers !== null || prof.num_published_papers !== null)) {
            return {
                numLabMembers: prof.num_lab_members || 0,
                numUndergradResearchers: prof.num_undergrad_researchers || 0,
                numPublishedPapers: prof.num_published_papers || 0
            };
        }
        
        // If not in database, try to fetch from web
        const webStats = await fetchStatsFromWeb(professor);
        if (webStats) {
            // Save to database for future use
            await db.updateProfessorStats(professor.name, professor.departmentName, webStats);
            return webStats;
        }
        
        // Return null/0 values if no data available (don't generate fake estimates)
        return {
            numLabMembers: 0,
            numUndergradResearchers: 0,
            numPublishedPapers: 0
        };
    } catch (error) {
        console.error('Error getting professor stats:', error);
        // Return zeros instead of estimates
        return {
            numLabMembers: 0,
            numUndergradResearchers: 0,
            numPublishedPapers: 0
        };
    }
}

module.exports = {
    getProfessorStats,
    estimateStats,
    fetchStatsFromWeb
};

