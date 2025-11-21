#!/usr/bin/env node

/**
 * Script to update professor stats (undergrads, lab members, published papers)
 * Usage: node scripts/update-professor-stats.js <department> <name> <undergrads> <labMembers> <publishedPapers>
 * 
 * Example:
 * node scripts/update-professor-stats.js statistics "Guillaume Bal" 5 12 45
 */

const db = require('../database');

async function updateProfessorStats() {
    const args = process.argv.slice(2);
    
    if (args.length < 5) {
        console.log('Usage: node scripts/update-professor-stats.js <department> <name> <undergrads> <labMembers> <publishedPapers>');
        console.log('\nExample:');
        console.log('  node scripts/update-professor-stats.js statistics "Guillaume Bal" 5 12 45');
        process.exit(1);
    }
    
    const [department, name, undergrads, labMembers, publishedPapers] = args;
    
    try {
        await db.initDatabase();
        
        // Check if professor exists
        const professor = await db.getProfessorByNameAndDepartment(name, department);
        if (!professor) {
            console.error(`❌ Professor "${name}" not found in department "${department}"`);
            process.exit(1);
        }
        
        const stats = {
            numUndergradResearchers: (undergrads === 'null' || undergrads === '') ? null : (isNaN(parseInt(undergrads)) ? null : parseInt(undergrads)),
            numLabMembers: (labMembers === 'null' || labMembers === '') ? null : (isNaN(parseInt(labMembers)) ? null : parseInt(labMembers)),
            numPublishedPapers: (publishedPapers === 'null' || publishedPapers === '') ? null : (isNaN(parseInt(publishedPapers)) ? null : parseInt(publishedPapers))
        };
        
        await db.updateProfessorStats(name, department, stats);
        
        console.log(`✅ Successfully updated professor stats:`);
        console.log(`   Name: ${name}`);
        console.log(`   Department: ${department}`);
        console.log(`   Undergraduate Researchers: ${stats.numUndergradResearchers || 'N/A'}`);
        console.log(`   Lab Members: ${stats.numLabMembers || 'N/A'}`);
        console.log(`   Published Papers: ${stats.numPublishedPapers || 'N/A'}`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating professor stats:', error.message);
        process.exit(1);
    }
}

updateProfessorStats();

