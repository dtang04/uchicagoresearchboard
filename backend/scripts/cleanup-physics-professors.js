#!/usr/bin/env node

/**
 * Script to delete Physics professors that are not in the Excel file
 * Keeps only the 65 professors listed in the Excel file
 */

const XLSX = require('xlsx');
const fs = require('fs');
const db = require('../database');

/**
 * Normalize name for matching (remove middle initials, normalize spaces)
 */
function normalizeName(name) {
    if (!name) return '';
    return name
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .replace(/[.,]/g, '')
        .replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width spaces
}

/**
 * Get base name (first + last) for matching
 */
function getBaseName(name) {
    const parts = normalizeName(name).split(' ');
    if (parts.length < 2) return normalizeName(name);
    return parts[0] + ' ' + parts[parts.length - 1];
}

async function cleanupPhysicsProfessors(excelPath) {
    try {
        if (!fs.existsSync(excelPath)) {
            throw new Error(`Excel file not found: ${excelPath}`);
        }

        console.log(`\n📊 Reading Excel file: ${excelPath}\n`);

        const workbook = XLSX.readFile(excelPath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
            throw new Error('Excel file is empty');
        }

        // Get list of professors from Excel
        const excelProfessors = data
            .filter(row => row.professor && row.professor.toString().trim())
            .map(row => row.professor.toString().trim());

        console.log(`   Found ${excelProfessors.length} professors in Excel file\n`);

        await db.initDatabase();
        const dbInstance = db.getDatabase();

        // Get all Physics professors from database
        const dbProfessors = await db.getProfessorsByDepartment('physics');
        console.log(`   Found ${dbProfessors.length} professors in database\n`);

        // Create a map of Excel professor names (normalized and base names)
        const excelNamesSet = new Set();
        const excelBaseNamesSet = new Set();
        
        excelProfessors.forEach(name => {
            const normalized = normalizeName(name);
            const baseName = getBaseName(name);
            excelNamesSet.add(normalized);
            excelBaseNamesSet.add(baseName);
        });

        let deleted = 0;
        let kept = 0;
        const toDelete = [];

        // Check each database professor against Excel list
        for (const dbProf of dbProfessors) {
            const normalized = normalizeName(dbProf.name);
            const baseName = getBaseName(dbProf.name);
            
            // Check if professor is in Excel (by exact match or base name match)
            const isInExcel = excelNamesSet.has(normalized) || excelBaseNamesSet.has(baseName);
            
            if (!isInExcel) {
                toDelete.push(dbProf);
                console.log(`   ❌ To delete: ${dbProf.name} (not in Excel file)`);
            } else {
                kept++;
                console.log(`   ✅ Keeping: ${dbProf.name}`);
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Keeping: ${kept} professors (from Excel file)`);
        console.log(`   ❌ Deleting: ${toDelete.length} professors (not in Excel file)`);

        if (toDelete.length === 0) {
            console.log(`\n✅ All database professors are in the Excel file - nothing to delete!\n`);
            dbInstance.close();
            process.exit(0);
        }

        // Ask for confirmation
        console.log(`\n⚠️  About to delete ${toDelete.length} professors:`);
        toDelete.forEach(p => console.log(`   - ${p.name}`));
        console.log(`\nProceeding with deletion...\n`);

        // Delete professors
        for (const prof of toDelete) {
            try {
                // Use the deleteProfessor function which handles cascading deletes
                await db.deleteProfessor(prof.name, 'physics');
                console.log(`   ✅ Deleted: ${prof.name}`);
                deleted++;
            } catch (error) {
                console.error(`   ❌ Error deleting ${prof.name}: ${error.message}`);
            }
        }

        console.log(`\n📊 Final Summary:`);
        console.log(`   ✅ Kept: ${kept} professors`);
        console.log(`   ✅ Deleted: ${deleted} professors`);

        // Verify final count
        const finalCount = (await db.getProfessorsByDepartment('physics')).length;
        console.log(`\n✅ Final Physics professor count: ${finalCount} (should be ${excelProfessors.length})\n`);

        dbInstance.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            }
            process.exit(0);
        });
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        process.exit(1);
    }
}

// Main
const excelPath = process.argv[2] || '/Users/dylantang/Downloads/Physics Profs.xlsx';

if (!fs.existsSync(excelPath)) {
    console.error(`❌ Excel file not found: ${excelPath}`);
    console.log('\nUsage: node scripts/cleanup-physics-professors.js [excel-file-path]');
    process.exit(1);
}

cleanupPhysicsProfessors(excelPath);

