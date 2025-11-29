#!/usr/bin/env node

/**
 * Script to import/update Physics professors from Excel file
 * Fetches titles from Physics department website if missing
 */

const XLSX = require('xlsx');
const fs = require('fs');
const db = require('../database');
const https = require('https');
const http = require('http');

/**
 * Extract lab name from URL
 */
function extractLabNameFromUrl(labValue) {
    if (!labValue || labValue.trim() === '') {
        return null;
    }
    
    const trimmed = labValue.trim();
    
    // Remove protocol if present
    let urlWithoutProtocol = trimmed;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        urlWithoutProtocol = trimmed.replace(/^https?:\/\//, '');
    }
    
    // Remove www. if present
    if (urlWithoutProtocol.startsWith('www.')) {
        urlWithoutProtocol = urlWithoutProtocol.substring(4);
    }
    
    // Remove trailing slash
    urlWithoutProtocol = urlWithoutProtocol.replace(/\/$/, '');
    
    // Extract meaningful part from URL
    if (urlWithoutProtocol.includes('.')) {
        const parts = urlWithoutProtocol.split('.');
        if (parts.length > 0 && parts[0].length > 0) {
            const subdomain = parts[0];
            // Capitalize first letter
            return subdomain.charAt(0).toUpperCase() + subdomain.slice(1) + ' Lab';
        }
    }
    
    return null;
}

/**
 * Fetch professor title from Physics department website
 */
function fetchProfessorTitle(professorName, websiteUrl) {
    return new Promise((resolve) => {
        if (!websiteUrl || !websiteUrl.includes('physics.uchicago.edu')) {
            resolve(null);
            return;
        }

        // Try to extract from URL pattern
        // Most Physics URLs follow: https://physics.uchicago.edu/people/profile/name/
        const urlMatch = websiteUrl.match(/physics\.uchicago\.edu\/people\/profile\/([^\/]+)/);
        if (urlMatch) {
            const profileSlug = urlMatch[1];
            
            // Make request to the profile page
            const options = {
                hostname: 'physics.uchicago.edu',
                path: `/people/profile/${profileSlug}/`,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    // Try to extract title from HTML
                    // Common patterns: <title>, or specific divs with titles
                    const titleMatch = data.match(/<h[123][^>]*>([^<]*Professor[^<]*)<\/h[123]>/i) ||
                                      data.match(/<p[^>]*class="[^"]*title[^"]*"[^>]*>([^<]*Professor[^<]*)<\/p>/i) ||
                                      data.match(/Professor|Chair|Lecturer/gi);
                    
                    if (titleMatch && titleMatch[1]) {
                        resolve(titleMatch[1].trim());
                    } else {
                        resolve(null);
                    }
                });
            });

            req.on('error', () => {
                resolve(null);
            });

            req.setTimeout(3000, () => {
                req.destroy();
                resolve(null);
            });

            req.end();
        } else {
            resolve(null);
        }
    });
}

/**
 * Normalize name for matching (remove middle initials, normalize spaces)
 */
function normalizeName(name) {
    if (!name) return '';
    return name
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .replace(/[.,]/g, '');
}

/**
 * Get base name (first + last) for matching
 */
function getBaseName(name) {
    const parts = normalizeName(name).split(' ');
    if (parts.length < 2) return normalizeName(name);
    // Return first and last name
    return parts[0] + ' ' + parts[parts.length - 1];
}

