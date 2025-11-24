// DOM elements (will be initialized in DOMContentLoaded)
let searchInput;
let searchButton;
let resultsContainer;
let filterButtons;

// Starred professors state
let starredProfessors = new Set(); // Store as "name|department" keys
let isViewingStarred = false;

// Global debounce for all button handlers (shared across all buttons)
let globalLastHandlerTime = 0;

// Helper function to handle both click and touch events for mobile
function addMobileFriendlyListener(element, handler) {
    if (!element) return;
    
    let touchHandled = false;
    
    // Track touch start
    element.addEventListener('touchstart', (e) => {
        touchHandled = false;
    }, { passive: true });
    
    // Handle touch end
    element.addEventListener('touchend', (e) => {
        const now = Date.now();
        // Global debounce: prevent rapid clicks across all buttons
        if ((now - globalLastHandlerTime) < 500) {
            return;
        }
        
        touchHandled = true;
        globalLastHandlerTime = now;
        e.preventDefault();
        e.stopPropagation();
        try {
            handler(e);
        } catch (error) {
            console.error('Error in touch handler:', error);
        }
    }, { passive: false });
    
    // Handle click events (for desktop and as fallback)
    element.addEventListener('click', (e) => {
        const now = Date.now();
        // Global debounce: prevent rapid clicks
        if ((now - globalLastHandlerTime) < 500) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        
        // If touch was handled, prevent the click (mobile browsers fire click after touch)
        if (!touchHandled) {
            globalLastHandlerTime = now;
            try {
                handler(e);
            } catch (error) {
                console.error('Error in click handler:', error);
            }
        }
        touchHandled = false;
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements
    searchInput = document.getElementById('departmentSearch');
    searchButton = document.getElementById('searchButton');
    resultsContainer = document.getElementById('resultsContainer');
    filterButtons = document.querySelectorAll('.filter-btn');
    
    // Verify elements exist
    if (!searchInput || !searchButton || !resultsContainer) {
        console.error('Critical DOM elements not found!');
        return;
    }
    
    console.log(`Found ${filterButtons.length} filter buttons`);
    
    // Search button click handler (mobile-friendly)
    if (searchButton) {
        addMobileFriendlyListener(searchButton, handleSearch);
    }
    
    // Enter key handler
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });
    }
    
    // Quick filter button handlers (mobile-friendly)
    filterButtons.forEach((btn, index) => {
        const dept = btn.getAttribute('data-dept');
        console.log(`Setting up filter button ${index}: ${dept}`);
        
        addMobileFriendlyListener(btn, (e) => {
            try {
                console.log(`Filter button clicked: ${dept}`);
                if (!searchInput) {
                    console.error('searchInput is not available');
                    return;
                }
                searchInput.value = dept;
                handleSearch();
            } catch (error) {
                console.error('Error in filter button handler:', error);
                // Prevent page crash by showing error instead
                if (resultsContainer) {
                    resultsContainer.innerHTML = `
                        <div class="no-results">
                            <h3>Error</h3>
                            <p>An error occurred. Please try again.</p>
                        </div>
                    `;
                }
            }
        });
    });
    
    // Starred professors tab (mobile-friendly)
    const starredTab = document.getElementById('starredTab');
    if (starredTab) {
        addMobileFriendlyListener(starredTab, handleStarredTab);
    }
    
    // Listen for auth events
    window.addEventListener('userLoggedIn', () => {
        loadStarredProfessors();
    });
    
    window.addEventListener('userLoggedOut', () => {
        starredProfessors.clear();
        isViewingStarred = false;
        if (starredTab) starredTab.classList.remove('active');
    });
    
    // Load starred professors if already logged in
    if (window.authService && window.authService.isAuthenticated()) {
        loadStarredProfessors();
    }
});

// Prevent multiple simultaneous searches
let isSearching = false;
let currentSearchController = null;

