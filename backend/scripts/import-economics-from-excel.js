#!/usr/bin/env node

/**
 * Script to import/update Economics professors from Excel file
 * Updates: stats, website, email
 */

const XLSX = require('xlsx');
const fs = require('fs');
const db = require('../database');

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

        console.log(`   Found ${data.length} professors in Excel file\n`);

        // Initialize database
        await db.initDatabase();
        const dbInstance = db.getDatabase();

        let successCount = 0;
        let updatedCount = 0;
        let addedCount = 0;
        let notFoundCount = 0;
        const errors = [];

        // Process each row
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            
            // Skip if no professor name
            if (!row.professor || !row.professor.toString().trim()) {
                continue;
            }

            const professorName = row.professor.toString().trim();
            
            // Parse values
            const numLabMembers = (row.num_lab_members !== null && row.num_lab_members !== undefined) 
                ? parseInt(row.num_lab_members) || 0 
                : null;
            const numUndergrads = (row.num_undergrads !== null && row.num_undergrads !== undefined) 
                ? parseInt(row.num_undergrads) || 0 
                : null;
            const numPublications = (row.num_publications !== null && row.num_publications !== undefined) 
                ? parseInt(row.num_publications) || 0 
                : null;
            const personalWebsite = row.Website ? row.Website.toString().trim() : null;
            const email = row.Email ? row.Email.toString().trim() : null;

            try {
                // Check if professor exists in economics
                let professor = await db.getProfessorByNameAndDepartment(professorName, 'economics');

                if (!professor) {
                    // Add new professor to economics
                    console.log(`   ➕ ${professorName} - Adding to economics...`);
                    await db.addProfessor('economics', {
                        name: professorName,
                        title: null,
                        lab: null,
                        labWebsite: null,
                        personalWebsite: personalWebsite,
                        email: email,
                        researchArea: null,
                        numUndergradResearchers: numUndergrads,
                        numLabMembers: numLabMembers,
                        numPublishedPapers: numPublications,
                        isRecruiting: false,
                        isTranslucent: false
                    });
                    addedCount++;
                } else {
                    // Update existing professor
                    console.log(`   ✅ ${professorName} - Updating in economics...`);
                    
                    // Build update query
                    const updates = [];
                    const values = [];
                    
                    if (numLabMembers !== null) {
                        updates.push('num_lab_members = ?');
                        values.push(numLabMembers);
                    }
                    if (numUndergrads !== null) {
                        updates.push('num_undergrad_researchers = ?');
                        values.push(numUndergrads);
                    }
                    if (numPublications !== null) {
                        updates.push('num_published_papers = ?');
                        values.push(numPublications);
                    }
                    if (personalWebsite !== null) {
                        updates.push('personal_website = ?');
                        values.push(personalWebsite);
                    }
                    if (email !== null) {
                        updates.push('email = ?');
                        values.push(email);
                    }
                    
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
                notFoundCount++;
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Successfully processed: ${successCount}`);
        console.log(`   ➕ Added: ${addedCount}`);
        console.log(`   🔄 Updated: ${updatedCount}`);
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
    }
}

// Run if called directly
if (require.main === module) {
    const excelPath = process.argv[2] || '/Users/dylantang/Downloads/Econ Profs.xlsx';
    
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

