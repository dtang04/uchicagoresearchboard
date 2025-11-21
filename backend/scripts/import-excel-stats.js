#!/usr/bin/env node

/**
 * Script to import professor stats from Excel file into SQLite database
 * 
 * Usage: node scripts/import-excel-stats.js <excel-file-path> [department] [sheet-name]
 * 
 * Example:
 *   node scripts/import-excel-stats.js ./professor-stats.xlsx statistics "Sheet1"
 * 
 * Expected Excel columns:
 *   - Name (or Professor Name)
 *   - Undergraduate Researchers (or Undergrads, Undergrad)
 *   - Lab Members (or Lab Members, Lab)
 *   - Published Papers (or Papers, Publications)
 * 
 * Optional columns:
 *   - Department (if not specified as argument)
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const db = require('../database');

function normalizeColumnName(name) {
    return (name || '').toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^a-z0-9\s]/g, '');
}

function findColumn(headerRow, possibleNames) {
    for (let i = 0; i < headerRow.length; i++) {
        const normalized = normalizeColumnName(headerRow[i]);
        for (const name of possibleNames) {
            if (normalized.includes(name) || name.includes(normalized)) {
                return i;
            }
        }
    }
    return -1;
}

async function importExcelStats(excelPath, department, sheetName = null) {
    try {
        // Check if file exists
        if (!fs.existsSync(excelPath)) {
            throw new Error(`Excel file not found: ${excelPath}`);
        }

        console.log(`\n📊 Reading Excel file: ${excelPath}\n`);

        // Read Excel file
        const workbook = XLSX.readFile(excelPath);
        
        // Get sheet name
        const sheet = sheetName || workbook.SheetNames[0];
        if (!workbook.Sheets[sheet]) {
            throw new Error(`Sheet "${sheet}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`);
        }

        console.log(`   Using sheet: ${sheet}\n`);

        // Convert to JSON
        const worksheet = workbook.Sheets[sheet];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

        if (data.length < 2) {
            throw new Error('Excel file must have at least a header row and one data row');
        }

        // Find column indices
        const headerRow = data[0];
        
        const nameCol = findColumn(headerRow, ['name', 'professor', 'professor name']);
        const undergradCol = findColumn(headerRow, ['undergrad', 'undergraduate', 'undergraduate researchers', 'undergrad researchers']);
        const labCol = findColumn(headerRow, ['lab', 'lab members', 'lab member', 'members']);
        const papersCol = findColumn(headerRow, ['paper', 'papers', 'publication', 'publications', 'published papers']);
        const deptCol = findColumn(headerRow, ['department', 'dept']);

        if (nameCol === -1) {
            throw new Error('Could not find "Name" column in Excel file');
        }

        console.log(`   Found columns:`);
        console.log(`     Name: column ${nameCol + 1} (${headerRow[nameCol]})`);
        if (undergradCol !== -1) console.log(`     Undergraduate Researchers: column ${undergradCol + 1} (${headerRow[undergradCol]})`);
        if (labCol !== -1) console.log(`     Lab Members: column ${labCol + 1} (${headerRow[labCol]})`);
        if (papersCol !== -1) console.log(`     Published Papers: column ${papersCol + 1} (${headerRow[papersCol]})`);
        if (deptCol !== -1) console.log(`     Department: column ${deptCol + 1} (${headerRow[deptCol]})`);
        console.log('');

        // Initialize database
        await db.initDatabase();

        let successCount = 0;
        let failCount = 0;
        const errors = [];

        // Process each row
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            
            // Skip empty rows
            if (!row[nameCol] || !row[nameCol].toString().trim()) {
                continue;
            }

            const professorName = row[nameCol].toString().trim();
            const rowDepartment = (deptCol !== -1 && row[deptCol]) ? row[deptCol].toString().trim().toLowerCase() : department;
            
            if (!rowDepartment) {
                errors.push(`Row ${i + 1}: ${professorName} - No department specified`);
                failCount++;
                continue;
            }

            // Parse values
            const undergrads = (undergradCol !== -1 && row[undergradCol] !== null && row[undergradCol] !== undefined) 
                ? parseInt(row[undergradCol]) || 0 
                : null;
            const labMembers = (labCol !== -1 && row[labCol] !== null && row[labCol] !== undefined) 
                ? parseInt(row[labCol]) || 0 
                : null;
            const papers = (papersCol !== -1 && row[papersCol] !== null && row[papersCol] !== undefined) 
                ? parseInt(row[papersCol]) || 0 
                : null;

            try {
                // Check if professor exists
                const professor = await db.getProfessorByNameAndDepartment(professorName, rowDepartment);
                if (!professor) {
                    errors.push(`Row ${i + 1}: ${professorName} - Not found in department "${rowDepartment}"`);
                    failCount++;
                    continue;
                }

                // Update stats
                await db.updateProfessorStats(professorName, rowDepartment, {
                    numUndergradResearchers: undergrads,
                    numLabMembers: labMembers,
                    numPublishedPapers: papers
                });

                console.log(`   ✅ ${professorName} (${rowDepartment}): Undergrad=${undergrads ?? 'N/A'}, Lab=${labMembers ?? 'N/A'}, Papers=${papers ?? 'N/A'}`);
                successCount++;
            } catch (error) {
                errors.push(`Row ${i + 1}: ${professorName} - ${error.message}`);
                failCount++;
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Successfully updated: ${successCount}`);
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
const args = process.argv.slice(2);

if (args.length < 1) {
    console.log('Usage: node scripts/import-excel-stats.js <excel-file-path> [department] [sheet-name]');
    console.log('\nExample:');
    console.log('  node scripts/import-excel-stats.js ./professor-stats.xlsx statistics');
    console.log('  node scripts/import-excel-stats.js ./professor-stats.xlsx statistics "Sheet1"');
    console.log('\nExpected Excel columns:');
    console.log('  - Name (or Professor Name)');
    console.log('  - Undergraduate Researchers (or Undergrads)');
    console.log('  - Lab Members (or Lab)');
    console.log('  - Published Papers (or Papers, Publications)');
    console.log('  - Department (optional, if not specified as argument)');
    process.exit(1);
}

const [excelPath, department, sheetName] = args;
importExcelStats(excelPath, department, sheetName);

