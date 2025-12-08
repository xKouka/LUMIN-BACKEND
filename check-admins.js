const pool = require('./config/database');

async function checkAdminUsers() {
    try {
        console.log('Conectando a la base de datos...');

        // Verificar todos los usuarios
        const allUsers = await pool.query('SELECT id, nombre, apellido, email, usuario, rol FROM usuarios ORDER BY id');
        console.log('\n=== TODOS LOS USUARIOS ===');
        console.log('Total usuarios:', allUsers.rows.length);
        console.table(allUsers.rows);

        // Verificar solo admins
        const adminUsers = await pool.query(
            `SELECT id, nombre, apellido, email, usuario, rol 
             FROM usuarios 
             WHERE rol = 'admin' OR rol = 'super_admin' 
             ORDER BY id`
        );
        console.log('\n=== USUARIOS ADMIN ===');
        console.log('Total admins:', adminUsers.rows.length);
        console.table(adminUsers.rows);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkAdminUsers();
