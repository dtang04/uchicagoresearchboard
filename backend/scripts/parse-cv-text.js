#!/usr/bin/env node

/**
 * Script to parse a professor's CV from text (pasted content) and automatically update their stats
 * Usage: node scripts/parse-cv-text.js <department> <name> <cv-text-file>
 * 
 * Example:
 * node scripts/parse-cv-text.js statistics "Guillaume Bal" ./cvs/guillaume-bal-cv.txt
 * 
 * Or pipe text directly:
 * cat cv.txt | node scripts/parse-cv-text.js statistics "Guillaume Bal" -
 */

const fs = require('fs');
const readline = require('readline');
const db = require('../database');

// Same patterns as PDF parser
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
        if (match) {
            return match.index;
        }
    }
    return -1;
}

function countEntries(text, startIndex) {
    if (startIndex === -1) return 0;
    
    let sectionText = text.substring(startIndex);
    
    // Find next major section (heading in all caps or bold-like formatting)
    const nextSection = sectionText.match(/\n\s*[A-Z][A-Z\s]{3,}\n/);
    if (nextSection) {
        sectionText = sectionText.substring(0, nextSection.index);
    } else {
        sectionText = sectionText.substring(0, Math.min(2000, sectionText.length));
    }
    
    // Count lines that look like entries
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

async function parseCVText(text, professorName, departmentName) {
    console.log(`\n📄 Parsing CV text for ${professorName}...`);
    console.log(`   Text length: ${text.length} characters\n`);
    
    const undergradIndex = findSection(text, SECTION_PATTERNS.undergraduate);
    const graduateIndex = findSection(text, SECTION_PATTERNS.graduate);
    const postdocIndex = findSection(text, SECTION_PATTERNS.postdoc);
    
    let numUndergradResearchers = 0;
    let numLabMembers = 0;
    let numPublishedPapers = 0;
    
    if (undergradIndex !== -1) {
        numUndergradResearchers = countEntries(text, undergradIndex);
        console.log(`   ✅ Found undergraduate section`);
        console.log(`   Counted ${numUndergradResearchers} undergraduate researchers`);
    } else {
        console.log(`   ⚠️  No undergraduate section found`);
    }
    
    let numGraduateStudents = 0;
    if (graduateIndex !== -1) {
        numGraduateStudents = countEntries(text, graduateIndex);
        console.log(`   ✅ Found graduate/doctoral students section`);
        console.log(`   Counted ${numGraduateStudents} graduate students`);
    } else {
        console.log(`   ⚠️  No graduate students section found`);
    }
    
    let numPostdocs = 0;
    if (postdocIndex !== -1) {
        numPostdocs = countEntries(text, postdocIndex);
        console.log(`   ✅ Found postdoc section`);
        console.log(`   Counted ${numPostdocs} postdocs`);
    } else {
        console.log(`   ⚠️  No postdoc section found`);
    }
    
    numLabMembers = numGraduateStudents + numPostdocs;
    
    const pubCount = countPublications(text);
    if (pubCount !== null) {
        numPublishedPapers = pubCount;
        console.log(`   ✅ Found publications section`);
        console.log(`   Counted ${numPublishedPapers} publications`);
    } else {
        console.log(`   ⚠️  No publications section found`);
    }
    
    console.log(`\n📊 Extracted Stats:`);
    console.log(`   Undergraduate Researchers: ${numUndergradResearchers}`);
    console.log(`   Lab Members (grad + postdoc): ${numLabMembers}`);
    console.log(`   Published Papers: ${numPublishedPapers || 'Not found'}`);
    
    return {
        numUndergradResearchers,
        numLabMembers,
        numPublishedPapers: numPublishedPapers || null
    };
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
        console.log('Usage: node scripts/parse-cv-text.js <department> <name> <text-file-path>');
        console.log('\nExample:');
        console.log('  node scripts/parse-cv-text.js statistics "Guillaume Bal" ./cvs/guillaume-bal-cv.txt');
        console.log('\nOr pipe text directly (use "-" as file path):');
        console.log('  cat cv.txt | node scripts/parse-cv-text.js statistics "Guillaume Bal" -');
        process.exit(1);
    }
    
    const [department, name, filePath] = args;
    
    try {
        await db.initDatabase();
        
        const professor = await db.getProfessorByNameAndDepartment(name, department);
        if (!professor) {
            console.error(`❌ Professor "${name}" not found in department "${department}"`);
            process.exit(1);
        }
        
        // Read text
        let text;
        if (filePath === '-') {
            // Read from stdin
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            const lines = [];
            for await (const line of rl) {
                lines.push(line);
            }
            text = lines.join('\n');
        } else {
            if (!fs.existsSync(filePath)) {
                console.error(`❌ Text file not found: ${filePath}`);
                process.exit(1);
            }
            text = fs.readFileSync(filePath, 'utf8');
        }
        
        const stats = await parseCVText(text, name, department);
        
        console.log(`\n💾 Updating database...`);
        await db.updateProfessorStats(name, department, stats);
        
        console.log(`\n✅ Successfully updated professor stats:`);
        console.log(`   Name: ${name}`);
        console.log(`   Department: ${department}`);
        console.log(`   Undergraduate Researchers: ${stats.numUndergradResearchers || 'N/A'}`);
        console.log(`   Lab Members: ${stats.numLabMembers || 'N/A'}`);
        console.log(`   Published Papers: ${stats.numPublishedPapers || 'N/A'}`);
        console.log(`\n⚠️  Please verify these numbers are correct!`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();

