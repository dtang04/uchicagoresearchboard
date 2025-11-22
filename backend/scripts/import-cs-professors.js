#!/usr/bin/env node

/**
 * Script to import Computer Science professors from Excel file
 * Handles translucent flag and recruiting flag
 */

const XLSX = require('xlsx');
const fs = require('fs');
const db = require('../database');

async function importCSProfessors(excelPath) {
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

        let added = 0;
        let updated = 0;
        let skipped = 0;
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
            const website = row.Website ? row.Website.toString().trim() : null;
            const email = row.Email ? row.Email.toString().trim() : null;
            const lab = row.Lab ? row.Lab.toString().trim() : null;
            
            // Check translucent flag (manual override to make card translucent even if lab members > 0)
            const shouldBeTranslucent = row.Translucent && 
                (row.Translucent.toString().toLowerCase().trim() === 'yes' || 
                 row.Translucent.toString().toLowerCase().trim() === 'true' ||
                 row.Translucent.toString().toLowerCase().trim() === '1');
            
            // Check recruiting flag
            const isRecruiting = row.Recruiting && 
                (row.Recruiting.toString().toLowerCase().trim() === 'yes' || 
                 row.Recruiting.toString().toLowerCase().trim() === 'true' ||
                 row.Recruiting.toString().toLowerCase().trim() === '1');
            
            // Keep the actual lab members count (don't override)
            const finalLabMembers = numLabMembers;

            try {
                // Check if professor already exists
                const existing = await db.getProfessorByNameAndDepartment(professorName, 'computer science');
                
                if (existing) {
                    // Update existing professor
                    await db.updateProfessorStats(professorName, 'computer science', {
                        numLabMembers: finalLabMembers,
                        numUndergradResearchers: numUndergrads,
                        numPublishedPapers: numPublications
                    });

                    // Update website, email, lab, recruiting flag, and translucent flag
                    await new Promise((resolve, reject) => {
                        dbInstance.run(
                            'UPDATE professors SET lab = ?, lab_website = ?, email = ?, is_recruiting = ?, is_translucent = ? WHERE id = ?',
                            [
                                lab || null,
                                website || null,
                                email || null,
                                isRecruiting ? 1 : 0,
                                shouldBeTranslucent ? 1 : 0,
                                existing.id
                            ],
                            function(err) {
                                if (err) reject(err);
                                else resolve();
                            }
                        );
                    });

                    console.log(`   ✅ Updated: ${professorName}`);
                    console.log(`      Lab Members: ${finalLabMembers ?? 'N/A'}, Undergrads: ${numUndergrads ?? 'N/A'}, Papers: ${numPublications ?? 'N/A'}`);
                    if (shouldBeTranslucent) console.log(`      ⚠️  Manually marked as translucent`);
                    if (isRecruiting) console.log(`      🔺 Marked as actively recruiting`);
                    if (lab) console.log(`      Lab: ${lab}`);
                    if (website) console.log(`      Website: ${website}`);
                    if (email) console.log(`      Email: ${email}`);
                    console.log('');

                    updated++;
                } else {
                    // Add new professor
                    await db.addProfessor('computer science', {
                        name: professorName,
                        title: null,
                        lab: lab,
                        labWebsite: website,
                        email: email,
                        researchArea: null,
                        isRecruiting: isRecruiting,
                        isTranslucent: shouldBeTranslucent
                    });

                    // Update stats
                    const newProf = await db.getProfessorByNameAndDepartment(professorName, 'computer science');
                    if (newProf) {
                        await db.updateProfessorStats(professorName, 'computer science', {
                            numLabMembers: finalLabMembers,
                            numUndergradResearchers: numUndergrads,
                            numPublishedPapers: numPublications
                        });
                    }

                    console.log(`   ✅ Added: ${professorName}`);
                    console.log(`      Lab Members: ${finalLabMembers ?? 'N/A'}, Undergrads: ${numUndergrads ?? 'N/A'}, Papers: ${numPublications ?? 'N/A'}`);
                    if (shouldBeTranslucent) console.log(`      ⚠️  Manually marked as translucent`);
                    if (isRecruiting) console.log(`      🔺 Marked as actively recruiting`);
                    if (lab) console.log(`      Lab: ${lab}`);
                    if (website) console.log(`      Website: ${website}`);
                    if (email) console.log(`      Email: ${email}`);
                    console.log('');

                    added++;
                }
            } catch (error) {
                errors.push(`${professorName}: ${error.message}`);
                console.error(`   ❌ Error processing ${professorName}: ${error.message}`);
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Added: ${added}`);
        console.log(`   ✅ Updated: ${updated}`);
        console.log(`   ⏭️  Skipped: ${skipped}`);
        console.log(`   ❌ Failed: ${errors.length}`);
        
        if (errors.length > 0) {
            console.log(`\n❌ Errors:`);
            errors.forEach(err => console.log(`   ${err}`));
        }

        process.exit(0);
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        process.exit(1);
    }
}

// Main
const excelPath = process.argv[2] || '/Users/dylantang/Downloads/CS Profs.xlsx';

if (!fs.existsSync(excelPath)) {
    console.error(`❌ Excel file not found: ${excelPath}`);
    console.log('\nUsage: node scripts/import-cs-professors.js [excel-file-path]');
    process.exit(1);
}

importCSProfessors(excelPath);

