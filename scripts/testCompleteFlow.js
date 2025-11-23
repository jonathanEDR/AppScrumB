/**
 * Script para probar el flujo completo de Cloudinary
 * Sube una imagen de prueba y verifica que se guarde correctamente
 */

require('dotenv').config();
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function testCompleteFlow() {
  try {
    console.log('\n🧪 Test completo del flujo de Cloudinary\n');

    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    // 1. Verificar estado actual
    console.log('📊 PASO 1: Verificando estado actual');
    console.log('─'.repeat(80));
    
    const [imageResults, rawResults] = await Promise.all([
      cloudinary.api.resources({ 
        type: 'upload', 
        prefix: 'appscrum/',
        resource_type: 'image',
        max_results: 500
      }),
      cloudinary.api.resources({ 
        type: 'upload', 
        prefix: 'appscrum/',
        resource_type: 'raw',
        max_results: 500
      })
    ]);

    const currentFiles = [
      ...imageResults.resources,
      ...rawResults.resources
    ];

    console.log(`Total archivos en Cloudinary: ${currentFiles.length}`);
    
    if (currentFiles.length > 0) {
      console.log('\n⚠️  Archivos encontrados:');
      currentFiles.forEach((file, idx) => {
        console.log(`${idx + 1}. ${file.public_id}`);
        console.log(`   URL: ${file.secure_url}\n`);
      });
    } else {
      console.log('✅ Cloudinary está limpio (0 archivos)\n');
    }

    // 2. Crear imagen de prueba
    console.log('📊 PASO 2: Creando imagen de prueba');
    console.log('─'.repeat(80));

    const testImagePath = path.join(__dirname, 'test-image.txt');
    fs.writeFileSync(testImagePath, 'TEST IMAGE CONTENT - ' + new Date().toISOString());
    console.log('✅ Archivo de prueba creado\n');

    // 3. Subir a Cloudinary
    console.log('📊 PASO 3: Subiendo a Cloudinary');
    console.log('─'.repeat(80));

    const uploadResult = await cloudinary.uploader.upload(testImagePath, {
      folder: 'appscrum/test',
      resource_type: 'raw',
      public_id: `test-${Date.now()}`
    });

    console.log('✅ Subida exitosa:');
    console.log(`   Public ID: ${uploadResult.public_id}`);
    console.log(`   URL: ${uploadResult.secure_url}`);
    console.log(`   Format: ${uploadResult.format}`);
    console.log(`   Size: ${uploadResult.bytes} bytes\n`);

    // 4. Verificar que aparece en listado
    console.log('📊 PASO 4: Verificando listado');
    console.log('─'.repeat(80));

    const verifyResults = await cloudinary.api.resources({ 
      type: 'upload', 
      prefix: 'appscrum/test',
      resource_type: 'raw',
      max_results: 10
    });

    console.log(`Archivos encontrados: ${verifyResults.resources.length}`);
    verifyResults.resources.forEach((file, idx) => {
      console.log(`${idx + 1}. ${file.public_id}`);
    });
    console.log('');

    // 5. Eliminar archivo de prueba
    console.log('📊 PASO 5: Eliminando archivo de prueba');
    console.log('─'.repeat(80));

    const deleteResult = await cloudinary.uploader.destroy(uploadResult.public_id, {
      resource_type: 'raw',
      invalidate: true
    });

    console.log('✅ Eliminación exitosa:', deleteResult.result);
    console.log('');

    // 6. Verificar eliminación
    console.log('📊 PASO 6: Verificando eliminación');
    console.log('─'.repeat(80));

    const finalVerify = await cloudinary.api.resources({ 
      type: 'upload', 
      prefix: 'appscrum/',
      resource_type: 'raw',
      max_results: 10
    });

    console.log(`Archivos restantes: ${finalVerify.resources.length}`);
    if (finalVerify.resources.length > 0) {
      finalVerify.resources.forEach((file, idx) => {
        console.log(`${idx + 1}. ${file.public_id}`);
      });
    }
    console.log('');

    // Limpiar archivo temporal
    fs.unlinkSync(testImagePath);

    console.log('═'.repeat(80));
    console.log('✅ Test completado exitosamente');
    console.log('═'.repeat(80) + '\n');

    await mongoose.connection.close();
    console.log('🔌 Conexión a MongoDB cerrada\n');

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
  }
}

testCompleteFlow();
