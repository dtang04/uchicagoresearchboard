#!/usr/bin/env node

/**
 * Script to fetch actual lab names from lab websites and update the database
 */

const https = require('https');
const http = require('http');
const db = require('../database');

/**
 * Fetch lab name from website
 */
function fetchLabName(url) {
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
                });

                res.on('end', () => {
                    // Try to extract lab name from various patterns
                    let labName = null;

                    // Method 1: Try to find in <title> tag
                    const titleMatch = data.match(/<title[^>]*>([^<]+)<\/title>/i);
                    if (titleMatch) {
                        let title = titleMatch[1].trim();
                        // Clean up common patterns
                        title = title.replace(/\s*[-|]\s*.*$/, ''); // Remove " - University" etc
                        title = title.replace(/\s*\|.*$/, '');
                        if (title && title.length < 100) {
                            labName = title;
                        }
                    }

                    // Method 2: Try to find in <h1> tag
                    if (!labName) {
                        const h1Match = data.match(/<h1[^>]*>([^<]+)<\/h1>/i);
                        if (h1Match) {
                            let h1 = h1Match[1].trim();
                            h1 = h1.replace(/<[^>]+>/g, ''); // Remove HTML tags
                            if (h1 && h1.length < 100 && !h1.includes('Error')) {
                                labName = h1;
                            }
                        }
                    }

                    // Method 3: Try to find common lab name patterns
                    if (!labName) {
                        const patterns = [
                            /(?:Lab|Group|Research Group|Laboratory)[\s]*:?\s*([A-Z][A-Za-z\s&-]+)/,
                            /([A-Z][a-z]+\s+(?:Lab|Group|Laboratory))/,
                            /(?:The\s+)?([A-Z][A-Za-z\s&]+)\s+(?:Lab|Group|Laboratory)/
                        ];
                        
                        for (const pattern of patterns) {
                            const match = data.match(pattern);
                            if (match && match[1]) {
                                labName = match[1].trim();
                                if (labName.length < 100) {
                                    break;
                                }
                            }
                        }
                    }

                    // Clean up the lab name
                    if (labName) {
                        labName = labName
                            .replace(/^\s+|\s+$/g, '')
                            .replace(/\s+/g, ' ')
                            .replace(/^(Home|Lab|Group|Laboratory|Research)\s+/i, '')
                            .replace(/\s+(Home|Lab|Group|Laboratory)$/i, '')
                            .trim();
                        
                        // If it's still too generic, return null
                        if (labName.length < 3 || labName.toLowerCase() === 'home' || labName.toLowerCase() === 'lab') {
                            labName = null;
                        }
                    }

                    resolve(labName);
                });
            });

            req.on('error', () => {
                resolve(null);
            });

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

async function updateLabNames() {
    try {
        await db.initDatabase();
        const dbInstance = db.getDatabase();

        console.log('📊 Fetching lab names from websites...\n');

        // Get all Physics professors with lab websites
        const professors = await db.getProfessorsByDepartment('physics');
        const withLabs = professors.filter(p => p.labWebsite && p.labWebsite.trim());

        console.log(`Found ${withLabs.length} professors with lab websites\n`);

        let updated = 0;
        let failed = 0;
        const labNames = {};

        // Known lab names mapping (for websites that might be hard to parse)
        const knownLabNames = {
            'https://pme.uchicago.edu/group/awschalom-group': 'Awschalom Group',
            'https://ultracold.uchicago.edu/': 'Ultracold Atom Lab',
            'https://vieregglab.uchicago.edu/': 'Vieregg Lab',
            'https://holzlab.uchicago.edu/': 'Holz Lab',
            'https://grandilab.uchicago.edu/': 'Grandi Lab',
            'https://rustlab.uchicago.edu/': 'Rust Lab',
            'https://irvinelab.uchicago.edu/': 'Irvine Lab',
            'https://squishycell.uchicago.edu/': 'Gardel Lab',
            'https://jerisonlab.uchicago.edu/': 'Jerison Lab',
            'https://muruganlab.uchicago.edu/': 'Murugan Lab',
            'https://www.jaegerlab.com': 'Jaeger Lab',
            'https://psec.uchicago.edu/': 'PSEC Lab',
            'https://neutrino.uchicago.edu/group/': 'Schmitz Neutrino Lab',
            'https://demillegroup.psd.uchicago.edu/': 'DeMille Group',
            'https://sites.google.com/view/yan-lab': 'Yan Lab',
            'https://sites.google.com/uchicago.edu/themcmahoncosmologylab/home': 'McMahon Cosmology Lab'
        };

        for (const prof of withLabs) {
            try {
                // Check if we have a known lab name first
                let labName = knownLabNames[prof.labWebsite] || null;

                // If not, try to fetch from website
                if (!labName) {
                    console.log(`   Fetching: ${prof.name} (${prof.labWebsite})`);
                    labName = await fetchLabName(prof.labWebsite);
                    
                    if (labName) {
                        console.log(`   ✅ Found: "${labName}"`);
                    } else {
                        console.log(`   ⚠️  Could not extract lab name`);
                    }
                } else {
                    console.log(`   Using known: ${prof.name} → "${labName}"`);
                }

                if (labName) {
                    labNames[prof.name] = labName;
                    
                    // Update database
                    await new Promise((resolve, reject) => {
                        dbInstance.run(
                            'UPDATE professors SET lab = ? WHERE name = ? AND department_id = (SELECT id FROM departments WHERE name = ?)',
                            [labName, prof.name, 'physics'],
                            function(err) {
                                if (err) reject(err);
                                else {
                                    updated++;
                                    resolve();
                                }
                            }
                        );
                    });
                } else {
                    failed++;
                }

                // Add small delay to avoid overwhelming servers
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`   ❌ Error processing ${prof.name}: ${error.message}`);
                failed++;
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Updated: ${updated} lab names`);
        console.log(`   ❌ Failed: ${failed} lab names`);

        // Show updated lab names
        if (Object.keys(labNames).length > 0) {
            console.log(`\n📝 Updated Lab Names:\n`);
            Object.entries(labNames).forEach(([name, lab]) => {
                console.log(`   ${name}: ${lab}`);
            });
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
updateLabNames();

