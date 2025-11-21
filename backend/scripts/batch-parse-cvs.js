#!/usr/bin/env node

/**
 * Batch CV Parser
 * Scans a directory for CV PDFs and processes them automatically
 * 
 * Usage: node scripts/batch-parse-cvs.js [cv-directory] [department]
 * 
 * Example:
 *   node scripts/batch-parse-cvs.js /Users/dylantang/Desktop/cvs statistics
 * 
 * The script will:
 * 1. Find all PDF files in the directory
 * 2. Try to match them to professors by filename
 * 3. Parse each CV and update the database
 */

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const readline = require('readline');
const db = require('../database');

const CV_DIR = process.argv[2] || '/Users/dylantang/Desktop/cvs';
const DEPARTMENT = process.argv[3] || null;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Import parsing functions from parse-cv-pdf.js
const SECTION_PATTERNS = {
    undergraduate: [
        /undergraduate\s+students?/i,
        /undergraduate\s+researchers?/i,
        /undergraduate\s+assistants?/i,
        /undergraduate\s+research\s+assistants?/i
    ],
    graduate: [
        /graduate\s+students?/i,
        /doctoral\s+students?/i,
        /ph\.?d\.?\s+students?/i,
        /phd\s+students?/i
    ],
    postdoc: [
        /postdoctoral\s+researchers?/i,
        /postdoctoral\s+scholars?/i,
        /postdoc/i,
        /post-doc/i,
        /post\s+doctoral/i
    ],
    publications: [
        /publications?/i,
        /peer-reviewed\s+publications?/i,
        /refereed\s+publications?/i,
        /journal\s+publications?/i,
        /papers?/i
    ]
};

function findSection(text, patterns) {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match.index;
    }
    return -1;
}

function countEntries(text, startIndex) {
    if (startIndex === -1) return 0;
    
    let sectionText = text.substring(startIndex);
    const nextSection = sectionText.match(/\n\s*[A-Z][A-Z\s]{3,}\n/);
    if (nextSection) {
        sectionText = sectionText.substring(0, nextSection.index);
    } else {
        sectionText = sectionText.substring(0, Math.min(2000, sectionText.length));
    }
    
    const lines = sectionText.split('\n').filter(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.length < 5) return false;
        const hasYear = /\b(19|20)\d{2}(-|–|—)?(\d{2,4})?/i.test(trimmed);
        const hasName = /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+/.test(trimmed);
        const hasBullet = /^[•\-\*]\s/.test(trimmed);
        return (hasYear || hasName) && (hasYear || hasBullet || hasName);
    });
    
    return lines.length;
}

function countPublications(text) {
    const pubIndex = findSection(text, SECTION_PATTERNS.publications);
    if (pubIndex === -1) return null;
    
    let pubText = text.substring(pubIndex);
    const nextSection = pubText.match(/\n\s*[A-Z][A-Z\s]{3,}\n/);
    if (nextSection) {
        pubText = pubText.substring(0, nextSection.index);
    }
    
    const pubLines = pubText.split('\n').filter(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.length < 10) return false;
        const hasYear = /\(?(19|20)\d{2}\)?/.test(trimmed);
        const hasJournal = /\b(journal|proceedings|conference|arxiv|preprint)/i.test(trimmed);
        const hasAuthors = /[A-Z][a-z]+(\s+[A-Z][a-z]+)+/.test(trimmed);
        return hasYear && (hasJournal || hasAuthors);
    });
    
    return pubLines.length;
}

async function parseCV(pdfPath) {
    try {
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdf(dataBuffer);
        const text = data.text;
        
        const undergradIndex = findSection(text, SECTION_PATTERNS.undergraduate);
        const graduateIndex = findSection(text, SECTION_PATTERNS.graduate);
        const postdocIndex = findSection(text, SECTION_PATTERNS.postdoc);
        
        let numUndergradResearchers = 0;
        let numLabMembers = 0;
        let numPublishedPapers = 0;
        
        if (undergradIndex !== -1) {
            numUndergradResearchers = countEntries(text, undergradIndex);
        }
        
        let numGraduateStudents = 0;
        if (graduateIndex !== -1) {
            numGraduateStudents = countEntries(text, graduateIndex);
        }
        
        let numPostdocs = 0;
        if (postdocIndex !== -1) {
            numPostdocs = countEntries(text, postdocIndex);
        }
        
        numLabMembers = numGraduateStudents + numPostdocs;
        
        const pubCount = countPublications(text);
        if (pubCount !== null) {
            numPublishedPapers = pubCount;
        }
        
        return {
            numUndergradResearchers,
            numLabMembers,
            numPublishedPapers: numPublishedPapers || null
        };
    } catch (error) {
        throw new Error(`Failed to parse PDF: ${error.message}`);
    }
}

function normalizeName(name) {
    return name.toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .trim()
        .split(/\s+/)
        .join(' ');
}

