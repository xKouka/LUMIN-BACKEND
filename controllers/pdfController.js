const PDFDocument = require('pdfkit');
const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

// Generar PDF de la muestra EN LANDSCAPE
const generarPDF = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Generando PDF para muestra ID: ${id}`);

    // Obtener datos completos de la muestra - SIN email ni direccion
    const muestraResult = await pool.query(
      `SELECT m.*, p.nombre as paciente_nombre, p.cedula, p.telefono, 
              p.fecha_nacimiento, p.genero
       FROM muestras m 
       JOIN pacientes p ON m.paciente_id = p.id 
       WHERE m.id = $1`,
      [id]
    );

    if (muestraResult.rows.length === 0) {
      return res.status(404).json({ error: 'Muestra no encontrada' });
    }

    const muestra = muestraResult.rows[0];

    // Obtener detalles de las muestras
    const detallesResult = await pool.query(
      `SELECT * FROM detalle_muestras WHERE muestra_id = $1 ORDER BY tipo_muestra`,
      [id]
    );

    const detalles = detallesResult.rows;

    if (detalles.length === 0) {
      return res.status(400).json({ error: 'No hay datos de muestras para generar el PDF' });
    }

    console.log(`✅ Muestra encontrada. Detalles: ${detalles.length}`);

    // Crear documento PDF EN LANDSCAPE
    const doc = new PDFDocument({ 
      size: 'LETTER',
      layout: 'landscape', // ⭐ ORIENTACIÓN HORIZONTAL
      margin: 40,
      bufferPages: true
    });

    // Configurar headers para descarga
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte_${muestra.paciente_nombre.replace(/\s+/g, '_')}.pdf`);

    doc.pipe(res);

    // PÁGINA 1: PORTADA
    agregarPortada(doc, muestra, detalles);

    // PÁGINAS SIGUIENTES: Una por cada tipo de muestra
    detalles.forEach((detalle, index) => {
      doc.addPage(); // Nueva página para cada tipo de muestra
      
      switch(detalle.tipo_muestra) {
        case 'sangre':
          agregarPaginaSangre(doc, muestra, detalle);
          break;
        case 'orina':
          agregarPaginaOrina(doc, muestra, detalle);
          break;
        case 'heces':
          agregarPaginaHeces(doc, muestra, detalle);
          break;
        default:
          agregarPaginaGenerica(doc, muestra, detalle);
      }
    });

    // Finalizar PDF
    doc.end();
    console.log('✅ PDF generado correctamente');

  } catch (error) {
    console.error('❌ Error al generar PDF:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Error al generar PDF: ' + error.message });
  }
};

// Función para agregar portada EN LANDSCAPE
function agregarPortada(doc, muestra, detalles) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const centerX = pageWidth / 2;

  // Logo y título centrado
  doc.fontSize(32)
     .fillColor('#10b981')
     .text('L.U.M.I.N.', 0, 60, { width: pageWidth, align: 'center' });
  
  doc.fontSize(14)
     .fillColor('#6b7280')
     .text('Laboratorio Clínico Blanca Trinidad', 0, 100, { width: pageWidth, align: 'center' });

  // Línea separadora
  doc.moveTo(80, 130)
     .lineTo(pageWidth - 80, 130)
     .stroke('#e5e7eb');

  // Título del reporte
  doc.fontSize(24)
     .fillColor('#1f2937')
     .text('REPORTE DE RESULTADOS', 0, 160, { width: pageWidth, align: 'center' });

  doc.fontSize(16)
     .fillColor('#6b7280')
     .text(`Orden: #${muestra.id.toString().padStart(6, '0')}`, 0, 195, { width: pageWidth, align: 'center' });

  // Datos del paciente en dos columnas
  let leftX = 100;
  let rightX = centerX + 50;
  let y = 250;

  doc.fontSize(18)
     .fillColor('#1f2937')
     .text('DATOS DEL PACIENTE', leftX, y);

  y += 40;
  doc.fontSize(13).fillColor('#374151');

  doc.text(`Nombre: ${muestra.paciente_nombre}`, leftX, y);
  doc.text(`Cédula: ${muestra.cedula}`, rightX, y);
  
  y += 25;
  if (muestra.fecha_nacimiento) {
    const edad = calcularEdad(muestra.fecha_nacimiento);
    doc.text(`Edad: ${edad} años`, leftX, y);
  }
  
  if (muestra.genero) {
    doc.text(`Género: ${muestra.genero}`, rightX, y);
  }

  y += 25;
  doc.text(`Fecha de muestra: ${new Date(muestra.fecha_toma).toLocaleDateString('es-ES')}`, leftX, y);
  doc.text(`Estado: ${muestra.estado.toUpperCase()}`, rightX, y);

  // Tipos de muestras incluidas
  y += 60;
  doc.fontSize(16)
     .fillColor('#1f2937')
     .text('ANÁLISIS INCLUIDOS:', leftX, y);

  y += 35;
  doc.fontSize(13).fillColor('#374151');
  detalles.forEach((detalle) => {
    doc.circle(leftX, y + 7, 4).fill('#10b981');
    doc.fillColor('#374151')
       .text(detalle.tipo_muestra.charAt(0).toUpperCase() + detalle.tipo_muestra.slice(1), leftX + 15, y);
    y += 25;
  });

  // Observaciones generales
  if (muestra.observaciones) {
    y += 30;
    doc.fontSize(14)
       .fillColor('#1f2937')
       .text('OBSERVACIONES GENERALES:', leftX, y);
    
    y += 25;
    doc.fontSize(11)
       .fillColor('#374151')
       .text(muestra.observaciones, leftX, y, { width: pageWidth - 200, align: 'justify' });
  }

  // Footer
  doc.fontSize(10)
     .fillColor('#9ca3af')
     .text('© 2024 L.U.M.I.N. - Laboratorio Clínico Blanca Trinidad', 0, pageHeight - 40, { 
       width: pageWidth, 
       align: 'center' 
     });
}

