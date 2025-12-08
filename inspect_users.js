const pool = require('./config/database');

const inspectUsers = async () => {
    try {
        console.log('Querying all users...');
        const res = await pool.query('SELECT id, nombre, usuario, rol, estado FROM usuarios');
        console.table(res.rows);
    } catch (err) {
        console.error('Error querying users:', err);
    } finally {
        await pool.end();
    }
};

inspectUsers();
