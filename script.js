// DOM elements
const searchInput = document.getElementById('departmentSearch');
const searchButton = document.getElementById('searchButton');
const resultsContainer = document.getElementById('resultsContainer');
const filterButtons = document.querySelectorAll('.filter-btn');

// Starred professors state
let starredProfessors = new Set(); // Store as "name|department" keys
let isViewingStarred = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Search button click handler
    searchButton.addEventListener('click', handleSearch);
    
    // Enter key handler
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    
    // Quick filter button handlers
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const dept = btn.getAttribute('data-dept');
            searchInput.value = dept;
            handleSearch();
        });
    });
    
    // Starred professors tab
    const starredTab = document.getElementById('starredTab');
    if (starredTab) {
        starredTab.addEventListener('click', handleStarredTab);
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

async function handleSearch() {
    const query = searchInput.value.trim();
    
    if (!query) {
        showWelcomeMessage();
        return;
    }
    
    showLoading();
    
    const startTime = performance.now();
    
    try {
        const searchStart = performance.now();
        const results = await searchDepartments(query);
        const searchTime = performance.now() - searchStart;
        console.log(`[Performance] Search took ${searchTime.toFixed(2)}ms, found ${results.length} results`);
        
        const displayStart = performance.now();
        await displayResults(query, results);
        const displayTime = performance.now() - displayStart;
        console.log(`[Performance] Display took ${displayTime.toFixed(2)}ms`);
        
        const totalTime = performance.now() - startTime;
        console.log(`[Performance] Total time: ${totalTime.toFixed(2)}ms`);
    } catch (error) {
        console.error('Error in search:', error);
        resultsContainer.innerHTML = `
            <div class="no-results">
                <h3>Error loading data</h3>
                <p>Unable to connect to the backend server. Please make sure the server is running.</p>
            </div>
        `;
    }
}

async function searchDepartments(query) {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Common department names mapping
    const departmentMap = {
        'statistics': 'statistics',
        'stat': 'statistics',
        'math': 'mathematics',
        'mathematics': 'mathematics',
        'cs': 'computer science',
        'computer science': 'computer science',
        'data science': 'data science',
        'ds': 'data science',
        'economics': 'economics',
        'econ': 'economics'
    };
    
    // First, try to get the specific department directly (fastest)
    const mappedDept = departmentMap[normalizedQuery];
    if (mappedDept) {
        const deptResults = await getDepartmentData(mappedDept);
        if (deptResults.length > 0) {
            return deptResults;
        }
    }
    
    // Try direct department match
    const directResults = await getDepartmentData(normalizedQuery);
    if (directResults.length > 0) {
        return directResults;
    }
    
    // If no direct match, get department list and try partial matching
    const allDepartments = await getDepartmentList();
    const matchingDept = allDepartments.find(dept => 
        dept.includes(normalizedQuery) || normalizedQuery.includes(dept)
    );
    
    if (matchingDept) {
        return await getDepartmentData(matchingDept);
    }
    
    // Last resort: fetch all departments and search across them
    // (only if query doesn't match any department name)
    const allDepartmentsData = await getAllDepartmentsData();
    const searchResults = [];
    Object.keys(allDepartmentsData).forEach(dept => {
        const deptResults = allDepartmentsData[dept].filter(prof => 
            prof.name.toLowerCase().includes(normalizedQuery) ||
            prof.lab.toLowerCase().includes(normalizedQuery) ||
            prof.title.toLowerCase().includes(normalizedQuery) ||
            (prof.researchArea && prof.researchArea.toLowerCase().includes(normalizedQuery))
        );
        searchResults.push(...deptResults);
    });
    
    return searchResults;
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
            <p>👋 Welcome! Search for a department to discover research opportunities.</p>
        </div>
    `;
}

async function displayResults(query, professors) {
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
    
    // Determine department name for display
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
    
    if (allDepartments[normalizedQuery]) {
        departmentName = allDepartments[normalizedQuery];
        normalizedDepartmentName = normalizedQuery; // Keep lowercase for API
    } else {
        // Capitalize first letter for display
        departmentName = query.charAt(0).toUpperCase() + query.slice(1);
        // Use normalized version for API
        normalizedDepartmentName = normalizedQuery;
    }
    
    // Get trending labs dynamically based on click analytics (use lowercase for API)
    const trendingLabNames = await getTrendingLabs(normalizedDepartmentName);
    const trendingLabs = professors.filter(prof => {
        const labName = prof.lab || '';
        const profName = prof.name || '';
        return trendingLabNames.includes(labName) || trendingLabNames.includes(profName);
    });
    const regularProfessors = professors.filter(prof => {
        const labName = prof.lab || '';
        const profName = prof.name || '';
        return !trendingLabNames.includes(labName) && !trendingLabNames.includes(profName);
    });
    
    // Group regular professors by research area (if available)
    const groupedByArea = groupProfessorsByArea(regularProfessors);
    
    let resultsHTML = `
        <div class="results-header">
            <h2>
                <span class="department-name">${departmentName} Department</span>
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
    
            // Display trending labs section at the top if there are any
            if (trendingLabs.length > 0) {
                resultsHTML += `
                    <div class="research-area-section trending-labs-section">
                        <h3 class="research-area-header trending-labs-header">🔥 Trending Labs</h3>
                        <div class="professors-grid">
                            ${trendingLabs.map(prof => createProfessorCard(prof, normalizedDepartmentName)).join('')}
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
                        ${groupedByArea[area].map(prof => createProfessorCard(prof, normalizedDepartmentName)).join('')}
                    </div>
                </div>
            `;
        });
    } else if (regularProfessors.length > 0) {
        // Fallback to uniform grid if no research areas
        resultsHTML += `
            <div class="professors-grid">
                ${regularProfessors.map(prof => createProfessorCard(prof, normalizedDepartmentName)).join('')}
            </div>
        `;
    }
    
    // Smooth transition when updating results
    resultsContainer.style.opacity = '0';
    resultsContainer.style.transform = 'translateY(20px)';
    resultsContainer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    
    setTimeout(() => {
        resultsContainer.innerHTML = resultsHTML;
        
        // Trigger animations after a brief delay
        setTimeout(() => {
            resultsContainer.style.opacity = '1';
            resultsContainer.style.transform = 'translateY(0)';
            
            // Add animation classes to cards for staggered effect
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
            
            // Add click tracking to all clickable elements (with a small delay to ensure DOM is ready)
            setTimeout(() => {
                setupClickTracking();
                updateStarIcons();
            }, 100);
        }, 50);
    }, 150);
}

