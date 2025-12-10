const { Pool } = require('pg');
const { getInstance: getSQLiteInstance } = require('./sqlite-database');
require('dotenv').config();

class DatabaseManager {
    constructor() {
        // PostgreSQL pool
        this.pgPool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false,
            },
        });

        // SQLite instance
        this.sqlite = null;

        // Estado de conectividad
        this.isOnline = true;
        this.lastCheckTime = null;
        this.checkInterval = 30000; // 30 segundos

        // Configurar listeners de PostgreSQL
        this.setupPostgreSQLListeners();

        // Inicializar SQLite
        this.initializeSQLite();

        // Verificar conectividad inicial
        this.checkConnectivity();
    }

    /**
     * Configura los listeners de eventos de PostgreSQL
     */
    setupPostgreSQLListeners() {
        this.pgPool.on('connect', () => {
            console.log('✓ Conectado a PostgreSQL (Neon)');
            this.isOnline = true;
        });

        this.pgPool.on('error', (err) => {
            console.error('Error en pool de PostgreSQL:', err.message);
            this.isOnline = false;
        });
    }

    /**
     * Inicializa la base de datos SQLite
     */
    initializeSQLite() {
        if (process.env.NODE_ENV === 'production') {
            console.log('production mode detected: SQLite initialization skipped');
            return;
        }

        try {
            this.sqlite = getSQLiteInstance();
            console.log('✓ Base de datos SQLite inicializada');
        } catch (error) {
            console.error('Error al inicializar SQLite:', error);
            throw error;
        }
    }

    /**
     * Verifica la conectividad a PostgreSQL
     * @returns {Promise<boolean>} true si está online, false si está offline
     */
    async checkConnectivity() {
        try {
            const client = await this.pgPool.connect();
            await client.query('SELECT 1');
            client.release();

            if (!this.isOnline) {
                console.log('🌐 Conexión a Internet restaurada - Cambiando a PostgreSQL');
            }

            this.isOnline = true;
            this.lastCheckTime = new Date();
            return true;
        } catch (error) {
            if (this.isOnline) {
                console.warn('⚠️  Sin conexión a Internet - Cambiando a SQLite local');
            }

            this.isOnline = false;
            this.lastCheckTime = new Date();
            return false;
        }
    }

    /**
     * Obtiene la conexión apropiada según el estado de conectividad
     * @returns {Object} Objeto de conexión (PostgreSQL Pool o SQLite wrapper)
     */
    getConnection() {
        if (this.isOnline || process.env.NODE_ENV === 'production') {
            return this.pgPool;
        } else {
            return this.sqlite;
        }
    }

    /**
     * Ejecuta una query en la base de datos apropiada
     * @param {string} text - Query SQL
     * @param {Array} params - Parámetros
     * @returns {Promise<Object>} Resultado de la query
     */
    async query(text, params = []) {
        const connection = this.getConnection();

        try {
            const result = await connection.query(text, params);

            // Si estamos usando SQLite, marcar como no sincronizado
            if (!this.isOnline) {
                await this.markAsUnsyncedIfNeeded(text);
            }

            return result;
        } catch (error) {
            console.error('Error en query:', error);
            throw error;
        }
    }

    /**
     * Marca registros como no sincronizados si la query fue INSERT/UPDATE/DELETE
     * @param {string} query - Query ejecutada
     */
    async markAsUnsyncedIfNeeded(query) {
        const upperQuery = query.trim().toUpperCase();

        // Solo marcar para operaciones de escritura
        if (upperQuery.startsWith('INSERT') ||
            upperQuery.startsWith('UPDATE') ||
            upperQuery.startsWith('DELETE')) {

            // La lógica de marcado se maneja en el sync-service
            // Aquí solo registramos que hubo un cambio
            console.log('📝 Cambio registrado en modo offline');
        }
    }

    /**
     * Obtener estado de conectividad
     * @returns {Object} Estado actual
     */
    getStatus() {
        return {
            isOnline: this.isOnline,
            database: this.isOnline ? 'PostgreSQL' : 'SQLite',
            lastCheck: this.lastCheckTime,
        };
    }

    /**
     * Conectar (para compatibilidad con transacciones)
     * @returns {Promise<Object>} Cliente de base de datos
     */
    async connect() {
        if (this.isOnline) {
            return await this.pgPool.connect();
        } else {
            return await this.sqlite.connect();
        }
    }

    /**
     * Cierra todas las conexiones
     */
    async close() {
        await this.pgPool.end();
        if (this.sqlite) {
            this.sqlite.close();
        }
        console.log('✓ Todas las conexiones de base de datos cerradas');
    }
}

// Singleton instance
let managerInstance = null;

module.exports = {
    getManager: () => {
        if (!managerInstance) {
            managerInstance = new DatabaseManager();
        }
        return managerInstance;
    },
    DatabaseManager
};
