#!/usr/bin/env node

/**
 * Script to update titles for CS professors who have null titles
 */

const db = require('../database.js');

async function updateCSTitles() {
    try {
        await db.initDatabase();
        const dbInstance = db.getDatabase();
        
        console.log('📝 Updating CS professor titles...\n');
        
        // Titles to update based on search results
        const titleUpdates = [
            {
                name: 'Ben Zhao',
                title: 'Neubauer Professor of Computer Science'
            },
            {
                name: 'Hank Hoffman',
                title: 'Liew Family Chair of Computer Science'
            },
            {
                name: 'Nathan Srebro',
                title: 'Professor' // TTIC professor - using generic title
            },
            {
                name: 'Yangjing Li',
                title: 'Assistant Professor of Computer Science'
            }
        ];
        
        let updatedCount = 0;
        let notFoundCount = 0;
        
        for (const update of titleUpdates) {
            try {
                // Get the professor
                const professor = await new Promise((resolve, reject) => {
                    dbInstance.get(`
                        SELECT p.id, p.name, p.title, d.name as department
                        FROM professors p
                        JOIN departments d ON p.department_id = d.id
                        WHERE p.name = ? AND d.name = 'computer science'
                    `, [update.name], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });
                
                if (!professor) {
                    console.log(`   ⚠️  Not found: ${update.name}`);
                    notFoundCount++;
                    continue;
                }
                
                const currentTitle = professor.title || 'NULL';
                console.log(`   Updating ${update.name}:`);
                console.log(`      Current: '${currentTitle}'`);
                console.log(`      New:     '${update.title}'`);
                
                // Update the title
                await new Promise((resolve, reject) => {
                    dbInstance.run(`
                        UPDATE professors 
                        SET title = ?
                        WHERE id = ?
                    `, [update.title, professor.id], function(err) {
                        if (err) reject(err);
                        else {
                            console.log(`      ✅ Updated (${this.changes} row(s) affected)\n`);
                            resolve();
                        }
                    });
                });
                
                updatedCount++;
            } catch (error) {
                console.error(`   ❌ Error updating ${update.name}:`, error.message);
            }
        }
        
        // Verify the updates
        console.log('\n📊 Verification - CS Professors with titles:\n');
        const allProfessors = await new Promise((resolve, reject) => {
            dbInstance.all(`
                SELECT p.name, p.title, d.name as department
                FROM professors p
                JOIN departments d ON p.department_id = d.id
                WHERE d.name = 'computer science'
                ORDER BY p.name
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        const nullTitles = allProfessors.filter(p => !p.title || p.title === 'NULL');
        const withTitles = allProfessors.filter(p => p.title && p.title !== 'NULL');
        
        console.log(`✅ Professors with titles: ${withTitles.length}`);
        console.log(`⚠️  Professors with null titles: ${nullTitles.length}`);
        
        if (nullTitles.length > 0) {
            console.log('\nProfessors still missing titles:');
            nullTitles.forEach(p => {
                console.log(`   - ${p.name}`);
            });
        }
        
        console.log(`\n✅ Done! Updated ${updatedCount} titles, ${notFoundCount} not found.`);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        if (db.getDatabase()) {
            db.getDatabase().close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                }
            });
        }
    }
}

updateCSTitles();

