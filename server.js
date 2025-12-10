const express = require('express');
const cors = require('cors');
const { getMonitor } = require('./services/connectivity-monitor');
const { getSync } = require('./services/sync-service');
const { getManager } = require('./config/database-manager');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pacientes', require('./routes/pacientes'));
app.use('/api/muestras', require('./routes/muestras'));
app.use('/api/inventario', require('./routes/inventario'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/reportes', require('./routes/reportes'));
app.use('/api/backup', require('./routes/backup'));

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend funcionando ✓' });
});

// Endpoint para verificar estado de conectividad
app.get('/api/status/connectivity', (req, res) => {
  const monitor = getMonitor();
  const dbManager = getManager();
  const syncService = getSync();

  res.json({
    ...monitor.getStatus(),
    sync: syncService.getStatus()
  });
});

// Endpoint para forzar sincronización manual (SQLite → PostgreSQL)
app.post('/api/sync/manual', async (req, res) => {
  try {
    const syncService = getSync();
    const result = await syncService.syncToPostgreSQL();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para descargar datos (PostgreSQL → SQLite)
app.post('/api/sync/download', async (req, res) => {
  try {
    const syncService = getSync();
    const result = await syncService.downloadFromPostgreSQL();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, async () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);

  // Iniciar monitoreo de conectividad
  const monitor = getMonitor();
  monitor.start();

  // Esperar 2 segundos para que checkConnectivity se complete
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Intentar descargar datos iniciales a SQLite (Solo si NO es producción)
  try {
    if (process.env.NODE_ENV === 'production') {
      console.log('🌍 Modo Producción: Saltando descarga a SQLite (Offline mode desactivado)');
    } else {
      const dbManager = getManager();

      // Re-verificar conectividad de forma explícita
      const isOnline = await dbManager.checkConnectivity();

      if (isOnline) {
        console.log('📥 Descargando datos iniciales a SQLite...');
        const syncService = getSync();
        const result = await syncService.downloadFromPostgreSQL();

        if (result && result.success) {
          console.log('✅ SQLite poblada con datos de PostgreSQL');
        } else {
          console.log('⚠️  Descarga de datos no completada completamente');
        }
      } else {
        console.log('⚠️  Sin conexión - SQLite usará datos locales existentes');
        console.log('💡 Tip: Ejecuta "node populate-sqlite.js" cuando tengas internet');
      }
    }
  } catch (error) {
    console.warn('⚠️  Error en descarga inicial:', error.message);
    console.log('📍 El sistema funcionará en modo offline con datos locales');
  }

  // Configurar listener para sincronización automática cuando se restaura conexión
  monitor.on('connected', async () => {
    try {
      const syncService = getSync();
      console.log('🔄 Iniciando sincronización automática...');
      await syncService.syncToPostgreSQL();
    } catch (error) {
      console.error('❌ Error en sincronización automática:', error.message);
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  const monitor = getMonitor();
  monitor.stop();

  server.close(() => {
    console.log('HTTP server closed');
    const dbManager = getManager();
    dbManager.close();
  });
});
