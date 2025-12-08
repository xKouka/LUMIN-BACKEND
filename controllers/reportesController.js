const pool = require('../config/database');

// Obtener historial de reportes
exports.obtenerTodos = async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT r.*, u.nombre as generado_por_nombre
      FROM reportes r
      JOIN usuarios u ON r.usuario_id = u.id
      ORDER BY r.fecha_generacion DESC
    `);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener historial de reportes' });
    }
};

// Guardar nuevo registro de reporte
exports.crear = async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin, tipo } = req.body;
        const usuario_id = req.usuario.id;

        const result = await pool.query(
            `INSERT INTO reportes (usuario_id, fecha_inicio, fecha_fin, tipo)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
            [usuario_id, fecha_inicio, fecha_fin, tipo || 'general']
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al guardar el registro del reporte' });
    }
};
