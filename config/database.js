const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on('connect', () => {
  console.log('✓ Conectado a PostgreSQL (Neon)');
});

pool.on('error', (err) => {
  console.error('Error en pool de conexión:', err);
});

module.exports = pool;