#!/usr/bin/env node

/**
 * Script to assign research areas to Physics professors
 * Based on UChicago Physics department research areas
 */

const db = require('../database');

// Mapping of Physics professors to their research areas
// Based on UChicago Physics department information from https://physics.uchicago.edu
// Research areas: Particle Physics, Condensed Matter Physics, Astrophysics, Cosmology,
// Atomic Physics, Biophysics, Nuclear Physics, General Relativity, Soft Matter Physics, Quantum Physics
const professorResearchAreas = {
    // Particle Physics
    'Marcela Carena': 'Particle Physics',
    'Clay Córdova': 'Particle Physics',
    'Luca Delacrétaz': 'Particle Physics',
    'Karri DiPetrillo': 'Particle Physics',
    'Bonnie Fleming': 'Particle Physics',
    'Henry J. Frisch': 'Particle Physics',
    'Jeffrey Harvey': 'Particle Physics',
    'Keisuke Harigaya': 'Particle Physics',
    'Paolo Privitera': 'Particle Physics',
    'Savdeep S. Sethi': 'Particle Physics',
    'Carlos E. M. Wagner': 'Particle Physics',
    'Scott Wakely': 'Particle Physics',
    'LianTao Wang': 'Particle Physics',
    'Edward Blucher': 'Particle Physics',
    'Juan I. Collar': 'Particle Physics',
    'Luca Grandi': 'Particle Physics',
    'Cosmin Deaconu': 'Particle Physics',
    'Eric Oberla': 'Particle Physics',
    'Mark Oreglia': 'Particle Physics',
    'Melvyn J. Shochet': 'Particle Physics',
    'Simone Pagan Griso': 'Particle Physics',
    
    // Quantum Physics / Quantum Information
    'David Awschalom': 'Quantum Physics',
    'Andrew Higginbotham': 'Quantum Physics',
    
    // Condensed Matter Physics
    'Cheng Chin': 'Condensed Matter Physics',
    'Philippe Guyot-Sionnest': 'Condensed Matter Physics',
    'William T.M. Irvine': 'Condensed Matter Physics',
    'Heinrich M. Jaeger': 'Condensed Matter Physics',
    'Elizabeth Jerison': 'Condensed Matter Physics',
    'Woowon Kang': 'Condensed Matter Physics',
    'Peter Littlewood': 'Condensed Matter Physics',
    'Pavel Wiegmann': 'Condensed Matter Physics',
    'Zoe Yan': 'Condensed Matter Physics',
    'Wendy W. Zhang': 'Condensed Matter Physics',
    
    // Atomic Physics
    'David DeMille': 'Atomic Physics',
    'Linda Young': 'Atomic Physics',
    
    // Astrophysics
    'John E. Carlstrom': 'Astrophysics',
    'Daniel Holz': 'Astrophysics',
    'Abigail Vieregg': 'Astrophysics',
    
    // Cosmology
    'Michael S. Turner': 'Cosmology',
    
    // General Relativity
    'Robert Wald': 'General Relativity',
    
    // Nuclear Physics
    'Aaron S. Chou': 'Nuclear Physics',
    'Robert Rosner': 'Nuclear Physics',
    'Yau W. Wah': 'Nuclear Physics',
    'Guy Savard': 'Nuclear Physics',
    
    // Biophysics
    'Margaret Gardel': 'Biophysics',
    'Stephanie Palmer': 'Biophysics',
    
    // Soft Matter Physics
    'Vincenzo Vitelli': 'Soft Matter Physics',
    'Thomas Witten': 'Soft Matter Physics',
    'Baudouin Saintyves': 'Soft Matter Physics',
    
    // Theoretical Physics
    'Dam T. Son': 'Theoretical Physics',
    
    // Physics Education / Instructional
    'Mohamed Abdelhafez': 'Physics Education',
    'Mark Chantell': 'Physics Education',
    'Stuart Gazes': 'Physics Education',
    'David D. Reid': 'Physics Education',
    
    // Other - will default to "Other" if not found
    'Michael Rust': 'Condensed Matter Physics'
};

async function updatePhysicsResearchAreas() {
    try {
        await db.initDatabase();
        const dbInstance = db.getDatabase();

        console.log('📝 Updating Physics professors\' research areas...\n');

        // Get all Physics professors
        const professors = await new Promise((resolve, reject) => {
            dbInstance.all(`
                SELECT p.id, p.name, p.title, p.research_area
                FROM professors p
                JOIN departments d ON p.department_id = d.id
                WHERE d.name = 'physics'
                ORDER BY p.name
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        let updatedCount = 0;
        let skippedCount = 0;

        for (const prof of professors) {
            let researchArea = professorResearchAreas[prof.name];
            
            // If no mapping found, assign to "Other"
            if (!researchArea) {
                researchArea = 'Other';
                console.log(`   ⚠️  No research area mapping for: ${prof.name} → assigning to "Other"`);
            }

            // Update research area
            if (!prof.research_area || prof.research_area === 'null' || prof.research_area.toLowerCase() === 'null') {
                await new Promise((resolve, reject) => {
                    dbInstance.run(
                        'UPDATE professors SET research_area = ? WHERE id = ?',
                        [researchArea, prof.id],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
                console.log(`   ✅ ${prof.name}: research_area NULL → "${researchArea}"`);
                updatedCount++;
            } else if (prof.research_area !== researchArea) {
                await new Promise((resolve, reject) => {
                    dbInstance.run(
                        'UPDATE professors SET research_area = ? WHERE id = ?',
                        [researchArea, prof.id],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
                console.log(`   ✅ ${prof.name}: research_area "${prof.research_area}" → "${researchArea}"`);
                updatedCount++;
            } else {
                console.log(`   ✓ ${prof.name}: Already has research area "${researchArea}"`);
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Updated: ${updatedCount} professors`);
        console.log(`   ⏭️  Skipped: ${skippedCount} professors (already had correct research area)`);

        // Show summary by research area
        console.log(`\n📚 Professors by Research Area:\n`);
        const byArea = await new Promise((resolve, reject) => {
            dbInstance.all(`
                SELECT 
                    COALESCE(p.research_area, 'Uncategorized') as research_area,
                    COUNT(*) as count,
                    GROUP_CONCAT(p.name, ', ') as names
                FROM professors p
                JOIN departments d ON p.department_id = d.id
                WHERE d.name = 'physics'
                GROUP BY p.research_area
                ORDER BY count DESC, p.research_area
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        byArea.forEach(area => {
            console.log(`   ${area.research_area} (${area.count}):`);
            const names = area.names.split(', ');
            names.forEach(name => {
                console.log(`      - ${name}`);
            });
            console.log();
        });

        console.log(`\n✅ Update complete!\n`);
    } catch (error) {
        console.error('\n❌ Error updating research areas:', error);
        throw error;
    } finally {
        if (db.getDatabase()) {
            db.getDatabase().close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                }
            });
        }
    }
}

// Run if called directly
if (require.main === module) {
    updatePhysicsResearchAreas()
        .then(() => {
            console.log('✅ Done!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { updatePhysicsResearchAreas };

