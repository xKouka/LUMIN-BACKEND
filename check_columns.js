const pool = require('./config/database');

const inspectColumns = async () => {
    try {
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'usuarios';
        `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
};

inspectColumns();
