#!/usr/bin/env node

/**
 * Script to replace all professors in the Economics department
 * Organized by research field based on UChicago Economics research areas
 * Source: https://economics.uchicago.edu/research-initiatives/areas-of-research
 */

const db = require('../database');

// Professors organized by research field
// Note: Some professors appear in multiple fields - we'll use their primary field
// or list them in the first field they appear

const professorsByField = {
    "Applied Microeconomics": [
        { name: "Stéphane Bonhomme", title: "Professor" },
        { name: "David Galenson", title: "Professor" },
        { name: "James J. Heckman", title: "Professor" },
        { name: "Ali Hortaçsu", title: "Professor" },
        { name: "Greg Kaplan", title: "Professor" },
        { name: "Steven Levitt", title: "Professor" },
        { name: "Kevin Murphy", title: "Professor" },
        { name: "Evan Rose", title: "Professor" }
    ],
    "Development Economics": [
        { name: "Anne Karing", title: "Assistant Professor" },
        { name: "Michael Kremer", title: "Professor" }
    ],
    "Econometrics": [
        { name: "Lars Peter Hansen", title: "Professor" },
        { name: "Jim Heckman", title: "Professor" }, // Note: May be same as James J. Heckman
        { name: "Kirill Ponomarev", title: "Assistant Professor" },
        { name: "Azeem Shaikh", title: "Professor" },
        { name: "Max Tabord-Meehan", title: "Assistant Professor" },
        { name: "Alex Torgovitsky", title: "Professor" }
    ],
    "Economic Theory": [
        { name: "Ben Brooks", title: "Professor" },
        { name: "Roger B. Myerson", title: "Professor" },
        { name: "Doron Ravid", title: "Assistant Professor" },
        { name: "Philip J. Reny", title: "Professor" },
        { name: "Joseph Root", title: "Assistant Professor" },
        { name: "Nancy Stokey", title: "Professor" }
    ],
    "Environmental/Energy": [
        { name: "Michael Greenstone", title: "Professor" },
        { name: "Esteban Rossi-Hansberg", title: "Professor" }
    ],
    "Experimental/Behavioral Economics": [
        { name: "Leonardo Bursztyn", title: "Professor" },
        { name: "John List", title: "Professor" }
    ],
    "IO": [
        { name: "Ali Hortaçsu", title: "Professor" } // Already in Applied Micro
    ],
    "Labor Economics": [
        { name: "Christina Brown", title: "Assistant Professor" },
        { name: "Manasi Deshpande", title: "Assistant Professor" },
        { name: "Thibaut Lamadon", title: "Assistant Professor" },
        { name: "Magne Mogstad", title: "Professor" },
        { name: "Derek A. Neal", title: "Professor" },
        { name: "Evan Rose", title: "Professor" } // Already in Applied Micro
    ],
    "Macro/Finance": [
        { name: "Ufuk Akcigit", title: "Professor" },
        { name: "Fernando Alvarez", title: "Professor" },
        { name: "Mikhail Golosov", title: "Professor" },
        { name: "Robert Shimer", title: "Professor" },
        { name: "Harald Uhlig", title: "Professor" }
    ],
    "Public Economics": [
        { name: "Casey Mulligan", title: "Professor" }
    ],
    "Trade/Spatial Economics": [
        { name: "Felix Tintelnot", title: "Professor" },
        { name: "Esteban Rossi-Hansberg", title: "Professor" } // Already in Environmental/Energy
    ]
};

// Collect all unique professors (avoid duplicates)
// If a professor appears in multiple fields, use the first field encountered
const uniqueProfessors = new Map(); // name (lowercase) -> {professor data, researchArea}

// Process each field and collect unique professors
for (const [field, profs] of Object.entries(professorsByField)) {
    for (const prof of profs) {
        const key = prof.name.toLowerCase().trim();
        if (!uniqueProfessors.has(key)) {
            uniqueProfessors.set(key, {
                ...prof,
                researchArea: field // Store first research field encountered
            });
        }
    }
}

async function updateEconomicsDepartment() {
    try {
        // Initialize the database
        await db.initDatabase();
        
        // Ensure economics department exists
        const dept = await db.createOrGetDepartment('economics');
        console.log(`📊 Department: ${dept.name} (ID: ${dept.id})`);
        
        // Get all existing professors from economics department
        console.log('\n🗑️  Getting existing professors from Economics department...');
        const existingProfessors = await db.getProfessorsByDepartment('economics');
        console.log(`   Found ${existingProfessors.length} existing professors`);
        
        // Delete all existing professors (and related records)
        if (existingProfessors.length > 0) {
            console.log('\n🗑️  Deleting existing professors...');
            for (const prof of existingProfessors) {
                try {
                    await db.deleteProfessor(prof.name, 'economics');
                    console.log(`   ✅ Deleted: ${prof.name}`);
                } catch (error) {
                    console.error(`   ⚠️  Error deleting ${prof.name}:`, error.message);
                }
            }
        }
        
        // Add all unique professors
        console.log('\n➕ Adding new professors...');
        let added = 0;
        let errors = 0;
        
        // Add each unique professor
        for (const [key, prof] of uniqueProfessors.entries()) {
            try {
                const professorData = {
                    name: prof.name,
                    title: prof.title,
                    lab: '', // Empty string
                    labWebsite: null,
                    email: '', // Empty string
                    researchArea: prof.researchArea, // Use research field as research area
                    numUndergradResearchers: 0,
                    numLabMembers: 0,
                    numPublishedPapers: 0,
                    isRecruiting: false,
                    isTranslucent: false
                };
                
                await db.addProfessor('economics', professorData);
                added++;
                console.log(`   ✅ Added: ${prof.name} (${prof.researchArea})`);
            } catch (error) {
                errors++;
                console.error(`   ❌ Error adding ${prof.name}:`, error.message);
            }
        }
        
        // Show summary by field
        console.log(`\n📋 Summary:`);
        console.log(`   - Deleted: ${existingProfessors.length} old professors`);
        console.log(`   - Added: ${added} new professors`);
        console.log(`   - Errors: ${errors}`);
        console.log(`   - Total unique professors: ${uniqueProfessors.size}`);
        
        // Show breakdown by field (including duplicates in counts)
        console.log(`\n📊 Professors listed by research field:`);
        for (const [field, profs] of Object.entries(professorsByField)) {
            console.log(`   ${field}: ${profs.length} professors listed`);
        }
        
        // Close database connection
        const database = db.getDatabase();
        if (database) {
            database.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                    process.exit(1);
                } else {
                    console.log('\n✅ Database closed successfully');
                    process.exit(0);
                }
            });
        } else {
            process.exit(0);
        }
    } catch (error) {
        console.error('❌ Error updating department:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

updateEconomicsDepartment();