// Función para agregar página de sangre EN LANDSCAPE
function agregarPaginaSangre(doc, muestra, detalle) {
  agregarHeader(doc, muestra, '🩸 ANÁLISIS DE SANGRE (HEMATOLOGÍA)');

  const resultados = detalle.resultados || {};
  let y = 150;

  // Tabla de resultados (3 columnas: Parámetro, Resultado, Unidad)
  const datos = [
    { param: 'Hemoglobina', valor: resultados.hemoglobina, unidad: 'g/dL' },
    { param: 'Hematocrito', valor: resultados.hematocrito, unidad: '%' },
    { param: 'Leucocitos', valor: resultados.leucocitos, unidad: '/mm³' },
    { param: 'Plaquetas', valor: resultados.plaquetas, unidad: '/mm³' },
    { param: 'Glucosa', valor: resultados.glucosa, unidad: 'mg/dL' },
    { param: 'VCM', valor: resultados.vcm, unidad: 'fL' },
    { param: 'HCM', valor: resultados.hcm, unidad: 'pg' },
    { param: 'CHCM', valor: resultados.chcm, unidad: 'g/dL' },
  ];

  dibujarTablaLandscape(doc, datos, y);

  // Observaciones específicas
  if (detalle.observaciones) {
    y = doc.page.height - 120;
    doc.fontSize(12)
       .fillColor('#1f2937')
       .text('Observaciones:', 60, y);
    
    doc.fontSize(10)
       .fillColor('#374151')
       .text(detalle.observaciones, 60, y + 20, { width: doc.page.width - 120 });
  }

  agregarFooter(doc);
}

// Función para agregar página de orina EN LANDSCAPE
function agregarPaginaOrina(doc, muestra, detalle) {
  agregarHeader(doc, muestra, '💧 UROANÁLISIS');

  const resultados = detalle.resultados || {};
  let y = 150;

  const datos = [
    { param: 'Color', valor: resultados.color, unidad: '-' },
    { param: 'Aspecto', valor: resultados.aspecto, unidad: '-' },
    { param: 'pH', valor: resultados.ph, unidad: '-' },
    { param: 'Densidad', valor: resultados.densidad, unidad: '-' },
    { param: 'Glucosa', valor: resultados.glucosa, unidad: '-' },
    { param: 'Proteínas', valor: resultados.proteinas, unidad: '-' },
    { param: 'Sangre', valor: resultados.sangre, unidad: '-' },
    { param: 'Leucocitos', valor: resultados.leucocitos, unidad: '/campo' },
    { param: 'Bacterias', valor: resultados.bacterias, unidad: '-' },
    { param: 'Cristales', valor: resultados.cristales, unidad: '-' },
  ];

  dibujarTablaLandscape(doc, datos, y);

  if (detalle.observaciones) {
    let y = doc.page.height - 120;
    doc.fontSize(12).fillColor('#1f2937').text('Observaciones:', 60, y);
    doc.fontSize(10).fillColor('#374151').text(detalle.observaciones, 60, y + 20, { width: doc.page.width - 120 });
  }

  agregarFooter(doc);
}

