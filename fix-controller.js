const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'controllers', 'muestrasController.js');
let content = fs.readFileSync(filePath, 'utf8');

// Reemplazar la línea problemática para usar NULL en lugar de ID 1
content = content.replace(
    /const registrado_por = req\.user\?\.id \|\| 1; \/\/ TEMPORAL: fallback para desarrollo/,
    'const registrado_por = req.user?.id || null; // TEMPORAL: NULL si no hay usuario autenticado'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Archivo actualizado correctamente - usando NULL como fallback');
