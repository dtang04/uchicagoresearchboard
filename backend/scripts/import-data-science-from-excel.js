#!/usr/bin/env node

/**
 * Script to import/update Data Science professors from Excel file
 * Updates: stats, website, lab website, email, recruiting, translucent flags
 * Also updates professors in other departments if they match by name
 */

const XLSX = require('xlsx');
const fs = require('fs');
const db = require('../database');

async function importDataScienceFromExcel(excelPath) {
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

        // Get all departments to check for cross-department matches
        const allDepartments = await db.getAllDepartments();
        const departmentNames = allDepartments.map(d => d.name);

        let successCount = 0;
        let updatedCount = 0;
        let addedCount = 0;
        let crossDeptUpdatedCount = 0;
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
            const labWebsite = row.Lab ? row.Lab.toString().trim() : null;
            const email = row.Email ? row.Email.toString().trim() : null;
            const isRecruiting = row.Recruiting && row.Recruiting.toString().toLowerCase() === 'yes';
            const isTranslucent = row.Translucent && row.Translucent.toString().toLowerCase() === 'yes';

            try {
                // First, check if professor exists in data science
                let professor = await db.getProfessorByNameAndDepartment(professorName, 'data science');
                let foundInDataScience = !!professor;

                if (!foundInDataScience) {
                    // Check if professor exists in other departments
                    let foundInOtherDept = false;
                    for (const dept of departmentNames) {
                        if (dept === 'data science') continue;
                        professor = await db.getProfessorByNameAndDepartment(professorName, dept);
                        if (professor) {
                            foundInOtherDept = true;
                            console.log(`   🔄 ${professorName} - Found in ${dept}, updating...`);
                            
                            // Update the existing professor in other department
                            await updateProfessor(professor, professorName, dept, {
                                numLabMembers,
                                numUndergrads,
                                numPublications,
                                website,
                                labWebsite,
                                email,
                                isRecruiting,
                                isTranslucent
                            }, dbInstance);
                            
                            crossDeptUpdatedCount++;
                            break;
                        }
                    }

                    if (!foundInOtherDept) {
                        // Add new professor to data science
                        console.log(`   ➕ ${professorName} - Adding to data science...`);
                        await addProfessorToDataScience(professorName, {
                            numLabMembers,
                            numUndergrads,
                            numPublications,
                            website,
                            labWebsite,
                            email,
                            isRecruiting,
                            isTranslucent
                        });
                        addedCount++;
                    }
                } else {
                    // Update existing professor in data science
                    console.log(`   ✅ ${professorName} - Updating in data science...`);
                    await updateProfessor(professor, professorName, 'data science', {
                        numLabMembers,
                        numUndergrads,
                        numPublications,
                        website,
                        labWebsite,
                        email,
                        isRecruiting,
                        isTranslucent
                    }, dbInstance);
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
        console.log(`   🔄 Updated in data science: ${updatedCount}`);
        console.log(`   ➕ Added to data science: ${addedCount}`);
        console.log(`   🔄 Updated in other departments: ${crossDeptUpdatedCount}`);
        console.log(`   ⚠️  Errors/Not found: ${notFoundCount}`);
        
        if (errors.length > 0) {
            console.log(`\n❌ Errors:`);
            errors.forEach(e => console.log(`   - ${e.professor}: ${e.error}`));
        }

        console.log('\n✅ Done!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

async function updateProfessor(professor, professorName, departmentName, data, dbInstance) {
    // Update stats
    if (data.numLabMembers !== null || data.numUndergrads !== null || data.numPublications !== null) {
        await db.updateProfessorStats(professorName, departmentName, {
            numLabMembers: data.numLabMembers,
            numUndergradResearchers: data.numUndergrads,
            numPublishedPapers: data.numPublications
        });
    }

    // Update other fields (email, website, lab website, flags)
    // Only update if the new value is not null/empty and different from existing
    const updates = [];
    const values = [];

    if (data.email && data.email.trim() && (!professor.email || professor.email.trim() === '')) {
        updates.push('email = ?');
        values.push(data.email.trim());
    }

    if (data.website && data.website.trim() && (!professor.lab_website || professor.lab_website.trim() === '')) {
        updates.push('lab_website = ?');
        values.push(data.website.trim());
    } else if (data.labWebsite && data.labWebsite.trim() && (!professor.lab_website || professor.lab_website.trim() === '')) {
        updates.push('lab_website = ?');
        values.push(data.labWebsite.trim());
    }

    if (data.isRecruiting !== undefined) {
        updates.push('is_recruiting = ?');
        values.push(data.isRecruiting ? 1 : 0);
    }

    if (data.isTranslucent !== undefined) {
        updates.push('is_translucent = ?');
        values.push(data.isTranslucent ? 1 : 0);
    }

    if (updates.length > 0) {
        values.push(professor.id);
        await new Promise((resolve, reject) => {
            dbInstance.run(
                `UPDATE professors SET ${updates.join(', ')} WHERE id = ?`,
                values,
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }
}

async function addProfessorToDataScience(professorName, data) {
    const professor = {
        name: professorName,
        title: null,
        lab: null,
        labWebsite: data.labWebsite || data.website || null,
        email: data.email || null,
        researchArea: null,
        numUndergradResearchers: data.numUndergrads,
        numLabMembers: data.numLabMembers,
        numPublishedPapers: data.numPublications,
        isRecruiting: data.isRecruiting || false,
        isTranslucent: data.isTranslucent || false
    };

    await db.addProfessor('data science', professor);
}

// Run the script
const excelPath = process.argv[2] || '/Users/dylantang/Desktop/Data Science Profs.xlsx';
importDataScienceFromExcel(excelPath);