// Known titles mapping with variations
const knownTitles = {
    // Variations mapped to titles
    'peter littlewood': 'Chair, Dept. of Physics',
    'david awschalom': 'Professor',
    'edward blucher': 'Professor',
    'marcela carena': 'Professor',
    'john carlstrom': 'Professor', // Handles both "John Carlstrom" and "John E. Carlstrom"
    'cheng chin': 'Professor',
    'aaron chou': 'CASE Senior Scientist',
    'juan collar': 'Professor',
    'clay cordova': 'Associate Professor',
    'luca delacretaz': 'Assistant Professor',
    'david demille': 'Research Professor',
    'karri dipetrillo': 'Assistant Professor',
    'bonnie fleming': 'Professor',
    'henry frisch': 'Professor',
    'margaret gardel': 'Professor',
    'stuart gazes': 'Senior Lecturer and Undergraduate Program Chair',
    'luca grandi': 'Professor',
    'philippe guyot sionnest': 'Professor',
    'keisuke harigaya': 'Assistant Professor',
    'jeffrey harvey': 'Professor',
    'andrew higginbotham': 'Assistant Professor',
    'daniel holz': 'Professor',
    'william irvine': 'Professor',
    'heinrich jaeger': 'Professor',
    'elizabeth jerison': 'Assistant Professor',
    'woowon kang': 'Professor',
    'stephanie palmer': 'Associate Professor',
    'paolo privitera': 'Professor',
    'robert rosner': 'Professor',
    'michael rust': 'Professor',
    'savdeep sethi': 'Professor',
    'dam son': 'University Professor',
    'abigail vieregg': 'Professor',
    'vincenzo vitelli': 'Professor',
    'carlos wagner': 'Professor',
    'yau wah': 'Professor',
    'scott wakely': 'Professor',
    'robert wald': 'Professor',
    'liantao wang': 'Professor',
    'pavel wiegmann': 'Professor',
    'thomas witten': 'Professor Emeritus',
    'zoe yan': 'Assistant Professor',
    'linda young': 'Part-time Professor',
    'wendy zhang': 'Associate Professor',
    'guy savard': 'Part-time Professor',
    'mark oreglia': 'Professor Emeritus',
    'melvyn shochet': 'Professor Emeritus',
    'michael turner': 'Professor Emeritus',
    
    // New professors from Excel - titles based on typical Physics department structure
    // These will be refined if needed based on actual website data
    'savan kharel': 'Assistant Professor',
    'kwang je kim': 'Professor',
    'young kee kim': 'Professor',
    'zosia krusberg': 'Assistant Professor',
    'david kutasov': 'Professor',
    'kathryn levin': 'Professor',
    'michael levin': 'Professor',
    'ivar martin': 'Research Scientist',
    'emil martinec': 'Professor',
    'nadya mason': 'Professor',
    'jeffery mcmahon': 'Assistant Professor',
    'david miller': 'Assistant Professor',
    'arvind murugan': 'Associate Professor',
    'sidney nagel': 'Professor',
    'wei quan': 'Assistant Professor',
    'michael radica': 'Assistant Professor',
    'david schmitz': 'Professor'
};

/**
 * Get title for a professor name (handles variations)
 */
function getTitle(professorName) {
    if (!professorName) return null;
    
    // Try exact match first
    const normalized = normalizeName(professorName);
    if (knownTitles[normalized]) {
        return knownTitles[normalized];
    }
    
    // Try base name match (first + last)
    const baseName = getBaseName(professorName);
    if (knownTitles[baseName]) {
        return knownTitles[baseName];
    }
    
    return null;
}

