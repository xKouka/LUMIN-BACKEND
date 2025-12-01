const transporter = require('../config/email');

// Función auxiliar para verificar conexión SMTP
const verifyConnection = async () => {
  try {
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('❌ Error de conexión SMTP:', error);
    return false;
  }
};

/**
 * Envía un correo de bienvenida con las credenciales del usuario
 * @param {string} recipientEmail - Email del destinatario
 * @param {string} username - Usuario (cédula) para login
 * @param {string} plainPassword - Contraseña sin hashear
 * @param {string} nombre - Nombre completo del paciente
 * @returns {Promise<void>}
 */
const sendUserCredentialsEmail = async (recipientEmail, username, plainPassword, nombre) => {
  try {
    // Verificar conexión antes de intentar enviar
    const isConnected = await verifyConnection();
    if (!isConnected) {
      console.warn('⚠️ No hay conexión SMTP, omitiendo envío de email de bienvenida');
      return { success: false, error: 'No SMTP connection' };
    }

    const loginUrl = 'http://localhost:3000/login';

    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to: recipientEmail,
      subject: '🎉 Bienvenido a L.U.M.I.N. - Tus Credenciales de Acceso',
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; padding: 20px 0; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 10px 10px 0 0; color: white; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
          .credentials-box { background-color: #f3f4f6; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #10b981; }
          .button { display: inline-block; padding: 12px 30px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <svg width="180" height="80" viewBox="0 0 1024 200" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 10px;">
              <!-- Cruz médica -->
              <g transform="translate(50, 30)">
                <path d="M 60 0 L 90 0 L 90 50 L 140 50 L 140 80 L 90 80 L 90 130 L 60 130 L 60 80 L 10 80 L 10 50 L 60 50 Z" 
                      fill="none" stroke="white" stroke-width="8"/>
                <!-- Estrella/átomo dentro -->
                <circle cx="75" cy="65" r="3" fill="white"/>
                <path d="M 75 50 L 85 70 L 65 70 Z M 60 65 L 80 75 L 80 55 Z M 90 65 L 70 75 L 70 55 Z M 75 80 L 85 60 L 65 60 Z" 
                      fill="none" stroke="white" stroke-width="2"/>
              </g>
              <!-- Texto L.U.M.I.N. -->
              <text x="200" y="100" font-family="Arial, sans-serif" font-size="60" font-weight="bold" fill="white" letter-spacing="8">
                L.U.M.I.N.
              </text>
            </svg>
            <h2 style="margin: 0; font-size: 24px; font-weight: 600;">¡Bienvenido a L.U.M.I.N.!</h2>
          </div>

          <!-- Content -->
          <div class="content">
            <p>Hola <strong>${nombre}</strong>,</p>
            <p>Nos complace darte la bienvenida a nuestro sistema de gestión clínica. Tu cuenta ha sido creada exitosamente.</p>
            
            <div class="credentials-box">
              <p style="margin: 0 0 10px 0;"><strong>Tus credenciales de acceso son:</strong></p>
              <p style="margin: 5px 0;">👤 <strong>Usuario:</strong> ${username}</p>
              <p style="margin: 5px 0;">🔑 <strong>Contraseña:</strong> ${plainPassword}</p>
            </div>

            <p>Por razones de seguridad, te recomendamos cambiar tu contraseña después de iniciar sesión por primera vez.</p>

            <div style="text-align: center;">
              <a href="${loginUrl}" class="button">Iniciar Sesión</a>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
            <p>&copy; ${new Date().getFullYear()} L.U.M.I.N. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✓ Email de bienvenida enviado:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error al enviar email de bienvenida:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Envía un correo de notificación cuando se crea una nueva prueba/muestra
 * @param {string} recipientEmail - Email del destinatario
 * @param {string} nombrePaciente - Nombre del paciente
 * @param {string} tipoExamen - Tipo de examen realizado
 * @param {string} observaciones - Observaciones (opcional)
 * @returns {Promise<Object>}
 */
const sendTestNotificationEmail = async (recipientEmail, nombrePaciente, tipoExamen, observaciones) => {
  try {
    // Verificar conexión antes de intentar enviar
    const isConnected = await verifyConnection();
    if (!isConnected) {
      console.warn('⚠️ No hay conexión SMTP, omitiendo envío de email de notificación');
      return { success: false, error: 'No SMTP connection' };
    }

    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to: recipientEmail,
      subject: '🔬 Nueva Prueba Registrada - L.U.M.I.N.',
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; padding: 20px 0; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 10px 10px 0 0; color: white; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
          .test-box { background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .button { display: inline-block; padding: 12px 30px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <svg width="180" height="80" viewBox="0 0 1024 200" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 10px;">
              <!-- Cruz médica -->
              <g transform="translate(50, 30)">
                <path d="M 60 0 L 90 0 L 90 50 L 140 50 L 140 80 L 90 80 L 90 130 L 60 130 L 60 80 L 10 80 L 10 50 L 60 50 Z" 
                      fill="none" stroke="white" stroke-width="8"/>
                <!-- Estrella/átomo dentro -->
                <circle cx="75" cy="65" r="3" fill="white"/>
                <path d="M 75 50 L 85 70 L 65 70 Z M 60 65 L 80 75 L 80 55 Z M 90 65 L 70 75 L 70 55 Z M 75 80 L 85 60 L 65 60 Z" 
                      fill="none" stroke="white" stroke-width="2"/>
              </g>
              <!-- Texto L.U.M.I.N. -->
              <text x="200" y="100" font-family="Arial, sans-serif" font-size="60" font-weight="bold" fill="white" letter-spacing="8">
                L.U.M.I.N.
              </text>
            </svg>
            <h2 style="margin: 0; font-size: 24px; font-weight: 600;">🔬 Nueva Prueba Registrada</h2>
          </div>

          <!-- Content -->
          <div class="content">
            <p>Hola <strong>${nombrePaciente}</strong>,</p>
            <p>Te informamos que se ha registrado una nueva prueba a tu nombre.</p>

            <div class="test-box">
              <p><strong>🧪 Tipo de Examen:</strong> ${tipoExamen}</p>
              ${observaciones ? `<p><strong>📝 Observaciones:</strong> ${observaciones}</p>` : ''}
              <p><strong>📅 Fecha:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
            </div>

            <div style="text-align: center;">
              <a href="http://localhost:3000/login" class="button">Ver Mis Muestras</a>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
            <p>&copy; ${new Date().getFullYear()} L.U.M.I.N. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✓ Email de notificación de prueba enviado:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error al enviar email de notificación de prueba:', error);
    return { success: false, error: error.message };
  }
};



module.exports = {
  sendUserCredentialsEmail,
  sendTestNotificationEmail
};
