const pool = require('./config/database');
const fs = require('fs');
const path = require('path');

const runFixMigration = async () => {
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'migrations', 'fix_estado_column.sql'), 'utf8');
        console.log('Ejecutando corrección de columna estado...');
        await pool.query(sql);
        console.log('Corrección completada exitosamente.');
    } catch (err) {
        console.error('Error al ejecutar la corrección:', err);
    } finally {
        await pool.end();
    }
};

runFixMigration();
