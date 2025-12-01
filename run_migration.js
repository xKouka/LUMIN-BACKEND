const pool = require('./config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, 'migrations', 'add_muestra_productos.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Ejecutando migración...');
        await pool.query(sql);
        console.log('Migración ejecutada exitosamente.');
    } catch (error) {
        console.error('Error al ejecutar migración:', error);
    } finally {
        await pool.end();
    }
}

runMigration();
