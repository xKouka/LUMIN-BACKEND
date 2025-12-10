const { getManager } = require('../config/database-manager');
const { getInstance: getSQLiteInstance } = require('../config/sqlite-database');
const fs = require('fs');
const path = require('path');

class SyncService {
    constructor() {
        this.dbManager = getManager();
        this.sqlite = getSQLiteInstance();
        this.isSyncing = false;
        this.syncLog = [];
    }

    /**
     * Convierte valores PostgreSQL a formato compatible con SQLite
     * @param {*} value - Valor a convertir
     * @returns {*} Valor convertido
     */
    convertValue(value) {
        if (value === null || value === undefined) {
            return null;
        }
        if (value instanceof Date) {
            return value.toISOString();
        }
        if (typeof value === 'boolean') {
            return value ? 1 : 0;
        }
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        return value;
    }

    /**
     * Descarga datos iniciales de PostgreSQL a SQLite
     * @returns {Promise<Object>} Resultado de la descarga
     */
    async downloadFromPostgreSQL() {
        if (!this.dbManager.isOnline) {
            console.log('⚠️  No hay conexión para descargar datos');
            return { success: false, message: 'No connection available' };
        }

        try {
            console.log('📥 Descargando datos de PostgreSQL a SQLite...');

            const results = {
                usuarios: 0,
                pacientes: 0,
                muestras: 0,
                detalle_muestras: 0,
                inventario: 0,
                errors: []
            };

            const pgPool = this.dbManager.pgPool;

            // Descargar usuarios
            const usuarios = await pgPool.query('SELECT * FROM usuarios ORDER BY id');
            for (const user of usuarios.rows) {
                try {
                    const columns = ['nombre', 'apellido', 'usuario', 'email', 'contraseña', 'rol', 'estado', 'fecha_creacion'];
                    const values = columns.map(k => this.convertValue(user[k]));
                    const placeholders = values.map(() => '?').join(', ');

                    this.sqlite.query(
                        `INSERT OR REPLACE INTO usuarios (id, ${columns.join(', ')}, synced) VALUES (?, ${placeholders}, 1)`,
                        [user.id, ...values]
                    );
                    results.usuarios++;
                } catch (err) {
                    console.error('Error insertando usuario:', err.message);
                }
            }

            // Descargar pacientes
            const pacientes = await pgPool.query('SELECT * FROM pacientes ORDER BY id');
            for (const paciente of pacientes.rows) {
                try {
                    const columns = ['nombre', 'apellido', 'cedula', 'fecha_nacimiento', 'genero', 'telefono', 'direccion', 'usuario_id', 'fecha_creacion'];
                    const values = columns.map(k => this.convertValue(paciente[k]));
                    const placeholders = values.map(() => '?').join(', ');

                    this.sqlite.query(
                        `INSERT OR REPLACE INTO pacientes (id, ${columns.join(', ')}, synced) VALUES (?, ${placeholders}, 1)`,
                        [paciente.id, ...values]
                    );
                    results.pacientes++;
                } catch (err) {
                    console.error('Error insertando paciente:', err.message);
                }
            }

            // Descargar muestras
            const muestras = await pgPool.query('SELECT * FROM muestras ORDER BY id');
            for (const muestra of muestras.rows) {
                let values = [];
                try {
                    const columns = ['paciente_id', 'fecha_toma', 'observaciones', 'pagado', 'fecha_resultado', 'registrado_por'];
                    values = columns.map(k => this.convertValue(muestra[k]));
                    const placeholders = values.map(() => '?').join(', ');

                    this.sqlite.query(
                        `INSERT OR REPLACE INTO muestras (id, ${columns.join(', ')}, synced, fecha_creacion) VALUES (?, ${placeholders}, 1, datetime('now'))`,
                        [muestra.id, ...values]
                    );
                    results.muestras++;
                } catch (err) {
                    const errorMsg = `Error insertando muestra ID ${muestra.id}: ${err.message}\n` +
                        `Data: ${JSON.stringify(muestra)}\n` +
                        `Valid Values: ${JSON.stringify(values)}\n` +
                        `----------------------------------------\n`;
                    fs.appendFileSync(path.join(__dirname, '../sync-debug.log'), errorMsg);
                    console.error('Error insertando muestra ID ' + muestra.id + ':', err);
                }
            }

            // Descargar detalle_muestras - NOTA: el campo es "resultado" singular
            const detalles = await pgPool.query('SELECT * FROM detalle_muestras ORDER BY id');
            for (const detalle of detalles.rows) {
                try {
                    const columns = ['muestra_id', 'tipo_muestra', 'resultados', 'observaciones'];
                    const values = columns.map(k => this.convertValue(detalle[k]));
                    const placeholders = values.map(() => '?').join(', ');

                    this.sqlite.query(
                        `INSERT OR REPLACE INTO detalle_muestras (id, ${columns.join(', ')}, synced) VALUES (?, ${placeholders}, 1)`,
                        [detalle.id, ...values]
                    );
                    results.detalle_muestras++;
                } catch (err) {
                    console.error('Error insertando detalle_muestra:', err.message);
                }
            }

            // Descargar inventario
            const inventario = await pgPool.query('SELECT * FROM inventario ORDER BY id');
            for (const producto of inventario.rows) {
                try {
                    const columns = ['nombre_producto', 'tipo', 'cantidad', 'cantidad_minima', 'fecha_creacion', 'fecha_actualizacion'];
                    const values = columns.map(k => this.convertValue(producto[k]));
                    const placeholders = values.map(() => '?').join(', ');

                    this.sqlite.query(
                        `INSERT OR REPLACE INTO inventario (id, ${columns.join(', ')}, synced) VALUES (?, ${placeholders}, 1)`,
                        [producto.id, ...values]
                    );
                    results.inventario++;
                } catch (err) {
                    console.error('Error insertando producto:', err.message);
                }
            }

            console.log(`✅ Descarga completada: ${JSON.stringify(results)}`);
            return { success: true, results };

        } catch (error) {
            console.error('❌ Error al descargar datos:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sincroniza datos de SQLite a PostgreSQL
     * @returns {Promise<Object>} Resultado de la sincronización
     */
    async syncToPostgreSQL() {
        if (this.isSyncing) {
            console.log('⚠️  Sincronización ya en progreso');
            return { success: false, message: 'Sync already in progress' };
        }

        if (!this.dbManager.isOnline) {
            console.log('⚠️  No hay conexión - no se puede sincronizar');
            return { success: false, message: 'No connection available' };
        }

        this.isSyncing = true;
        const syncStartTime = new Date();
        const results = {
            usuarios: 0,
            pacientes: 0,
            muestras: 0,
            detalle_muestras: 0,
            inventario: 0,
            detalle_muestra_productos: 0,
            reportes: 0,
            errors: []
        };

        try {
            console.log('🔄 Iniciando sincronización SQLite → PostgreSQL...');

            // Sincronizar en orden de dependencias
            results.usuarios = await this.syncTable('usuarios', ['nombre', 'apellido', 'usuario', 'email', 'contraseña', 'rol', 'estado']);
            results.pacientes = await this.syncTable('pacientes', ['nombre', 'apellido', 'cedula', 'fecha_nacimiento', 'genero', 'telefono', 'direccion', 'usuario_id']);
            results.muestras = await this.syncTable('muestras', ['paciente_id', 'fecha_toma', 'observaciones', 'pagado', 'fecha_resultado', 'registrado_por']);
            results.detalle_muestras = await this.syncTable('detalle_muestras', ['muestra_id', 'tipo_muestra', 'resultados', 'observaciones']);
            results.inventario = await this.syncTable('inventario', ['nombre_producto', 'tipo', 'cantidad', 'cantidad_minima']);
            results.detalle_muestra_productos = await this.syncTable('detalle_muestra_productos', ['detalle_muestra_id', 'producto_id', 'cantidad_usada']);
            results.reportes = await this.syncTable('reportes', ['usuario_id', 'fecha_inicio', 'fecha_fin', 'tipo']);

            const syncDuration = (new Date() - syncStartTime) / 1000;
            const totalSynced = Object.values(results).reduce((sum, val) =>
                typeof val === 'number' ? sum + val : sum, 0
            );

            console.log(`✅ Sincronización completada en ${syncDuration.toFixed(2)}s - ${totalSynced} registros sincronizados`);

            this.logSync({
                timestamp: syncStartTime,
                duration: syncDuration,
                results,
                success: true
            });

            return { success: true, results, duration: syncDuration };

        } catch (error) {
            console.error('❌ Error durante la sincronización:', error);
            results.errors.push(error.message);

            this.logSync({
                timestamp: syncStartTime,
                results,
                success: false,
                error: error.message
            });

            return { success: false, error: error.message, results };
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Sincroniza una tabla específica
     * @param {string} tableName - Nombre de la tabla
     * @param {Array<string>} columns - Columnas a sincronizar
     * @returns {Promise<number>} Número de registros sincronizados
     */
    async syncTable(tableName, columns) {
        try {
            // Obtener registros no sincronizados de SQLite
            const unsyncedQuery = `SELECT * FROM ${tableName} WHERE synced = 0`;
            const unsyncedResult = this.sqlite.query(unsyncedQuery);
            const unsyncedRecords = unsyncedResult.rows;

            if (unsyncedRecords.length === 0) {
                return 0;
            }

            console.log(`  📤 Sincronizando ${unsyncedRecords.length} registros de ${tableName}`);

            let syncedCount = 0;

            for (const record of unsyncedRecords) {
                try {
                    // Verificar si el registro ya existe en PostgreSQL (por ID)
                    const pgPool = this.dbManager.pgPool;
                    const existsQuery = `SELECT id FROM ${tableName} WHERE id = $1`;
                    const existsResult = await pgPool.query(existsQuery, [record.id]);

                    const columnList = columns.join(', ');
                    const values = columns.map(col => {
                        // Intentar parsear JSON si es string y empieza con { o [
                        const val = record[col];
                        if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
                            try {
                                return JSON.parse(val);
                            } catch (e) {
                                return val;
                            }
                        }
                        return val;
                    });

                    if (existsResult.rows.length > 0) {
                        // UPDATE: El registro existe, actualizarlo
                        const setClause = columns.map((col, idx) => `${col} = $${idx + 1}`).join(', ');
                        const updateQuery = `UPDATE ${tableName} SET ${setClause} WHERE id = $${columns.length + 1}`;
                        await pgPool.query(updateQuery, [...values, record.id]);
                    } else {
                        // INSERT: El registro no existe, insertarlo
                        const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
                        const insertQuery = `INSERT INTO ${tableName} (${columnList}) VALUES (${placeholders})`;
                        await pgPool.query(insertQuery, values);
                    }

                    // Marcar como sincronizado en SQLite
                    const markSyncedQuery = `UPDATE ${tableName} SET synced = 1 WHERE id = ?`;
                    this.sqlite.query(markSyncedQuery, [record.id]);

                    syncedCount++;

                } catch (recordError) {
                    console.error(`  ❌ Error al sincronizar registro ID ${record.id} de ${tableName}:`, recordError.message);
                    // Continuar con el siguiente registro
                }
            }

            console.log(`  ✓ ${syncedCount}/${unsyncedRecords.length} registros de ${tableName} sincronizados`);
            return syncedCount;

        } catch (error) {
            console.error(`Error al sincronizar tabla ${tableName}:`, error);
            throw error;
        }
    }

    /**
     * Registra un evento de sincronización
     * @param {Object} logEntry - Entrada de log
     */
    logSync(logEntry) {
        this.syncLog.push(logEntry);

        // Mantener solo los últimos 50 logs
        if (this.syncLog.length > 50) {
            this.syncLog = this.syncLog.slice(-50);
        }
    }

    /**
     * Obtiene el historial de sincronización
     * @returns {Array} Historial de sincronizaciones
     */
    getSyncHistory() {
        return this.syncLog;
    }

    /**
     * Obtiene el estado actual de sincronización
     * @returns {Object} Estado
     */
    getStatus() {
        return {
            isSyncing: this.isSyncing,
            lastSync: this.syncLog.length > 0 ? this.syncLog[this.syncLog.length - 1] : null,
            totalSyncs: this.syncLog.length
        };
    }
}

// Singleton instance
let syncInstance = null;

module.exports = {
    getSync: () => {
        if (!syncInstance) {
            syncInstance = new SyncService();
        }
        return syncInstance;
    },
    SyncService
};