async function handleSearch() {
    // Prevent multiple simultaneous searches
    if (isSearching) {
        return;
    }
    
    if (!searchInput) {
        return;
    }
    
    const query = searchInput.value.trim();
    if (!query) {
        showWelcomeMessage();
        return;
    }
    
    // Cancel any previous in-flight requests
    if (currentSearchController) {
        currentSearchController.abort();
    }
    currentSearchController = new AbortController();
    
    isSearching = true;
    showLoading();
    
    try {
        const signal = currentSearchController.signal;
        const results = await searchDepartments(query, signal);
        await displayResults(query, results, signal);
    } catch (error) {
        // Don't show error if it was aborted
        if (error.name === 'AbortError') {
            return;
        }
        console.error('Error in search:', error);
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="no-results">
                    <h3>Error loading data</h3>
                    <p>Unable to connect to the backend server. Please make sure the server is running.</p>
                </div>
            `;
        }
    } finally {
        isSearching = false;
        currentSearchController = null;
    }
}

/**
 * Calculate Levenshtein distance between two strings (for fuzzy matching)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Edit distance
 */
function levenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    
    // Create a matrix
    const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
    
    // Initialize first row and column
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
    
    // Fill the matrix
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }
    
    return matrix[len1][len2];
}

/**
 * Calculate similarity score between two strings (0-1, where 1 is identical)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score (0-1)
 */
function similarityScore(str1, str2) {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1;
    const distance = levenshteinDistance(str1, str2);
    return 1 - (distance / maxLen);
}

/**
 * Calculate relevance score for a match (0-1, where 1 is perfect match)
 * Handles abbreviations by checking both original query and expanded forms
 * @param {string} query - Search query
 * @param {string} target - Target string to match against
 * @param {boolean} useAbbreviations - Whether to expand abbreviations (default: true)
 * @returns {number} - Relevance score (0-1)
 */
function calculateRelevance(query, target, useAbbreviations = true) {
    if (!query || !target) return 0;
    
    const queryLower = query.toLowerCase().trim();
    const targetLower = target.toLowerCase().trim();
    
    // If using abbreviations, check expanded forms and take the best match
    if (useAbbreviations) {
        const expansions = expandAbbreviations(queryLower);
        let bestScore = 0;
        
        for (const expandedQuery of expansions) {
            const score = calculateRelevance(expandedQuery, targetLower, false);
            if (score > bestScore) {
                bestScore = score;
            }
        }
        
        // If expanded query matches better, boost the score slightly to prefer exact abbreviation matches
        // This ensures "applied stats" matches "applied statistics" better than "applied math"
        if (bestScore > 0 && expansions.length > 1) {
            // Check if any expansion matches exactly
            const exactExpansionMatch = expansions.some(exp => {
                const expScore = calculateRelevance(exp, targetLower, false);
                return expScore >= 0.9 && exp !== queryLower;
            });
            
            if (exactExpansionMatch) {
                // Slight boost for abbreviation matches that expand correctly
                return Math.min(1.0, bestScore * 1.05);
            }
        }
        
        return bestScore;
    }
    
    // Exact match (highest priority) - score 1.0
    if (targetLower === queryLower) return 1.0;
    
    // Check if query is a prefix of target (for partial queries like "applied")
    if (targetLower.startsWith(queryLower)) {
        // Longer matches are more relevant
        const prefixScore = queryLower.length / targetLower.length;
        return 0.9 + (prefixScore * 0.1); // 0.9-1.0 range
    }
    
    // Check if target starts with query as a word (for "applied statistics" matching "applied")
    const targetWords = targetLower.split(/\s+/);
    const queryWords = queryLower.split(/\s+/);
    
    // If query is a single word and matches the first word of target
    if (queryWords.length === 1 && targetWords.length > 0 && targetWords[0].startsWith(queryWords[0])) {
        return 0.85;
    }
    
    // For multi-word queries, check if all words appear in order (phrase match)
    if (queryWords.length > 1) {
        // Check if query appears as a phrase in target
        if (targetLower.includes(queryLower)) {
            // Exact phrase match - very high relevance
            return 0.95;
        }
        
        // Check if all query words appear in target in order (allowing gaps)
        let wordIndex = 0;
        let allWordsFound = true;
        let wordsInOrder = true;
        let exactWordMatches = 0;
        
        for (let i = 0; i < targetWords.length && wordIndex < queryWords.length; i++) {
            const tWord = targetWords[i];
            const qWord = queryWords[wordIndex];
            
            if (tWord === qWord) {
                exactWordMatches++;
                wordIndex++;
            } else if (tWord.startsWith(qWord)) {
                wordIndex++;
            } else if (tWord.includes(qWord)) {
                wordIndex++;
            }
        }
        
        if (wordIndex === queryWords.length) {
            // All words found in order
            const orderScore = exactWordMatches / queryWords.length;
            return 0.75 + (orderScore * 0.15); // 0.75-0.9 range
        }
        
        // Check if all words appear but not necessarily in order
        let allWordsPresent = true;
        let wordMatchScore = 0;
        for (const qWord of queryWords) {
            let found = false;
            let bestMatch = 0;
            for (const tWord of targetWords) {
                if (tWord === qWord) {
                    found = true;
                    bestMatch = 1.0;
                    break;
                } else if (tWord.startsWith(qWord)) {
                    found = true;
                    bestMatch = Math.max(bestMatch, 0.8);
                } else if (tWord.includes(qWord)) {
                    found = true;
                    bestMatch = Math.max(bestMatch, 0.6);
                }
            }
            if (!found) allWordsPresent = false;
            wordMatchScore += bestMatch;
        }
        
        if (allWordsPresent) {
            // All words present but not in order - moderate relevance
            return 0.5 + (wordMatchScore / queryWords.length) * 0.2; // 0.5-0.7 range
        }
    }
    
    // For single-word queries, check word matches
    if (queryWords.length === 1) {
        const qWord = queryWords[0];
        for (const tWord of targetWords) {
            if (tWord === qWord) {
                return 0.8;
            } else if (tWord.startsWith(qWord)) {
                return 0.75;
            } else if (tWord.includes(qWord)) {
                return 0.6;
            }
        }
    }
    
    // Substring match (moderate priority)
    if (targetLower.includes(queryLower)) {
        const position = targetLower.indexOf(queryLower);
        // Earlier in string = more relevant
        const positionScore = 1 - (position / Math.max(targetLower.length, 1));
        return 0.5 + (positionScore * 0.2); // 0.5-0.7 range
    }
    
    if (queryLower.includes(targetLower)) {
        return 0.4;
    }
    
    // Fuzzy match on full strings (lower priority)
    const fuzzyScore = similarityScore(queryLower, targetLower);
    if (fuzzyScore >= 0.7) {
        return 0.3 + (fuzzyScore - 0.7) * 0.67; // 0.3-0.5 range for 0.7-1.0 fuzzy scores
    }
    
    // Word-level fuzzy match
    let maxWordScore = 0;
    for (const qWord of queryWords) {
        for (const tWord of targetWords) {
            const wordScore = similarityScore(qWord, tWord);
            if (wordScore > maxWordScore) {
                maxWordScore = wordScore;
            }
        }
    }
    
    if (maxWordScore >= 0.6) {
        return 0.2 + (maxWordScore - 0.6) * 0.25; // 0.2-0.3 range
    }
    
    return 0;
}

/**
 * Expand abbreviations in query to their full forms
 * @param {string} query - Search query
 * @returns {Array<string>} - Array of possible query expansions (original + expanded)
 */
function expandAbbreviations(query) {
    const normalized = query.toLowerCase().trim();
    const queryWords = normalized.split(/\s+/);
    const expansions = [normalized]; // Always include original query
    
    // Common abbreviation mappings
    const abbreviations = {
        'stats': 'statistics',
        'stat': 'statistics',
        'math': 'mathematics',
        'cs': 'computer science',
        'ds': 'data science',
        'econ': 'economics',
        'ml': 'machine learning',
        'ai': 'artificial intelligence',
        'nlp': 'natural language processing',
        'cv': 'computer vision',
        'bio': 'biology',
        'bioinfo': 'bioinformatics',
        'neuro': 'neuroscience',
        'neurobio': 'neurobiology',
        'comp': 'computational',
        'theor': 'theoretical',
        'appl': 'applied'
    };
    
    // Try expanding each word
    const expandedQueries = new Set([normalized]);
    
    // Generate all combinations of expanded words
    function generateExpansions(words, index = 0, current = []) {
        if (index >= words.length) {
            expandedQueries.add(current.join(' '));
            return;
        }
        
        const word = words[index];
        const expansion = abbreviations[word];
        
        // Try with original word
        generateExpansions(words, index + 1, [...current, word]);
        
        // Try with expanded word if abbreviation exists
        if (expansion) {
            generateExpansions(words, index + 1, [...current, expansion]);
        }
    }
    
    generateExpansions(queryWords);
    
    return Array.from(expandedQueries);
}

/**
 * Check if query matches a string with fuzzy matching
 * @param {string} query - Search query
 * @param {string} target - Target string to match against
 * @param {number} threshold - Minimum similarity threshold (0-1)
 * @returns {boolean} - True if match
 */
function fuzzyMatch(query, target, threshold = 0.6) {
    return calculateRelevance(query, target) >= threshold;
}

/**
 * Unified search function that searches across departments, professors, and research areas
 * Uses fuzzy matching for typo tolerance and filters out low-relevance results
 */
async function searchDepartments(query, signal = null) {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) {
        return [];
    }
    
    if (signal && signal.aborted) {
        throw new Error('Search was cancelled');
    }
    
    // Get all departments data
    const allDepartmentsData = await getAllDepartmentsData();
    
    if (signal && signal.aborted) {
        throw new Error('Search was cancelled');
    }
    const allDepartments = Object.keys(allDepartmentsData);
    
    // Build search results with relevance scores
    const searchResults = [];
    const seenProfessors = new Set(); // Track by "name|department" to avoid duplicates
    
    // 1. Search departments (exact and fuzzy match)
    for (const dept of allDepartments) {
        const deptRelevance = calculateRelevance(normalizedQuery, dept);
        if (deptRelevance >= 0.3) {
            // If department matches, add all professors from that department
            const professors = allDepartmentsData[dept] || [];
            professors.forEach(prof => {
                const key = `${prof.name}|${dept}`;
                if (!seenProfessors.has(key)) {
                    seenProfessors.add(key);
                    // Add department info and relevance score
                    searchResults.push({ 
                        ...prof, 
                        department: dept,
                        relevance: deptRelevance,
                        matchType: 'department'
                    });
                }
            });
        }
    }
    
    // 2. Search professors by name, lab, and title
    for (const dept of allDepartments) {
        const professors = allDepartmentsData[dept] || [];
        professors.forEach(prof => {
            const key = `${prof.name}|${dept}`;
            
            // Calculate relevance for different fields
            const nameRelevance = calculateRelevance(normalizedQuery, prof.name);
            const labRelevance = prof.lab ? calculateRelevance(normalizedQuery, prof.lab) : 0;
            const titleRelevance = prof.title ? calculateRelevance(normalizedQuery, prof.title) : 0;
            
            // Get the best relevance score
            const bestRelevance = Math.max(nameRelevance, labRelevance, titleRelevance);
            const matchType = bestRelevance === nameRelevance ? 'name' : 
                            (bestRelevance === labRelevance ? 'lab' : 'title');
            
            if (bestRelevance >= 0.3) {
                if (!seenProfessors.has(key)) {
                    seenProfessors.add(key);
                    searchResults.push({ 
                        ...prof, 
                        department: dept,
                        relevance: bestRelevance,
                        matchType: matchType
                    });
                } else {
                    // Update if this match is more relevant
                    const existingIndex = searchResults.findIndex(r => 
                        r.name === prof.name && r.department === dept
                    );
                    if (existingIndex >= 0 && searchResults[existingIndex].relevance < bestRelevance) {
                        searchResults[existingIndex].relevance = bestRelevance;
                        searchResults[existingIndex].matchType = matchType;
                    }
                }
            }
        });
    }
    
    // 3. Search by research area/subfield
    for (const dept of allDepartments) {
        const professors = allDepartmentsData[dept] || [];
        professors.forEach(prof => {
            if (prof.researchArea) {
                const key = `${prof.name}|${dept}`;
                const areaRelevance = calculateRelevance(normalizedQuery, prof.researchArea);
                
                if (areaRelevance >= 0.3) {
                    if (!seenProfessors.has(key)) {
                        seenProfessors.add(key);
                        searchResults.push({ 
                            ...prof, 
                            department: dept,
                            relevance: areaRelevance,
                            matchType: 'researchArea'
                        });
                    } else {
                        // Update if this match is more relevant
                        const existingIndex = searchResults.findIndex(r => 
                            r.name === prof.name && r.department === dept
                        );
                        if (existingIndex >= 0 && searchResults[existingIndex].relevance < areaRelevance) {
                            searchResults[existingIndex].relevance = areaRelevance;
                            searchResults[existingIndex].matchType = 'researchArea';
                        }
                    }
                }
            }
        });
    }
    
    // Sort results by relevance (highest first)
    searchResults.sort((a, b) => b.relevance - a.relevance);
    
    // Filter out low-relevance results when we have high-relevance matches
    if (searchResults.length > 0) {
        const topRelevance = searchResults[0].relevance;
        const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
        const isMultiWordQuery = queryWords.length >= 2;
        
        // For multi-word queries, be more aggressive with filtering
        if (isMultiWordQuery) {
            // If we have very high relevance matches (>= 0.85), only keep very relevant results
            if (topRelevance >= 0.85) {
                // Keep only results with relevance >= 0.7 (require all words to match well)
                return searchResults.filter(r => r.relevance >= 0.7);
            }
            // If we have good matches (>= 0.7), filter aggressively
            if (topRelevance >= 0.7) {
                // Keep only results with relevance >= 0.5 or within 0.2 of the top result
                const minRelevance = Math.max(0.5, topRelevance - 0.2);
                return searchResults.filter(r => r.relevance >= minRelevance);
            }
            // For moderate matches, still filter
            if (topRelevance >= 0.5) {
                const minRelevance = Math.max(0.4, topRelevance - 0.15);
                return searchResults.filter(r => r.relevance >= minRelevance);
            }
        } else {
            // Single-word queries - less aggressive filtering
            // If we have very high relevance matches (>= 0.8), filter out low relevance ones
            if (topRelevance >= 0.8) {
                // Keep only results with relevance >= 0.6 or within 0.3 of the top result
                const minRelevance = Math.max(0.6, topRelevance - 0.3);
                return searchResults.filter(r => r.relevance >= minRelevance);
            }
            
            // If we have good matches (>= 0.6), filter more aggressively
            if (topRelevance >= 0.6) {
                // Keep only results with relevance >= 0.4 or within 0.25 of the top result
                const minRelevance = Math.max(0.4, topRelevance - 0.25);
                return searchResults.filter(r => r.relevance >= minRelevance);
            }
            
            // For lower relevance matches, be more lenient but still filter
            if (topRelevance >= 0.4) {
                // Keep only results with relevance >= 0.3 or within 0.2 of the top result
                const minRelevance = Math.max(0.3, topRelevance - 0.2);
                return searchResults.filter(r => r.relevance >= minRelevance);
            }
        }
    }
    
    // Return all results if relevance is low (no good matches found)
    return searchResults;
}

/**
 * Merge duplicate professors (same name) into a single entry
 * Takes the maximum of all stats and combines other fields intelligently
 * @param {Array} professors - Array of professor objects
 * @returns {Array} - Array of merged professor objects
 */
function mergeDuplicateProfessors(professors) {
    const mergedMap = new Map();
    
    professors.forEach(prof => {
        const name = prof.name;
        
        if (!mergedMap.has(name)) {
            // First occurrence - add to map
            mergedMap.set(name, { ...prof });
        } else {
            // Duplicate found - merge with existing
            const existing = mergedMap.get(name);
            
            // Take maximum of all stats
            existing.numLabMembers = Math.max(
                existing.numLabMembers || 0,
                prof.numLabMembers || 0
            );
            existing.numUndergradResearchers = Math.max(
                existing.numUndergradResearchers || 0,
                prof.numUndergradResearchers || 0
            );
            existing.numPublishedPapers = Math.max(
                existing.numPublishedPapers || 0,
                prof.numPublishedPapers || 0
            );
            
            // Take the best relevance score
            existing.relevance = Math.max(
                existing.relevance || 0,
                prof.relevance || 0
            );
            
            // Combine departments (if different)
            if (prof.department && existing.department) {
                if (prof.department !== existing.department) {
                    // If different departments, keep both (comma-separated)
                    const depts = [existing.department, prof.department];
                    existing.department = [...new Set(depts)].join(', ');
                }
            } else if (prof.department && !existing.department) {
                existing.department = prof.department;
            }
            
            // Take non-empty values for other fields (prefer existing if both have values)
            if (!existing.title && prof.title) existing.title = prof.title;
            if (!existing.lab && prof.lab) existing.lab = prof.lab;
            if (!existing.labWebsite && prof.labWebsite) existing.labWebsite = prof.labWebsite;
            if (!existing.email && prof.email) existing.email = prof.email;
            if (!existing.researchArea && prof.researchArea) existing.researchArea = prof.researchArea;
            
            // If both have research areas and they're different, combine them intelligently
            if (existing.researchArea && prof.researchArea && 
                existing.researchArea !== prof.researchArea) {
                // Split both into individual areas (handle comma-separated)
                const existingAreas = existing.researchArea.split(',').map(a => a.trim()).filter(Boolean);
                const profAreas = prof.researchArea.split(',').map(a => a.trim()).filter(Boolean);
                
                // Combine all areas
                const allAreas = [...existingAreas, ...profAreas];
                
                // Remove duplicates and subsumed areas
                const uniqueAreas = [];
                for (const area of allAreas) {
                    const areaLower = area.toLowerCase();
                    let isSubsumed = false;
                    
                    // Check if this area is subsumed by any other area
                    for (const otherArea of allAreas) {
                        if (area === otherArea) continue;
                        const otherLower = otherArea.toLowerCase();
                        
                        // If other area contains this area and is longer, this area is subsumed
                        if (otherLower.includes(areaLower) && otherArea.length > area.length) {
                            isSubsumed = true;
                            break;
                        }
                    }
                    
                    if (!isSubsumed && !uniqueAreas.some(a => a.toLowerCase() === areaLower)) {
                        uniqueAreas.push(area);
                    }
                }
                
                // If we have unique areas, join them; otherwise keep the more specific one
                if (uniqueAreas.length > 0) {
                    existing.researchArea = uniqueAreas.join(', ');
                } else {
                    // Fallback: use the longer one
                    existing.researchArea = existing.researchArea.length > prof.researchArea.length 
                        ? existing.researchArea 
                        : prof.researchArea;
                }
            }
            
            // Take the better match type (prefer name > lab > title > researchArea > department)
            const matchTypePriority = {
                'name': 5,
                'lab': 4,
                'title': 3,
                'researchArea': 2,
                'department': 1
            };
            const existingPriority = matchTypePriority[existing.matchType] || 0;
            const profPriority = matchTypePriority[prof.matchType] || 0;
            if (profPriority > existingPriority) {
                existing.matchType = prof.matchType;
            }
        }
    });
    
    return Array.from(mergedMap.values());
}

function showLoading() {
    resultsContainer.style.opacity = '0';
    resultsContainer.style.transform = 'translateY(20px)';
    setTimeout(() => {
        resultsContainer.innerHTML = '<div class="loading">Searching</div>';
        resultsContainer.style.opacity = '1';
        resultsContainer.style.transform = 'translateY(0)';
        resultsContainer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    }, 100);
}

function showWelcomeMessage() {
    resultsContainer.innerHTML = `
        <div class="welcome-message">
            <p>👋 Welcome! Search for departments, professors, or research areas to discover research opportunities and connect with leading researchers at the University of Chicago.</p>
        </div>
    `;
}

async function displayResults(query, professors, signal = null) {
    if (signal && signal.aborted) {
        return;
    }
    
    if (professors.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <h3>No results found</h3>
                <p>We couldn't find any professors matching "${query}".</p>
                <p>Try searching for: Statistics, Mathematics, Computer Science, Data Science, or Economics</p>
            </div>
        `;
        return;
    }
    
    // Merge duplicate professors (same name appearing multiple times)
    professors = mergeDuplicateProfessors(professors);
    
    // Determine if results are from a single department or multiple departments
    // For merged professors, use the first department for grouping purposes
    const uniqueDepartments = new Set(professors.map(p => {
        const dept = p.department || '';
        // If department is comma-separated, use the first one
        return dept.split(',')[0].trim();
    }).filter(Boolean));
    const isSingleDepartment = uniqueDepartments.size === 1;
    
    // Determine department name for display
    // Always use the first department from the first unique department (not combined)
    const normalizedQuery = query.toLowerCase().trim();
    let departmentName = query;
    let normalizedDepartmentName = normalizedQuery; // For API calls
    
    // Try to find matching department name
    const allDepartments = {
        'statistics': 'Statistics',
        'mathematics': 'Mathematics',
        'computer science': 'Computer Science',
        'data science': 'Data Science',
        'economics': 'Economics'
    };
    
    // If we have a single department, always use that department name
    if (uniqueDepartments.size === 1) {
        const dept = Array.from(uniqueDepartments)[0];
        const firstDept = dept.split(',')[0].trim();
        const deptLower = firstDept.toLowerCase();
        departmentName = allDepartments[deptLower] || firstDept.charAt(0).toUpperCase() + firstDept.slice(1);
        normalizedDepartmentName = deptLower;
    } else if (allDepartments[normalizedQuery]) {
        // Query matches a known department, but results might be from multiple departments
        departmentName = allDepartments[normalizedQuery];
        normalizedDepartmentName = normalizedQuery;
    } else {
        // Multiple departments or no clear match - use generic header
        departmentName = 'Search Results';
        // For trending labs, we'll skip it or use the first department
        const firstDept = Array.from(uniqueDepartments)[0];
        normalizedDepartmentName = firstDept ? firstDept.split(',')[0].trim().toLowerCase() : normalizedQuery;
    }
    
    // Get trending labs dynamically based on click analytics
    // IMPORTANT: Only fetch trending labs for the department the user searched for,
    // NOT for all departments that appear in the results
    let trendingLabNames = [];
    if (signal && signal.aborted) {
        return;
    }
    
    // Always use the searched department name, not the departments in results
    // This prevents fetching trending labs for multiple departments when user searches for one
    trendingLabNames = await getTrendingLabs(normalizedDepartmentName, signal);
    
    if (signal && signal.aborted) {
        return;
    }
    
    // Calculate the minimum relevance threshold for trending labs
    // This ensures trending labs are only shown if they're relevant to the search query
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
    const isMultiWordQuery = queryWords.length >= 2;
    
    // Determine relevance threshold based on query type and top results
    let minTrendingRelevance = 0.3; // Default threshold
    if (professors.length > 0) {
        const topRelevance = professors[0].relevance || 0;
        
        // For multi-word queries (like "applied stats"), be more strict
        if (isMultiWordQuery) {
            // Only show trending labs if they match the query well
            // Use a threshold that's close to the top relevance, but slightly lower
            if (topRelevance >= 0.8) {
                minTrendingRelevance = 0.7; // Very strict for high-relevance queries
            } else if (topRelevance >= 0.6) {
                minTrendingRelevance = 0.5; // Moderate strictness
            } else {
                minTrendingRelevance = 0.4; // Still require decent match
            }
        } else {
            // For single-word queries, be slightly more lenient
            if (topRelevance >= 0.8) {
                minTrendingRelevance = 0.6;
            } else if (topRelevance >= 0.6) {
                minTrendingRelevance = 0.4;
            } else {
                minTrendingRelevance = 0.3;
            }
        }
    }
    
    // Filter trending labs to only include those that match the search query
    // This ensures trending labs are relevant to the current search
    const trendingLabs = professors.filter(prof => {
        const labName = prof.lab || '';
        const profName = prof.name || '';
        const isTrending = trendingLabNames.includes(labName) || trendingLabNames.includes(profName);
        
        if (!isTrending) return false;
        
        // Check if this professor matches the search query
        // Use the relevance score that was already calculated during search
        const relevance = prof.relevance || 0;
        
        // Only include trending labs that are relevant to the query
        return relevance >= minTrendingRelevance;
    });
    
    const regularProfessors = professors.filter(prof => {
        const labName = prof.lab || '';
        const profName = prof.name || '';
        const isTrending = trendingLabNames.includes(labName) || trendingLabNames.includes(profName);
        const relevance = prof.relevance || 0;
        
        // Regular professors are those that are either:
        // 1. Not trending, OR
        // 2. Trending but don't match the query well enough
        return !isTrending || relevance < minTrendingRelevance;
    });
    
    // Group regular professors by research area (if available)
    const groupedByArea = groupProfessorsByArea(regularProfessors);
    
    // 1. Department Header
    const headerTitle = isSingleDepartment && departmentName !== 'Search Results' 
        ? `${departmentName} Department` 
        : departmentName;
    let resultsHTML = `
        <div class="results-header">
            <h2>
                <span class="department-name">${headerTitle}</span>
                <span class="info-icon" data-tooltip="Flip card to see additional statistics">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5" fill="none"/>
                        <path d="M8 6V8M8 10H8.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </span>
            </h2>
            <div class="results-count">Found ${professors.length} professor${professors.length !== 1 ? 's' : ''}</div>
        </div>
    `;
    
    // 2. Total Stats (for all departments)
    const totals = professors.reduce((acc, prof) => {
        acc.labMembers += prof.numLabMembers || 0;
        acc.undergrads += prof.numUndergradResearchers || 0;
        acc.publications += prof.numPublishedPapers || 0;
        return acc;
    }, { labMembers: 0, undergrads: 0, publications: 0 });
    
    // Check if this is the mathematics department for the tooltip
    const isMathematicsDept = normalizedDepartmentName === 'mathematics';
    const undergradLabel = isMathematicsDept 
        ? `<div class="stat-label">Undergraduate Researchers<span class="stat-asterisk" data-tooltip="Most undergraduate researchers in the math department participate in the REU program, and are not included in this total.">*</span></div>`
        : `<div class="stat-label">Undergraduate Researchers</div>`;
    
    resultsHTML += `
        <div class="department-stats-section">
            <div class="stats-card-combined">
                <div class="stat-item-combined">
                    <div class="stat-label">Lab Members</div>
                    <div class="stat-number" data-stat="lab-members">${totals.labMembers}</div>
                </div>
                <div class="stat-divider"></div>
                <div class="stat-item-combined">
                    ${undergradLabel}
                    <div class="stat-number" data-stat="undergrads">${totals.undergrads}</div>
                </div>
                <div class="stat-divider"></div>
                <div class="stat-item-combined">
                    <div class="stat-label">Published Papers</div>
                    <div class="stat-number" data-stat="publications">${totals.publications}</div>
                </div>
            </div>
        </div>
    `;
    
    // 3. Local Programs (e.g., Math REU, Data Science Clinic)
    if (normalizedDepartmentName === 'mathematics') {
        resultsHTML += `
            <div class="reu-program-section">
                <h3 class="reu-program-header">Math REU Program</h3>
                <div class="reu-program-content">
                    <p class="reu-program-description">Explore summer research opportunities through the University of Chicago Mathematics REU Program.</p>
                    <a href="https://math.uchicago.edu/~may/REU2025/" target="_blank" rel="noopener noreferrer" class="reu-program-link">
                        <span>Learn More</span>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </a>
                </div>
            </div>
        `;
    }
    
    // Check if this is data science department - only show if it's exclusively data science
    // Must be: single department AND that department is data science
    const isDataScienceDept = (uniqueDepartments.size === 1 && 
                               Array.from(uniqueDepartments)[0].toLowerCase().trim() === 'data science') ||
                               normalizedDepartmentName.toLowerCase().trim() === 'data science';
    
    if (isDataScienceDept) {
        resultsHTML += `
            <div class="reu-program-section">
                <h3 class="reu-program-header">Data Science Clinic</h3>
                <div class="reu-program-content">
                    <p class="reu-program-description">An experiential project-based course where students work in teams as data scientists with real-world clients under the supervision of instructors.</p>
                    <a href="https://clinic.ds.uchicago.edu/" target="_blank" rel="noopener noreferrer" class="reu-program-link">
                        <span>Learn More</span>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </a>
                </div>
            </div>
        `;
    }
    
    // 4. Trending Labs
    if (trendingLabs.length > 0) {
        resultsHTML += `
            <div class="research-area-section trending-labs-section">
                <h3 class="research-area-header trending-labs-header">🔥 Trending Labs</h3>
                <div class="professors-grid">
                    ${trendingLabs.map(prof => {
                        // Use first department if comma-separated
                        const dept = prof.department || normalizedDepartmentName;
                        const displayDept = dept.includes(',') ? dept.split(',')[0].trim() : dept;
                        return createProfessorCard(prof, displayDept);
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    // If we have research areas, display grouped; otherwise display as grid
    if (groupedByArea && Object.keys(groupedByArea).length > 0) {
        // Sort areas alphabetically
        const sortedAreas = Object.keys(groupedByArea).sort();
        
        sortedAreas.forEach(area => {
            resultsHTML += `
                <div class="research-area-section">
                    <h3 class="research-area-header">${area}</h3>
                    <div class="professors-grid">
                        ${groupedByArea[area].map(prof => {
                            // Use first department if comma-separated
                            const dept = prof.department || normalizedDepartmentName;
                            const displayDept = dept.includes(',') ? dept.split(',')[0].trim() : dept;
                            return createProfessorCard(prof, displayDept);
                        }).join('')}
                    </div>
                </div>
            `;
        });
    } else if (regularProfessors.length > 0) {
        // Fallback to uniform grid if no research areas
        resultsHTML += `
            <div class="professors-grid">
                ${regularProfessors.map(prof => {
                    // Use first department if comma-separated
                    const dept = prof.department || normalizedDepartmentName;
                    const displayDept = dept.includes(',') ? dept.split(',')[0].trim() : dept;
                    return createProfessorCard(prof, displayDept);
                }).join('')}
            </div>
        `;
    }
    
    // Smooth transition when updating results
    resultsContainer.style.opacity = '0';
    resultsContainer.style.transform = 'translateY(20px)';
    resultsContainer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    
    // Store signal in closure for animation checks
    const animationSignal = signal;
    
    setTimeout(() => {
        // Check if search was cancelled before updating DOM
        if (animationSignal && animationSignal.aborted) {
            return;
        }
        
        // Reset click tracking flag when replacing content
        // This allows setupClickTracking to run again for new content
        clickTrackingSetup = false;
        resultsContainer.innerHTML = resultsHTML;
        
        // Trigger animations after a brief delay
        setTimeout(() => {
            // Check again if search was cancelled
            if (animationSignal && animationSignal.aborted) {
                return;
            }
            
            resultsContainer.style.opacity = '1';
            resultsContainer.style.transform = 'translateY(0)';
            
            // Add animation classes to cards for staggered effect
            // Limit animations to prevent memory issues on mobile
            const cards = resultsContainer.querySelectorAll('.professor-card');
            const maxAnimatedCards = 50; // Limit to prevent memory issues
            cards.forEach((card, index) => {
                if (index >= maxAnimatedCards) {
                    // Skip animation for cards beyond limit to prevent crashes
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0) scale(1)';
                    return;
                }
                card.style.opacity = '0';
                card.style.transform = 'translateY(30px) scale(0.9)';
                setTimeout(() => {
                    // Check if search was cancelled before animating
                    if (animationSignal && animationSignal.aborted) {
                        return;
                    }
                    card.style.transition = `opacity 0.5s ease ${index * 0.05}s, transform 0.5s ease ${index * 0.05}s`;
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0) scale(1)';
                }, 50);
            });
            
            // Add click tracking to all clickable elements (with a small delay to ensure DOM is ready)
            setTimeout(() => {
                // Final check before setting up tracking
                if (animationSignal && animationSignal.aborted) {
                    return;
                }
                setupClickTracking();
                updateStarIcons();
            }, 100);
        }, 50);
    }, 150);
}

// Track clicks on professor cards and links
// Use a flag to prevent duplicate setup
let clickTrackingSetup = false;

function setupClickTracking() {
    // Prevent duplicate setup - innerHTML replacement already removes old listeners
    // But if called multiple times before DOM is ready, this prevents duplicates
    if (clickTrackingSetup) {
        return;
    }
    clickTrackingSetup = true;
    
    // Track clicks on email links
    document.querySelectorAll('.email-link').forEach(link => {
        link.addEventListener('click', async (e) => {
            const professorName = link.getAttribute('data-professor');
            const departmentName = link.getAttribute('data-department');
            await trackClick(professorName, departmentName, 'email');
        });
    });
    
    // Track clicks on lab website links
    document.querySelectorAll('.lab-link').forEach(link => {
        link.addEventListener('click', async (e) => {
            const professorName = link.getAttribute('data-professor');
            const departmentName = link.getAttribute('data-department');
            await trackClick(professorName, departmentName, 'lab-website');
        });
    });
    
    // Track clicks on personal website links
    document.querySelectorAll('.website-link').forEach(link => {
        link.addEventListener('click', async (e) => {
            const professorName = link.getAttribute('data-professor');
            const departmentName = link.getAttribute('data-department');
            await trackClick(professorName, departmentName, 'personal-website');
        });
    });
    
    // Track clicks on professor cards and handle flip
    const cards = document.querySelectorAll('.professor-card');
    console.log(`🔍 Setting up click tracking for ${cards.length} cards`);
    
    cards.forEach((card, index) => {
        // Handle card flip on click (mobile-friendly)
        const handleCardClick = async (e) => {
            // Don't flip if clicking on links or star icon
            const clickedLink = e.target.closest('a');
            const clickedStar = e.target.closest('.star-icon-container');
            if (clickedLink || clickedStar) {
                return; // Let the link/star handle its own click
            }
            
            const professorName = card.getAttribute('data-professor');
            const departmentName = card.getAttribute('data-department');
            
            if (professorName && departmentName) {
                // Track the click
                await trackClick(professorName, departmentName, 'card');
                
                // Toggle flip
                const cardInner = card.querySelector('.card-inner');
                if (cardInner) {
                    const isFlipped = cardInner.classList.contains('flipped');
                    
                    if (!isFlipped) {
                        // Flipping to back - load stats (using placeholders for now)
                        cardInner.classList.add('flipped');
                        loadProfessorStats(card, professorName, departmentName);
                    } else {
                        // Flipping back to front
                        cardInner.classList.remove('flipped');
                    }
                }
            }
        };
        
        addMobileFriendlyListener(card, handleCardClick);
    });
    
    // Setup star icon handlers
    setupStarIcons();
    
    console.log(`✅ Click tracking setup complete for ${cards.length} cards`);
}

// Setup star icon click handlers
function setupStarIcons() {
    document.querySelectorAll('.star-icon-container').forEach(container => {
        const handleStarClick = async (e) => {
            e.stopPropagation(); // Prevent card flip
            
            if (!window.authService || !window.authService.isAuthenticated()) {
                // Show login modal
                document.getElementById('authModal').style.display = 'flex';
                return;
            }
            
            const professorName = container.getAttribute('data-professor');
            const departmentName = container.getAttribute('data-department');
            const starIcon = container.querySelector('.star-icon');
            const isStarred = starIcon.classList.contains('starred');
            
            try {
                const API_BASE = window.API_BASE_URL || 'http://localhost:3001/api';
                const token = window.authService.getAuthToken();
                
                if (isStarred) {
                    // Unstar
                    const response = await fetch(`${API_BASE}/starred`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ professorName, departmentName })
                    });
                    
                    if (response.ok) {
                        starIcon.classList.remove('starred');
                        const key = `${professorName}|${departmentName}`;
                        starredProfessors.delete(key);
                    }
                } else {
                    // Star
                    const response = await fetch(`${API_BASE}/starred`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ professorName, departmentName })
                    });
                    
                    if (response.ok) {
                        starIcon.classList.add('starred');
                        const key = `${professorName}|${departmentName}`;
                        starredProfessors.add(key);
                    }
                }
            } catch (error) {
                console.error('Error toggling star:', error);
            }
        };
        
        addMobileFriendlyListener(container, handleStarClick);
    });
}

// Update star icons based on starred state
function updateStarIcons() {
    document.querySelectorAll('.star-icon-container').forEach(container => {
        const professorName = container.getAttribute('data-professor');
        const departmentName = container.getAttribute('data-department');
        const starIcon = container.querySelector('.star-icon');
        const key = `${professorName}|${departmentName}`;
        
        if (starredProfessors.has(key)) {
            starIcon.classList.add('starred');
        } else {
            starIcon.classList.remove('starred');
        }
    });
}

// Load starred professors
async function loadStarredProfessors() {
    if (!window.authService || !window.authService.isAuthenticated()) {
        return;
    }
    
    try {
        const API_BASE = window.API_BASE_URL || 'http://localhost:3001/api';
        const token = window.authService.getAuthToken();
        
        const response = await fetch(`${API_BASE}/starred/ids`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            starredProfessors.clear();
            Object.keys(data.starred).forEach(key => {
                starredProfessors.add(key);
            });
            updateStarIcons();
        }
    } catch (error) {
        console.error('Error loading starred professors:', error);
    }
}

// Handle starred professors tab click
async function handleStarredTab() {
    const starredTab = document.getElementById('starredTab');
    isViewingStarred = !isViewingStarred;
    
    if (isViewingStarred) {
        starredTab.classList.add('active');
        await displayStarredProfessors();
    } else {
        starredTab.classList.remove('active');
        showWelcomeMessage();
    }
}

// Display starred professors
async function displayStarredProfessors() {
    if (!window.authService || !window.authService.isAuthenticated()) {
        return;
    }
    
    try {
        const API_BASE = window.API_BASE_URL || 'http://localhost:3001/api';
        const token = window.authService.getAuthToken();
        
        const response = await fetch(`${API_BASE}/starred`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load starred professors');
        }
        
        const data = await response.json();
        const professors = data.starred || [];
        
        if (professors.length === 0) {
            resultsContainer.innerHTML = `
                <div class="no-results">
                    <h3>No starred professors</h3>
                    <p>You haven't starred any professors yet. Click the star icon on any professor card to add them to your favorites.</p>
                </div>
            `;
            return;
        }
        
        let resultsHTML = `
            <div class="results-header">
                <h2>
                    <span class="department-name">Starred Professors</span>
                </h2>
                <div class="results-count">${professors.length} starred professor${professors.length !== 1 ? 's' : ''}</div>
            </div>
            <div class="professors-grid">
                ${professors.map(prof => createProfessorCard(prof, prof.department || 'unknown')).join('')}
            </div>
        `;
        
        resultsContainer.style.opacity = '0';
        resultsContainer.style.transform = 'translateY(20px)';
        resultsContainer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        
        setTimeout(() => {
            resultsContainer.innerHTML = resultsHTML;
            
            setTimeout(() => {
                resultsContainer.style.opacity = '1';
                resultsContainer.style.transform = 'translateY(0)';
                
                const cards = resultsContainer.querySelectorAll('.professor-card');
                cards.forEach((card, index) => {
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(30px) scale(0.9)';
                    setTimeout(() => {
                        card.style.transition = `opacity 0.5s ease ${index * 0.05}s, transform 0.5s ease ${index * 0.05}s`;
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0) scale(1)';
                    }, 50);
                });
                
                setTimeout(() => {
                    setupClickTracking();
                    updateStarIcons();
                }, 100);
            }, 50);
        }, 150);
    } catch (error) {
        console.error('Error displaying starred professors:', error);
        resultsContainer.innerHTML = `
            <div class="no-results">
                <h3>Error loading starred professors</h3>
                <p>Unable to load your starred professors. Please try again.</p>
            </div>
        `;
    }
}

// Load professor stats and display them
async function loadProfessorStats(card, professorName, departmentName) {
    const statsContent = card.querySelector('.stats-content');
    const statsLoading = card.querySelector('.stats-loading');
    
    if (!statsContent || !statsLoading) return;
    
    // Get API base URL from config.js
    const API_BASE = window.API_BASE_URL || 'http://localhost:3001/api';
    
    try {
        // Fetch stats from API
        const response = await fetch(`${API_BASE}/professor/stats`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                professorName: professorName,
                departmentName: departmentName.toLowerCase()
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            const stats = data.stats || {
                numLabMembers: 0,
                numUndergradResearchers: 0,
                numPublishedPapers: 0
            };
            
            // Update stat values
            const labMembersEl = card.querySelector('[data-stat="lab-members"]');
            const undergradEl = card.querySelector('[data-stat="undergrad"]');
            const papersEl = card.querySelector('[data-stat="papers"]');
            
            if (labMembersEl) {
                labMembersEl.textContent = stats.numLabMembers || 0;
            }
            if (undergradEl) {
                undergradEl.textContent = stats.numUndergradResearchers || 0;
            }
            if (papersEl) {
                papersEl.textContent = stats.numPublishedPapers || 0;
            }
        } else {
            // If API fails, show zeros
            const labMembersEl = card.querySelector('[data-stat="lab-members"]');
            const undergradEl = card.querySelector('[data-stat="undergrad"]');
            const papersEl = card.querySelector('[data-stat="papers"]');
            
            if (labMembersEl) labMembersEl.textContent = 0;
            if (undergradEl) undergradEl.textContent = 0;
            if (papersEl) papersEl.textContent = 0;
        }
    } catch (error) {
        console.error('Error loading professor stats:', error);
        // On error, show zeros
        const labMembersEl = card.querySelector('[data-stat="lab-members"]');
        const undergradEl = card.querySelector('[data-stat="undergrad"]');
        const papersEl = card.querySelector('[data-stat="papers"]');
        
        if (labMembersEl) labMembersEl.textContent = 0;
        if (undergradEl) undergradEl.textContent = 0;
        if (papersEl) papersEl.textContent = 0;
    } finally {
        // Hide loading, show content
        statsLoading.style.display = 'none';
        statsContent.style.display = 'block';
    }
}

// Track click analytics
async function trackClick(professorName, departmentName, clickType) {
    try {
        // Normalize department name to lowercase (matching database)
        const normalizedDept = departmentName.toLowerCase().trim();
        
        // Get API base URL from config.js
        const API_BASE = window.API_BASE_URL || 'http://localhost:3001/api';
        
        console.log('Sending click tracking:', { professorName, departmentName: normalizedDept, clickType });
        const response = await fetch(`${API_BASE}/analytics/click`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                professorName: professorName,
                departmentName: normalizedDept,
                clickType: clickType
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error || 'Unknown'}`);
        }
        
        const result = await response.json();
        console.log('✅ Click tracked successfully:', result);
        
        // Clear trending labs cache so it refreshes on next search
        if (typeof clearTrendingLabsCache === 'function') {
            clearTrendingLabsCache();
        }
    } catch (error) {
        // Log error for debugging
        console.error('❌ Analytics tracking failed:', error);
    }
}

