#!/usr/bin/env node

/**
 * Script to import/update Economics professors from Excel file
 * - Handles duplicates (keeps only one per professor)
 * - Removes cards with 0 0 0 (0 publications, 0 lab members, 0 undergrads)
 */

const XLSX = require('xlsx');
const fs = require('fs');
const db = require('../database');

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

async function importEconomicsFromExcel(excelPath) {
    try {
        // Check if file exists
        if (!fs.existsSync(excelPath)) {
            throw new Error(`Excel file not found: ${excelPath}`);
        }

        console.log(`\n📊 Reading Excel file: ${excelPath}\n`);

        // Read Excel file
        const workbook = XLSX.readFile(excelPath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const data = XLSX.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
            throw new Error('Excel file is empty');
        }

        console.log(`   Found ${data.length} rows in Excel file\n`);

        // Initialize database
        await db.initDatabase();
        const dbInstance = db.getDatabase();

        // Step 1: Remove all 0 0 0 professors from economics department
        console.log('🗑️  Step 1: Removing professors with 0 publications, 0 lab members, and 0 undergrads...\n');
        const zeroProfessors = await new Promise((resolve, reject) => {
            dbInstance.all(`
                SELECT p.id, p.name
                FROM professors p
                JOIN departments d ON p.department_id = d.id
                WHERE d.name = 'economics'
                AND COALESCE(p.num_published_papers, 0) = 0
                AND COALESCE(p.num_lab_members, 0) = 0
                AND COALESCE(p.num_undergrad_researchers, 0) = 0
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        let removedCount = 0;
        for (const prof of zeroProfessors) {
            console.log(`   🗑️  Removing: ${prof.name} (ID: ${prof.id}) - has 0 0 0`);
            await deleteProfessorById(prof.id, dbInstance);
            removedCount++;
        }
        console.log(`\n   ✅ Removed ${removedCount} professor(s) with 0 0 0\n`);

        // Step 2: Find and handle duplicates in economics department
        console.log('🔍 Step 2: Finding and removing duplicate professors...\n');
        const duplicates = await new Promise((resolve, reject) => {
            dbInstance.all(`
                SELECT 
                    p.id,
                    p.name,
                    COALESCE(p.num_published_papers, 0) as num_published_papers,
                    COALESCE(p.num_lab_members, 0) as num_lab_members,
                    COALESCE(p.num_undergrad_researchers, 0) as num_undergrad_researchers
                FROM professors p
                JOIN departments d ON p.department_id = d.id
                WHERE d.name = 'economics'
                AND p.name IN (
                    SELECT p2.name
                    FROM professors p2
                    JOIN departments d2 ON p2.department_id = d2.id
                    WHERE d2.name = 'economics'
                    GROUP BY p2.name
                    HAVING COUNT(*) > 1
                )
                ORDER BY p.name, COALESCE(p.num_published_papers, 0) DESC, p.id
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Group duplicates
        const duplicateGroups = {};
        duplicates.forEach(row => {
            if (!duplicateGroups[row.name]) {
                duplicateGroups[row.name] = [];
            }
            duplicateGroups[row.name].push(row);
        });

        let duplicateRemovedCount = 0;
        for (const [name, group] of Object.entries(duplicateGroups)) {
            if (group.length > 1) {
                console.log(`   👤 ${name}: Found ${group.length} duplicate(s)`);
                // Sort by publications, then lab members, then undergrads (descending)
                group.sort((a, b) => {
                    if (b.num_published_papers !== a.num_published_papers) {
                        return b.num_published_papers - a.num_published_papers;
                    }
                    if (b.num_lab_members !== a.num_lab_members) {
                        return b.num_lab_members - a.num_lab_members;
                    }
                    if (b.num_undergrad_researchers !== a.num_undergrad_researchers) {
                        return b.num_undergrad_researchers - a.num_undergrad_researchers;
                    }
                    return a.id - b.id; // Keep lower ID if all stats are equal
                });
                
                const keep = group[0];
                const toDelete = group.slice(1);
                
                console.log(`      ✅ Keeping: ID ${keep.id} (${keep.num_published_papers} pubs, ${keep.num_lab_members} lab, ${keep.num_undergrad_researchers} undergrad)`);
                
                for (const prof of toDelete) {
                    console.log(`      🗑️  Deleting: ID ${prof.id} (${prof.num_published_papers} pubs, ${prof.num_lab_members} lab, ${prof.num_undergrad_researchers} undergrad)`);
                    await deleteProfessorById(prof.id, dbInstance);
                    duplicateRemovedCount++;
                }
            }
        }
        console.log(`\n   ✅ Removed ${duplicateRemovedCount} duplicate professor(s)\n`);

        // Step 3: Import/update from Excel
        console.log('📥 Step 3: Importing/updating professors from Excel...\n');
        
        let successCount = 0;
        let updatedCount = 0;
        let addedCount = 0;
        let skippedCount = 0;
        const errors = [];

        // Track processed names to handle duplicates in Excel
        const processedNames = new Set();

        // Process each row
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            
            // Skip if no professor name
            if (!row.professor && !row.Professor && !row.name && !row.Name) {
                continue;
            }

            const professorName = (row.professor || row.Professor || row.name || row.Name || '').toString().trim();
            
            if (!professorName) {
                continue;
            }

            // Skip duplicates in Excel (first occurrence wins)
            if (processedNames.has(professorName.toLowerCase())) {
                console.log(`   ⏭️  Skipping duplicate in Excel: ${professorName}`);
                skippedCount++;
                continue;
            }
            processedNames.add(professorName.toLowerCase());
            
            // Parse values - try multiple column name variations
            const numLabMembers = parseInt(row.num_lab_members || row['Num Lab Members'] || row['Lab Members'] || 0) || 0;
            const numUndergrads = parseInt(row.num_undergrads || row['Num Undergrads'] || row['Undergrads'] || 0) || 0;
            const numPublications = parseInt(row.num_publications || row['Num Publications'] || row['Publications'] || 0) || 0;
            
            // Skip if 0 0 0
            if (numPublications === 0 && numLabMembers === 0 && numUndergrads === 0) {
                console.log(`   ⏭️  Skipping ${professorName}: has 0 0 0`);
                skippedCount++;
                continue;
            }
            
            const personalWebsite = (row.Website || row.website || row['Personal Website'] || '').toString().trim() || null;
            const email = (row.Email || row.email || '').toString().trim() || null;
            const lab = (row.Lab || row.lab || '').toString().trim() || null;
            const labWebsite = (row['Lab Website'] || row['Lab_Website'] || row.lab_website || '').toString().trim() || null;
            const title = (row.Title || row.title || '').toString().trim() || null;
            const researchArea = (row['Research Area'] || row.research_area || row['Research Area'] || '').toString().trim() || null;
            const isRecruiting = (row.Recruiting || row.recruiting || '').toString().toLowerCase() === 'yes';
            const isTranslucent = (row.Translucent || row.translucent || '').toString().toLowerCase() === 'yes';

            try {
                // Check if professor exists in economics
                let professor = await db.getProfessorByNameAndDepartment(professorName, 'economics');

                if (!professor) {
                    // Add new professor to economics
                    console.log(`   ➕ ${professorName} - Adding...`);
                    await db.addProfessor('economics', {
                        name: professorName,
                        title: title,
                        lab: lab,
                        labWebsite: labWebsite,
                        personalWebsite: personalWebsite,
                        email: email,
                        researchArea: researchArea,
                        numUndergradResearchers: numUndergrads,
                        numLabMembers: numLabMembers,
                        numPublishedPapers: numPublications,
                        isRecruiting: isRecruiting,
                        isTranslucent: isTranslucent
                    });
                    addedCount++;
                } else {
                    // Update existing professor
                    console.log(`   ✅ ${professorName} - Updating...`);
                    
                    // Build update query
                    const updates = [];
                    const values = [];
                    
                    if (title !== null) {
                        updates.push('title = ?');
                        values.push(title);
                    }
                    if (lab !== null) {
                        updates.push('lab = ?');
                        values.push(lab);
                    }
                    if (labWebsite !== null) {
                        updates.push('lab_website = ?');
                        values.push(labWebsite);
                    }
                    if (personalWebsite !== null) {
                        updates.push('personal_website = ?');
                        values.push(personalWebsite);
                    }
                    if (email !== null) {
                        updates.push('email = ?');
                        values.push(email);
                    }
                    if (researchArea !== null) {
                        updates.push('research_area = ?');
                        values.push(researchArea);
                    }
                    if (numLabMembers !== null && numLabMembers !== undefined) {
                        updates.push('num_lab_members = ?');
                        values.push(numLabMembers);
                    }
                    if (numUndergrads !== null && numUndergrads !== undefined) {
                        updates.push('num_undergrad_researchers = ?');
                        values.push(numUndergrads);
                    }
                    if (numPublications !== null && numPublications !== undefined) {
                        updates.push('num_published_papers = ?');
                        values.push(numPublications);
                    }
                    updates.push('is_recruiting = ?');
                    values.push(isRecruiting ? 1 : 0);
                    updates.push('is_translucent = ?');
                    values.push(isTranslucent ? 1 : 0);
                    
                    if (updates.length > 0) {
                        values.push(professor.id);
                        const query = `UPDATE professors SET ${updates.join(', ')} WHERE id = ?`;
                        
                        await new Promise((resolve, reject) => {
                            dbInstance.run(query, values, (err) => {
                                if (err) reject(err);
                                else resolve();
                            });
                        });
                    }
                    
                    updatedCount++;
                }

                successCount++;
            } catch (error) {
                console.error(`   ❌ Error processing ${professorName}:`, error.message);
                errors.push({ professor: professorName, error: error.message });
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   🗑️  Removed 0-0-0 professors: ${removedCount}`);
        console.log(`   🔄 Removed duplicates: ${duplicateRemovedCount}`);
        console.log(`   ✅ Successfully processed: ${successCount}`);
        console.log(`   ➕ Added: ${addedCount}`);
        console.log(`   🔄 Updated: ${updatedCount}`);
        console.log(`   ⏭️  Skipped: ${skippedCount}`);
        if (errors.length > 0) {
            console.log(`   ❌ Errors: ${errors.length}`);
            console.log(`\n   Error details:`);
            errors.forEach(err => {
                console.log(`      - ${err.professor}: ${err.error}`);
            });
        }

        console.log(`\n✅ Import complete!\n`);
    } catch (error) {
        console.error('\n❌ Error importing economics professors:', error);
        throw error;
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

// Run if called directly
if (require.main === module) {
    const excelPath = process.argv[2] || '/Users/dylantang/Desktop/Econ Profs (1).xlsx';
    
    importEconomicsFromExcel(excelPath)
        .then(() => {
            console.log('✅ Done!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { importEconomicsFromExcel };

