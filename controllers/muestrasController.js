const pool = require('../config/database');
const { getManager } = require('../config/database-manager');
const { sendTestNotificationEmail, sendStatusUpdateEmail, sendPaymentConfirmationEmail } = require('../services/emailService');
const { registrarProductosUsados } = require('./muestraProductosController');

// Obtener todas las muestras
exports.obtenerTodas = async (req, res) => {
  try {
    const dbManager = getManager();
    const isOnline = dbManager.isOnline;

    if (isOnline) {
      // PostgreSQL query with JSON functions
      const result = await pool.query(`
        SELECT m.*, m.fecha_resultado, p.nombre as paciente_nombre, p.cedula, u.email, p.telefono, p.direccion,
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
        LEFT JOIN usuarios u ON p.usuario_id = u.id
        LEFT JOIN detalle_muestras dm ON m.id = dm.muestra_id
        GROUP BY m.id, p.nombre, p.cedula, u.email, p.telefono, p.direccion
        ORDER BY m.fecha_toma DESC
      `);
      res.json(result.rows);
    } else {
      // SQLite compatible query - fetch separately and combine in JavaScript
      const muestrasResult = await pool.query(`
        SELECT m.*, m.fecha_resultado, p.nombre as paciente_nombre, p.cedula, u.email, p.telefono, p.direccion
        FROM muestras m
        JOIN pacientes p ON m.paciente_id = p.id
        LEFT JOIN usuarios u ON p.usuario_id = u.id
        ORDER BY m.fecha_toma DESC
      `);

      // For each muestra, fetch its detalle_muestras
      const muestrasConDetalles = await Promise.all(
        muestrasResult.rows.map(async (muestra) => {
          const detallesResult = await pool.query(`
            SELECT id, tipo_muestra, resultados
            FROM detalle_muestras
            WHERE muestra_id = ?
            ORDER BY tipo_muestra
          `, [muestra.id]);

          const tipos_muestras = detallesResult.rows.map(dm => ({
            id: dm.id,
            tipo_muestra: dm.tipo_muestra,
            tiene_resultados: dm.resultados && JSON.stringify(dm.resultados) !== '{}'
          }));

          return {
            ...muestra,
            tipos_muestras
          };
        })
      );

      res.json(muestrasConDetalles);
    }
  } catch (error) {
    console.error('Error al obtener muestras:', error);
    res.status(500).json({ error: 'Error al obtener muestras: ' + error.message });
  }
};

