const pool = require('./config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'migrations', 'create_reportes.sql'), 'utf8');
        await pool.query(sql);
        console.log('Migration create_reportes executed successfully');
        process.exit(0);
    } catch (err) {
        console.error('Error executing migration:', err);
        process.exit(1);
    }
}

runMigration();
