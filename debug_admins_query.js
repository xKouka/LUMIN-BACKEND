const pool = require('./config/database');

const testQuery = async () => {
    try {
        console.log('Testing admin fetch query...');
        const result = await pool.query(
            `SELECT id, nombre, apellido, email, usuario, rol, estado
       FROM usuarios 
       WHERE rol = 'admin' OR rol = 'super_admin'
       ORDER BY id DESC`
        );
        console.log('Query successful!');
        console.table(result.rows);
    } catch (err) {
        console.error('Query failed:', err);
    } finally {
        await pool.end();
    }
};

testQuery();