// Track clicks on professor cards and links
function setupClickTracking() {
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
    
    // Track clicks on professor cards and handle flip
    const cards = document.querySelectorAll('.professor-card');
    console.log(`🔍 Setting up click tracking for ${cards.length} cards`);
    
    cards.forEach((card, index) => {
        // Handle card flip on click
        card.addEventListener('click', async (e) => {
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
        });
    });
    
    // Setup star icon handlers
    setupStarIcons();
    
    console.log(`✅ Click tracking setup complete for ${cards.length} cards`);
}

// Setup star icon click handlers
function setupStarIcons() {
    document.querySelectorAll('.star-icon-container').forEach(container => {
        container.addEventListener('click', async (e) => {
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
        });
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
// For now, using placeholder data (0s) - data will be entered manually over time
function loadProfessorStats(card, professorName, departmentName) {
    const statsContent = card.querySelector('.stats-content');
    const statsLoading = card.querySelector('.stats-loading');
    
    if (!statsContent || !statsLoading) return;
    
    // Hide loading, show content immediately with placeholder data
    statsLoading.style.display = 'none';
    
    // Use placeholder data (0s) for now
    // TODO: Replace with actual data from database as it's entered manually
    const stats = {
        numLabMembers: 0,
        numUndergradResearchers: 0,
        numPublishedPapers: 0
    };
    
    // Update stat values
    const labMembersEl = card.querySelector('[data-stat="lab-members"]');
    const undergradEl = card.querySelector('[data-stat="undergrad"]');
    const papersEl = card.querySelector('[data-stat="papers"]');
    
    if (labMembersEl) {
        labMembersEl.textContent = stats.numLabMembers;
    }
    if (undergradEl) {
        undergradEl.textContent = stats.numUndergradResearchers;
    }
    if (papersEl) {
        papersEl.textContent = stats.numPublishedPapers;
    }
    
    // Show content
    statsContent.style.display = 'block';
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

function createProfessorCard(professor, departmentName) {
    const cardId = `prof-${professor.name.replace(/\s+/g, '-').toLowerCase()}-${departmentName.replace(/\s+/g, '-').toLowerCase()}`;
    
    const labLink = professor.labWebsite 
        ? `<a href="${professor.labWebsite}" target="_blank" rel="noopener noreferrer" class="lab-link" data-click-type="lab-website" data-professor="${professor.name}" data-department="${departmentName}">${professor.lab}</a>`
        : `<span class="lab-name">${professor.lab}</span>`;
    
    const emailSection = professor.email && professor.email.trim() !== ''
        ? `<div class="email-section">
            <div class="email-label">Email</div>
            <a href="mailto:${professor.email}" class="email-link" data-click-type="email" data-professor="${professor.name}" data-department="${departmentName}">${professor.email}</a>
        </div>`
        : '';
    
    return `
        <div class="professor-card" data-professor="${professor.name}" data-department="${departmentName}" data-click-type="card" id="${cardId}">
            <div class="star-icon-container" data-professor="${professor.name}" data-department="${departmentName}">
                <svg class="star-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
            </div>
            <div class="card-inner">
                <div class="card-front">
                    <div class="professor-name">${professor.name}</div>
                    <div class="professor-title">${professor.title}</div>
                    <div class="lab-section">
                        <div class="lab-label">Research Lab</div>
                        ${labLink}
                    </div>
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

