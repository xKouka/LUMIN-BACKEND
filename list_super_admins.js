const pool = require('./config/database');
const fs = require('fs');

async function checkAdminUsers() {
    try {
        const adminUsers = await pool.query(
            `SELECT id, nombre, email, usuario, rol 
             FROM usuarios 
             WHERE rol = 'super_admin'`
        );

        let output = '=== USUARIOS SUPER ADMIN ===\n';
        adminUsers.rows.forEach(u => {
            output += `Usuario: ${u.usuario}\nEmail: ${u.email}\nNombre: ${u.nombre}\n-------------------\n`;
        });

        fs.writeFileSync('found_admins.txt', output, 'utf8');
        process.exit(0);
    } catch (error) {
        fs.writeFileSync('found_admins.txt', 'Error: ' + error.message, 'utf8');
        process.exit(1);
    }
}

checkAdminUsers();
