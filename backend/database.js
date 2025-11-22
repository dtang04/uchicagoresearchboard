const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.db');

let db = null;

/**
 * Initialize the database
 */
function initDatabase() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                reject(err);
            } else {
                createTables().then(() => {
                    console.log('✅ Database initialized');
                    resolve();
                }).catch(reject);
            }
        });
    });
}

/**
 * Create database tables
 */
function createTables() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Departments table
            db.run(`
                CREATE TABLE IF NOT EXISTS departments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Professors/Labs table
            db.run(`
                CREATE TABLE IF NOT EXISTS professors (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    department_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    title TEXT,
                    lab TEXT,
                    lab_website TEXT,
                    email TEXT,
                    research_area TEXT,
                    num_undergrad_researchers INTEGER,
                    num_lab_members INTEGER,
                    num_published_papers INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (department_id) REFERENCES departments(id)
                )
            `);

            // Trending labs table
            db.run(`
                CREATE TABLE IF NOT EXISTS trending_labs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    department_id INTEGER NOT NULL,
                    lab_name TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (department_id) REFERENCES departments(id),
                    UNIQUE(department_id, lab_name)
                )
            `);

            // Analytics: View tracking
            db.run(`
                CREATE TABLE IF NOT EXISTS professor_views (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    professor_id INTEGER NOT NULL,
                    viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    ip_address TEXT,
                    user_agent TEXT,
                    FOREIGN KEY (professor_id) REFERENCES professors(id)
                )
            `);

            // Analytics: Click tracking
            db.run(`
                CREATE TABLE IF NOT EXISTS professor_clicks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    professor_id INTEGER NOT NULL,
                    click_type TEXT NOT NULL,
                    clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    ip_address TEXT,
                    user_agent TEXT,
                    FOREIGN KEY (professor_id) REFERENCES professors(id)
                )
            `);

            // Analytics: Department views
            db.run(`
                CREATE TABLE IF NOT EXISTS department_views (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    department_id INTEGER NOT NULL,
                    viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    ip_address TEXT,
                    user_agent TEXT,
                    FOREIGN KEY (department_id) REFERENCES departments(id)
                )
            `);

            // Users table
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT,
                    name TEXT,
                    google_id TEXT UNIQUE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Starred professors table
            db.run(`
                CREATE TABLE IF NOT EXISTS starred_professors (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    professor_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (professor_id) REFERENCES professors(id),
                    UNIQUE(user_id, professor_id)
                )
            `, (err) => {
                if (err) reject(err);
                else {
                    // Add new columns to professors table if they don't exist (migration)
                    // SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we'll try and ignore errors
                    db.run(`ALTER TABLE professors ADD COLUMN num_undergrad_researchers INTEGER`, (err1) => {
                        // Ignore error if column already exists
                        db.run(`ALTER TABLE professors ADD COLUMN num_lab_members INTEGER`, (err2) => {
                            // Ignore error if column already exists
                            db.run(`ALTER TABLE professors ADD COLUMN num_published_papers INTEGER`, (err3) => {
                                // Ignore error if column already exists
                                db.run(`ALTER TABLE professors ADD COLUMN is_recruiting INTEGER DEFAULT 0`, (err4) => {
                                    // Ignore error if column already exists
                                    db.run(`ALTER TABLE professors ADD COLUMN is_translucent INTEGER DEFAULT 0`, (err5) => {
                                        // Ignore error if column already exists
                                        // Create indexes
                                        db.run(`CREATE INDEX IF NOT EXISTS idx_professors_department ON professors(department_id)`, () => {
                                            db.run(`CREATE INDEX IF NOT EXISTS idx_views_professor ON professor_views(professor_id)`, () => {
                                                db.run(`CREATE INDEX IF NOT EXISTS idx_clicks_professor ON professor_clicks(professor_id)`, () => {
                                                    db.run(`CREATE INDEX IF NOT EXISTS idx_views_department ON department_views(department_id)`, () => {
                                                        db.run(`CREATE INDEX IF NOT EXISTS idx_starred_user ON starred_professors(user_id)`, () => {
                                                            db.run(`CREATE INDEX IF NOT EXISTS idx_starred_professor ON starred_professors(professor_id)`, () => {
                                                                resolve();
                                                            });
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                }
            });
        });
    });
}

/**
 * Get database instance
 */
function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

/**
 * Get all departments
 */
function getAllDepartments() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM departments ORDER BY name', (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

/**
 * Get department by name
 */
function getDepartmentByName(name) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM departments WHERE name = ?', [name], (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

/**
 * Create or get department
 */
async function createOrGetDepartment(name) {
    let dept = await getDepartmentByName(name);
    if (!dept) {
        return new Promise((resolve, reject) => {
            db.run('INSERT INTO departments (name) VALUES (?)', [name], function(err) {
                if (err) reject(err);
                else {
                    getDepartmentByName(name).then(resolve).catch(reject);
                }
            });
        });
    }
    return dept;
}

/**
 * Get professors by department
 */
function getProfessorsByDepartment(departmentName) {
    return new Promise((resolve, reject) => {
        getDepartmentByName(departmentName).then(dept => {
            if (!dept) {
                resolve([]);
                return;
            }
            
            db.all(`
                SELECT * FROM professors 
                WHERE department_id = ? 
                ORDER BY name
            `, [dept.id], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const results = rows.map(prof => ({
                        name: prof.name,
                        title: prof.title,
                        lab: prof.lab,
                        labWebsite: prof.lab_website,
                        email: prof.email,
                        researchArea: prof.research_area,
                        numUndergradResearchers: prof.num_undergrad_researchers,
                        numLabMembers: prof.num_lab_members,
                        numPublishedPapers: prof.num_published_papers,
                        isRecruiting: prof.is_recruiting === 1 || prof.is_recruiting === true,
                        isTranslucent: prof.is_translucent === 1 || prof.is_translucent === true
                    }));
                    resolve(results);
                }
            });
        }).catch(reject);
    });
}

/**
 * Add professor
 */
async function addProfessor(departmentName, professor) {
    const dept = await createOrGetDepartment(departmentName);
    
    return new Promise((resolve, reject) => {
        db.run(`
            INSERT INTO professors 
            (department_id, name, title, lab, lab_website, email, research_area, num_undergrad_researchers, num_lab_members, num_published_papers, is_recruiting, is_translucent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            dept.id,
            professor.name,
            professor.title || null,
            professor.lab || null,
            professor.labWebsite || null,
            professor.email || null,
            professor.researchArea || null,
            professor.numUndergradResearchers || null,
            professor.numLabMembers || null,
            professor.numPublishedPapers || null,
            professor.isRecruiting ? 1 : 0,
            professor.isTranslucent ? 1 : 0
        ], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

