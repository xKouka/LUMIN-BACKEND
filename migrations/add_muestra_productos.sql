-- Tabla para configurar productos por tipo de muestra
CREATE TABLE IF NOT EXISTS tipo_muestra_productos (
  id SERIAL PRIMARY KEY,
  tipo_muestra VARCHAR(50) NOT NULL, -- 'sangre', 'orina', 'heces'
  producto_id INTEGER NOT NULL REFERENCES inventario(id) ON DELETE CASCADE,
  cantidad_default INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tipo_muestra, producto_id)
);

-- Tabla para registrar productos usados en cada detalle de muestra
CREATE TABLE IF NOT EXISTS detalle_muestra_productos (
  id SERIAL PRIMARY KEY,
  detalle_muestra_id INTEGER NOT NULL REFERENCES detalle_muestras(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES inventario(id) ON DELETE CASCADE,
  cantidad_usada INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_tipo_muestra_productos_tipo ON tipo_muestra_productos(tipo_muestra);
CREATE INDEX IF NOT EXISTS idx_detalle_muestra_productos_detalle ON detalle_muestra_productos(detalle_muestra_id);

COMMENT ON TABLE tipo_muestra_productos IS 'Configuración de productos predeterminados por tipo de muestra';
COMMENT ON TABLE detalle_muestra_productos IS 'Productos realmente usados en cada detalle de muestra';
