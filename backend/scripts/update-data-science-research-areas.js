#!/usr/bin/env node

/**
 * Script to update research areas for data science professors
 * Categorizes professors into specific research subfields
 */

const db = require('../database');

// Research area assignments based on titles and typical research
const researchAreaAssignments = {
    // Machine Learning / AI
    'Alex Kale': 'Machine Learning',
    'Ari Holtzman': 'Natural Language Processing',
    'Ce Zhang': 'Machine Learning',
    'Chenhao Tan': 'Natural Language Processing',
    'Haifeng Xu': 'Machine Learning',
    'Mina Lee': 'Natural Language Processing',
    'Tian Li': 'Machine Learning',
    
    // Statistics / Statistical Methods
    'Frederic Koehler': 'Statistical Methods',
    'Li Ma': 'Statistical Methods',
    'Nikolaos (Nikos) Ignatiadis': 'Statistical Methods',
    'Victor Veitch': 'Statistical Methods',
    
    // Privacy & Security
    'Aloni Cohen': 'Privacy & Security',
    'Bo Li': 'Privacy & Security',
    
    // Computational Social Science / Democracy
    'Moon Duchin': 'Computational Social Science',
    
    // Education & Evaluation
    'Jeanne Century': 'Education & Evaluation',
    'Amanda Kube Jotte': 'Education & Evaluation',
    'Amy Nussbaum': 'Education & Evaluation',
    
    // Program Administration / Instructional (these might stay as "Other" or we can create a category)
    'David Biron': 'Program Administration',
    'Edwin Lo': 'Program Administration',
    'Greg Green': 'Program Administration',
    'Nick Ross': 'Program Administration',
    'Will Trimble': 'Program Administration',
    
    // Visiting / Research
    'Kristian Lum': 'Statistical Methods'
};

async function updateResearchAreas() {
    try {
        await db.initDatabase();
        
        const departmentName = 'data science';
        let updated = 0;
        let skipped = 0;
        let errors = 0;
        
        console.log('📝 Updating research areas for Data Science professors...\n');
        
        for (const [professorName, researchArea] of Object.entries(researchAreaAssignments)) {
            try {
                const prof = await db.getProfessorByNameAndDepartment(professorName, departmentName);
                if (!prof) {
                    console.log(`⚠️  Not found: ${professorName}`);
                    skipped++;
                    continue;
                }
                
                await db.updateProfessorResearchArea(professorName, departmentName, researchArea);
                console.log(`✅ ${professorName} → ${researchArea}`);
                updated++;
            } catch (error) {
                console.error(`❌ Error updating ${professorName}:`, error.message);
                errors++;
            }
        }
        
        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Updated: ${updated}`);
        console.log(`   ⚠️  Skipped: ${skipped}`);
        console.log(`   ❌ Errors: ${errors}`);
        console.log('\n✅ Done!');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

updateResearchAreas();

