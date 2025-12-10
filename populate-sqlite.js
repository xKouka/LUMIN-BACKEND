// Script para poblar SQLite manualmente con todos los datos de PostgreSQL
const { Pool } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

// Conexión a PostgreSQL
const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

// Conexión a SQLite
const dbPath = path.join(__dirname, 'data/lumin-local.db');
const sqlite = new Database(dbPath);

/**
 * Convierte valores para SQLite
 */
function convertValue(value) {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
}

/**
 * Puebla una tabla
 */
async function populateTable(tableName, pgQuery, columns) {
    try {
        console.log(`\n📥 Descargando ${tableName}...`);

        const result = await pgPool.query(pgQuery);
        const rows = result.rows;

        console.log(`   Encontrados ${rows.length} registros`);

        let inserted = 0;
        let errors = 0;

        for (const row of rows) {
            try {
                const values = [row.id, ...columns.map(col => convertValue(row[col]))];
                const placeholders = values.map(() => '?').join(', ');

                sqlite.prepare(
                    `INSERT OR REPLACE INTO ${tableName} (id, ${columns.join(', ')}, synced) 
           VALUES (${placeholders}, 1)`
                ).run(values);

                inserted++;
            } catch (err) {
                errors++;
                console.error(`   ❌ Error en registro ID ${row.id}:`, err.message);
            }
        }

        console.log(`   ✅ Insertados: ${inserted}/${rows.length} (errores: ${errors})`);
        return inserted;

    } catch (error) {
        console.error(`   ❌ Error en tabla ${tableName}:`, error.message);
        return 0;
    }
}

/**
 * Proceso principal
 */
async function main() {
    try {
        console.log('🚀 Iniciando población de SQLite...\n');

        const results = {};

        // Usuarios
        results.usuarios = await populateTable(
            'usuarios',
            'SELECT * FROM usuarios ORDER BY id',
            ['nombre', 'apellido', 'usuario', 'email', 'contraseña', 'rol', 'estado', 'fecha_creacion']
        );

        // Pacientes
        results.pacientes = await populateTable(
            'pacientes',
            'SELECT * FROM pacientes ORDER BY id',
            ['nombre', 'apellido', 'cedula', 'fecha_nacimiento', 'genero', 'telefono', 'direccion', 'usuario_id', 'fecha_creacion']
        );

        // Muestras
        results.muestras = await populateTable(
            'muestras',
            'SELECT * FROM muestras ORDER BY id',
            ['paciente_id', 'fecha_toma', 'observaciones', 'pagado', 'fecha_resultado', 'registrado_por']
        );

        // Detalle de muestras
        results.detalle_muestras = await populateTable(
            'detalle_muestras',
            'SELECT * FROM detalle_muestras ORDER BY id',
            ['muestra_id', 'tipo_muestra', 'resultados', 'observaciones']
        );

        // Inventario
        results.inventario = await populateTable(
            'inventario',
            'SELECT * FROM inventario ORDER BY id',
            ['nombre_producto', 'tipo', 'cantidad', 'cantidad_minima', 'fecha_creacion', 'fecha_actualizacion']
        );

        // Detalle muestra productos
        results.detalle_muestra_productos = await populateTable(
            'detalle_muestra_productos',
            'SELECT * FROM detalle_muestra_productos ORDER BY id',
            ['detalle_muestra_id', 'producto_id', 'cantidad_usada', 'created_at']
        );

        // Reportes
        results.reportes = await populateTable(
            'reportes',
            'SELECT * FROM reportes ORDER BY id',
            ['usuario_id', 'fecha_inicio', 'fecha_fin', 'tipo', 'fecha_generacion']
        );

        console.log('\n' + '='.repeat(50));
        console.log('✅ POBLACIÓN COMPLETADA');
        console.log('='.repeat(50));
        console.log(JSON.stringify(results, null, 2));

        // Verificar conteos finales
        console.log('\n📊 Verificación de registros en SQLite:');
        const tables = ['usuarios', 'pacientes', 'muestras', 'detalle_muestras', 'inventario', 'detalle_muestra_productos', 'reportes'];

        for (const table of tables) {
            const count = sqlite.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
            console.log(`   ${table}: ${count.count}`);
        }

    } catch (error) {
        console.error('❌ Error fatal:', error);
    } finally {
        await pgPool.end();
        sqlite.close();
        console.log('\n✓ Conexiones cerradas');
    }
}

main();
