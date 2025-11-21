#!/usr/bin/env node

/**
 * Script to parse a professor's CV PDF and automatically update their stats
 * Usage: node scripts/parse-cv-pdf.js <department> <name> <pdf-file-path>
 * 
 * Example:
 * node scripts/parse-cv-pdf.js statistics "Guillaume Bal" ./cvs/guillaume-bal-cv.pdf
 */

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const db = require('../database');

// Patterns to identify sections and count entries
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

function countEntries(text, startIndex, endPattern = null) {
    if (startIndex === -1) return 0;
    
    // Extract section text
    let sectionText = text.substring(startIndex);
    
    // If end pattern provided, find where section ends
    if (endPattern) {
        const endMatch = sectionText.match(endPattern);
        if (endMatch) {
            sectionText = sectionText.substring(0, endMatch.index);
        }
    } else {
        // Look for next major section (usually a heading in all caps or bold)
        const nextSection = sectionText.match(/\n\s*[A-Z][A-Z\s]{3,}\n/);
        if (nextSection) {
            sectionText = sectionText.substring(0, nextSection.index);
        } else {
            // Limit to next 2000 characters if no clear section break
            sectionText = sectionText.substring(0, Math.min(2000, sectionText.length));
        }
    }
    
    // Count lines that look like entries (name patterns, years, etc.)
    // Look for lines with:
    // - Names (capitalized words)
    // - Years (4 digits, possibly with ranges like 2020-2023)
    // - Bullet points or dashes
    const lines = sectionText.split('\n').filter(line => {
        const trimmed = line.trim();
        // Skip empty lines, section headers, and very short lines
        if (!trimmed || trimmed.length < 5) return false;
        
        // Look for patterns that indicate an entry:
        // - Contains a year (4 digits)
        // - Contains capitalized words (likely names)
        // - Starts with bullet/dash
        const hasYear = /\b(19|20)\d{2}(-|–|—)?(\d{2,4})?/i.test(trimmed);
        const hasName = /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+/.test(trimmed);
        const hasBullet = /^[•\-\*]\s/.test(trimmed);
        
        return (hasYear || hasName) && (hasYear || hasBullet || hasName);
    });
    
    return lines.length;
}

function countPublications(text) {
    // Try to find publications section
    const pubIndex = findSection(text, SECTION_PATTERNS.publications);
    if (pubIndex === -1) return null;
    
    // Extract publications section
    let pubText = text.substring(pubIndex);
    
    // Look for next major section
    const nextSection = pubText.match(/\n\s*[A-Z][A-Z\s]{3,}\n/);
    if (nextSection) {
        pubText = pubText.substring(0, nextSection.index);
    }
    
    // Count publication entries
    // Publications typically have:
    // - Author names
    // - Year (often in parentheses or brackets)
    // - Title
    // - Journal/conference name
    
    // Look for numbered lists or entries with years
    const pubLines = pubText.split('\n').filter(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.length < 10) return false;
        
        // Look for year patterns (in parentheses, brackets, or standalone)
        const hasYear = /\(?(19|20)\d{2}\)?/.test(trimmed);
        // Look for journal/conference indicators
        const hasJournal = /\b(journal|proceedings|conference|arxiv|preprint)/i.test(trimmed);
        // Look for author patterns (multiple capitalized words)
        const hasAuthors = /[A-Z][a-z]+(\s+[A-Z][a-z]+)+/.test(trimmed);
        
        return hasYear && (hasJournal || hasAuthors);
    });
    
    return pubLines.length;
}

