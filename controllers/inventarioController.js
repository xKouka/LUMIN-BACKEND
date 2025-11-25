const pool = require('../config/database');

// Obtener todo el inventario
exports.obtener = async (req, res) => {
  try {
    const inventario = await pool.query(
      'SELECT * FROM inventario ORDER BY nombre_producto ASC'
    );
    res.json(inventario.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener inventario' });
  }
};

// Obtener producto por ID
exports.obtenerPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const producto = await pool.query(
      'SELECT * FROM inventario WHERE id = $1',
      [id]
    );

    if (producto.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(producto.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
};

// Crear producto (solo admin)
exports.crear = async (req, res) => {
  try {
    const { nombre_producto, tipo, cantidad, cantidad_minima } = req.body;

    if (!nombre_producto || !tipo || cantidad === undefined) {
      return res.status(400).json({ error: 'Datos requeridos incompletos' });
    }

    const nuevoProducto = await pool.query(
      'INSERT INTO inventario (nombre_producto, tipo, cantidad, cantidad_minima) VALUES ($1, $2, $3, $4) RETURNING *',
      [nombre_producto, tipo, cantidad, cantidad_minima || 5]
    );

    res.status(201).json({
      mensaje: 'Producto creado exitosamente',
      producto: nuevoProducto.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
};

// Actualizar cantidad (agregar o restar)
exports.actualizarCantidad = async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad } = req.body;

    if (cantidad === undefined) {
      return res.status(400).json({ error: 'Cantidad requerida' });
    }

    const productoActualizado = await pool.query(
      'UPDATE inventario SET cantidad = $1, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [cantidad, id]
    );

    if (productoActualizado.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({
      mensaje: 'Cantidad actualizada',
      producto: productoActualizado.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar cantidad' });
  }
};

// Eliminar producto
exports.eliminar = async (req, res) => {
  try {
    const { id } = req.params;

    const resultado = await pool.query(
      'DELETE FROM inventario WHERE id = $1 RETURNING id',
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ mensaje: 'Producto eliminado exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
};