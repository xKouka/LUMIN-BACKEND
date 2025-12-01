const pool = require('../config/database');
const { sendTestNotificationEmail, sendStatusUpdateEmail } = require('../services/emailService');

// Obtener todas las muestras
exports.obtenerTodas = async (req, res) => {
  try {
    // Consulta mejorada para obtener tipos de muestras
    const result = await pool.query(`
      SELECT m.*, p.nombre as paciente_nombre, p.cedula,
             COALESCE(
               JSON_AGG(
                 JSON_BUILD_OBJECT(
                   'id', dm.id,
                   'tipo_muestra', dm.tipo_muestra,
                   'tiene_resultados', CASE WHEN dm.resultados::text != '{}'::text THEN true ELSE false END
                 ) ORDER BY dm.tipo_muestra
               ) FILTER (WHERE dm.id IS NOT NULL),
               '[]'::json
             ) as tipos_muestras
      FROM muestras m
      JOIN pacientes p ON m.paciente_id = p.id
      LEFT JOIN detalle_muestras dm ON m.id = dm.muestra_id
      GROUP BY m.id, p.nombre, p.cedula
      ORDER BY m.fecha_toma DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener muestras' });
  }
};

// Obtener muestras del paciente autenticado (para clientes)
exports.obtenerMisMuestras = async (req, res) => {
  try {
    const pacienteId = req.usuario.paciente_id;
    
    if (!pacienteId) {
      return res.status(400).json({ error: 'Usuario no asociado a un paciente' });
    }

    const result = await pool.query(`
      SELECT m.*, p.nombre as paciente_nombre, p.cedula,
             COALESCE(
               JSON_AGG(
                 JSON_BUILD_OBJECT(
                   'id', dm.id,
                   'tipo_muestra', dm.tipo_muestra,
                   'tiene_resultados', CASE WHEN dm.resultados::text != '{}'::text THEN true ELSE false END
                 ) ORDER BY dm.tipo_muestra
               ) FILTER (WHERE dm.id IS NOT NULL),
               '[]'::json
             ) as tipos_muestras
      FROM muestras m
      JOIN pacientes p ON m.paciente_id = p.id
      LEFT JOIN detalle_muestras dm ON m.id = dm.muestra_id
      WHERE m.paciente_id = $1
      GROUP BY m.id, p.nombre, p.cedula
      ORDER BY m.fecha_toma DESC
    `, [pacienteId]);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener muestras' });
  }
};

// Obtener muestras filtradas por tipo (usando detalle_muestras)
exports.filtrarPorTipo = async (req, res) => {
  try {
    const { tipo } = req.params;

    // Si el filtro es 'todos', usar obtenerTodas
    if (tipo === 'todos') {
      return exports.obtenerTodas(req, res);
    }

    const result = await pool.query(`
      SELECT DISTINCT m.*, p.nombre as paciente_nombre, p.cedula,
             COALESCE(
               JSON_AGG(
                 JSON_BUILD_OBJECT(
                   'id', dm_all.id,
                   'tipo_muestra', dm_all.tipo_muestra,
                   'tiene_resultados', CASE WHEN dm_all.resultados::text != '{}'::text THEN true ELSE false END
                 ) ORDER BY dm_all.tipo_muestra
               ) FILTER (WHERE dm_all.id IS NOT NULL),
               '[]'::json
             ) as tipos_muestras
      FROM muestras m
      JOIN pacientes p ON m.paciente_id = p.id
      JOIN detalle_muestras dm_filter ON m.id = dm_filter.muestra_id
      LEFT JOIN detalle_muestras dm_all ON m.id = dm_all.muestra_id
      WHERE dm_filter.tipo_muestra = $1
      GROUP BY m.id, p.nombre, p.cedula
      ORDER BY m.fecha_toma DESC
    `, [tipo]);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al filtrar muestras' });
  }
};

// Obtener muestra por ID con todos los detalles
exports.obtenerPorId = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Buscando muestra ID: ${id}`);

    // Verificar si el ID es válido
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'ID de muestra inválido' });
    }

    // Consulta simplificada para evitar errores de columnas inexistentes
    // Eliminamos p.direccion si da problemas, pero verificamos que existe
    const muestra = await pool.query(
      `SELECT m.*, p.nombre as paciente_nombre, p.cedula, p.telefono, p.fecha_nacimiento, p.genero, p.direccion
       FROM muestras m
       JOIN pacientes p ON m.paciente_id = p.id
       WHERE m.id = $1`,
      [id]
    );

    if (muestra.rows.length === 0) {
      console.log(`❌ Muestra ID ${id} no encontrada`);
      return res.status(404).json({ error: 'Muestra no encontrada' });
    }

    // Obtener detalles de las muestras
    const detalles = await pool.query(
      `SELECT * FROM detalle_muestras WHERE muestra_id = $1 ORDER BY tipo_muestra`,
      [id]
    );

    console.log(`✅ Muestra encontrada. Detalles: ${detalles.rows.length}`);

    res.json({
      ...muestra.rows[0],
      detalles: detalles.rows
    });
  } catch (error) {
    console.error('❌ Error en obtenerPorId:', error);
    res.status(500).json({ error: 'Error al obtener muestra: ' + error.message });
  }
};

