const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Registrar nuevo usuario
exports.register = async (req, res) => {
  try {
    const { nombre, email, contraseña, rol } = req.body;

    // Validaciones
    if (!nombre || !email || !contraseña) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    // Verificar si el email ya existe
    const usuarioExistente = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email]
    );

    if (usuarioExistente.rows.length > 0) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(contraseña, 10);

    // Insertar usuario
    const nuevoUsuario = await pool.query(
      'INSERT INTO usuarios (nombre, email, contraseña, rol) VALUES ($1, $2, $3, $4) RETURNING id, nombre, email, rol',
      [nombre, email, hashedPassword, rol || 'cliente']
    );

    const usuario = nuevoUsuario.rows[0];

    // Si es cliente, crear entrada en pacientes
    if (rol !== 'admin') {
      await pool.query(
        'INSERT INTO pacientes (usuario_id, nombre) VALUES ($1, $2)',
        [usuario.id, nombre]
      );
    }

    res.status(201).json({
      mensaje: 'Usuario registrado exitosamente',
      usuario,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
};

// Login - Permite usar email O usuario (cedula)
exports.login = async (req, res) => {
  try {
    const { emailUsuario, contraseña } = req.body;

    if (!emailUsuario || !contraseña) {
      return res.status(400).json({ error: 'Email/Usuario y contraseña requeridos' });
    }

    // Buscar usuario por email o por usuario (cedula)
    const usuario = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1 OR usuario = $2',
      [emailUsuario, emailUsuario]
    );

    if (usuario.rows.length === 0) {
      return res.status(401).json({ error: 'Email/Usuario o contraseña incorrectos' });
    }

    const usuarioData = usuario.rows[0];

    // Verificar contraseña
    const validPassword = await bcrypt.compare(contraseña, usuarioData.contraseña);

    if (!validPassword) {
      return res.status(401).json({ error: 'Email/Usuario o contraseña incorrectos' });
    }

    // Crear token JWT
    const token = jwt.sign(
      {
        id: usuarioData.id,
        email: usuarioData.email,
        usuario: usuarioData.usuario,
        rol: usuarioData.rol,
        nombre: usuarioData.nombre,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    res.json({
      mensaje: 'Login exitoso',
      token,
      usuario: {
        id: usuarioData.id,
        nombre: usuarioData.nombre,
        email: usuarioData.email,
        usuario: usuarioData.usuario,
        rol: usuarioData.rol,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al hacer login' });
  }
};