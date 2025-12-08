const pool = require('./config/database');

const checkSchema = async () => {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'usuarios' AND column_name = 'estado';
        `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
};

checkSchema();
