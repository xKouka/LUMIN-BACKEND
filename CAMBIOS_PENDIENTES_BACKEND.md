# Cambios Pendientes en Backend - Eliminar Sistema de Estados

## ⚠️ Cambios Manuales Requeridos

Debido a la complejidad de los archivos, estos cambios deben hacerse manualmente:

---

## 1. `controllers/muestrasController.js`

### Línea 132-136: Crear Muestra
**Cambiar:**
```javascript
const muestraResult = await client.query(
  `INSERT INTO muestras (paciente_id, registrado_por, observaciones, estado)
   VALUES ($1, $2, $3, 'pendiente')
   RETURNING *`,
  [paciente_id, registrado_por, observaciones]
);
```

**Por:**
```javascript
const muestraResult = await client.query(
  `INSERT INTO muestras (paciente_id, registrado_por, observaciones)
   VALUES ($1, $2, $3)
   RETURNING *`,
  [paciente_id, registrado_por, observaciones]
);
```

### Línea 207-240: Actualizar Muestra
**Eliminar** todo el bloque de construcción dinámica de query y **reemplazar** por:
```javascript
const { observaciones, detalles } = req.body;

await client.query('BEGIN');

// 1. Actualizar muestra principal
let muestraActualizada;
if (observaciones !== undefined) {
  const result = await client.query(
    `UPDATE muestras SET observaciones = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
    [observaciones, id]
  );
  muestraActualizada = result.rows[0];
}
```

### Línea 265-290: Notificaciones de Estado
**Eliminar** completamente este bloque:
```javascript
// Enviar notificación de cambio de estado si corresponde
if (estado && (estado === 'en_proceso' || estado === 'completado')) {
  // ... todo el bloque
}
```

---

## 2. `services/emailService.js`

### Eliminar función `sendStatusUpdateEmail`
**Buscar y eliminar** la función completa (líneas ~207-315):
```javascript
const sendStatusUpdateEmail = async (recipientEmail, nombre, estado, idMuestra) => {
  // ... toda la función
};
```

### Actualizar exports
**Cambiar:**
```javascript
module.exports = {
  sendTestNotificationEmail,
  sendStatusUpdateEmail  // ← ELIMINAR ESTA LÍNEA
};
```

**Por:**
```javascript
module.exports = {
  sendTestNotificationEmail
};
```

---

## 3. `controllers/pdfController.js`

### Buscar línea que muestra estado en PDF
**Buscar** (aproximadamente línea 145):
```javascript
doc.text(`Estado: ${muestra.estado.toUpperCase()}`, rightX, y);
```

**Eliminar** esa línea completa.

---

## 4. Base de Datos

### Ejecutar migración SQL
```bash
cd BACKEND
psql -U postgres -d clinica_blanca_trinidad -f database/migrations/001_remove_estado_column.sql
```

O desde pgAdmin/DBeaver, ejecutar el contenido del archivo:
`database/migrations/001_remove_estado_column.sql`

---

## ✅ Verificación

Después de hacer los cambios:

1. **Reiniciar backend:**
   ```bash
   cd BACKEND
   npm run dev
   ```

2. **Probar crear muestra** - No debe fallar por falta de columna `estado`

3. **Probar actualizar muestra** - No debe intentar actualizar `estado`

4. **Verificar que NO se envían emails** de cambio de estado

---

## 📝 Resumen de Archivos a Modificar

- ✅ `database/migrations/001_remove_estado_column.sql` - **CREADO**
- ⏳ `controllers/muestrasController.js` - **PENDIENTE** (3 cambios)
- ⏳ `services/emailService.js` - **PENDIENTE** (eliminar función)
- ⏳ `controllers/pdfController.js` - **PENDIENTE** (1 línea)