/**
 * Get trending labs for a department based on weighted average of clicks and undergraduate researchers
 * Returns top 3 labs/professors by weighted score (70% undergrads, 30% clicks)
 */
function getTrendingLabs(departmentName) {
    return new Promise((resolve, reject) => {
        getDepartmentByName(departmentName).then(dept => {
            if (!dept) {
                resolve([]);
                return;
            }
            
            // Get professors with clicks and undergrad counts
            db.all(`
                SELECT 
                    p.id,
                    p.lab,
                    p.name,
                    COALESCE(COUNT(DISTINCT pc.id), 0) as click_count,
                    COALESCE(p.num_undergrad_researchers, 0) as undergrad_count
                FROM professors p
                LEFT JOIN professor_clicks pc ON p.id = pc.professor_id 
                    AND pc.clicked_at >= datetime('now', '-30 days')
                WHERE p.department_id = ?
                GROUP BY p.id, p.lab, p.name, p.num_undergrad_researchers
            `, [dept.id], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (rows.length === 0) {
                    resolve([]);
                    return;
                }
                
                // Normalize values for weighted average
                // Find max values for normalization
                const maxClicks = Math.max(...rows.map(r => r.click_count), 1);
                const maxUndergrads = Math.max(...rows.map(r => r.undergrad_count), 1);
                
                // Calculate weighted score for each professor
                // Weight: 70% undergrads, 30% clicks
                const UNDERGRAD_WEIGHT = 0.7;
                const CLICK_WEIGHT = 0.3;
                
                const scored = rows.map(r => {
                    // Normalize to 0-1 scale
                    const normalizedClicks = maxClicks > 0 ? r.click_count / maxClicks : 0;
                    const normalizedUndergrads = maxUndergrads > 0 ? r.undergrad_count / maxUndergrads : 0;
                    
                    // Weighted average
                    const score = (normalizedUndergrads * UNDERGRAD_WEIGHT) + (normalizedClicks * CLICK_WEIGHT);
                    
                    return {
                        ...r,
                        score: score
                    };
                });
                
                // Sort by score (descending), then by name
                scored.sort((a, b) => {
                    if (Math.abs(a.score - b.score) < 0.0001) {
                        // If scores are very close, sort by name
                        return (a.lab || a.name).localeCompare(b.lab || b.name);
                    }
                    return b.score - a.score;
                });
                
                // Return top 3 lab names (or professor names if no lab)
                const trending = scored.slice(0, 3).map(r => r.lab || r.name);
                resolve(trending);
            });
        }).catch(reject);
    });
}

