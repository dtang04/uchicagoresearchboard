#!/usr/bin/env node

/**
 * Script to import Physics faculty from the UChicago Physics website
 * Creates 0 0 0 cards for all faculty members
 */

const db = require('../database');

// Faculty data extracted from https://physics.uchicago.edu/people/#faculty
// Filtered to only include actual faculty (not grad students, staff, etc.)
const physicsFaculty = [
    { name: "Peter Littlewood", title: "Chair, Dept. of Physics" },
    { name: "David Awschalom", title: "Professor" },
    { name: "Edward Blucher", title: "Professor" },
    { name: "Marcela Carena", title: "Professor" },
    { name: "John E. Carlstrom", title: "Professor" },
    { name: "Cheng Chin", title: "Professor" },
    { name: "Juan I. Collar", title: "Professor" },
    { name: "Clay Córdova", title: "Associate Professor" },
    { name: "Luca Delacrétaz", title: "Assistant Professor" },
    { name: "David DeMille", title: "Research Professor" },
    { name: "Karri DiPetrillo", title: "Assistant Professor" },
    { name: "Bonnie Fleming", title: "Professor" },
    { name: "Henry J. Frisch", title: "Professor" },
    { name: "Margaret Gardel", title: "Professor" },
    { name: "Luca Grandi", title: "Professor" },
    { name: "Philippe Guyot-Sionnest", title: "Professor" },
    { name: "Keisuke Harigaya", title: "Assistant Professor" },
    { name: "Jeffrey Harvey", title: "Professor" },
    { name: "Andrew Higginbotham", title: "Assistant Professor" },
    { name: "Daniel Holz", title: "Professor" },
    { name: "William T.M. Irvine", title: "Professor" },
    { name: "Heinrich M. Jaeger", title: "Professor" },
    { name: "Elizabeth Jerison", title: "Assistant Professor" },
    { name: "Woowon Kang", title: "Professor" },
    { name: "Stephanie Palmer", title: "Associate Professor" },
    { name: "Paolo Privitera", title: "Professor" },
    { name: "Robert Rosner", title: "Professor" },
    { name: "Michael Rust", title: "Professor" },
    { name: "Savdeep S. Sethi", title: "Professor" },
    { name: "Dam T. Son", title: "University Professor" },
    { name: "Abigail Vieregg", title: "Professor" },
    { name: "Vincenzo Vitelli", title: "Professor" },
    { name: "Carlos E. M. Wagner", title: "Professor" },
    { name: "Yau W. Wah", title: "Professor" },
    { name: "Scott Wakely", title: "Professor" },
    { name: "Robert Wald", title: "Professor" },
    { name: "LianTao Wang", title: "Professor" },
    { name: "Pavel Wiegmann", title: "Professor" },
    { name: "Thomas Witten", title: "Professor Emeritus" },
    { name: "Zoe Yan", title: "Assistant Professor" },
    { name: "Wendy W. Zhang", title: "Associate Professor" },
    { name: "Guy Savard", title: "Part-time Professor" },
    { name: "Linda Young", title: "Part-time Professor" },
    { name: "Mark Oreglia", title: "Professor Emeritus" },
    { name: "Melvyn J. Shochet", title: "Professor Emeritus" },
    { name: "Michael S. Turner", title: "Professor Emeritus" },
    { name: "David D. Reid", title: "Lecturer (part-time)" },
    { name: "Stuart Gazes", title: "Senior Lecturer and Undergraduate Program Chair" },
    { name: "Mohamed Abdelhafez", title: "Associate Instructional Professor" },
    { name: "Mark Chantell", title: "Director of Instructional Laboratories" },
    { name: "Aaron S. Chou", title: "CASE Senior Scientist" },
    { name: "Cosmin Deaconu", title: "Research Scientist" },
    { name: "Eric Oberla", title: "Research Scientist" },
    { name: "Baudouin Saintyves", title: "Research Scientist" },
    { name: "Simone Pagan Griso", title: "Winstein Distinguished Visiting Fellow" }
];

async function importPhysicsFaculty() {
    try {
        console.log(`\n📊 Importing Physics Faculty...\n`);

        // Initialize database
        await db.initDatabase();
        
        let added = 0;
        let updated = 0;
        const errors = [];

        // Process each faculty member
        for (const faculty of physicsFaculty) {
            try {
                // Check if professor already exists
                const existing = await db.getProfessorByNameAndDepartment(faculty.name, 'physics');
                
                if (existing) {
                    // Update existing professor (keep their data, just ensure title is set)
                    await new Promise((resolve, reject) => {
                        const dbInstance = db.getDatabase();
                        dbInstance.run(
                            'UPDATE professors SET title = ? WHERE id = ?',
                            [faculty.title, existing.id],
                            function(err) {
                                if (err) reject(err);
                                else resolve();
                            }
                        );
                    });
                    console.log(`   ✅ Updated: ${faculty.name} (${faculty.title})`);
                    updated++;
                } else {
                    // Add new professor with 0 0 0 stats
                    await db.addProfessor('physics', {
                        name: faculty.name,
                        title: faculty.title,
                        lab: null,
                        labWebsite: null,
                        personalWebsite: null,
                        email: null,
                        researchArea: null,
                        numUndergradResearchers: 0,
                        numLabMembers: 0,
                        numPublishedPapers: 0,
                        isRecruiting: false,
                        isTranslucent: false
                    });
                    console.log(`   ✅ Added: ${faculty.name} (${faculty.title}) - 0 0 0`);
                    added++;
                }
            } catch (error) {
                errors.push(`${faculty.name}: ${error.message}`);
                console.error(`   ❌ Error processing ${faculty.name}: ${error.message}`);
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Added: ${added}`);
        console.log(`   ✅ Updated: ${updated}`);
        console.log(`   ❌ Failed: ${errors.length}`);
        
        if (errors.length > 0) {
            console.log(`\n❌ Errors:`);
            errors.forEach(err => console.log(`   ${err}`));
        }

        // Close database connection
        const dbInstance = db.getDatabase();
        dbInstance.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            }
            process.exit(0);
        });
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        const dbInstance = db.getDatabase();
        dbInstance.close(() => {
            process.exit(1);
        });
    }
}

// Run the import
importPhysicsFaculty();

