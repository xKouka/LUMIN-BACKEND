// Script para ejecutar migración de base de datos
const pool = require('./config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Ejecutando migración...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', 'add_detalle_muestras.sql'),
      'utf8'
    );
    
    await client.query(migrationSQL);
    
    console.log('✅ Migración completada exitosamente!');
    console.log('✅ Tabla detalle_muestras creada');
    console.log('✅ Índices creados');
    console.log('✅ Constraint de unicidad agregado');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

runMigration();
