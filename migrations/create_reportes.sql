CREATE TABLE IF NOT EXISTS reportes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    tipo VARCHAR(50) DEFAULT 'general',
    fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
