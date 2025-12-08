const pool = require('./config/database');
const fs = require('fs');
const path = require('path');

const runApellidoMigration = async () => {
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'migrations', 'add_apellido_column.sql'), 'utf8');
        console.log('Ejecutando migración apellido...');
        await pool.query(sql);
        console.log('Migración apellido completada exitosamente.');
    } catch (err) {
        console.error('Error al ejecutar la migración:', err);
    } finally {
        await pool.end();
    }
};

runApellidoMigration();