// Obtener muestras del paciente autenticado (para clientes)
exports.obtenerMisMuestras = async (req, res) => {
  try {
    const pacienteId = req.usuario.paciente_id;

    if (!pacienteId) {
      return res.status(400).json({ error: 'Usuario no asociado a un paciente' });
    }

    const dbManager = getManager();
    const isOnline = dbManager.isOnline;

    if (isOnline) {
      // PostgreSQL query
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
        WHERE m.paciente_id = $1 AND m.pagado = true
        GROUP BY m.id, p.nombre, p.cedula
        ORDER BY m.fecha_toma DESC
      `, [pacienteId]);
      res.json(result.rows);
    } else {
      // SQLite compatible query
      const muestrasResult = await pool.query(`
        SELECT m.*, p.nombre as paciente_nombre, p.cedula
        FROM muestras m
        JOIN pacientes p ON m.paciente_id = p.id
        WHERE m.paciente_id = ? AND m.pagado = 1
        ORDER BY m.fecha_toma DESC
      `, [pacienteId]);

      const muestrasConDetalles = await Promise.all(
        muestrasResult.rows.map(async (muestra) => {
          const detallesResult = await pool.query(`
            SELECT id, tipo_muestra, resultados
            FROM detalle_muestras
            WHERE muestra_id = ?
            ORDER BY tipo_muestra
          `, [muestra.id]);

          const tipos_muestras = detallesResult.rows.map(dm => ({
            id: dm.id,
            tipo_muestra: dm.tipo_muestra,
            tiene_resultados: dm.resultados && JSON.stringify(dm.resultados) !== '{}'
          }));

          return {
            ...muestra,
            tipos_muestras
          };
        })
      );

      res.json(muestrasConDetalles);
    }
  } catch (error) {
    console.error('Error al obtener muestras:', error);
    res.status(500).json({ error: 'Error al obtener muestras: ' + error.message });
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

    const dbManager = getManager();
    const isOnline = dbManager.isOnline;

    if (isOnline) {
      // PostgreSQL query
      const result = await pool.query(`
        SELECT DISTINCT m.*, p.nombre as paciente_nombre, p.cedula, u.email, p.telefono, p.direccion,
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
        LEFT JOIN usuarios u ON p.usuario_id = u.id
        JOIN detalle_muestras dm_filter ON m.id = dm_filter.muestra_id
        LEFT JOIN detalle_muestras dm_all ON m.id = dm_all.muestra_id
        WHERE dm_filter.tipo_muestra = $1
        GROUP BY m.id, p.nombre, p.cedula, u.email, p.telefono, p.direccion
        ORDER BY m.fecha_toma DESC
      `, [tipo]);
      res.json(result.rows);
    } else {
      // SQLite compatible query
      const muestrasResult = await pool.query(`
        SELECT DISTINCT m.*, p.nombre as paciente_nombre, p.cedula, u.email, p.telefono, p.direccion
        FROM muestras m
        JOIN pacientes p ON m.paciente_id = p.id
        LEFT JOIN usuarios u ON p.usuario_id = u.id
        JOIN detalle_muestras dm_filter ON m.id = dm_filter.muestra_id
        WHERE dm_filter.tipo_muestra = ?
        ORDER BY m.fecha_toma DESC
      `, [tipo]);

      const muestrasConDetalles = await Promise.all(
        muestrasResult.rows.map(async (muestra) => {
          const detallesResult = await pool.query(`
            SELECT id, tipo_muestra, resultados
            FROM detalle_muestras
            WHERE muestra_id = ?
            ORDER BY tipo_muestra
          `, [muestra.id]);

          const tipos_muestras = detallesResult.rows.map(dm => ({
            id: dm.id,
            tipo_muestra: dm.tipo_muestra,
            tiene_resultados: dm.resultados && JSON.stringify(dm.resultados) !== '{}'
          }));

          return {
            ...muestra,
            tipos_muestras
          };
        })
      );

      res.json(muestrasConDetalles);
    }
  } catch (error) {
    console.error('Error al filtrar muestras:', error);
    res.status(500).json({ error: 'Error al filtrar muestras: ' + error.message });
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

    // Validar acceso para clientes: solo pueden ver muestras pagadas
    const muestraData = muestra.rows[0];
    const esCliente = req.usuario.rol === 'cliente';

    if (esCliente && !muestraData.pagado) {
      console.log(`⛔ Cliente intentó acceder a muestra no pagada ID ${id}`);
      return res.status(403).json({ error: 'No tienes acceso a esta muestra. Verifica el estado de pago.' });
    }

    // Obtener detalles de las muestras con sus productos
    const detalles = await pool.query(
      `SELECT dm.*, 
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'producto_id', i.id,
              'nombre', i.nombre_producto,
              'cantidad', dmp.cantidad_usada
            )
          ) FILTER (WHERE dmp.id IS NOT NULL),
          '[]'::json
        ) as productos_usados
       FROM detalle_muestras dm
       LEFT JOIN detalle_muestra_productos dmp ON dm.id = dmp.detalle_muestra_id
       LEFT JOIN inventario i ON dmp.producto_id = i.id
       WHERE dm.muestra_id = $1 
       GROUP BY dm.id
       ORDER BY dm.tipo_muestra`,
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
    const { paciente_id, observaciones, detalles, pagado } = req.body;
    const registrado_por = req.usuario.id; // Del token

    console.log('🚀 Intento de crear muestra:', {
      usuario_id: registrado_por,
      paciente_id,
      detalles_count: detalles?.length,
      pagado
    });

    if (!paciente_id || !detalles || !Array.isArray(detalles) || detalles.length === 0) {
      console.error('❌ Error: Datos incompletos para crear muestra');
      return res.status(400).json({ error: 'Datos incompletos: Se requiere paciente y al menos un detalle' });
    }

    await client.query('BEGIN');

    // 1. Crear la muestra principal
    const muestraResult = await client.query(
      `INSERT INTO muestras (paciente_id, registrado_por, observaciones, pagado, fecha_toma)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [paciente_id, registrado_por, observaciones, pagado !== undefined ? pagado : false, new Date()]
    );

    const nuevaMuestra = muestraResult.rows[0];

    // 2. Insertar los detalles de muestras
    const detallesInsertados = [];
    for (const detalle of detalles) {
      const { tipo_muestra, resultados, observaciones: obsDetalle, productos } = detalle;

      const detalleResult = await client.query(
        `INSERT INTO detalle_muestras (muestra_id, tipo_muestra, resultados, observaciones)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [nuevaMuestra.id, tipo_muestra, JSON.stringify(resultados || {}), obsDetalle]
      );

      const detalleInsertado = detalleResult.rows[0];
      detallesInsertados.push(detalleInsertado);

      // 3. Registrar productos usados y descontar del inventario
      if (productos && Array.isArray(productos) && productos.length > 0) {
        console.log(`📦 Registrando ${productos.length} productos para detalle ${detalleInsertado.id}`);
        await registrarProductosUsados(productos, detalleInsertado.id, client);
      }
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

      // Si la muestra se creó como PAGADA, enviar confirmación de pago
      if (pagado && paciente && paciente.email) {
        await sendPaymentConfirmationEmail(
          paciente.email,
          paciente.nombre,
          nuevaMuestra.id
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
    const { estado, observaciones, detalles, pagado } = req.body;

    await client.query('BEGIN');

    // 1. Actualizar muestra principal
    let muestraActualizada;
    if (estado || observaciones !== undefined || pagado !== undefined) {
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

      if (pagado !== undefined) {
        updates.push(`pagado = $${paramCount}`);
        values.push(pagado);
        paramCount++;
      }

      if (updates.length > 0) {
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
             SET resultados = $1, observaciones = $2
             WHERE id = $3 AND muestra_id = $4`,
            [JSON.stringify(detalle.resultados || {}), detalle.observaciones, detalle.id, id]
          );
        }
      }
    }

    // 4. Update fecha_resultado if results are being updated
    if (detalles && Array.isArray(detalles) && detalles.length > 0) {
      const hasResults = detalles.some(d => d.resultados && Object.keys(d.resultados).length > 0);
      if (hasResults) {
        await client.query(
          `UPDATE muestras SET fecha_resultado = NOW() WHERE id = $1`,
          [id]
        );
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

    // Enviar notificación de PAGO si se marcó como pagado
    if (pagado === true) {
      try {
        const pacienteResult = await pool.query(
          `SELECT p.nombre, p.email
           FROM pacientes p 
           JOIN muestras m ON p.id = m.paciente_id 
           WHERE m.id = $1`,
          [id]
        );
        const paciente = pacienteResult.rows[0];

        if (paciente && paciente.email) {
          await sendPaymentConfirmationEmail(
            paciente.email,
            paciente.nombre,
            id
          );
        }
      } catch (emailError) {
        console.error('Error al enviar email de pago:', emailError);
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