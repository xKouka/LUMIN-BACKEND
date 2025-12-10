const { getManager } = require('../config/database-manager');
const cron = require('node-cron');
const EventEmitter = require('events');

class ConnectivityMonitor extends EventEmitter {
    constructor() {
        super();
        this.dbManager = getManager();
        this.isMonitoring = false;
        this.cronJob = null;
        this.previousState = null;
    }

    /**
     * Inicia el monitoreo de conectividad cada 30 segundos
     */
    start() {
        if (this.isMonitoring) {
            console.log('⚠️  Connectivity monitor ya está activo');
            return;
        }

        console.log('🔍 Iniciando monitoreo de conectividad (cada 30 segundos)');

        // Ejecutar verificación inmediata
        this.checkAndNotify();

        // Configurar cron job para ejecutar cada 30 segundos
        this.cronJob = cron.schedule('*/30 * * * * *', () => {
            this.checkAndNotify();
        });

        this.isMonitoring = true;
    }

    /**
     * Verifica conectividad y emite eventos si cambió el estado
     */
    async checkAndNotify() {
        try {
            const isOnline = await this.dbManager.checkConnectivity();
            const currentState = isOnline ? 'online' : 'offline';

            // Si el estado cambió, emitir evento
            if (this.previousState !== null && this.previousState !== currentState) {
                console.log(`🔄 Estado de conectividad cambió: ${this.previousState} → ${currentState}`);

                if (currentState === 'online') {
                    this.emit('connected');
                    console.log('✅ Conexión restaurada - Iniciando sincronización...');
                } else {
                    this.emit('disconnected');
                    console.log('❌ Conexión perdida - Modo offline activado');
                }
            }

            this.previousState = currentState;

            // Log silencioso cada 5 minutos (10 checks de 30 segundos)
            if (!this.checkCounter) this.checkCounter = 0;
            this.checkCounter++;

            if (this.checkCounter % 10 === 0) {
                console.log(`📊 Estado: ${currentState} (última verificación: ${new Date().toLocaleTimeString()})`);
            }

        } catch (error) {
            console.error('Error al verificar conectividad:', error);
        }
    }

    /**
     * Detiene el monitoreo
     */
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.isMonitoring = false;
            console.log('🛑 Monitoreo de conectividad detenido');
        }
    }

    /**
     * Obtiene el estado actual
     * @returns {Object} Estado de conectividad
     */
    getStatus() {
        return {
            isMonitoring: this.isMonitoring,
            currentState: this.previousState,
            ...this.dbManager.getStatus()
        };
    }
}

// Singleton instance
let monitorInstance = null;

module.exports = {
    getMonitor: () => {
        if (!monitorInstance) {
            monitorInstance = new ConnectivityMonitor();
        }
        return monitorInstance;
    },
    ConnectivityMonitor
};
