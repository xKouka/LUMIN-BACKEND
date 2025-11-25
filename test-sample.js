// Script de prueba para crear una muestra con múltiples tipos
const pool = require('./config/database');

async function testCreateSample() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Iniciando prueba de creación de muestra...\n');
    
    // 1. Buscar un paciente existente
    const pacientes = await client.query('SELECT id, nombre FROM pacientes LIMIT 1');
    
    if (pacientes.rows.length === 0) {
      console.log('❌ No hay pacientes en la base de datos');
      return;
    }
    
    const paciente = pacientes.rows[0];
    console.log(`✓ Paciente encontrado: ${paciente.nombre} (ID: ${paciente.id})\n`);
    
    // 2. Buscar un usuario admin
    const admin = await client.query('SELECT id FROM usuarios WHERE rol = $1 LIMIT 1', ['admin']);
    
    if (admin.rows.length === 0) {
      console.log('❌ No hay usuarios administradores');
      return;
    }
    
    const adminId = admin.rows[0].id;
    console.log(`✓ Admin encontrado (ID: ${adminId})\n`);
    
    // 3. Crear muestra principal
    await client.query('BEGIN');
    
    const muestra = await client.query(
      'INSERT INTO muestras (paciente_id, observaciones, registrado_por) VALUES ($1, $2, $3) RETURNING *',
      [paciente.id, 'Prueba de sistema avanzado de muestras', adminId]
    );
    
    const muestraId = muestra.rows[0].id;
    console.log(`✓ Muestra creada (ID: ${muestraId})\n`);
    
    // 4. Agregar detalle de sangre
    const sangre = await client.query(
      'INSERT INTO detalle_muestras (muestra_id, tipo_muestra, resultados) VALUES ($1, $2, $3) RETURNING *',
      [muestraId, 'sangre', JSON.stringify({
        hemoglobina: 14.5,
        hematocrito: 42,
        leucocitos: 7500,
        plaquetas: 250000,
        glucosa: 95,
        vcm: 85,
        hcm: 28,
        chcm: 33
      })]
    );
    console.log('✓ Detalle de sangre agregado');
    
    // 5. Agregar detalle de orina
    const orina = await client.query(
      'INSERT INTO detalle_muestras (muestra_id, tipo_muestra, resultados) VALUES ($1, $2, $3) RETURNING *',
      [muestraId, 'orina', JSON.stringify({
        color: 'Amarillo',
        aspecto: 'Claro',
        ph: 6.0,
        densidad: 1.020,
        glucosa: 'Negativo',
        proteinas: 'Trazas',
        sangre: 'Negativo',
        leucocitos: '5-10',
        bacterias: 'Moderadas',
        cristales: 'Ninguno'
      })]
    );
    console.log('✓ Detalle de orina agregado');
    
    // 6. Agregar detalle de heces
    const heces = await client.query(
      'INSERT INTO detalle_muestras (muestra_id, tipo_muestra, resultados) VALUES ($1, $2, $3) RETURNING *',
      [muestraId, 'heces', JSON.stringify({
        consistencia: 'Normal',
        color: 'Marrón',
        ph: 7.0,
        sangre_oculta: 'Negativo',
        parasitos: 'No se observan',
        leucocitos: 'Negativos',
        moco: 'Ausente',
        restos_alimenticios: 'No'
      })]
    );
    console.log('✓ Detalle de heces agregado\n');
    
    await client.query('COMMIT');
    
    // 7. Verificar la muestra creada
    const verificacion = await client.query(`
      SELECT m.*, 
             json_agg(json_build_object('tipo', dm.tipo_muestra, 'id', dm.id)) as detalles
      FROM muestras m
      LEFT JOIN detalle_muestras dm ON m.id = dm.muestra_id
      WHERE m.id = $1
      GROUP BY m.id
    `, [muestraId]);
    
    console.log('📋 Muestra creada exitosamente:');
    console.log(JSON.stringify(verificacion.rows[0], null, 2));
    console.log(`\n✅ Prueba exitosa! Muestra ID: ${muestraId}`);
    console.log(`\n🔗 Puedes generar el PDF llamando a: GET /muestras/${muestraId}/pdf`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    client.release();
    process.exit(0);
  }
}

testCreateSample();
