const nodemailer = require('nodemailer');
require('dotenv').config();

// Configurar el transporter de nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false, // true para 465, false para otros puertos
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false, // Para desarrollo, en producción usar true
  },
});

// Verificar la conexión al iniciar
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Error en la configuración de email:', error);
  } else {
    console.log('✓ Servidor de email configurado correctamente');
  }
});

module.exports = transporter;
