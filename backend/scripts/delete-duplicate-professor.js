#!/usr/bin/env node

/**
 * Script to find and delete duplicate professor entries
 * Usage: node scripts/delete-duplicate-professor.js <professorName> [department]
 * 
 * Example:
 * node scripts/delete-duplicate-professor.js "Aaron Shein"
 */

const db = require('../database');

async function findAndDeleteDuplicate() {
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
        console.log('Usage: node scripts/delete-duplicate-professor.js <professorName> [department]');
        console.log('\nExample:');
        console.log('  node scripts/delete-duplicate-professor.js "Aaron Shein"');
        process.exit(1);
    }
    
    const professorName = args[0];
    const departmentName = args[1]; // Optional
    
    try {
        await db.initDatabase();
        
        // Get all departments
        const allDepartments = await db.getAllDepartments();
        
        const matches = [];
        
        // Search for the professor in all departments (or specific department)
        const departmentsToSearch = departmentName 
            ? [departmentName] 
            : allDepartments.map(d => d.name);
        
        for (const dept of departmentsToSearch) {
            try {
                const prof = await db.getProfessorByNameAndDepartment(professorName, dept);
                if (prof) {
                    // Get stats
                    const stats = {
                        numLabMembers: prof.num_lab_members || 0,
                        numUndergradResearchers: prof.num_undergrad_researchers || 0,
                        numPublishedPapers: prof.num_published_papers || 0
                    };
                    
                    matches.push({
                        id: prof.id,
                        department: dept,
                        name: prof.name,
                        title: prof.title,
                        lab: prof.lab,
                        email: prof.email,
                        researchArea: prof.research_area,
                        stats: stats
                    });
                }
            } catch (error) {
                // Department might not exist, skip
            }
        }
        
        if (matches.length === 0) {
            console.log(`❌ No professor named "${professorName}" found`);
            process.exit(1);
        }
        
        console.log(`\n📋 Found ${matches.length} professor(s) named "${professorName}":\n`);
        
        matches.forEach((match, index) => {
            console.log(`${index + 1}. Department: ${match.department}`);
            console.log(`   ID: ${match.id}`);
            console.log(`   Title: ${match.title || 'N/A'}`);
            console.log(`   Lab: ${match.lab || 'N/A'}`);
            console.log(`   Email: ${match.email || 'N/A'}`);
            console.log(`   Research Area: ${match.researchArea || 'N/A'}`);
            console.log(`   Stats: ${match.stats.numLabMembers} lab members, ${match.stats.numUndergradResearchers} undergrads, ${match.stats.numPublishedPapers} papers`);
            console.log('');
        });
        
        // Find the one with 0 0 0 stats
        const zeroStatsMatches = matches.filter(m => 
            m.stats.numLabMembers === 0 && 
            m.stats.numUndergradResearchers === 0 && 
            m.stats.numPublishedPapers === 0
        );
        
        if (zeroStatsMatches.length === 0) {
            console.log('⚠️  No professor with 0 0 0 stats found');
            process.exit(0);
        }
        
        if (zeroStatsMatches.length > 1) {
            console.log(`⚠️  Found ${zeroStatsMatches.length} professors with 0 0 0 stats. Deleting all of them...\n`);
        } else {
            console.log('🗑️  Deleting professor with 0 0 0 stats...\n');
        }
        
        // Delete all zero-stats matches
        for (const match of zeroStatsMatches) {
            try {
                await db.deleteProfessor(match.name, match.department);
                console.log(`✅ Deleted: ${match.name} from ${match.department} (ID: ${match.id})`);
            } catch (error) {
                console.error(`❌ Error deleting ${match.name} from ${match.department}:`, error.message);
            }
        }
        
        console.log('\n✅ Done!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

findAndDeleteDuplicate();

