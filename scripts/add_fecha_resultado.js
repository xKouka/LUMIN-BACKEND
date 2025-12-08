const pool = require('../config/database');

const migrate = async () => {
    try {
        console.log('Iniciando migración...');

        // Add fecha_resultado column
        await pool.query(`
      ALTER TABLE muestras 
      ADD COLUMN IF NOT EXISTS fecha_resultado TIMESTAMP;
    `);

        console.log('✅ Columna fecha_resultado agregada exitosamente');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en la migración:', error);
        process.exit(1);
    }
};

migrate();
