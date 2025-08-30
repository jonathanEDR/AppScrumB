const https = require('https');
const http = require('http');

// Configuración
const isProduction = process.env.NODE_ENV === 'production';
const baseURL = isProduction
  ? 'https://appscrum-backend.onrender.com'
  : 'http://localhost:5000';

console.log(`🔍 Probando conectividad con: ${baseURL}`);
console.log(`🌍 Ambiente: ${isProduction ? 'Producción' : 'Desarrollo'}`);

const endpoints = [
  { path: '/', description: 'Root endpoint' },
  { path: '/api/health', description: 'Health check' },
  { path: '/health', description: 'Health check (alternative)' },
  { path: '/api/test', description: 'Test endpoint' },
  { path: '/api/diagnostic', description: 'Diagnostic endpoint' }
];

// Función para hacer peticiones HTTP
const makeRequest = (url) => {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const req = protocol.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            data: jsonData,
            headers: res.headers
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            data: data,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout after 10 seconds'));
    });
  });
};

// Función principal de prueba
const runTests = async () => {
  const results = [];

  for (const endpoint of endpoints) {
    try {
      console.log(`🔄 Probando ${endpoint.description} (${endpoint.path})...`);

      const startTime = Date.now();
      const response = await makeRequest(`${baseURL}${endpoint.path}`);
      const endTime = Date.now();

      const result = {
        endpoint: endpoint.path,
        description: endpoint.description,
        status: response.status,
        statusText: response.statusText,
        responseTime: `${endTime - startTime}ms`,
        success: response.status >= 200 && response.status < 300
      };

      results.push(result);

      if (result.success) {
        console.log(`✅ ${endpoint.description}: ${response.status} (${endTime - startTime}ms)`);
        if (response.data && typeof response.data === 'object') {
          console.log(`   📄 Respuesta:`, JSON.stringify(response.data, null, 2));
        }
      } else {
        console.log(`❌ ${endpoint.description}: ${response.status} ${response.statusText}`);
        if (response.data) {
          console.log(`   📄 Error:`, response.data);
        }
      }

    } catch (error) {
      console.log(`❌ ${endpoint.description}: Error - ${error.message}`);
      results.push({
        endpoint: endpoint.path,
        description: endpoint.description,
        error: error.message,
        success: false
      });
    }
  }

  // Resumen
  console.log('\n📊 RESUMEN DE PRUEBAS:');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`✅ Exitosos: ${successful}`);
  console.log(`❌ Fallidos: ${failed}`);

  if (failed > 0) {
    console.log('\n⚠️ ENDPOINTS CON PROBLEMAS:');
    results.filter(r => !r.success).forEach(result => {
      console.log(`  - ${result.endpoint}: ${result.statusText || result.error}`);
    });

    console.log('\n💡 SUGERENCIAS DE SOLUCIÓN:');
    console.log('  1. Verificar que el backend esté ejecutándose en Render');
    console.log('  2. Comprobar las variables de entorno en Render');
    console.log('  3. Revisar los logs del servidor en el dashboard de Render');
    console.log('  4. Verificar la configuración de CORS');
    console.log('  5. Asegurarse de que el puerto esté configurado correctamente');
  } else {
    console.log('\n🎉 TODOS LOS ENDPOINTS ESTÁN FUNCIONANDO CORRECTAMENTE!');
  }

  return results;
};

// Ejecutar pruebas
runTests().catch(error => {
  console.error('❌ Error ejecutando pruebas:', error.message);
  process.exit(1);
});
