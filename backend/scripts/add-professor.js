#!/usr/bin/env node

/**
 * Script to add a professor to the database
 * Usage: node scripts/add-professor.js <department> <name> [title] [lab] [email] [researchArea]
 * 
 * Example:
 * node scripts/add-professor.js statistics "Jane Smith" "Assistant Professor" "Smith Lab" "janesmith@uchicago.edu" "Data Science"
 */

const db = require('../database');

async function addProfessor() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('Usage: node scripts/add-professor.js <department> <name> [title] [lab] [email] [researchArea]');
        console.log('\nExample:');
        console.log('  node scripts/add-professor.js statistics "Jane Smith" "Assistant Professor" "Smith Lab" "janesmith@uchicago.edu" "Data Science"');
        process.exit(1);
    }
    
    const [department, name, title, lab, email, researchArea] = args;
    
    try {
        await db.initDatabase();
        
        const professor = {
            name: name,
            title: title || null,
            lab: lab || null,
            email: email || null,
            researchArea: researchArea || null
        };
        
        const professorId = await db.addProfessor(department, professor);
        
        console.log(`✅ Successfully added professor:`);
        console.log(`   Name: ${name}`);
        console.log(`   Department: ${department}`);
        console.log(`   Title: ${title || 'N/A'}`);
        console.log(`   Lab: ${lab || 'N/A'}`);
        console.log(`   Email: ${email || 'N/A'}`);
        console.log(`   Research Area: ${researchArea || 'N/A'}`);
        console.log(`   ID: ${professorId}`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error adding professor:', error.message);
        process.exit(1);
    }
}

addProfessor();

