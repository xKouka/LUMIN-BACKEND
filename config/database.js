const { Pool } = require('pg');
const { getManager } = require('./database-manager');
require('dotenv').config();

// Obtener el database manager (singleton)
const dbManager = getManager();

// Para compatibilidad con código existente, exportamos un objeto que se comporta como el pool
// pero internamente usa el database manager
const pool = {
  query: async (text, params) => {
    return await dbManager.query(text, params);
  },
  connect: async () => {
    return await dbManager.connect();
  },
  end: async () => {
    return await dbManager.close();
  },
  on: (event, callback) => {
    // Mantener compatibilidad con event listeners
    if (dbManager.pgPool) {
      dbManager.pgPool.on(event, callback);
    }
  }
};

module.exports = pool;