#!/usr/bin/env node

/**
 * Script to fix Tian Li duplicate entries
 * - Delete "Tian Li" (ID 146)
 * - Update "Tian LI" (ID 196) to "Tian Li" with correct title and lab
 */

const db = require('../database.js');

async function deleteProfessorById(professorId, dbInstance) {
    return new Promise((resolve, reject) => {
        // First delete related records
        dbInstance.run('DELETE FROM starred_professors WHERE professor_id = ?', [professorId], (err1) => {
            if (err1) {
                reject(err1);
                return;
            }
            dbInstance.run('DELETE FROM professor_views WHERE professor_id = ?', [professorId], (err2) => {
                if (err2) {
                    reject(err2);
                    return;
                }
                dbInstance.run('DELETE FROM professor_clicks WHERE professor_id = ?', [professorId], (err3) => {
                    if (err3) {
                        reject(err3);
                        return;
                    }
                    // Finally delete the professor
                    dbInstance.run('DELETE FROM professors WHERE id = ?', [professorId], function(err4) {
                        if (err4) reject(err4);
                        else resolve(this.changes);
                    });
                });
            });
        });
    });
}

async function fixTianLi() {
    try {
        await db.initDatabase();
        const dbInstance = db.getDatabase();
        
        console.log('🔍 Finding Tian Li entries...\n');
        
        // Get both entries
        const rows = await new Promise((resolve, reject) => {
            dbInstance.all(`
                SELECT p.id, p.name, p.title, p.lab, d.name as department
                FROM professors p
                JOIN departments d ON p.department_id = d.id
                WHERE (p.name LIKE '%Tian Li%' OR p.name LIKE '%Tian LI%')
                AND d.name = 'data science'
                ORDER BY p.id
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        console.log(`Found ${rows.length} Tian Li entries:\n`);
        rows.forEach(r => {
            console.log(`  ID: ${r.id}, Name: '${r.name}', Title: '${r.title || 'NULL'}', Lab: '${r.lab || 'NULL'}'`);
        });
        
        if (rows.length !== 2) {
            console.error('⚠️  Expected 2 entries, found', rows.length);
            process.exit(1);
        }
        
        // Identify which one to delete and which one to keep
        const tianLiEntry = rows.find(r => r.name === 'Tian Li');
        const tianLIEntry = rows.find(r => r.name === 'Tian LI');
        
        if (!tianLiEntry || !tianLIEntry) {
            console.error('⚠️  Could not find both entries');
            process.exit(1);
        }
        
        console.log(`\n🗑️  Deleting duplicate: ID ${tianLiEntry.id} (Tian Li)`);
        await deleteProfessorById(tianLiEntry.id, dbInstance);
        console.log(`   ✅ Deleted\n`);
        
        console.log(`✏️  Updating ID ${tianLIEntry.id}:`);
        console.log(`   - Name: '${tianLIEntry.name}' → 'Tian Li'`);
        console.log(`   - Title: '${tianLIEntry.title || 'NULL'}' → 'Associate Professor'`);
        
        // Update lab name - check if it contains "LI Lab" and replace with "Li Lab"
        const currentLab = tianLIEntry.lab || '';
        let newLab = currentLab;
        if (currentLab.includes('LI Lab')) {
            newLab = currentLab.replace(/LI Lab/gi, 'Li Lab');
            console.log(`   - Lab: '${currentLab}' → '${newLab}'`);
        } else if (!currentLab) {
            // If no lab, check if we need to set it
            console.log(`   - Lab: '${currentLab}' (keeping as is or setting if needed)`);
        }
        
        // Update the entry
        await new Promise((resolve, reject) => {
            dbInstance.run(`
                UPDATE professors 
                SET name = ?,
                    title = ?,
                    lab = ?
                WHERE id = ?
            `, ['Tian Li', 'Associate Professor', newLab, tianLIEntry.id], function(err) {
                if (err) reject(err);
                else {
                    console.log(`   ✅ Updated (${this.changes} row(s) affected)\n`);
                    resolve();
                }
            });
        });
        
        // Verify the result
        const updated = await new Promise((resolve, reject) => {
            dbInstance.get(`
                SELECT p.id, p.name, p.title, p.lab, d.name as department
                FROM professors p
                JOIN departments d ON p.department_id = d.id
                WHERE p.id = ?
            `, [tianLIEntry.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        console.log('✅ Final result:');
        console.log(`   ID: ${updated.id}, Name: '${updated.name}', Title: '${updated.title}', Lab: '${updated.lab || 'NULL'}', Dept: ${updated.department}`);
        
        // Check for any remaining duplicates
        const remaining = await new Promise((resolve, reject) => {
            dbInstance.all(`
                SELECT p.id, p.name, p.title, p.lab, d.name as department
                FROM professors p
                JOIN departments d ON p.department_id = d.id
                WHERE (p.name LIKE '%Tian Li%' OR p.name LIKE '%Tian LI%')
                AND d.name = 'data science'
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        if (remaining.length !== 1) {
            console.error(`\n⚠️  Warning: Expected 1 entry, found ${remaining.length}`);
        } else {
            console.log('\n✅ Successfully fixed - only one Tian Li entry remains');
        }
        
        console.log(`\n✅ Done!\n`);
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

fixTianLi();

