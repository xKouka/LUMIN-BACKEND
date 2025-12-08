-- Script SQL para crear la tabla necesaria para el descuento automático de inventario
-- Ejecutar este script en la base de datos antes de habilitar la funcionalidad

CREATE TABLE IF NOT EXISTS detalle_muestra_productos (
  id SERIAL PRIMARY KEY,
  detalle_muestra_id INTEGER NOT NULL REFERENCES detalle_muestras(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES inventario(id),
  cantidad_usada INTEGER NOT NULL CHECK (cantidad_usada > 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_detalle_muestra_productos_detalle 
  ON detalle_muestra_productos(detalle_muestra_id);

CREATE INDEX IF NOT EXISTS idx_detalle_muestra_productos_producto 
  ON detalle_muestra_productos(producto_id);

-- Comentario sobre la tabla
COMMENT ON TABLE detalle_muestra_productos IS 
  'Registra qué productos del inventario fueron utilizados en cada detalle de muestra';
