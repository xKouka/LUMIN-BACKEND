const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkData() {
    try {
        console.log('Connecting to Postgres...');
        const client = await pool.connect();

        // Check Muestras structure
        console.log('\n--- Muestras Structure ---');
        const muestras = await client.query('SELECT * FROM muestras LIMIT 1');
        if (muestras.rows.length > 0) {
            console.log('Keys in "muestras" row:', Object.keys(muestras.rows[0]));
            console.log('Sample row:', muestras.rows[0]);
        } else {
            console.log('No samples found in Postgres.');
        }

        // Check Detalle Muestras structure
        console.log('\n--- Detalle Muestras Structure ---');
        const detalles = await client.query('SELECT * FROM detalle_muestras LIMIT 1');
        if (detalles.rows.length > 0) {
            console.log('Keys in "detalle_muestras" row:', Object.keys(detalles.rows[0]));
        }

        client.release();
    } catch (err) {
        console.error('Error:', err);
    } finally {
        pool.end();
    }
}

checkData();