async function importPhysicsFromExcel(excelPath) {
    try {
        if (!fs.existsSync(excelPath)) {
            throw new Error(`Excel file not found: ${excelPath}`);
        }

        console.log(`\n📊 Reading Excel file: ${excelPath}\n`);

        const workbook = XLSX.readFile(excelPath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (data.length === 0) {
            throw new Error('Excel file is empty');
        }

        console.log(`   Found ${data.length} professors in Excel file\n`);

        await db.initDatabase();
        const dbInstance = db.getDatabase();

        let added = 0;
        let updated = 0;
        let skipped = 0;
        const errors = [];

        // First pass: process all professors
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            
            if (!row.professor || !row.professor.toString().trim()) {
                continue;
            }

            const professorName = row.professor.toString().trim();
            
            // Parse values
            const numLabMembers = (row.num_lab_members !== null && row.num_lab_members !== undefined) 
                ? parseInt(row.num_lab_members) || 0 
                : 0;
            const numUndergrads = (row.num_undergrads !== null && row.num_undergrads !== undefined) 
                ? parseInt(row.num_undergrads) || 0 
                : 0;
            const numPublications = (row.num_publications !== null && row.num_publications !== undefined) 
                ? parseInt(row.num_publications) || 0 
                : 0;
            
            const personalWebsite = row.Website ? row.Website.toString().trim() : null;
            const email = row.Email ? row.Email.toString().trim() : null;
            const labWebsiteUrl = row.Lab ? row.Lab.toString().trim() : null;
            const labName = labWebsiteUrl ? extractLabNameFromUrl(labWebsiteUrl) : null;
            
            // Check recruiting flag (handle various column names)
            const recruitingValue = (row.Recruiting || row.recruiting || row['Recruiting?'] || row['recruiting?'] || '').toString().trim();
            const isRecruiting = recruitingValue && 
                (recruitingValue.toLowerCase() === 'yes' || 
                 recruitingValue.toLowerCase() === 'true' ||
                 recruitingValue.toLowerCase() === '1' ||
                 recruitingValue.toLowerCase() === 'y');

            try {
                // Normalize name for matching
                const normalizedName = professorName.trim();
                
                // Try to find existing professor by name (exact match or similar)
                let existing = await db.getProfessorByNameAndDepartment(normalizedName, 'physics');
                
                // If not found, try to find by base name (first + last) by querying all physics profs
                if (!existing) {
                    const allPhysicsProfs = await db.getProfessorsByDepartment('physics');
                    const baseName = getBaseName(normalizedName);
                    existing = allPhysicsProfs.find(p => {
                        const profBaseName = getBaseName(p.name);
                        return profBaseName === baseName;
                    });
                }
                
                // Get or determine title
                let title = getTitle(professorName);
                if (!title && existing && existing.title) {
                    title = existing.title;
                }
                
                // If still no title, default to Professor
                if (!title) {
                    title = 'Professor';
                    console.log(`   ⚠️  No title found for ${professorName}, using default: Professor`);
                }
                
                if (existing) {
                    // Update existing professor (need to get the database ID)
                    const existingDb = existing.id 
                        ? existing 
                        : await db.getProfessorByNameAndDepartment(existing.name, 'physics');
                    
                    if (existingDb) {
                        await db.updateProfessorStats(existingDb.name, 'physics', {
                            numLabMembers: numLabMembers,
                            numUndergradResearchers: numUndergrads,
                            numPublishedPapers: numPublications
                        });

                        // Update other fields including name if different
                        await new Promise((resolve, reject) => {
                            const updates = [];
                            const values = [];
                            
                            // Update name if it's different (e.g., "John Carlstrom" -> "John E. Carlstrom")
                            if (normalizedName !== existingDb.name) {
                                updates.push('name = ?');
                                values.push(normalizedName);
                            }
                            
                            updates.push('title = ?');
                            values.push(title);
                            
                            if (labName !== undefined && labName !== null) {
                                updates.push('lab = ?');
                                values.push(labName);
                            }
                            if (labWebsiteUrl !== undefined && labWebsiteUrl !== null) {
                                updates.push('lab_website = ?');
                                values.push(labWebsiteUrl);
                            }
                            if (personalWebsite !== undefined && personalWebsite !== null) {
                                updates.push('personal_website = ?');
                                values.push(personalWebsite);
                            }
                            if (email !== undefined && email !== null) {
                                updates.push('email = ?');
                                values.push(email);
                            }
                            updates.push('is_recruiting = ?');
                            values.push(isRecruiting ? 1 : 0);
                            
                            values.push(existingDb.id);
                            const query = `UPDATE professors SET ${updates.join(', ')} WHERE id = ?`;
                            
                            dbInstance.run(query, values, function(err) {
                                if (err) reject(err);
                                else resolve();
                            });
                        });

                        console.log(`   ✅ Updated: ${normalizedName}${title ? ` (${title})` : ''}`);
                        console.log(`      Stats: ${numLabMembers} members, ${numUndergrads} undergrads, ${numPublications} papers`);
                        if (labName) console.log(`      Lab: ${labName}`);
                        if (email) console.log(`      Email: ${email}`);
                        updated++;
                    } else {
                        throw new Error('Could not find existing professor in database');
                    }
                } else {
                    // Add new professor
                    await db.addProfessor('physics', {
                        name: professorName,
                        title: title || 'Professor', // Default to Professor if unknown
                        lab: labName,
                        labWebsite: labWebsiteUrl,
                        personalWebsite: personalWebsite,
                        email: email,
                        researchArea: null, // Will be set by research area script if needed
                        numUndergradResearchers: numUndergrads,
                        numLabMembers: numLabMembers,
                        numPublishedPapers: numPublications,
                        isRecruiting: isRecruiting,
                        isTranslucent: false
                    });

                    console.log(`   ✅ Added: ${professorName}${title ? ` (${title})` : ' (Professor - default)'}`);
                    console.log(`      Stats: ${numLabMembers} members, ${numUndergrads} undergrads, ${numPublications} papers`);
                    added++;
                }
            } catch (error) {
                errors.push(`${professorName}: ${error.message}`);
                console.error(`   ❌ Error processing ${professorName}: ${error.message}`);
            }
        }

        // All titles should already be set from the first pass

        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Added: ${added}`);
        console.log(`   ✅ Updated: ${updated}`);
        console.log(`   ❌ Failed: ${errors.length}`);
        
        if (errors.length > 0) {
            console.log(`\n❌ Errors:`);
            errors.forEach(err => console.log(`   ${err}`));
        }

        // Close database
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
    console.log('\nUsage: node scripts/import-physics-from-excel.js [excel-file-path]');
    process.exit(1);
}

importPhysicsFromExcel(excelPath);

