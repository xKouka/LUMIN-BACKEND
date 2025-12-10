const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;
let lastError = null;

/**
 * Obtiene o crea el transporter de email
 * Lazy loading para evitar errores de DNS cuando no hay internet
 */
const getTransporter = () => {
  // Si ya tenemos un transporter válido, devolverlo
  if (transporter) {
    return transporter;
  }

  try {
    // Crear transporter solo cuando se necesita
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // Configuraciones adicionales para manejar timeouts
      connectionTimeout: 5000, // 5 segundos
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });

    // Event listeners opcionales (sin causar crash)
    transporter.on('error', (err) => {
      console.error('⚠️  Error en transporter de email:', err.message);
      lastError = err;
      // No crashear, solo guardar el error
    });

    console.log('✓ Transporter de email creado');
    lastError = null;
    return transporter;

  } catch (error) {
    console.error('❌ Error al crear transporter de email:', error.message);
    lastError = error;
    // Retornar un transporter mock que falla gracefully
    return {
      sendMail: async () => {
        throw new Error('Email transporter no disponible - no hay conexión a internet');
      },
      verify: async () => {
        throw new Error('Email transporter no disponible - no hay conexión a internet');
      }
    };
  }
};

// Verificar configuración al inicializar (sin bloquear si falla)
(async () => {
  try {
    const t = getTransporter();

    // Intentar verificar con timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout verificando email')), 3000)
    );

    await Promise.race([t.verify(), timeoutPromise]);
    console.log('✓ Servidor de email configurado correctamente');
  } catch (error) {
    console.warn('⚠️  No se pudo verificar servidor de email:', error.message);
    console.warn('💡 Los emails no se enviarán hasta que haya conexión a internet');
  }
})();

// Exportar el transporter a través de una función getter
module.exports = {
  get sendMail() {
    return getTransporter().sendMail.bind(getTransporter());
  },
  get verify() {
    return getTransporter().verify.bind(getTransporter());
  },
  getLastError: () => lastError
};