// Crear nueva muestra con múltiples detalles
exports.crear = async (req, res) => {
  const client = await pool.connect();

  try {
    const { paciente_id, observaciones, detalles } = req.body;
    const registrado_por = req.usuario.id; // Del token

    if (!paciente_id || !detalles || !Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    await client.query('BEGIN');

    // 1. Crear la muestra principal
    const muestraResult = await client.query(
      `INSERT INTO muestras (paciente_id, registrado_por, observaciones)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [paciente_id, registrado_por, observaciones]
    );

    const nuevaMuestra = muestraResult.rows[0];

    // 2. Insertar los detalles de muestras
    const detallesInsertados = [];
    for (const detalle of detalles) {
      const { tipo_muestra, resultados, observaciones: obsDetalle } = detalle;

      const detalleResult = await client.query(
        `INSERT INTO detalle_muestras (muestra_id, tipo_muestra, resultados, observaciones)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [nuevaMuestra.id, tipo_muestra, JSON.stringify(resultados || {}), obsDetalle]
      );

      detallesInsertados.push(detalleResult.rows[0]);
    }

    await client.query('COMMIT');

    // Enviar notificación por correo
    try {
      // Obtener datos del paciente para el correo
      const pacienteResult = await pool.query('SELECT nombre, email FROM pacientes WHERE id = $1', [paciente_id]);
      const paciente = pacienteResult.rows[0];

      if (paciente && paciente.email) {
        // Crear lista de tipos de exámenes para el correo
        const tiposExamenes = detalles.map(d => d.tipo_muestra).join(', ');

        await sendTestNotificationEmail(
          paciente.email,
          paciente.nombre,
          tiposExamenes,
          observaciones
        );
      }
    } catch (emailError) {
      console.error('Error al enviar email de notificación:', emailError);
      // No fallamos la request si el email falla
    }

    res.status(201).json({
      message: 'Muestra creada exitosamente',
      muestra: {
        ...nuevaMuestra,
        detalles: detallesInsertados
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);

    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Ya existe una muestra de este tipo para esta prueba' });
    }

    res.status(500).json({ error: 'Error al crear la muestra' });
  } finally {
    client.release();
  }
};

// Actualizar muestra y sus detalles
exports.actualizar = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { estado, observaciones, detalles } = req.body;

    await client.query('BEGIN');

    // 1. Actualizar muestra principal
    let muestraActualizada;
    if (estado || observaciones !== undefined) {
      // Construir query dinámica
      const updates = [];
      const values = [id];
      let paramCount = 2;

      if (estado) {
        updates.push(`estado = $${paramCount}`);
        values.push(estado);
        paramCount++;
      }

      if (observaciones !== undefined) {
        updates.push(`observaciones = $${paramCount}`);
        values.push(observaciones);
        paramCount++;
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);

      if (updates.length > 1) { // Si hay algo más que updated_at
        const result = await client.query(
          `UPDATE muestras SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
          values
        );
        muestraActualizada = result.rows[0];
      }
    }

    // 2. Actualizar detalles si se proporcionan
    if (detalles && Array.isArray(detalles)) {
      for (const detalle of detalles) {
        if (detalle.id) {
          // Actualizar detalle existente
          await client.query(
            `UPDATE detalle_muestras 
             SET resultados = $1, observaciones = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3 AND muestra_id = $4`,
            [JSON.stringify(detalle.resultados || {}), detalle.observaciones, detalle.id, id]
          );
        }
      }
    }

    // Si no se actualizó la muestra principal arriba, obtenerla ahora
    if (!muestraActualizada) {
      const res = await client.query('SELECT * FROM muestras WHERE id = $1', [id]);
      muestraActualizada = res.rows[0];
    }

    await client.query('COMMIT');

    // Enviar notificación de cambio de estado si corresponde
    if (estado && (estado === 'en_proceso' || estado === 'completado')) {
      try {
        // Obtener datos del paciente
        const pacienteResult = await pool.query(
          `SELECT p.nombre
           FROM pacientes p 
           JOIN muestras m ON p.id = m.paciente_id 
           WHERE m.id = $1`,
          [id]
        );

        const paciente = pacienteResult.rows[0];

        if (paciente && paciente.email) {
          await sendStatusUpdateEmail(
            paciente.email,
            paciente.nombre,
            estado,
            id
          );
        }
      } catch (emailError) {
        console.error('Error al enviar email de estado:', emailError);
      }
    }

    res.json({ message: 'Muestra actualizada exitosamente', muestra: muestraActualizada });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar la muestra' });
  } finally {
    client.release();
  }
};

// Eliminar muestra
exports.eliminar = async (req, res) => {
  try {
    const { id } = req.params;

    // Al eliminar la muestra, el CASCADE eliminará los detalles
    const result = await pool.query('DELETE FROM muestras WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Muestra no encontrada' });
    }

    res.json({ message: 'Muestra eliminada exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar la muestra' });
  }
};