#!/usr/bin/env node

/**
 * Script to update Mathematics professors from Excel file
 * Updates: stats (lab members, undergrads, publications), website, and email
 */

const XLSX = require('xlsx');
const fs = require('fs');
const db = require('../database');

async function updateProfessorsFromExcel(excelPath) {
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
        let failCount = 0;
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
            const website = row.Website ? row.Website.toString().trim() : null;
            const email = row.Email ? row.Email.toString().trim() : null;

            try {
                // Check if professor exists
                const professor = await db.getProfessorByNameAndDepartment(professorName, 'mathematics');
                if (!professor) {
                    console.log(`   ⚠️  ${professorName} - Not found in Mathematics department`);
                    notFoundCount++;
                    continue;
                }

                // Update stats
                await db.updateProfessorStats(professorName, 'mathematics', {
                    numLabMembers: numLabMembers,
                    numUndergradResearchers: numUndergrads,
                    numPublishedPapers: numPublications
                });

                // Update website and email
                await new Promise((resolve, reject) => {
                    dbInstance.run(
                        'UPDATE professors SET lab_website = ?, email = ? WHERE id = ?',
                        [
                            website || null,
                            email || null,
                            professor.id
                        ],
                        function(err) {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });

                console.log(`   ✅ ${professorName}`);
                console.log(`      Lab Members: ${numLabMembers ?? 'N/A'}, Undergrads: ${numUndergrads ?? 'N/A'}, Papers: ${numPublications ?? 'N/A'}`);
                if (website) console.log(`      Website: ${website}`);
                if (email) console.log(`      Email: ${email}`);
                console.log('');

                successCount++;
            } catch (error) {
                errors.push(`${professorName}: ${error.message}`);
                failCount++;
                console.error(`   ❌ Error updating ${professorName}: ${error.message}`);
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Successfully updated: ${successCount}`);
        console.log(`   ⚠️  Not found: ${notFoundCount}`);
        console.log(`   ❌ Failed: ${failCount}`);
        
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
const excelPath = process.argv[2] || '/Users/dylantang/Desktop/Mathematics Profs.xlsx';

if (!fs.existsSync(excelPath)) {
    console.error(`❌ Excel file not found: ${excelPath}`);
    console.log('\nUsage: node scripts/update-mathematics-from-excel.js [excel-file-path]');
    process.exit(1);
}

updateProfessorsFromExcel(excelPath);