function groupProfessorsByArea(professors) {
    const grouped = {};
    
    professors.forEach(prof => {
        const area = prof.researchArea || 'Other';
        if (!grouped[area]) {
            grouped[area] = [];
        }
        grouped[area].push(prof);
    });
    
    // Only return grouped data if we have research areas
    const hasAreas = professors.some(prof => prof.researchArea);
    return hasAreas ? grouped : null;
}

/**
 * Extract lab name from URL or return the original string if it's not a URL
 * For URLs like "airlab.cs.uchicago.edu", extracts "airlab"
 * @param {string} labValue - The lab value which might be a URL or lab name
 * @returns {string} - The extracted lab name or original value
 */
function extractLabNameFromUrl(labValue) {
    if (!labValue || labValue.trim() === '') {
        return labValue;
    }
    
    const trimmed = labValue.trim();
    
    // Check if it looks like a URL (contains dots and common URL patterns)
    // Patterns: "subdomain.domain.com", "http://...", "https://...", "www."
    // Remove protocol if present
    let urlWithoutProtocol = trimmed;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        urlWithoutProtocol = trimmed.replace(/^https?:\/\//, '');
    }
    
    // Remove www. if present
    if (urlWithoutProtocol.startsWith('www.')) {
        urlWithoutProtocol = urlWithoutProtocol.substring(4);
    }
    
    // Check if it contains dots (likely a domain/subdomain)
    if (urlWithoutProtocol.includes('.')) {
        // Extract the first part (subdomain) before the first dot
        // For "airlab.cs.uchicago.edu", this would be "airlab"
        const parts = urlWithoutProtocol.split('.');
        if (parts.length > 0 && parts[0].length > 0) {
            const subdomain = parts[0];
            // Capitalize first letter for better display
            return subdomain.charAt(0).toUpperCase() + subdomain.slice(1);
        }
    }
    
    // If it doesn't look like a URL, return as-is
    return trimmed;
}

