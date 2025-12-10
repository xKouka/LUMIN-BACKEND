const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class SQLiteDatabase {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, '../data/lumin-local.db');
  }

  /**
   * Inicializa la base de datos SQLite
   */
  initialize() {
    try {
      // Crear directorio data si no existe
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Conectar a la base de datos
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging para mejor concurrencia

      console.log('✓ Conectado a SQLite local:', this.dbPath);

      // Ejecutar script de inicialización de schema
      this.initializeSchema();

      return this.db;
    } catch (error) {
      console.error('Error al inicializar SQLite:', error);
      throw error;
    }
  }

  /**
   * Ejecuta el script de inicialización del schema
   */
  initializeSchema() {
    try {
      const schemaPath = path.join(__dirname, '../migrations/sqlite/schema-init.sql');

      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        this.db.exec(schema);
        console.log('✓ Schema SQLite inicializado correctamente');
      } else {
        console.warn('⚠ Archivo de schema no encontrado:', schemaPath);
      }
    } catch (error) {
      console.error('Error al inicializar schema SQLite:', error);
      throw error;
    }
  }

  /**
   * Ejecuta una query adaptada para SQLite
   * @param {string} text - Query SQL
   * @param {Array} params - Parámetros de la query
   * @returns {Object} Resultado con formato similar a pg
   */
  query(text, params = []) {
    try {
      // Adaptar sintaxis de PostgreSQL a SQLite
      let adaptedQuery = this.adaptQuery(text);

      // Determinar si es SELECT, INSERT, UPDATE o DELETE
      const queryType = this.getQueryType(adaptedQuery);

      // Adaptar parámetros (booleanos a 0/1, Dates a string)
      const adaptedParams = params.map(p => {
        if (typeof p === 'boolean') return p ? 1 : 0;
        if (p instanceof Date) return p.toISOString();
        return p;
      });

      try {
        const fs = require('fs');
        const path = require('path');
        const logPath = path.join(__dirname, '../sqlite-debug-params.log');
        fs.appendFileSync(logPath, `QueryType: ${queryType}\nParams In: ${JSON.stringify(params)}\nAdapted Out: ${JSON.stringify(adaptedParams)}\nTypes: ${JSON.stringify(adaptedParams.map(p => typeof p))}\n---\n`);
      } catch (e) { }

      if (queryType === 'SELECT') {
        const stmt = this.db.prepare(adaptedQuery);
        const rows = stmt.all(...adaptedParams);
        return { rows, rowCount: rows.length };
      } else if (queryType === 'INSERT') {
        const stmt = this.db.prepare(adaptedQuery);
        const info = stmt.run(...adaptedParams);

        // Si la query original tenía RETURNING, hacer un SELECT del registro insertado
        if (text.toUpperCase().includes('RETURNING')) {
          const selectStmt = this.createSelectAfterInsert(text, info.lastInsertRowid);
          const rows = this.db.prepare(selectStmt).all();
          return { rows, rowCount: info.changes };
        }

        return { rows: [{ id: info.lastInsertRowid }], rowCount: info.changes };
      } else if (queryType === 'UPDATE' || queryType === 'DELETE') {
        const stmt = this.db.prepare(adaptedQuery);
        const info = stmt.run(...adaptedParams);

        // Si la query tenía RETURNING, intentar recuperar los datos
        if (text.toUpperCase().includes('RETURNING')) {
          // Para UPDATE/DELETE con RETURNING, necesitamos ejecutar antes un SELECT
          // Esto es una limitación de SQLite, por simplicidad retornamos el rowCount
          return { rows: [], rowCount: info.changes };
        }

        return { rows: [], rowCount: info.changes };
      } else {
        // Otros tipos de queries (CREATE, ALTER, etc.)
        this.db.exec(adaptedQuery);
        return { rows: [], rowCount: 0 };
      }
    } catch (error) {
      console.error('Error en SQLite query:', error);
      console.error('Query original:', text);
      console.error('Params:', params);

      try {
        const fs = require('fs');
        const path = require('path');
        const logPath = path.join(__dirname, '../sqlite-error.log');
        const logMsg = `[${new Date().toISOString()}] Error: ${error.message}\n` +
          `Query: ${text}\n` +
          `Params: ${JSON.stringify(params)}\n` +
          `Stack: ${error.stack}\n` +
          `----------------------------------------\n`;
        fs.appendFileSync(logPath, logMsg);
      } catch (logError) {
        console.error('Error writing to log file:', logError);
      }

      throw error;
    }
  }

  /**
   * Adapta queries de PostgreSQL a SQLite
   * @param {string} query - Query original
   * @returns {string} Query adaptada
   */
  adaptQuery(query) {
    let adapted = query;

    // Reemplazar placeholders $1, $2, ... con ?
    adapted = adapted.replace(/\$\d+/g, '?');

    // Reemplazar CURRENT_TIMESTAMP con datetime('now')
    adapted = adapted.replace(/CURRENT_TIMESTAMP/gi, "datetime('now')");

    // Remover cláusula RETURNING (SQLite no la soporta directamente)
    adapted = adapted.replace(/RETURNING\s+.*/gi, '');

    // Reemplazar SERIAL con INTEGER PRIMARY KEY AUTOINCREMENT
    adapted = adapted.replace(/SERIAL/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');

    return adapted.trim();
  }

  /**
   * Determina el tipo de query
   * @param {string} query - Query SQL
   * @returns {string} Tipo de query
   */
  getQueryType(query) {
    const upperQuery = query.trim().toUpperCase();

    if (upperQuery.startsWith('SELECT')) return 'SELECT';
    if (upperQuery.startsWith('INSERT')) return 'INSERT';
    if (upperQuery.startsWith('UPDATE')) return 'UPDATE';
    if (upperQuery.startsWith('DELETE')) return 'DELETE';

    return 'OTHER';
  }

  /**
   * Crea un SELECT para obtener el registro insertado
   * @param {string} originalQuery - Query original con RETURNING
   * @param {number} lastId - ID del último registro insertado
   * @returns {string} Query SELECT
   */
  createSelectAfterInsert(originalQuery, lastId) {
    // Extraer tabla del INSERT
    const tableMatch = originalQuery.match(/INSERT\s+INTO\s+(\w+)/i);
    const tableName = tableMatch ? tableMatch[1] : 'unknown';

    // Extraer columnas del RETURNING
    const returningMatch = originalQuery.match(/RETURNING\s+(.*?)$/i);
    const columns = returningMatch ? returningMatch[1].trim() : '*';

    return `SELECT ${columns} FROM ${tableName} WHERE id = ${lastId}`;
  }

  /**
   * Inicia una transacción
   */
  async connect() {
    // SQLite maneja transacciones de manera diferente
    // Retornamos un objeto que simula el client de pg
    return {
      query: this.query.bind(this),
      release: () => { }, // No-op para compatibilidad
    };
  }

  /**
   * Cierra la conexión a la base de datos
   */
  close() {
    if (this.db) {
      this.db.close();
      console.log('✓ Conexión SQLite cerrada');
    }
  }

  /**
   * Ejecuta una función dentro de una transacción
   * @param {Function} callback - Función a ejecutar
   */
  async transaction(callback) {
    const beginStmt = this.db.prepare('BEGIN');
    const commitStmt = this.db.prepare('COMMIT');
    const rollbackStmt = this.db.prepare('ROLLBACK');

    try {
      beginStmt.run();
      await callback(this);
      commitStmt.run();
    } catch (error) {
      rollbackStmt.run();
      throw error;
    }
  }
}

// Singleton instance
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new SQLiteDatabase();
      instance.initialize();
    }
    return instance;
  },
  SQLiteDatabase
};
