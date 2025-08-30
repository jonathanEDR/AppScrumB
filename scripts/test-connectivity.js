#!/usr/bin/env node

/**
 * Script para probar la conectividad con el backend
 */

async function testBackendConnectivity() {
  const backendUrl = 'https://appscrum-backend.onrender.com';

  console.log('🔍 Probando conectividad con el backend...\n');

  try {
    // Probar endpoint de health si existe
    console.log('📡 Probando endpoint de health...');
    const healthResponse = await fetch(`${backendUrl}/health`);
    console.log(`   Status: ${healthResponse.status}`);

    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log(`   ✅ Respuesta:`, healthData);
    } else {
      console.log(`   ⚠️  Health endpoint no disponible`);
    }
  } catch (error) {
    console.log(`   ❌ Error conectando a health: ${error.message}`);
  }

  try {
    // Probar endpoint raíz
    console.log('\n📡 Probando endpoint raíz...');
    const rootResponse = await fetch(backendUrl);
    console.log(`   Status: ${rootResponse.status}`);

    if (rootResponse.ok) {
      console.log(`   ✅ Backend responde correctamente`);
    } else {
      console.log(`   ❌ Backend no responde: ${rootResponse.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Error conectando al backend: ${error.message}`);
  }

  try {
    // Probar endpoint de test sin autenticación
    console.log('\n📡 Probando endpoint de test...');
    const testResponse = await fetch(`${backendUrl}/api/test`);
    console.log(`   Status: ${testResponse.status}`);

    if (testResponse.ok) {
      const testData = await testResponse.json();
      console.log(`   ✅ Test endpoint funciona:`, testData);
    } else {
      console.log(`   ❌ Test endpoint no funciona: ${testResponse.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Error conectando a test: ${error.message}`);
  }

  console.log('\n💡 Recomendaciones:');
  console.log('1. Verifica que el backend esté desplegado en Render');
  console.log('2. Revisa los logs de Render para errores');
  console.log('3. Verifica las variables de entorno en Render');
  console.log('4. Confirma que MongoDB Atlas esté accesible');
  console.log('5. Revisa la configuración de CORS');
}

// Ejecutar prueba
testBackendConnectivity().catch(console.error);