async function parseCV(pdfPath, professorName, departmentName) {
    try {
        // Read PDF file
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdf(dataBuffer);
        const text = data.text;
        
        console.log(`\n📄 Parsing CV for ${professorName}...`);
        console.log(`   PDF: ${pdfPath}`);
        console.log(`   Text length: ${text.length} characters\n`);
        
        // Find sections
        const undergradIndex = findSection(text, SECTION_PATTERNS.undergraduate);
        const graduateIndex = findSection(text, SECTION_PATTERNS.graduate);
        const postdocIndex = findSection(text, SECTION_PATTERNS.postdoc);
        
        // Count entries
        let numUndergradResearchers = 0;
        let numLabMembers = 0;
        let numPublishedPapers = 0;
        
        if (undergradIndex !== -1) {
            numUndergradResearchers = countEntries(text, undergradIndex);
            console.log(`   Found undergraduate section at index ${undergradIndex}`);
            console.log(`   Counted ${numUndergradResearchers} undergraduate researchers`);
        } else {
            console.log(`   ⚠️  No undergraduate section found`);
        }
        
        // Count graduate students
        let numGraduateStudents = 0;
        if (graduateIndex !== -1) {
            numGraduateStudents = countEntries(text, graduateIndex);
            console.log(`   Found graduate/doctoral students section at index ${graduateIndex}`);
            console.log(`   Counted ${numGraduateStudents} graduate students`);
        } else {
            console.log(`   ⚠️  No graduate students section found`);
        }
        
        // Count postdocs
        let numPostdocs = 0;
        if (postdocIndex !== -1) {
            numPostdocs = countEntries(text, postdocIndex);
            console.log(`   Found postdoc section at index ${postdocIndex}`);
            console.log(`   Counted ${numPostdocs} postdocs`);
        } else {
            console.log(`   ⚠️  No postdoc section found`);
        }
        
        // Total lab members = graduate students + postdocs (current)
        // For current lab members, we'll count entries with dates ending in "-" or recent years
        // For now, use total as approximation (user can verify)
        numLabMembers = numGraduateStudents + numPostdocs;
        
        // Count publications
        const pubCount = countPublications(text);
        if (pubCount !== null) {
            numPublishedPapers = pubCount;
            console.log(`   Found publications section`);
            console.log(`   Counted ${numPublishedPapers} publications`);
        } else {
            console.log(`   ⚠️  No publications section found - you may need to count manually`);
        }
        
        console.log(`\n📊 Extracted Stats:`);
        console.log(`   Undergraduate Researchers: ${numUndergradResearchers}`);
        console.log(`   Lab Members (grad + postdoc): ${numLabMembers}`);
        console.log(`   Published Papers: ${numPublishedPapers || 'Not found'}`);
        
        // Ask for confirmation or auto-update
        return {
            numUndergradResearchers,
            numLabMembers,
            numPublishedPapers: numPublishedPapers || null
        };
        
    } catch (error) {
        console.error('❌ Error parsing PDF:', error.message);
        throw error;
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
        console.log('Usage: node scripts/parse-cv-pdf.js <department> <name> <pdf-file-path>');
        console.log('\nExample:');
        console.log('  node scripts/parse-cv-pdf.js statistics "Guillaume Bal" ./cvs/guillaume-bal-cv.pdf');
        console.log('\nNote: The script will attempt to extract:');
        console.log('  - Undergraduate researchers');
        console.log('  - Lab members (graduate students + postdocs)');
        console.log('  - Published papers');
        process.exit(1);
    }
    
    const [department, name, pdfPath] = args;
    
    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
        console.error(`❌ PDF file not found: ${pdfPath}`);
        process.exit(1);
    }
    
    try {
        await db.initDatabase();
        
        // Check if professor exists
        const professor = await db.getProfessorByNameAndDepartment(name, department);
        if (!professor) {
            console.error(`❌ Professor "${name}" not found in department "${department}"`);
            process.exit(1);
        }
        
        // Parse CV
        const stats = await parseCV(pdfPath, name, department);
        
        // Update database
        console.log(`\n💾 Updating database...`);
        await db.updateProfessorStats(name, department, stats);
        
        console.log(`\n✅ Successfully updated professor stats:`);
        console.log(`   Name: ${name}`);
        console.log(`   Department: ${department}`);
        console.log(`   Undergraduate Researchers: ${stats.numUndergradResearchers || 'N/A'}`);
        console.log(`   Lab Members: ${stats.numLabMembers || 'N/A'}`);
        console.log(`   Published Papers: ${stats.numPublishedPapers || 'N/A'}`);
        console.log(`\n⚠️  Please verify these numbers are correct!`);
        console.log(`   PDF parsing may not be 100% accurate.`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();

