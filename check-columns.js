const pool = require('./config/database');

async function checkColumns() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'pacientes'
    `);
    console.log('Columnas en pacientes:', res.rows.map(r => r.column_name));
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    process.exit(0);
  }
}

checkColumns();
