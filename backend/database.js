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
            `, (err) => {
                if (err) reject(err);
                else {
                    // Create indexes
                    db.run(`CREATE INDEX IF NOT EXISTS idx_professors_department ON professors(department_id)`, () => {
                        db.run(`CREATE INDEX IF NOT EXISTS idx_views_professor ON professor_views(professor_id)`, () => {
                            db.run(`CREATE INDEX IF NOT EXISTS idx_clicks_professor ON professor_clicks(professor_id)`, () => {
                                db.run(`CREATE INDEX IF NOT EXISTS idx_views_department ON department_views(department_id)`, () => {
                                    resolve();
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
                        researchArea: prof.research_area
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
            (department_id, name, title, lab, lab_website, email, research_area)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            dept.id,
            professor.name,
            professor.title || null,
            professor.lab || null,
            professor.labWebsite || null,
            professor.email || null,
            professor.researchArea || null
        ], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

/**
 * Get trending labs for a department based on click analytics
 * Returns top 3 labs/professors by clicks in the last 30 days
 */
function getTrendingLabs(departmentName) {
    return new Promise((resolve, reject) => {
        getDepartmentByName(departmentName).then(dept => {
            if (!dept) {
                resolve([]);
                return;
            }
            
            // Get top professors by clicks (last 30 days, minimum 1 click)
            db.all(`
                SELECT 
                    p.lab,
                    p.name,
                    COUNT(pc.id) as click_count
                FROM professors p
                LEFT JOIN professor_clicks pc ON p.id = pc.professor_id 
                    AND pc.clicked_at >= datetime('now', '-30 days')
                WHERE p.department_id = ?
                GROUP BY p.id, p.lab, p.name
                HAVING click_count > 0
                ORDER BY click_count DESC, p.name ASC
                LIMIT 3
            `, [dept.id], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Return lab names (or professor names if no lab)
                const trending = rows.map(r => r.lab || r.name);
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

module.exports = {
    initDatabase,
    getDatabase,
    getAllDepartments,
    getDepartmentByName,
    createOrGetDepartment,
    getProfessorsByDepartment,
    addProfessor,
    getTrendingLabs,
    setTrendingLabs,
    trackProfessorView,
    trackProfessorClick,
    trackDepartmentView,
    getProfessorByNameAndDepartment,
    getProfessorAnalytics,
    getAllAnalytics
};