function createProfessorCard(professor, departmentName) {
    // Handle comma-separated departments (use first one for display)
    const displayDept = departmentName.includes(',') ? departmentName.split(',')[0].trim() : departmentName;
    const cardId = `prof-${professor.name.replace(/\s+/g, '-').toLowerCase()}-${displayDept.replace(/\s+/g, '-').toLowerCase()}`;
    
    // Check if mathematics department - use "Group" instead of "Lab"
    // Check if any department in the list is mathematics
    const deptList = departmentName.toLowerCase().split(',').map(d => d.trim());
    const isMathematics = deptList.includes('mathematics');
    const groupType = isMathematics ? 'Group' : 'Lab';
    const groupLabel = isMathematics ? 'Research Group' : 'Research Lab';
    
    // Get lab/group name, or generate from last name if null/empty
    // First, extract lab name from URL if it's a URL
    let labName = extractLabNameFromUrl(professor.lab);
    if (!labName || labName.trim() === '') {
        // Extract last name from professor name
        const nameParts = professor.name.trim().split(/\s+/);
        const lastName = nameParts[nameParts.length - 1];
        labName = `${lastName} ${groupType}`;
    } else if (isMathematics && labName.toLowerCase().endsWith(' lab')) {
        // Replace "Lab" with "Group" in existing lab names for mathematics
        labName = labName.replace(/ lab$/i, ` ${groupType}`);
    } else if (isMathematics && labName.toLowerCase().endsWith('lab')) {
        // Handle case without space
        labName = labName.replace(/lab$/i, groupType);
    }
    
    // Determine the lab website URL
    // If labWebsite is set, use it; otherwise, if lab is a URL, use that
    let labWebsiteUrl = professor.labWebsite;
    if (!labWebsiteUrl && professor.lab) {
        const trimmedLab = professor.lab.trim();
        // Check if lab value is a URL
        const urlPattern = /^(https?:\/\/)?(www\.)?([a-zA-Z0-9.-]+)/;
        if (urlPattern.test(trimmedLab)) {
            // If it doesn't start with http:// or https://, add https://
            labWebsiteUrl = trimmedLab.startsWith('http://') || trimmedLab.startsWith('https://') 
                ? trimmedLab 
                : `https://${trimmedLab}`;
        }
    }
    
    const labLink = labWebsiteUrl
        ? `<a href="${labWebsiteUrl}" target="_blank" rel="noopener noreferrer" class="lab-link" data-click-type="lab-website" data-professor="${professor.name}" data-department="${displayDept}">${labName}</a>`
        : `<span class="lab-name">${labName}</span>`;
    
    // Personal website section
    const personalWebsiteSection = professor.personalWebsite && professor.personalWebsite.trim() !== ''
        ? `<div class="website-section">
            <div class="website-label">Personal Website</div>
            <a href="${professor.personalWebsite}" target="_blank" rel="noopener noreferrer" class="website-link" data-click-type="personal-website" data-professor="${professor.name}" data-department="${displayDept}">Visit Website</a>
        </div>`
        : '';
    
    const emailSection = professor.email && professor.email.trim() !== ''
        ? `<div class="email-section">
            <div class="email-label">Email</div>
            <a href="mailto:${professor.email}" class="email-link" data-click-type="email" data-professor="${professor.name}" data-department="${displayDept}">${professor.email}</a>
        </div>`
        : '';
    
    // Check if professor should be translucent (0 lab members OR manually marked as translucent)
    const hasZeroLabMembers = (professor.numLabMembers || 0) === 0;
    const isManuallyTranslucent = professor.isTranslucent === true || professor.isTranslucent === 1;
    const translucentClass = (hasZeroLabMembers || isManuallyTranslucent) ? 'card-translucent' : '';
    
    // Debug logging for translucent cards
    if (professor.name && professor.name.includes('Gunawi')) {
        console.log('[DEBUG] Gunawi card data:', {
            name: professor.name,
            isTranslucent: professor.isTranslucent,
            isTranslucentType: typeof professor.isTranslucent,
            numLabMembers: professor.numLabMembers,
            hasZeroLabMembers,
            isManuallyTranslucent,
            translucentClass
        });
    }
    
    // Check if professor is explicitly recruiting (from database flag or hardcoded names for backwards compatibility)
    const nameLower = professor.name.toLowerCase();
    const isRecruiting = professor.isRecruiting || 
                        (nameLower.includes('claire') && nameLower.includes('donnat')) ||
                        (nameLower.includes('dacheng') && nameLower.includes('xiu')) ||
                        (nameLower.includes('mihai') && nameLower.includes('anitescu'));
    const recruitingStripe = isRecruiting ? '<div class="recruiting-stripe"></div>' : '';
    
    return `
        <div class="professor-card ${translucentClass}" data-professor="${professor.name}" data-department="${displayDept}" data-click-type="card" id="${cardId}">
            ${recruitingStripe}
            <div class="star-icon-container" data-professor="${professor.name}" data-department="${displayDept}">
                <svg class="star-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
            </div>
            <div class="card-inner">
                <div class="card-front">
                    <div class="professor-name">${professor.name}</div>
                    <div class="professor-title">${professor.title}</div>
                    <div class="lab-section">
                        <div class="lab-label">${groupLabel}</div>
                        ${labLink}
                    </div>
                    ${personalWebsiteSection}
                    ${emailSection}
                </div>
                <div class="card-back">
                    <div class="stats-loading">Loading stats...</div>
                    <div class="stats-content" style="display: none;">
                        <div class="stats-header">Lab Statistics</div>
                        <div class="stat-item">
                            <div class="stat-label">Lab Members</div>
                            <div class="stat-value" data-stat="lab-members">-</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Undergraduate Researchers</div>
                            <div class="stat-value" data-stat="undergrad">-</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Published Papers</div>
                            <div class="stat-value" data-stat="papers">-</div>
                        </div>
                        <div class="flip-hint">Click to flip back</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