function matchProfessorToFile(filename, professors) {
    const filenameLower = filename.toLowerCase();
    
    // Try exact match first
    for (const prof of professors) {
        const profNameNormalized = normalizeName(prof.name);
        if (filenameLower.includes(profNameNormalized) || profNameNormalized.includes(filenameLower.replace(/\.pdf$/i, ''))) {
            return prof;
        }
    }
    
    // Try partial match (first and last name)
    for (const prof of professors) {
        const nameParts = prof.name.toLowerCase().split(/\s+/);
        if (nameParts.length >= 2) {
            const firstName = nameParts[0];
            const lastName = nameParts[nameParts.length - 1];
            if (filenameLower.includes(firstName) && filenameLower.includes(lastName)) {
                return prof;
            }
        }
    }
    
    // Try last name only
    for (const prof of professors) {
        const nameParts = prof.name.toLowerCase().split(/\s+/);
        if (nameParts.length >= 1) {
            const lastName = nameParts[nameParts.length - 1];
            if (filenameLower.includes(lastName)) {
                return prof;
            }
        }
    }
    
    return null;
}

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function processCV(pdfPath, professors, department) {
    const filename = path.basename(pdfPath);
    console.log(`\n📄 Processing: ${filename}`);
    
    // Try to match professor
    let professor = matchProfessorToFile(filename, professors);
    
    if (!professor) {
        console.log(`   ⚠️  Could not auto-match professor from filename`);
        console.log(`   Available professors in ${department}:`);
        professors.forEach((p, i) => {
            console.log(`   ${i + 1}. ${p.name}`);
        });
        
        const answer = await question(`   Enter professor number (1-${professors.length}) or 'skip': `);
        if (answer.toLowerCase() === 'skip') {
            console.log(`   ⏭️  Skipping ${filename}`);
            return false;
        }
        
        const index = parseInt(answer) - 1;
        if (isNaN(index) || index < 0 || index >= professors.length) {
            console.log(`   ❌ Invalid selection, skipping`);
            return false;
        }
        
        professor = professors[index];
    } else {
        console.log(`   ✅ Matched to: ${professor.name}`);
    }
    
    // Check if professor already has stats
    const existingProf = await db.getProfessorByNameAndDepartment(professor.name, department);
    const hasExistingStats = existingProf && (
        existingProf.num_undergrad_researchers !== null ||
        existingProf.num_lab_members !== null ||
        existingProf.num_published_papers !== null
    );
    
    if (hasExistingStats) {
        console.log(`   ⏭️  Professor already has stats in database:`);
        console.log(`      Undergraduate Researchers: ${existingProf.num_undergrad_researchers || 'N/A'}`);
        console.log(`      Lab Members: ${existingProf.num_lab_members || 'N/A'}`);
        console.log(`      Published Papers: ${existingProf.num_published_papers || 'N/A'}`);
        console.log(`   ⏭️  Skipping ${filename} (use update script to overwrite if needed)`);
        return false; // Skip, don't count as failure
    }
    
    // Parse CV
    try {
        const stats = await parseCV(pdfPath);
        
        console.log(`   📊 Extracted:`);
        console.log(`      Undergraduate Researchers: ${stats.numUndergradResearchers}`);
        console.log(`      Lab Members: ${stats.numLabMembers}`);
        console.log(`      Published Papers: ${stats.numPublishedPapers || 'Not found'}`);
        
        // Update database
        await db.updateProfessorStats(professor.name, department, stats);
        console.log(`   ✅ Updated database for ${professor.name}`);
        
        return true;
    } catch (error) {
        console.error(`   ❌ Error processing ${filename}: ${error.message}`);
        return false;
    }
}

async function main() {
    if (!fs.existsSync(CV_DIR)) {
        console.error(`❌ CV directory not found: ${CV_DIR}`);
        console.log(`   Creating directory...`);
        fs.mkdirSync(CV_DIR, { recursive: true });
        console.log(`   ✅ Created directory. Please add CV PDFs and run again.`);
        process.exit(0);
    }
    
    // Find all PDF files
    const files = fs.readdirSync(CV_DIR)
        .filter(file => file.toLowerCase().endsWith('.pdf'))
        .map(file => path.join(CV_DIR, file));
    
    if (files.length === 0) {
        console.log(`📁 No PDF files found in ${CV_DIR}`);
        console.log(`   Please add CV PDFs to this directory and run again.`);
        process.exit(0);
    }
    
    console.log(`📁 Found ${files.length} PDF file(s) in ${CV_DIR}\n`);
    
    // Get department
    let department = DEPARTMENT;
    if (!department) {
        department = await question('Enter department name (e.g., statistics, mathematics): ');
    }
    
    try {
        await db.initDatabase();
        
        // Get all professors in the department
        const professors = await db.getProfessorsByDepartment(department.toLowerCase());
        if (professors.length === 0) {
            console.error(`❌ No professors found in department "${department}"`);
            process.exit(1);
        }
        
        console.log(`\n✅ Found ${professors.length} professors in ${department}`);
        console.log(`\n🔄 Processing CVs...\n`);
        
        let successCount = 0;
        let failCount = 0;
        
        for (const pdfPath of files) {
            const success = await processCV(pdfPath, professors, department.toLowerCase());
            if (success) {
                successCount++;
            } else {
                failCount++;
            }
        }
        
        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Successfully processed: ${successCount}`);
        console.log(`   ⏭️  Skipped (already in DB): ${failCount}`);
        console.log(`   📁 Total files: ${files.length}`);
        
        rl.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        rl.close();
        process.exit(1);
    }
}

main();

