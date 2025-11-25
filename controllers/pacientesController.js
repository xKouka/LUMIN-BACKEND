const pool = require("../config/database");
const bcrypt = require("bcryptjs");
const { sendUserCredentialsEmail } = require("../services/emailService");

// Obtener todos los pacientes (solo admin)
exports.obtenerTodos = async (req, res) => {
  try {
    const pacientes = await pool.query(
      "SELECT * FROM pacientes ORDER BY fecha_creacion DESC"
    );
    res.json(pacientes.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener pacientes" });
  }
};

// Obtener paciente por ID (cliente ve el suyo, admin ve todos)
exports.obtenerPorId = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.usuario.rol === "cliente") {
      const paciente = await pool.query(
        "SELECT * FROM pacientes WHERE usuario_id = $1",
        [req.usuario.id]
      );
      if (paciente.rows.length === 0) {
        return res.status(404).json({ error: "Paciente no encontrado" });
      }
      return res.json(paciente.rows[0]);
    }

    const paciente = await pool.query("SELECT * FROM pacientes WHERE id = $1", [
      id,
    ]);

    if (paciente.rows.length === 0) {
      return res.status(404).json({ error: "Paciente no encontrado" });
    }

    res.json(paciente.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener paciente" });
  }
};

// Crear paciente (solo admin) - Con creación de usuario automática
exports.crear = async (req, res) => {
  try {
    const { nombre, apellido, cedula, email, fecha_nacimiento, genero, telefono, direccion } =
      req.body;

    // Validar campos requeridos
    if (!nombre || !apellido || !cedula || !email) {
      return res.status(400).json({ 
        error: "Nombre, apellido, cédula y email son requeridos" 
      });
    }

    // Validar que el email no exista
    const emailExistente = await pool.query(
      "SELECT id FROM usuarios WHERE email = $1",
      [email]
    );
    if (emailExistente.rows.length > 0) {
      return res.status(400).json({ error: "El email ya está registrado" });
    }

    // Obtener últimos 3 números de la cédula
    const ultimos3Cedula = cedula.slice(-3);

    // Generar usuario: cédula
    const usuarioLogin = cedula;

    // Generar contraseña: apellido + últimos 3 números de cédula
    const contraseñaUsuario = `${apellido.toLowerCase()}${ultimos3Cedula}`;

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(contraseñaUsuario, 10);

    // Crear nombre completo para el campo nombre
    const nombreCompleto = `${nombre} ${apellido}`;

    // Crear usuario en BD
    const usuarioCreado = await pool.query(
      "INSERT INTO usuarios (nombre, usuario, email, contraseña, rol) VALUES ($1, $2, $3, $4, $5) RETURNING id, nombre, usuario, email, rol",
      [nombreCompleto, usuarioLogin, email, hashedPassword, "cliente"]
    );

    const nuevoUsuarioId = usuarioCreado.rows[0].id;

    // Crear paciente vinculado al usuario con apellido
    const nuevoPaciente = await pool.query(
      "INSERT INTO pacientes (nombre, apellido, cedula, fecha_nacimiento, genero, telefono, direccion, usuario_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      [
        nombreCompleto,
        apellido,
        cedula,
        fecha_nacimiento || null,
        genero || null,
        telefono || null,
        direccion || null,
        nuevoUsuarioId,
      ]
    );

    // Enviar email con las credenciales (no bloquea si falla)
    let emailEnviado = false;
    try {
      await sendUserCredentialsEmail(
        email,
        usuarioLogin,
        contraseñaUsuario, // Contraseña plana antes de hashear
        nombreCompleto
      );
      emailEnviado = true;
      console.log(`✓ Email de bienvenida enviado a: ${email}`);
    } catch (emailError) {
      console.error('⚠️ Error al enviar email, pero el usuario fue creado:', emailError.message);
      // No lanzamos el error, solo lo registramos
    }

    res.status(201).json({
      mensaje: "Paciente y usuario creados exitosamente",
      paciente: nuevoPaciente.rows[0],
      usuario: {
        id: usuarioCreado.rows[0].id,
        nombre: usuarioCreado.rows[0].nombre,
        usuario: usuarioCreado.rows[0].usuario,
        email: usuarioCreado.rows[0].email,
        contraseña: contraseñaUsuario,
        rol: usuarioCreado.rows[0].rol,
      },
      emailEnviado, // Indica si el email se envió correctamente
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear paciente" });
  }
};

// Actualizar paciente
exports.actualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, cedula, fecha_nacimiento, genero, telefono, direccion } = req.body;

    const pacienteActualizado = await pool.query(
      "UPDATE pacientes SET nombre = $1, apellido = $2, cedula = $3, fecha_nacimiento = $4, genero = $5, telefono = $6, direccion = $7 WHERE id = $8 RETURNING *",
      [
        nombre,
        apellido,
        cedula,
        fecha_nacimiento || null,
        genero || null,
        telefono || null,
        direccion || null,
        id,
      ]
    );

    if (pacienteActualizado.rows.length === 0) {
      return res.status(404).json({ error: "Paciente no encontrado" });
    }

    res.json({
      mensaje: "Paciente actualizado exitosamente",
      paciente: pacienteActualizado.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar paciente" });
  }
};

// Eliminar paciente (y su usuario asociado)
exports.eliminar = async (req, res) => {
  try {
    const { id } = req.params;

    const paciente = await pool.query(
      "SELECT usuario_id FROM pacientes WHERE id = $1",
      [id]
    );

    if (paciente.rows.length === 0) {
      return res.status(404).json({ error: "Paciente no encontrado" });
    }

    const usuarioId = paciente.rows[0].usuario_id;

    await pool.query("DELETE FROM pacientes WHERE id = $1", [id]);

    if (usuarioId) {
      await pool.query("DELETE FROM usuarios WHERE id = $1", [usuarioId]);
    }

    res.json({ mensaje: "Paciente y usuario eliminados exitosamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al eliminar paciente" });
  }
};