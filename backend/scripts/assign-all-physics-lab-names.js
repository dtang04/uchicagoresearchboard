#!/usr/bin/env node

/**
 * Script to assign lab names to all Physics professors
 * Extracts from websites or creates default names
 */

const https = require('https');
const http = require('http');
const db = require('../database');

/**
 * Fetch lab name from website
 */
function fetchLabNameFromWebsite(url) {
    return new Promise((resolve) => {
        if (!url || !url.trim()) {
            resolve(null);
            return;
        }

        try {
            const urlObj = new URL(url.trim());
            const isHttps = urlObj.protocol === 'https:';
            const client = isHttps ? https : http;

            const options = {
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                },
                timeout: 5000
            };

            const req = client.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk.toString();
                    // Limit data size to avoid memory issues
                    if (data.length > 50000) {
                        req.destroy();
                        resolve(null);
                    }
                });

                res.on('end', () => {
                    // Try to extract lab/group name
                    let labName = null;

                    // Try <title> tag
                    const titleMatch = data.match(/<title[^>]*>([^<]+)<\/title>/i);
                    if (titleMatch) {
                        let title = titleMatch[1].trim();
                        title = title.replace(/\s*[-|]\s*.*$/, '');
                        title = title.replace(/\s*\|.*$/, '');
                        if (title && title.length < 80 && !title.includes('Error') && !title.includes('301')) {
                            labName = title;
                        }
                    }

                    // Try <h1> tag
                    if (!labName) {
                        const h1Match = data.match(/<h1[^>]*>([^<]+)<\/h1>/i);
                        if (h1Match) {
                            let h1 = h1Match[1].trim().replace(/<[^>]+>/g, '');
                            if (h1 && h1.length < 80 && !h1.includes('Error')) {
                                labName = h1;
                            }
                        }
                    }

                    resolve(labName);
                });
            });

            req.on('error', () => resolve(null));
            req.on('timeout', () => {
                req.destroy();
                resolve(null);
            });

            req.end();
        } catch (error) {
            resolve(null);
        }
    });
}

/**
 * Generate default lab name from professor name
 */
function generateDefaultLabName(professorName, title) {
    // Remove middle initials and common prefixes
    const name = professorName.trim();
    const parts = name.split(' ');
    
    // Get last name
    const lastName = parts[parts.length - 1];
    
    // Skip titles that typically don't have labs
    if (title && (title.includes('Emeritus') || title.includes('Chair, Dept'))) {
        return `${lastName} Research Group`;
    }
    
    return `${lastName} Lab`;
}

async function assignAllLabNames() {
    try {
        await db.initDatabase();
        const dbInstance = db.getDatabase();

        console.log('📊 Assigning lab names to all Physics professors...\n');

        const professors = await db.getProfessorsByDepartment('physics');
        const withoutLabs = professors.filter(p => !p.lab || !p.lab.trim());

        console.log(`Found ${withoutLabs.length} professors without lab names\n`);

        let fromWebsite = 0;
        let fromDefault = 0;
        let skipped = 0;

        for (const prof of withoutLabs) {
            let labName = null;

            // Try to get from personal website
            if (prof.personalWebsite && prof.personalWebsite.trim()) {
                console.log(`   Checking ${prof.name}...`);
                labName = await fetchLabNameFromWebsite(prof.personalWebsite);
                
                if (labName) {
                    // Clean up the lab name
                    labName = labName
                        .replace(/^\s+|\s+$/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    
                    // Filter out bad results
                    if (labName.length < 3 || 
                        labName.includes('Error') || 
                        labName.includes('301') ||
                        labName.includes('Moved') ||
                        labName.toLowerCase() === 'home') {
                        labName = null;
                    } else {
                        console.log(`   ✅ Found from website: "${labName}"`);
                        fromWebsite++;
                    }
                }
            }

            // If no lab name from website, generate default
            if (!labName) {
                labName = generateDefaultLabName(prof.name, prof.title);
                console.log(`   📝 Generated default: "${labName}"`);
                fromDefault++;
            }

            // Update database
            try {
                await new Promise((resolve, reject) => {
                    dbInstance.run(
                        'UPDATE professors SET lab = ? WHERE name = ? AND department_id = (SELECT id FROM departments WHERE name = ?)',
                        [labName, prof.name, 'physics'],
                        function(err) {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            } catch (error) {
                console.error(`   ❌ Error updating ${prof.name}: ${error.message}`);
                skipped++;
            }

            // Small delay to avoid overwhelming servers
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        console.log(`\n📊 Summary:`);
        console.log(`   ✅ From website: ${fromWebsite}`);
        console.log(`   📝 Generated default: ${fromDefault}`);
        console.log(`   ❌ Failed: ${skipped}`);

        // Verify all have lab names now
        const allProfs = await db.getProfessorsByDepartment('physics');
        const stillMissing = allProfs.filter(p => !p.lab || !p.lab.trim());
        
        if (stillMissing.length === 0) {
            console.log(`\n✅ All 65 professors now have lab names!\n`);
        } else {
            console.log(`\n⚠️  ${stillMissing.length} professors still missing lab names:`);
            stillMissing.forEach(p => console.log(`   - ${p.name}`));
        }

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

// Run
assignAllLabNames();