// Función para agregar página de heces EN LANDSCAPE
function agregarPaginaHeces(doc, muestra, detalle) {
  agregarHeader(doc, muestra, '🧻 COPROLÓGICO');

  const resultados = detalle.resultados || {};
  let y = 150;

  const datos = [
    { param: 'Consistencia', valor: resultados.consistencia, unidad: '-' },
    { param: 'Color', valor: resultados.color, unidad: '-' },
    { param: 'pH', valor: resultados.ph, unidad: '-' },
    { param: 'Sangre oculta', valor: resultados.sangre_oculta, unidad: '-' },
    { param: 'Parásitos', valor: resultados.parasitos, unidad: '-' },
    { param: 'Leucocitos', valor: resultados.leucocitos, unidad: '/campo' },
    { param: 'Moco', valor: resultados.moco, unidad: '-' },
    { param: 'Restos alimenticios', valor: resultados.restos_alimenticios, unidad: '-' },
  ];

  dibujarTablaLandscape(doc, datos, y);

  if (detalle.observaciones) {
    let y = doc.page.height - 120;
    doc.fontSize(12).fillColor('#1f2937').text('Observaciones:', 60, y);
    doc.fontSize(10).fillColor('#374151').text(detalle.observaciones, 60, y + 20, { width: doc.page.width - 120 });
  }

  agregarFooter(doc);
}

// Página genérica para otros tipos de muestra
function agregarPaginaGenerica(doc, muestra, detalle) {
  agregarHeader(doc, muestra, `ANÁLISIS: ${detalle.tipo_muestra.toUpperCase()}`);
  
  doc.fontSize(12)
     .fillColor('#374151')
     .text('Resultados disponibles en el sistema', 60, 200);
  
  agregarFooter(doc);
}

// Funciones auxiliares para LANDSCAPE
function agregarHeader(doc, muestra, titulo) {
  const pageWidth = doc.page.width;
  
  doc.fontSize(28)
     .fillColor('#10b981')
     .text('L.U.M.I.N.', 0, 30, { width: pageWidth, align: 'center' });
  
  doc.moveTo(60, 65).lineTo(pageWidth - 60, 65).stroke('#e5e7eb');

  doc.fontSize(18)
     .fillColor('#1f2937')
     .text(titulo, 0, 75, { width: pageWidth, align: 'center' });

  doc.fontSize(10)
     .fillColor('#6b7280')
     .text(`Paciente: ${muestra.paciente_nombre} | Orden: #${muestra.id.toString().padStart(6, '0')} | Fecha: ${new Date(muestra.fecha_toma).toLocaleDateString('es-ES')}`, 
           60, 105, { width: pageWidth - 120, align: 'center' });

  doc.moveTo(60, 125).lineTo(pageWidth - 60, 125).stroke('#e5e7eb');
}

function dibujarTablaLandscape(doc, datos, startY) {
  const colWidths = [250, 200, 150]; // Parámetro, Resultado, Unidad (3 columnas)
  const rowHeight = 28;
  let y = startY;
  const startX = 60;

  // Header de tabla
  doc.fontSize(11)
     .fillColor('#ffffff')
     .rect(startX, y, colWidths.reduce((a,b) => a+b), rowHeight)
     .fill('#10b981');

  doc.fillColor('#ffffff')
     .text('Parámetro', startX + 10, y + 9, { width: colWidths[0] - 20 })
     .text('Resultado', startX + colWidths[0] + 10, y + 9, { width: colWidths[1] - 20 })
     .text('Unidad', startX + colWidths[0] + colWidths[1] + 10, y + 9, { width: colWidths[2] - 20 });

  y += rowHeight;

  // Filas de datos
  datos.forEach((fila, index) => {
    const bgColor = index % 2 === 0 ? '#f9fafb' : '#ffffff';
    doc.rect(startX, y, colWidths.reduce((a,b) => a+b), rowHeight).fill(bgColor);

    doc.fontSize(10)
       .fillColor('#374151')
       .text(fila.param, startX + 10, y + 9, { width: colWidths[0] - 20 })
       .text(fila.valor !== undefined && fila.valor !== null && fila.valor !== '' ? String(fila.valor) : '-', 
             startX + colWidths[0] + 10, y + 9, { width: colWidths[1] - 20 })
       .text(fila.unidad || '-', startX + colWidths[0] + colWidths[1] + 10, y + 9, { width: colWidths[2] - 20 });

    // Bordes
    doc.rect(startX, y, colWidths.reduce((a,b) => a+b), rowHeight).stroke('#e5e7eb');

    y += rowHeight;
  });
}

function agregarFooter(doc) {
  const pageHeight = doc.page.height;
  const pageWidth = doc.page.width;
  
  doc.fontSize(9)
     .fillColor('#9ca3af')
     .text('Este documento fue generado electrónicamente por L.U.M.I.N. - Laboratorio Clínico Blanca Trinidad', 
           0, pageHeight - 30, { width: pageWidth, align: 'center' })
     .text(`Generado: ${new Date().toLocaleString('es-ES')}`, 
           0, pageHeight - 15, { width: pageWidth, align: 'center' });
}

function calcularEdad(fechaNacimiento) {
  const hoy = new Date();
  const cumpleanos = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - cumpleanos.getFullYear();
  const m = hoy.getMonth() - cumpleanos.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < cumpleanos.getDate())) {
    edad--;
  }
  return edad;
}

module.exports = {
  generarPDF
};
