const fs = require('fs').promises;
const path = require('path');
const db = require('../database');

async function migrate() {
    console.log('🔄 Starting migration from JSON to SQLite...');
    
    // Initialize database
    await db.initDatabase();
    
    // Read JSON database
    const jsonPath = path.join(__dirname, '..', 'database.json');
    const jsonData = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
    
    // Migrate departments and professors
    console.log('📦 Migrating departments and professors...');
    const departments = jsonData.departments || {};
    
    for (const [deptName, professors] of Object.entries(departments)) {
        console.log(`  - Migrating ${deptName}: ${professors.length} professors`);
        
        for (const prof of professors) {
            try {
                await db.addProfessor(deptName, prof);
            } catch (err) {
                console.error(`    Error adding professor ${prof.name}:`, err.message);
            }
        }
    }
    
    // Migrate trending labs
    console.log('🔥 Migrating trending labs...');
    const trendingLabs = jsonData.trendingLabs || {};
    
    for (const [deptName, labs] of Object.entries(trendingLabs)) {
        if (labs.length > 0) {
            console.log(`  - ${deptName}: ${labs.length} trending labs`);
            try {
                await db.setTrendingLabs(deptName, labs);
            } catch (err) {
                console.error(`    Error setting trending labs for ${deptName}:`, err.message);
            }
        }
    }
    
    console.log('✅ Migration complete!');
    console.log(`📊 Database saved to: ${path.join(__dirname, '..', 'database.db')}`);
    
    // Verify migration
    const allDepts = await db.getAllDepartments();
    console.log(`\n📈 Verification:`);
    console.log(`   - Departments: ${allDepts.length}`);
    
    for (const dept of allDepts) {
        const profs = await db.getProfessorsByDepartment(dept.name);
        console.log(`   - ${dept.name}: ${profs.length} professors`);
    }
}

// Run migration
migrate().catch(console.error);

