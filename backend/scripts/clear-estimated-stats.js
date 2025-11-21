#!/usr/bin/env node

/**
 * Script to clear estimated stats from database
 * Only keeps stats that were manually entered or from CVs
 * 
 * Usage: node scripts/clear-estimated-stats.js [department]
 */

const db = require('../database');

// Known real stats (from CVs we've processed)
const knownRealStats = {
    'statistics': [
        'Guillaume Bal',
        'Jingshu Wang',
        'Xinran Li',
        'Matthew Stephens',
        'Aaron Schein',
        'Molly Offer-Westort'
        // Note: Promit Ghosal and Veronika Rockova have parsing errors, need manual correction
    ]
};

function looksLikeEstimate(prof, department) {
    // If it's in our known real stats list, keep it
    if (knownRealStats[department] && knownRealStats[department].includes(prof.name)) {
        return false;
    }
    
    const lab = prof.num_lab_members || 0;
    const undergrad = prof.num_undergrad_researchers || 0;
    const papers = prof.num_published_papers || 0;
    
    // Estimates typically fall in these ranges (from estimateStats function):
    // Lab members: 1-12
    // Undergrads: 0-6
    // Papers: 10-150
    
    // If all values are in estimate ranges, it's likely an estimate
    const labInRange = lab >= 1 && lab <= 12;
    const undergradInRange = undergrad >= 0 && undergrad <= 6;
    const papersInRange = papers >= 10 && papers <= 150;
    
    // If at least 2 out of 3 are in estimate ranges, likely an estimate
    const inRangeCount = [labInRange, undergradInRange, papersInRange].filter(Boolean).length;
    
    // Also flag obviously wrong parsing results (very high numbers)
    const hasSuspiciouslyHighNumbers = lab > 50 || undergrad > 50 || (papers > 200 && lab > 20);
    
    return inRangeCount >= 2 || hasSuspiciouslyHighNumbers;
}

async function clearEstimates(department) {
    try {
        await db.initDatabase();
        
        const professors = await db.getProfessorsByDepartment(department);
        console.log(`\n📊 Found ${professors.length} professors in ${department}\n`);
        
        let cleared = 0;
        let kept = 0;
        
        for (const prof of professors) {
            const hasStats = prof.numLabMembers !== null || 
                           prof.numUndergradResearchers !== null || 
                           prof.numPublishedPapers !== null;
            
            if (!hasStats) {
                continue; // No stats to clear
            }
            
            // Get full professor record
            const fullProf = await db.getProfessorByNameAndDepartment(prof.name, department);
            
            if (looksLikeEstimate(fullProf, department)) {
                console.log(`   🗑️  Clearing estimated stats for: ${prof.name}`);
                console.log(`      Was: Lab=${fullProf.num_lab_members}, Undergrad=${fullProf.num_undergrad_researchers}, Papers=${fullProf.num_published_papers}`);
                
                await db.updateProfessorStats(prof.name, department, {
                    numLabMembers: null,
                    numUndergradResearchers: null,
                    numPublishedPapers: null
                });
                
                cleared++;
            } else {
                console.log(`   ✅ Keeping stats for: ${prof.name} (looks real)`);
                kept++;
            }
        }
        
        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Kept: ${kept}`);
        console.log(`   🗑️  Cleared: ${cleared}`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

const department = process.argv[2] || 'statistics';
clearEstimates(department);

