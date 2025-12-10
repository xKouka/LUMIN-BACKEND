const db = require('better-sqlite3')('./data/lumin-local.db');

console.log('📊 Registros en SQLite:\n');

const tables = [
    'usuarios',
    'pacientes',
    'muestras',
    'detalle_muestras',
    'inventario',
    'detalle_muestra_productos',
    'reportes'
];

tables.forEach(table => {
    const result = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
    console.log(`  ${table}: ${result.count}`);
});

db.close();
console.log('\n✅ Verificación completada');
