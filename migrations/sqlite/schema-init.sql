-- SQLite Schema Initialization for LUMIN
-- Este script crea todas las tablas necesarias para el modo offline

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100),
    usuario VARCHAR(100) UNIQUE,
    email VARCHAR(100) UNIQUE NOT NULL,
    contraseña VARCHAR(255) NOT NULL,
    rol VARCHAR(20) DEFAULT 'cliente',
    estado VARCHAR(20) DEFAULT 'activo',
    fecha_creacion TIMESTAMP DEFAULT (datetime('now')),
    synced BOOLEAN DEFAULT 0,
    local_updated_at TIMESTAMP DEFAULT (datetime('now'))
);

-- Tabla de pacientes
CREATE TABLE IF NOT EXISTS pacientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100),
    cedula VARCHAR(20) UNIQUE NOT NULL,
    fecha_nacimiento DATE,
    genero VARCHAR(20),
    telefono VARCHAR(20),
    direccion TEXT,
    usuario_id INTEGER,
    fecha_creacion TIMESTAMP DEFAULT (datetime('now')),
    synced BOOLEAN DEFAULT 0,
    local_updated_at TIMESTAMP DEFAULT (datetime('now')),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Tabla de muestras
CREATE TABLE IF NOT EXISTS muestras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER NOT NULL,
    fecha_toma DATE NOT NULL,
    observaciones TEXT,
    pagado BOOLEAN DEFAULT 0,
    fecha_resultado TIMESTAMP,
    registrado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT (datetime('now')),
    synced BOOLEAN DEFAULT 0,
    local_updated_at TIMESTAMP DEFAULT (datetime('now')),
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (registrado_por) REFERENCES usuarios(id)
);

-- Tabla de detalle de muestras
CREATE TABLE IF NOT EXISTS detalle_muestras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    muestra_id INTEGER NOT NULL,
    tipo_muestra VARCHAR(100) NOT NULL,
    resultados TEXT,
    observaciones TEXT,
    synced BOOLEAN DEFAULT 0,
    local_updated_at TIMESTAMP DEFAULT (datetime('now')),
    FOREIGN KEY (muestra_id) REFERENCES muestras(id) ON DELETE CASCADE
);

-- Tabla de inventario
CREATE TABLE IF NOT EXISTS inventario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_producto VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 0,
    cantidad_minima INTEGER DEFAULT 5,
    fecha_creacion TIMESTAMP DEFAULT (datetime('now')),
    fecha_actualizacion TIMESTAMP DEFAULT (datetime('now')),
    synced BOOLEAN DEFAULT 0,
    local_updated_at TIMESTAMP DEFAULT (datetime('now'))
);

-- Tabla de detalle de productos usados en muestras
CREATE TABLE IF NOT EXISTS detalle_muestra_productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    detalle_muestra_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    cantidad_usada INTEGER NOT NULL CHECK (cantidad_usada > 0),
    created_at TIMESTAMP DEFAULT (datetime('now')),
    synced BOOLEAN DEFAULT 0,
    local_updated_at TIMESTAMP DEFAULT (datetime('now')),
    FOREIGN KEY (detalle_muestra_id) REFERENCES detalle_muestras(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES inventario(id)
);

-- Tabla de reportes
CREATE TABLE IF NOT EXISTS reportes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    tipo VARCHAR(50) DEFAULT 'general',
    fecha_generacion TIMESTAMP DEFAULT (datetime('now')),
    synced BOOLEAN DEFAULT 0,
    local_updated_at TIMESTAMP DEFAULT (datetime('now')),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_pacientes_cedula ON pacientes(cedula);
CREATE INDEX IF NOT EXISTS idx_pacientes_usuario_id ON pacientes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_muestras_paciente_id ON muestras(paciente_id);
CREATE INDEX IF NOT EXISTS idx_muestras_fecha_toma ON muestras(fecha_toma);
CREATE INDEX IF NOT EXISTS idx_detalle_muestras_muestra_id ON detalle_muestras(muestra_id);
CREATE INDEX IF NOT EXISTS idx_detalle_muestra_productos_detalle ON detalle_muestra_productos(detalle_muestra_id);
CREATE INDEX IF NOT EXISTS idx_detalle_muestra_productos_producto ON detalle_muestra_productos(producto_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_usuario ON usuarios(usuario);

-- Índices para rastrear sincronización
CREATE INDEX IF NOT EXISTS idx_usuarios_synced ON usuarios(synced);
CREATE INDEX IF NOT EXISTS idx_pacientes_synced ON pacientes(synced);
CREATE INDEX IF NOT EXISTS idx_muestras_synced ON muestras(synced);
CREATE INDEX IF NOT EXISTS idx_inventario_synced ON inventario(synced);
