-- Migración para sistema avanzado de muestras
-- Crear tabla de detalles de muestras

CREATE TABLE IF NOT EXISTS detalle_muestras (
  id SERIAL PRIMARY KEY,
  muestra_id INTEGER NOT NULL REFERENCES muestras(id) ON DELETE CASCADE,
  tipo_muestra VARCHAR(50) NOT NULL CHECK (tipo_muestra IN ('sangre', 'orina', 'heces')),
  resultados JSONB DEFAULT '{}',
  observaciones TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_detalle_muestras_muestra_id ON detalle_muestras(muestra_id);
CREATE INDEX IF NOT EXISTS idx_detalle_muestras_tipo ON detalle_muestras(tipo_muestra);
CREATE INDEX IF NOT EXISTS idx_detalle_muestras_resultados ON detalle_muestras USING GIN (resultados);

-- Constraint para evitar múltiples muestras del mismo tipo en una prueba
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_tipo_por_muestra 
ON detalle_muestras(muestra_id, tipo_muestra);

-- Eliminar columnas obsoletas de la tabla muestras si existen
ALTER TABLE muestras DROP COLUMN IF EXISTS tipo_examen;
ALTER TABLE muestras DROP COLUMN IF EXISTS resultado;

-- Comentarios para documentación
COMMENT ON TABLE detalle_muestras IS 'Tabla de detalles de muestras con resultados específicos por tipo';
COMMENT ON COLUMN detalle_muestras.tipo_muestra IS 'Tipo de muestra: sangre, orina o heces';
COMMENT ON COLUMN detalle_muestras.resultados IS 'Resultados en formato JSON según el tipo de muestra';
