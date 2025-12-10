const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

// Generar PDF usando HTML + Puppeteer
const generarPDF = async (req, res) => {
  let browser;
  try {
    const { id } = req.params;
    console.log(`🔍 Generando PDF (HTML) para muestra ID: ${id}`);

    // 1. Obtener datos de la muestra solicitada y paciente
    const muestraResult = await pool.query(
      `SELECT m.*, p.nombre as paciente_nombre, p.cedula, p.telefono, 
              p.fecha_nacimiento, p.genero, p.id as paciente_id
       FROM muestras m 
       JOIN pacientes p ON m.paciente_id = p.id 
       WHERE m.id = $1`,
      [id]
    );

    if (muestraResult.rows.length === 0) {
      return res.status(404).json({ error: 'Muestra no encontrada' });
    }

    const muestra = muestraResult.rows[0];

    // 2. Obtener detalles de la muestra específica
    const detallesResult = await pool.query(
      `SELECT dm.*, m.id as muestra_id, m.fecha_toma
       FROM detalle_muestras dm
       JOIN muestras m ON dm.muestra_id = m.id
       WHERE m.id = $1
       ORDER BY dm.tipo_muestra`,
      [id]
    );

    const detalles = detallesResult.rows;

    if (detalles.length === 0) {
      return res.status(400).json({ error: 'No hay datos de muestras para generar el PDF' });
    }

    // 3. Preparar Template
    // Vercel path resolution fix: usar process.cwd()
    const templatePath = path.join(process.cwd(), 'templates', 'reporte.html');
    console.log(`📂 Intentando leer template desde: ${templatePath}`);

    if (!fs.existsSync(templatePath)) {
      console.error(`❌ Template no encontrado en: ${templatePath}`);
      return res.status(500).json({ error: 'Template HTML no encontrado en el servidor' });
    }

    let html = fs.readFileSync(templatePath, 'utf8');

    // 4. Cargar Logo en Base64
    const logoPath = path.join(process.cwd(), 'logo-laboratorio.png');
    console.log(`📂 Intentando leer logo desde: ${logoPath}`);

    let logoBase64 = '';
    if (fs.existsSync(logoPath)) {
      const logoData = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoData.toString('base64')}`;
    } else {
      console.warn(`⚠️ Logo no encontrado en: ${logoPath}`);
    }

    // 5. Reemplazar Datos Generales
    html = html.replace('{{LOGO_BASE64}}', logoBase64)
      .replace('{{PACIENTE_NOMBRE}}', muestra.paciente_nombre)
      .replace('{{CEDULA}}', muestra.cedula)
      .replace('{{ORDEN_ID}}', `Orden #${muestra.id}`)
      .replace('{{FECHA}}', new Date(muestra.fecha_toma).toLocaleDateString('es-ES'))
      .replace('{{FECHA_GENERACION}}', new Date().toLocaleString('es-ES'));

    // 6. Generar Contenido de Tablas
    let contenidoHtml = '';

    // Título de la muestra
    contenidoHtml += '<h3 style="margin-top: 20px; color: #2563eb;">Muestra #' + muestra.id + ' - ' + new Date(muestra.fecha_toma).toLocaleDateString('es-ES') + '</h3>';

    if (muestra.observaciones) {
      contenidoHtml += '<p style="font-size: 11px; color: #6b7280; font-style: italic;">' + muestra.observaciones + '</p>';
    }

    detalles.forEach(detalle => {
      contenidoHtml += generarSeccionHTML(detalle);
    });

    html = html.replace('{{CONTENT}}', contenidoHtml);

    // 7. Lanzar Browser (Condicional)
    if (process.env.NODE_ENV === 'production') {
      // Configuración para Vercel (AWS Lambda)
      const chromium = require('@sparticuz/chromium');
      const puppeteerCore = require('puppeteer-core');

      chromium.setHeadlessMode = true;
      chromium.setGraphicsMode = false;

      browser = await puppeteerCore.launch({
        args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      // Configuración local: require dinámico importado solo aquí
      const puppeteer = require('puppeteer');
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }

    const page = await browser.newPage();

    // Cargar contenido HTML
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Generar PDF
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      landscape: true,
      printBackground: true,
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      },
      displayHeaderFooter: false
    });

    await browser.close();

    // 8. Enviar Respuesta
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte_${muestra.paciente_nombre.replace(/\s+/g, '_')}.pdf`);
    res.send(pdfBuffer);

    console.log('✅ PDF generado correctamente');

  } catch (error) {
    if (browser) await browser.close();
    console.error('❌ Error al generar PDF:', error);
    res.status(500).json({ error: 'Error al generar PDF: ' + error.message, stack: error.stack });
  }
};

// Helper para generar HTML de cada sección
function generarSeccionHTML(detalle) {
  let html = `<div class="section">`;

  // Título
  let titulo = '';
  switch (detalle.tipo_muestra) {
    case 'sangre': titulo = 'HEMATOLOGÍA COMPLETA'; break;
    case 'orina': titulo = 'UROANÁLISIS'; break;
    case 'heces': titulo = 'COPROLÓGICO'; break;
    default: titulo = detalle.tipo_muestra.toUpperCase();
  }
  html += `<div class="section-title">${titulo}</div>`;

  // Tabla
  html += `<table>
    <thead>
      <tr>
        <th style="width: 35%">Parámetro</th>
        <th style="width: 20%">Resultado</th>
        <th style="width: 15%">Unidad</th>
        <th style="width: 30%">Valores de Referencia</th>
      </tr>
    </thead>
    <tbody>`;

  const resultados = detalle.resultados || {};
  const filas = obtenerFilasPorTipo(detalle.tipo_muestra, resultados);

  filas.forEach(fila => {
    html += `<tr>
      <td>${fila.param}</td>
      <td>${fila.valor !== undefined && fila.valor !== null && fila.valor !== '' ? fila.valor : '-'}</td>
      <td>${fila.unidad || '-'}</td>
      <td>${fila.referencia || '-'}</td>
    </tr>`;
  });

  html += `</tbody></table>`;

  // Observaciones
  if (detalle.observaciones) {
    html += `<div class="observations">
      <h4>Observaciones:</h4>
      <p>${detalle.observaciones}</p>
    </div>`;
  }

  html += `</div>`;
  return html;
}

// Helper para definir las filas según el tipo de muestra
function obtenerFilasPorTipo(tipo, resultados) {
  switch (tipo) {
    case 'sangre':
      return [
        { param: 'Hemoglobina', valor: resultados.hemoglobina, unidad: 'g/dL', referencia: '12.0 - 18.0' },
        { param: 'Hematocrito', valor: resultados.hematocrito, unidad: '%', referencia: '36.0 - 52.0' },
        { param: 'Leucocitos', valor: resultados.leucocitos, unidad: '/mm³', referencia: '4,000 - 11,000' },
        { param: 'Plaquetas', valor: resultados.plaquetas, unidad: '/mm³', referencia: '150,000 - 400,000' },
        { param: 'Glucosa', valor: resultados.glucosa, unidad: 'mg/dL', referencia: '70 - 100' },
        { param: 'VCM', valor: resultados.vcm, unidad: 'fL', referencia: '80 - 100' },
        { param: 'HCM', valor: resultados.hcm, unidad: 'pg', referencia: '27 - 31' },
        { param: 'CHCM', valor: resultados.chcm, unidad: 'g/dL', referencia: '32 - 36' },
      ];
    case 'orina':
      return [
        { param: 'Color', valor: resultados.color, unidad: '-', referencia: 'Amarillo claro' },
        { param: 'Aspecto', valor: resultados.aspecto, unidad: '-', referencia: 'Transparente' },
        { param: 'pH', valor: resultados.ph, unidad: '-', referencia: '4.5 - 8.0' },
        { param: 'Densidad', valor: resultados.densidad, unidad: '-', referencia: '1.003 - 1.030' },
        { param: 'Glucosa', valor: resultados.glucosa, unidad: '-', referencia: 'Negativo' },
        { param: 'Proteínas', valor: resultados.proteinas, unidad: '-', referencia: 'Negativo' },
        { param: 'Sangre', valor: resultados.sangre, unidad: '-', referencia: 'Negativo' },
        { param: 'Leucocitos', valor: resultados.leucocitos, unidad: '/campo', referencia: '0 - 5' },
        { param: 'Bacterias', valor: resultados.bacterias, unidad: '-', referencia: 'Negativo' },
        { param: 'Cristales', valor: resultados.cristales, unidad: '-', referencia: 'Negativo' },
      ];
    case 'heces':
      return [
        { param: 'Consistencia', valor: resultados.consistencia, unidad: '-', referencia: 'Sólida/Blanda' },
        { param: 'Color', valor: resultados.color, unidad: '-', referencia: 'Marrón' },
        { param: 'pH', valor: resultados.ph, unidad: '-', referencia: '6.0 - 7.5' },
        { param: 'Sangre oculta', valor: resultados.sangre_oculta, unidad: '-', referencia: 'Negativo' },
        { param: 'Parásitos', valor: resultados.parasitos, unidad: '-', referencia: 'Negativo' },
        { param: 'Leucocitos', valor: resultados.leucocitos, unidad: '/campo', referencia: '0 - 3' },
        { param: 'Moco', valor: resultados.moco, unidad: '-', referencia: 'Negativo' },
        { param: 'Restos alimenticios', valor: resultados.restos_alimenticios, unidad: '-', referencia: 'Normal' },
      ];
    default:
      return [];
  }
}

module.exports = {
  generarPDF
};
