const pool = require('../config/database');

// Obtener productos configurados para un tipo de muestra
exports.obtenerProductosPorTipo = async (req, res) => {
    try {
        const { tipo } = req.params;

        const result = await pool.query(`
      SELECT tmp.*, i.nombre as producto_nombre, i.stock_actual
      FROM tipo_muestra_productos tmp
      JOIN inventario i ON tmp.producto_id = i.id
      WHERE tmp.tipo_muestra = $1
      ORDER BY i.nombre
    `, [tipo]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener productos por tipo:', error);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
};

// Configurar productos para un tipo de muestra
exports.configurarProductosTipo = async (req, res) => {
    const client = await pool.connect();

    try {
        const { tipo } = req.params;
        const { productos } = req.body; // Array de { producto_id, cantidad_default }

        await client.query('BEGIN');

        // Eliminar configuración anterior
        await client.query(
            'DELETE FROM tipo_muestra_productos WHERE tipo_muestra = $1',
            [tipo]
        );

        // Insertar nueva configuración
        if (productos && productos.length > 0) {
            for (const prod of productos) {
                await client.query(
                    `INSERT INTO tipo_muestra_productos (tipo_muestra, producto_id, cantidad_default)
           VALUES ($1, $2, $3)`,
                    [tipo, prod.producto_id, prod.cantidad_default || 1]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ mensaje: 'Productos configurados correctamente' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al configurar productos:', error);
        res.status(500).json({ error: 'Error al configurar productos' });
    } finally {
        client.release();
    }
};

// Obtener productos usados en un detalle de muestra
exports.obtenerProductosDetalle = async (req, res) => {
    try {
        const { detalleId } = req.params;

        const result = await pool.query(`
      SELECT dmp.*, i.nombre as producto_nombre
      FROM detalle_muestra_productos dmp
      JOIN inventario i ON dmp.producto_id = i.id
      WHERE dmp.detalle_muestra_id = $1
      ORDER BY i.nombre
    `, [detalleId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener productos del detalle:', error);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
};

// Registrar productos usados en un detalle de muestra y restar del inventario
exports.registrarProductosUsados = async (productos, detalleId, client) => {
    try {
        for (const prod of productos) {
            // Insertar registro de producto usado
            await client.query(
                `INSERT INTO detalle_muestra_productos (detalle_muestra_id, producto_id, cantidad_usada)
         VALUES ($1, $2, $3)`,
                [detalleId, prod.producto_id, prod.cantidad]
            );

            // Restar del inventario
            await client.query(
                `UPDATE inventario 
         SET stock_actual = stock_actual - $1
         WHERE id = $2`,
                [prod.cantidad, prod.producto_id]
            );

            // Verificar que no quedó en negativo
            const checkStock = await client.query(
                'SELECT stock_actual FROM inventario WHERE id = $1',
                [prod.producto_id]
            );

            if (checkStock.rows[0].stock_actual < 0) {
                throw new Error(`Stock insuficiente para el producto ID ${prod.producto_id}`);
            }
        }
    } catch (error) {
        throw error;
    }
};

module.exports = exports;