/**
 * Set trending labs for a department
 */
async function setTrendingLabs(departmentName, labNames) {
    const dept = await createOrGetDepartment(departmentName);
    
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM trending_labs WHERE department_id = ?', [dept.id], (err) => {
            if (err) {
                reject(err);
                return;
            }
            
            const stmt = db.prepare('INSERT INTO trending_labs (department_id, lab_name) VALUES (?, ?)');
            labNames.forEach(labName => {
                stmt.run([dept.id, labName]);
            });
            stmt.finalize((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });
}

/**
 * Track professor view
 */
function trackProfessorView(professorId, ipAddress = null, userAgent = null) {
    return new Promise((resolve, reject) => {
        db.run(`
            INSERT INTO professor_views (professor_id, ip_address, user_agent)
            VALUES (?, ?, ?)
        `, [professorId, ipAddress, userAgent], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

/**
 * Track professor click
 */
function trackProfessorClick(professorId, clickType, ipAddress = null, userAgent = null) {
    return new Promise((resolve, reject) => {
        db.run(`
            INSERT INTO professor_clicks (professor_id, click_type, ip_address, user_agent)
            VALUES (?, ?, ?, ?)
        `, [professorId, clickType, ipAddress, userAgent], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

/**
 * Track department view
 */
async function trackDepartmentView(departmentName, ipAddress = null, userAgent = null) {
    const dept = await getDepartmentByName(departmentName);
    if (!dept) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
        db.run(`
            INSERT INTO department_views (department_id, ip_address, user_agent)
            VALUES (?, ?, ?)
        `, [dept.id, ipAddress, userAgent], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

/**
 * Get professor by name and department
 */
function getProfessorByNameAndDepartment(professorName, departmentName) {
    return new Promise((resolve, reject) => {
        getDepartmentByName(departmentName).then(dept => {
            if (!dept) {
                resolve(null);
                return;
            }
            
            db.get(`
                SELECT * FROM professors 
                WHERE department_id = ? AND name = ?
            `, [dept.id, professorName], (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        }).catch(reject);
    });
}

/**
 * Get analytics for a professor
 */
function getProfessorAnalytics(professorId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM professor_views WHERE professor_id = ?', 
            [professorId], (err, viewsRow) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                db.get('SELECT COUNT(*) as count FROM professor_clicks WHERE professor_id = ?', 
                    [professorId], (err, clicksRow) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        resolve({
                            views: viewsRow.count,
                            clicks: clicksRow.count
                        });
                    });
            });
    });
}

/**
 * Get all analytics summary
 */
function getAllAnalytics() {
    return new Promise((resolve, reject) => {
        // Get all professors with their analytics
        db.all(`
            SELECT 
                p.id,
                p.name,
                p.lab,
                d.name as department,
                (SELECT COUNT(*) FROM professor_views WHERE professor_id = p.id) as views,
                (SELECT COUNT(*) FROM professor_clicks WHERE professor_id = p.id) as clicks
            FROM professors p
            JOIN departments d ON p.department_id = d.id
            ORDER BY views DESC, clicks DESC
        `, (err, professors) => {
            if (err) {
                reject(err);
                return;
            }
            
            // Get department views
            db.all(`
                SELECT 
                    d.name as department,
                    COUNT(*) as views
                FROM department_views dv
                JOIN departments d ON dv.department_id = d.id
                GROUP BY d.id, d.name
                ORDER BY views DESC
            `, (err, departmentViews) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Get total stats
                db.get('SELECT COUNT(*) as total_views FROM professor_views', (err, totalViewsRow) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    db.get('SELECT COUNT(*) as total_clicks FROM professor_clicks', (err, totalClicksRow) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        db.get('SELECT COUNT(*) as total_dept_views FROM department_views', (err, totalDeptViewsRow) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            
                            resolve({
                                professors: professors.map(p => ({
                                    id: p.id,
                                    name: p.name,
                                    lab: p.lab,
                                    department: p.department,
                                    views: p.views,
                                    clicks: p.clicks
                                })),
                                departmentViews: departmentViews,
                                totals: {
                                    professorViews: totalViewsRow.total_views,
                                    professorClicks: totalClicksRow.total_clicks,
                                    departmentViews: totalDeptViewsRow.total_dept_views
                                }
                            });
                        });
                    });
                });
            });
        });
    });
}

/**
 * Update professor stats
 */
async function updateProfessorStats(professorName, departmentName, stats) {
    const prof = await getProfessorByNameAndDepartment(professorName, departmentName);
    if (!prof) {
        throw new Error('Professor not found');
    }
    
    return new Promise((resolve, reject) => {
        db.run(`
            UPDATE professors 
            SET num_undergrad_researchers = ?,
                num_lab_members = ?,
                num_published_papers = ?
            WHERE id = ?
        `, [
            stats.numUndergradResearchers !== undefined && stats.numUndergradResearchers !== null ? stats.numUndergradResearchers : null,
            stats.numLabMembers !== undefined && stats.numLabMembers !== null ? stats.numLabMembers : null,
            stats.numPublishedPapers !== undefined && stats.numPublishedPapers !== null ? stats.numPublishedPapers : null,
            prof.id
        ], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

/**
 * Update professor research area
 */
async function updateProfessorResearchArea(professorName, departmentName, researchArea) {
    const prof = await getProfessorByNameAndDepartment(professorName, departmentName);
    if (!prof) {
        throw new Error('Professor not found');
    }
    
    return new Promise((resolve, reject) => {
        db.run(`
            UPDATE professors 
            SET research_area = ?
            WHERE id = ?
        `, [researchArea, prof.id], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

/**
 * User management functions
 */

// Create or get user by email
function getUserByEmail(email) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

// Create user
function createUser(email, passwordHash, name, googleId = null) {
    return new Promise((resolve, reject) => {
        db.run(`
            INSERT INTO users (email, password_hash, name, google_id)
            VALUES (?, ?, ?, ?)
        `, [email, passwordHash, name, googleId], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

// Get user by ID
function getUserById(userId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT id, email, name, google_id, created_at FROM users WHERE id = ?', [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

// Get user by Google ID
function getUserByGoogleId(googleId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE google_id = ?', [googleId], (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

/**
 * Starred professors functions
 */

// Get starred professors for a user
function getStarredProfessors(userId) {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT 
                p.id,
                p.name,
                p.title,
                p.lab,
                p.lab_website,
                p.email,
                p.research_area,
                p.num_undergrad_researchers,
                p.num_lab_members,
                p.num_published_papers,
                d.name as department
            FROM starred_professors sp
            JOIN professors p ON sp.professor_id = p.id
            JOIN departments d ON p.department_id = d.id
            WHERE sp.user_id = ?
            ORDER BY sp.created_at DESC
        `, [userId], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                const results = rows.map(prof => ({
                    name: prof.name,
                    title: prof.title,
                    lab: prof.lab,
                    labWebsite: prof.lab_website,
                    email: prof.email,
                    researchArea: prof.research_area,
                    numUndergradResearchers: prof.num_undergrad_researchers,
                    numLabMembers: prof.num_lab_members,
                    numPublishedPapers: prof.num_published_papers,
                    department: prof.department
                }));
                resolve(results);
            }
        });
    });
}

// Check if professor is starred by user
function isProfessorStarred(userId, professorId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT id FROM starred_professors 
            WHERE user_id = ? AND professor_id = ?
        `, [userId, professorId], (err, row) => {
            if (err) reject(err);
            else resolve(!!row);
        });
    });
}

// Star a professor
async function starProfessor(userId, professorName, departmentName) {
    const prof = await getProfessorByNameAndDepartment(professorName, departmentName);
    if (!prof) {
        throw new Error('Professor not found');
    }
    
    return new Promise((resolve, reject) => {
        db.run(`
            INSERT OR IGNORE INTO starred_professors (user_id, professor_id)
            VALUES (?, ?)
        `, [userId, prof.id], function(err) {
            if (err) reject(err);
            else resolve(this.changes > 0);
        });
    });
}

// Unstar a professor
async function unstarProfessor(userId, professorName, departmentName) {
    const prof = await getProfessorByNameAndDepartment(professorName, departmentName);
    if (!prof) {
        throw new Error('Professor not found');
    }
    
    return new Promise((resolve, reject) => {
        db.run(`
            DELETE FROM starred_professors 
            WHERE user_id = ? AND professor_id = ?
        `, [userId, prof.id], function(err) {
            if (err) reject(err);
            else resolve(this.changes > 0);
        });
    });
}

// Get starred professor IDs for a user (for checking which are starred)
async function getStarredProfessorIds(userId) {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT p.id, p.name, d.name as department
            FROM starred_professors sp
            JOIN professors p ON sp.professor_id = p.id
            JOIN departments d ON p.department_id = d.id
            WHERE sp.user_id = ?
        `, [userId], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                // Return a map of professor name + department to professor ID for quick lookup
                const starredMap = {};
                rows.forEach(row => {
                    const key = `${row.name}|${row.department}`;
                    starredMap[key] = row.id;
                });
                resolve(starredMap);
            }
        });
    });
}

/**
 * Delete professor by name and department
 */
async function deleteProfessor(professorName, departmentName) {
    const prof = await getProfessorByNameAndDepartment(professorName, departmentName);
    if (!prof) {
        throw new Error('Professor not found');
    }
    
    return new Promise((resolve, reject) => {
        // First delete related records (starred_professors, views, clicks)
        db.run('DELETE FROM starred_professors WHERE professor_id = ?', [prof.id], (err1) => {
            if (err1) {
                reject(err1);
                return;
            }
            db.run('DELETE FROM professor_views WHERE professor_id = ?', [prof.id], (err2) => {
                if (err2) {
                    reject(err2);
                    return;
                }
                db.run('DELETE FROM professor_clicks WHERE professor_id = ?', [prof.id], (err3) => {
                    if (err3) {
                        reject(err3);
                        return;
                    }
                    // Finally delete the professor
                    db.run('DELETE FROM professors WHERE id = ?', [prof.id], function(err4) {
                        if (err4) reject(err4);
                        else resolve(this.changes);
                    });
                });
            });
        });
    });
}

module.exports = {
    initDatabase,
    getDatabase,
    getAllDepartments,
    getDepartmentByName,
    createOrGetDepartment,
    getProfessorsByDepartment,
    addProfessor,
    deleteProfessor,
    getTrendingLabs,
    setTrendingLabs,
    trackProfessorView,
    trackProfessorClick,
    trackDepartmentView,
    getProfessorByNameAndDepartment,
    getProfessorAnalytics,
    getAllAnalytics,
    updateProfessorStats,
    updateProfessorResearchArea,
    getUserByEmail,
    createUser,
    getUserById,
    getUserByGoogleId,
    getStarredProfessors,
    isProfessorStarred,
    starProfessor,
    unstarProfessor,
    getStarredProfessorIds
};
