#!/usr/bin/env node

/**
 * Script to update professor websites and emails from Excel file
 * Only updates professors that don't have a website yet, or updates emails if different
 * 
 * Usage: node scripts/update-websites-emails.js <excel-file-path> [department] [sheet-name]
 */

const XLSX = require('xlsx');
const fs = require('fs');
const db = require('../database');

function normalizeName(name) {
    return (name || '').toLowerCase().trim();
}

function findColumn(headerRow, possibleNames) {
    for (let i = 0; i < headerRow.length; i++) {
        const normalized = (headerRow[i] || '').toLowerCase().trim();
        for (const name of possibleNames) {
            if (normalized.includes(name) || name.includes(normalized)) {
                return i;
            }
        }
    }
    return -1;
}

async function updateProfessorWebsiteAndEmail(professorName, departmentName, website, email) {
    const prof = await db.getProfessorByNameAndDepartment(professorName, departmentName);
    if (!prof) {
        throw new Error('Professor not found');
    }
    
    return new Promise((resolve, reject) => {
        // Only update if professor doesn't have website yet, or if email is different
        const updates = [];
        const values = [];
        
        if (!prof.lab_website && website) {
            updates.push('lab_website = ?');
            values.push(website);
        }
        
        if (email && email !== prof.email) {
            updates.push('email = ?');
            values.push(email);
        }
        
        if (updates.length === 0) {
            resolve(0); // Nothing to update
            return;
        }
        
        values.push(prof.id);
        
        const database = db.getDatabase();
        database.run(`
            UPDATE professors 
            SET ${updates.join(', ')}
            WHERE id = ?
        `, values, function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

async function importWebsitesAndEmails(excelPath, department, sheetName = null) {
    try {
        if (!fs.existsSync(excelPath)) {
            throw new Error(`Excel file not found: ${excelPath}`);
        }

        console.log(`\n📊 Reading Excel file: ${excelPath}\n`);

        const workbook = XLSX.readFile(excelPath);
        const sheet = sheetName || workbook.SheetNames[0];
        if (!workbook.Sheets[sheet]) {
            throw new Error(`Sheet "${sheet}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`);
        }

        console.log(`   Using sheet: ${sheet}\n`);

        const worksheet = workbook.Sheets[sheet];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

        if (data.length < 2) {
            throw new Error('Excel file must have at least a header row and one data row');
        }

        const headerRow = data[0];
        
        const nameCol = findColumn(headerRow, ['name', 'professor', 'professor name']);
        const websiteCol = findColumn(headerRow, ['website', 'lab website', 'lab_website', 'url']);
        const emailCol = findColumn(headerRow, ['email', 'e-mail']);

        if (nameCol === -1) {
            throw new Error('Could not find "Name" column in Excel file');
        }

        if (websiteCol === -1 && emailCol === -1) {
            throw new Error('Could not find "Website" or "Email" columns in Excel file');
        }

        console.log(`   Found columns:`);
        console.log(`     Name: column ${nameCol + 1} (${headerRow[nameCol]})`);
        if (websiteCol !== -1) console.log(`     Website: column ${websiteCol + 1} (${headerRow[websiteCol]})`);
        if (emailCol !== -1) console.log(`     Email: column ${emailCol + 1} (${headerRow[emailCol]})`);
        console.log('');

        await db.initDatabase();

        let websiteUpdated = 0;
        let emailUpdated = 0;
        let skipped = 0;
        const errors = [];

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            
            if (!row[nameCol] || !row[nameCol].toString().trim()) {
                continue;
            }

            const professorName = row[nameCol].toString().trim();
            const website = (websiteCol !== -1 && row[websiteCol]) ? row[websiteCol].toString().trim() : null;
            const email = (emailCol !== -1 && row[emailCol]) ? row[emailCol].toString().trim() : null;

            try {
                const professor = await db.getProfessorByNameAndDepartment(professorName, department);
                if (!professor) {
                    errors.push(`Row ${i + 1}: ${professorName} - Not found in department "${department}"`);
                    continue;
                }

                // Check what needs updating
                const needsWebsite = !professor.lab_website && website;
                const needsEmail = email && email !== professor.email;

                if (!needsWebsite && !needsEmail) {
                    skipped++;
                    continue;
                }

                await updateProfessorWebsiteAndEmail(professorName, department, website, email);

                if (needsWebsite) {
                    console.log(`   ✅ ${professorName}: Added website: ${website}`);
                    websiteUpdated++;
                }
                if (needsEmail) {
                    console.log(`   ✅ ${professorName}: Updated email: ${email}`);
                    emailUpdated++;
                }
            } catch (error) {
                errors.push(`Row ${i + 1}: ${professorName} - ${error.message}`);
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Websites added: ${websiteUpdated}`);
        console.log(`   ✅ Emails updated: ${emailUpdated}`);
        console.log(`   ⏭️  Skipped (already have data): ${skipped}`);
        
        if (errors.length > 0) {
            console.log(`   ❌ Errors: ${errors.length}`);
            errors.forEach(err => console.log(`      ${err}`));
        }

        process.exit(0);
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        process.exit(1);
    }
}

const args = process.argv.slice(2);

if (args.length < 2) {
    console.log('Usage: node scripts/update-websites-emails.js <excel-file-path> <department> [sheet-name]');
    console.log('\nExample:');
    console.log('  node scripts/update-websites-emails.js ./professor-stats.xlsx statistics');
    process.exit(1);
}

const [excelPath, department, sheetName] = args;
importWebsitesAndEmails(excelPath, department, sheetName);

