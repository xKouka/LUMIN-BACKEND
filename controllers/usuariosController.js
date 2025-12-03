const pool = require('../config/database');
const bcrypt = require('bcryptjs');

// Obtener todos los usuarios (solo para super admin)
exports.obtenerUsuarios = async (req, res) => {
    try {
        // Verificar que el usuario es super admin
        if (req.usuario.rol !== 'super_admin') {
            return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de super admin.' });
        }

        const result = await pool.query(
            `SELECT id, nombre, apellido, email, usuario, rol
       FROM usuarios 
       ORDER BY id DESC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
};

// Obtener usuarios admin solamente
exports.obtenerAdmins = async (req, res) => {
    try {
        // Verificar que el usuario es super admin
        if (req.usuario.rol !== 'super_admin') {
            return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de super admin.' });
        }

        const result = await pool.query(
            `SELECT id, nombre, apellido, email, usuario, rol
       FROM usuarios 
       WHERE rol = 'admin' OR rol = 'super_admin'
       ORDER BY id DESC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener admins:', error);
        res.status(500).json({ error: 'Error al obtener admins' });
    }
};

// Crear nuevo usuario admin
exports.crearUsuarioAdmin = async (req, res) => {
    try {
        // Verificar que el usuario es super admin
        if (req.usuario.rol !== 'super_admin') {
            return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de super admin.' });
        }

        const { nombre, apellido, email, usuario, contraseña, rol } = req.body;

        // Validaciones
        if (!nombre || !apellido || !email || !contraseña || !rol) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }

        // Validar que el rol sea admin o super_admin
        if (rol !== 'admin' && rol !== 'super_admin') {
            return res.status(400).json({ error: 'El rol debe ser admin o super_admin' });
        }

        // Verificar si el email ya existe
        const emailExistente = await pool.query(
            'SELECT * FROM usuarios WHERE email = $1',
            [email]
        );

        if (emailExistente.rows.length > 0) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }

        // Verificar si el usuario (cedula) ya existe
        if (usuario) {
            const usuarioExistente = await pool.query(
                'SELECT * FROM usuarios WHERE usuario = $1',
                [usuario]
            );

            if (usuarioExistente.rows.length > 0) {
                return res.status(400).json({ error: 'El usuario ya está registrado' });
            }
        }

        // Encriptar contraseña
        const hashedPassword = await bcrypt.hash(contraseña, 10);

        // Insertar usuario
        const nuevoUsuario = await pool.query(
            'INSERT INTO usuarios (nombre, apellido, email, usuario, contraseña, rol) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nombre, apellido, email, usuario, rol',
            [nombre, apellido, email, usuario || null, hashedPassword, rol]
        );

        res.status(201).json({
            mensaje: 'Usuario admin creado exitosamente',
            usuario: nuevoUsuario.rows[0],
        });
    } catch (error) {
        console.error('Error al crear usuario admin:', error);
        res.status(500).json({ error: 'Error al crear usuario admin' });
    }
};

// Actualizar usuario admin
exports.actualizarUsuarioAdmin = async (req, res) => {
    try {
        // Verificar que el usuario es super admin
        if (req.usuario.rol !== 'super_admin') {
            return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de super admin.' });
        }

        const { id } = req.params;
        const { nombre, apellido, email, usuario, contraseña, rol } = req.body;

        // Validar que el rol sea admin o super_admin
        if (rol && rol !== 'admin' && rol !== 'super_admin') {
            return res.status(400).json({ error: 'El rol debe ser admin o super_admin' });
        }

        // Verificar si el usuario existe
        const usuarioExistente = await pool.query(
            'SELECT * FROM usuarios WHERE id = $1',
            [id]
        );

        if (usuarioExistente.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Construir la consulta de actualización dinámicamente
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (nombre) {
            updates.push(`nombre = $${paramCount}`);
            values.push(nombre);
            paramCount++;
        }

        if (email) {
            // Verificar que el email no esté en uso por otro usuario
            const emailCheck = await pool.query(
                'SELECT * FROM usuarios WHERE email = $1 AND id != $2',
                [email, id]
            );
            if (emailCheck.rows.length > 0) {
                return res.status(400).json({ error: 'El email ya está en uso' });
            }
            updates.push(`email = $${paramCount}`);
            values.push(email);
            paramCount++;
        }

        if (apellido !== undefined) {
            updates.push(`apellido = $${paramCount}`);
            values.push(apellido);
            paramCount++;
        }

        if (usuario) {
            // Verificar que el usuario no esté en uso por otro usuario
            const usuarioCheck = await pool.query(
                'SELECT * FROM usuarios WHERE usuario = $1 AND id != $2',
                [usuario, id]
            );
            if (usuarioCheck.rows.length > 0) {
                return res.status(400).json({ error: 'El usuario ya está en uso' });
            }
            updates.push(`usuario = $${paramCount}`);
            values.push(usuario);
            paramCount++;
        }

        if (contraseña) {
            const hashedPassword = await bcrypt.hash(contraseña, 10);
            updates.push(`contraseña = $${paramCount}`);
            values.push(hashedPassword);
            paramCount++;
        }

        if (rol) {
            updates.push(`rol = $${paramCount}`);
            values.push(rol);
            paramCount++;
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No hay datos para actualizar' });
        }

        values.push(id);
        const query = `
      UPDATE usuarios 
      SET ${updates.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING id, nombre, apellido, email, usuario, rol
    `;

        const resultado = await pool.query(query, values);

        res.json({
            mensaje: 'Usuario actualizado exitosamente',
            usuario: resultado.rows[0],
        });
    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
};

// Eliminar usuario admin
exports.eliminarUsuarioAdmin = async (req, res) => {
    try {
        // Verificar que el usuario es super admin
        if (req.usuario.rol !== 'super_admin') {
            return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de super admin.' });
        }

        const { id } = req.params;

        // Evitar que el super admin se elimine a sí mismo
        if (parseInt(id) === req.usuario.id) {
            return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
        }

        // Verificar si el usuario existe
        const usuarioExistente = await pool.query(
            'SELECT * FROM usuarios WHERE id = $1',
            [id]
        );

        if (usuarioExistente.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Eliminar usuario
        await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);

        res.json({ mensaje: 'Usuario eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
};
