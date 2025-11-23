#!/usr/bin/env node

/**
 * Script to replace all professors in the Data Science department
 * This deletes all existing professors and adds the new list
 */

const db = require('../database');

// List of professors from the Data Science department
const professors = [
    {
        name: "David Biron",
        title: "Director of Undergraduate Data Science; Assistant Senior Instructional Professor"
    },
    {
        name: "Jeanne Century",
        title: "Research Associate Professor and Director, Outlier Research & Evaluation"
    },
    {
        name: "Aloni Cohen",
        title: "Assistant Professor of Computer Science and Data Science"
    },
    {
        name: "Moon Duchin",
        title: "Professor of Computer Science and Data Science; Faculty Director, Data & Democracy"
    },
    {
        name: "Greg Green",
        title: "Senior Instructional Professor; Senior Director of the DSI Polsky Transform Initiative; Senior Director of DSI Executive and Professional Education"
    },
    {
        name: "Ari Holtzman",
        title: "Assistant Professor of Computer Science and Data Science"
    },
    {
        name: "Nikolaos (Nikos) Ignatiadis",
        title: "Assistant Professor of Statistics and Data Science"
    },
    {
        name: "Alex Kale",
        title: "Assistant Professor of Computer Science and Data Science"
    },
    {
        name: "Frederic Koehler",
        title: "Assistant Professor of Statistics and Data Science"
    },
    {
        name: "Amanda Kube Jotte",
        title: "Assistant Instructional Professor"
    },
    {
        name: "Mina Lee",
        title: "Assistant Professor of Computer Science and Data Science"
    },
    {
        name: "Bo Li",
        title: "Research Associate Professor of Computer Science and Data Science"
    },
    {
        name: "Tian Li",
        title: "Assistant Professor of Computer Science and Data Science"
    },
    {
        name: "Edwin Lo",
        title: "Director of Masters in Data Science Program; Assistant Senior Instructional Professor"
    },
    {
        name: "Kristian Lum",
        title: "Visiting Scientist"
    },
    {
        name: "Li Ma",
        title: "Professor of Statistics and Data Science"
    },
    {
        name: "Amy Nussbaum",
        title: "Assistant Instructional Professor"
    },
    {
        name: "Nick Ross",
        title: "Data Science Clinic Director, Data Science Institute; Associate Senior Instructional Professor"
    },
    {
        name: "Aaron Schein",
        title: "Assistant Professor of Statistics and Data Science"
    },
    {
        name: "Chenhao Tan",
        title: "Associate Professor of Computer Science and Data Science; Faculty Co-Director, Novel Intelligence"
    },
    {
        name: "Will Trimble",
        title: "Assistant Instructional Professor"
    },
    {
        name: "Victor Veitch",
        title: "Assistant Professor of Statistics and Data Science"
    },
    {
        name: "Haifeng Xu",
        title: "Assistant Professor of Computer Science and Data Science"
    },
    {
        name: "Ce Zhang",
        title: "Neubauer Associate Professor of Computer Science and Data Science"
    }
];

async function updateDataScienceDepartment() {
    try {
        // Initialize the database
        await db.initDatabase();
        
        // Ensure data science department exists
        const dept = await db.createOrGetDepartment('data science');
        console.log(`📊 Department: ${dept.name} (ID: ${dept.id})`);
        
        // Get all existing professors from data science department
        console.log('\n🗑️  Getting existing professors from Data Science department...');
        const existingProfessors = await db.getProfessorsByDepartment('data science');
        console.log(`   Found ${existingProfessors.length} existing professors`);
        
        // Delete all existing professors (and related records)
        if (existingProfessors.length > 0) {
            console.log('\n🗑️  Deleting existing professors...');
            for (const prof of existingProfessors) {
                try {
                    await db.deleteProfessor(prof.name, 'data science');
                    console.log(`   ✅ Deleted: ${prof.name}`);
                } catch (error) {
                    console.error(`   ⚠️  Error deleting ${prof.name}:`, error.message);
                }
            }
        }
        
        // Add all new professors
        console.log('\n➕ Adding new professors...');
        let added = 0;
        
        for (const prof of professors) {
            try {
                const professorData = {
                    name: prof.name,
                    title: prof.title,
                    lab: '', // Empty string
                    labWebsite: null,
                    email: '', // Empty string
                    researchArea: null,
                    numUndergradResearchers: 0,
                    numLabMembers: 0,
                    numPublishedPapers: 0,
                    isRecruiting: false,
                    isTranslucent: false
                };
                
                await db.addProfessor('data science', professorData);
                added++;
                console.log(`   ✅ Added: ${prof.name}`);
            } catch (error) {
                console.error(`   ❌ Error adding ${prof.name}:`, error.message);
            }
        }
        
        console.log(`\n✅ Successfully updated Data Science department!`);
        console.log(`   - Deleted: ${existingProfessors.length} old professors`);
        console.log(`   - Added: ${added} new professors`);
        console.log(`   - Total: ${added} professors in department`);
        
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

updateDataScienceDepartment();

