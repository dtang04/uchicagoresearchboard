#!/usr/bin/env node

/**
 * Script to update Economics professors' titles and research areas
 */

const db = require('../database');

// Mapping of professor names to their titles and research areas
// Based on UChicago Economics department information
const professorData = {
    // Already have titles - keep them or update with more specific ones
    'Alex Torgovitsky': { title: 'Professor', researchArea: 'Econometrics' },
    'Ali Hortacsu': { title: 'Ralph and Mary Otis Isham Professor in Economics and the College', researchArea: 'Industrial Organization' },
    'Anne Karing': { title: 'Assistant Professor', researchArea: 'Development Economics' },
    'Azeem Shaikh': { title: 'Professor', researchArea: 'Econometrics' },
    'Ben Brooks': { title: 'Professor', researchArea: 'Microeconomic Theory' },
    'Casey Mulligan': { title: 'Professor', researchArea: 'Public Economics' },
    'Christina Brown': { title: 'Assistant Professor', researchArea: 'Labor Economics' },
    'Derek Neal': { title: 'Professor', researchArea: 'Labor Economics' },
    'Esteban Rossi-Hansberg': { title: 'Glen A. Lloyd Distinguished Service Professor', researchArea: 'Macroeconomics' },
    'Evan Rose': { title: 'Assistant Professor', researchArea: 'Labor Economics' },
    'Fernando Alvarez': { title: 'Professor', researchArea: 'Macroeconomics' },
    'Greg Kaplan': { title: 'Professor', researchArea: 'Macroeconomics' },
    'Harald Ulhig': { title: 'Professor', researchArea: 'Macroeconomics' },
    'Harald Uhlig': { title: 'Professor', researchArea: 'Macroeconomics' }, // alternate spelling
    'James Heckman': { title: 'Henry Schultz Distinguished Service Professor', researchArea: 'Labor Economics' },
    'John List': { title: 'Kenneth C. Griffin Distinguished Service Professor', researchArea: 'Applied Microeconomics' },
    'Joseph Root': { title: 'Assistant Professor', researchArea: 'Microeconomic Theory' },
    'Kevin Murphy': { title: 'George J. Stigler Distinguished Service Professor', researchArea: 'Applied Microeconomics' },
    'Lars Hansen': { title: 'David Rockefeller Distinguished Service Professor', researchArea: 'Macroeconomics' },
    'Lars Peter Hansen': { title: 'David Rockefeller Distinguished Service Professor', researchArea: 'Macroeconomics' },
    'Leonardo Bursztyn': { title: 'Professor', researchArea: 'Development Economics' },
    'Magne Mogstad': { title: 'Professor', researchArea: 'Labor Economics' },
    'Manasi Deshpande': { title: 'Assistant Professor', researchArea: 'Labor Economics' },
    'Michael Greenstone': { title: 'Milton Friedman Distinguished Service Professor', researchArea: 'Environmental Economics' },
    'Michael Kremer': { title: 'University Professor', researchArea: 'Development Economics' },
    'Mikhail Golosov': { title: 'Professor', researchArea: 'Macroeconomics' },
    'Nancy Stokey': { title: 'Frederick Henry Prince Distinguished Service Professor', researchArea: 'Microeconomic Theory' },
    'Philip Reny': { title: 'Professor', researchArea: 'Microeconomic Theory' },
    'Robert Shimer': { title: 'George J. Stigler Distinguished Service Professor', researchArea: 'Labor Economics' },
    'Roger Myerson': { title: 'Glen A. Lloyd Distinguished Service Professor', researchArea: 'Microeconomic Theory' },
    'Stephane Bonhomme': { title: 'Professor', researchArea: 'Econometrics' },
    'Steven Levitt': { title: 'William B. Ogden Distinguished Service Professor', researchArea: 'Applied Microeconomics' },
    'Thibaut Lamadon': { title: 'Assistant Professor', researchArea: 'Labor Economics' },
    'Ufuk Akcigit': { title: 'Professor', researchArea: 'Macroeconomics' },
};

async function updateTitlesAndAreas() {
    try {
        await db.initDatabase();
        const dbInstance = db.getDatabase();

        console.log('📝 Updating Economics professors\' titles and research areas...\n');

        // Get all economics professors
        const professors = await new Promise((resolve, reject) => {
            dbInstance.all(`
                SELECT p.id, p.name, p.title, p.research_area
                FROM professors p
                JOIN departments d ON p.department_id = d.id
                WHERE d.name = 'economics'
                ORDER BY p.name
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        let updatedCount = 0;
        let skippedCount = 0;

        for (const prof of professors) {
            const data = professorData[prof.name];
            
            if (!data) {
                console.log(`   ⚠️  No data found for: ${prof.name}`);
                // Default to "Professor" if title is null
                if (!prof.title) {
                    await new Promise((resolve, reject) => {
                        dbInstance.run(
                            'UPDATE professors SET title = ? WHERE id = ?',
                            ['Professor', prof.id],
                            (err) => {
                                if (err) reject(err);
                                else resolve();
                            }
                        );
                    });
                    console.log(`   ✅ Set default title "Professor" for ${prof.name}`);
                    updatedCount++;
                }
                skippedCount++;
                continue;
            }

            const updates = [];
            const values = [];
            let needsUpdate = false;

            // Update title if null or different
            if (!prof.title || prof.title === 'null' || prof.title.toLowerCase() === 'null') {
                updates.push('title = ?');
                values.push(data.title);
                needsUpdate = true;
                console.log(`   📝 ${prof.name}: title NULL → "${data.title}"`);
            } else if (prof.title !== data.title) {
                // Optionally update to more specific title
                updates.push('title = ?');
                values.push(data.title);
                needsUpdate = true;
                console.log(`   📝 ${prof.name}: title "${prof.title}" → "${data.title}"`);
            }

            // Update research area if null or empty
            if (!prof.research_area || prof.research_area === 'null' || prof.research_area.toLowerCase() === 'null') {
                updates.push('research_area = ?');
                values.push(data.researchArea);
                needsUpdate = true;
                console.log(`   📝 ${prof.name}: research_area NULL → "${data.researchArea}"`);
            } else if (prof.research_area !== data.researchArea) {
                // Update to match our categorization
                updates.push('research_area = ?');
                values.push(data.researchArea);
                needsUpdate = true;
                console.log(`   📝 ${prof.name}: research_area "${prof.research_area}" → "${data.researchArea}"`);
            }

            if (needsUpdate) {
                values.push(prof.id);
                const query = `UPDATE professors SET ${updates.join(', ')} WHERE id = ?`;
                
                await new Promise((resolve, reject) => {
                    dbInstance.run(query, values, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                updatedCount++;
            } else {
                console.log(`   ✓ ${prof.name}: Already up to date`);
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Updated: ${updatedCount} professors`);
        console.log(`   ⏭️  Skipped: ${skippedCount} professors`);

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
                WHERE d.name = 'economics'
                GROUP BY p.research_area
                ORDER BY count DESC, p.research_area
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        byArea.forEach(area => {
            console.log(`   ${area.research_area} (${area.count}):`);
            area.names.split(', ').forEach(name => {
                console.log(`      - ${name}`);
            });
            console.log();
        });

        console.log(`\n✅ Update complete!\n`);
    } catch (error) {
        console.error('\n❌ Error updating titles and areas:', error);
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
    updateTitlesAndAreas()
        .then(() => {
            console.log('✅ Done!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { updateTitlesAndAreas };

