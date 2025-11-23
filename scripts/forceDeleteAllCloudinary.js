/**
 * Script para FORZAR la eliminación de archivos en Cloudinary
 * Usa invalidate:true para limpiar el cache de CDN
 */

require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const readline = require('readline');

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function forceDeleteAll() {
  try {
    console.log('\n🗑️  ELIMINACIÓN FORZADA de archivos en Cloudinary\n');

    // 1. Listar todos los archivos
    console.log('📂 Listando archivos...\n');
    
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

    const allFiles = [
      ...imageResults.resources.map(r => ({ ...r, resource_type: 'image' })),
      ...rawResults.resources.map(r => ({ ...r, resource_type: 'raw' }))
    ];

    if (allFiles.length === 0) {
      console.log('✅ No hay archivos en Cloudinary\n');
      rl.close();
      return;
    }

    console.log(`Total archivos encontrados: ${allFiles.length}\n`);
    console.log('═'.repeat(80));
    
    allFiles.forEach((file, idx) => {
      console.log(`\n${idx + 1}. [${file.resource_type.toUpperCase()}] ${file.public_id}`);
      console.log(`   URL: ${file.secure_url}`);
      console.log(`   Tamaño: ${(file.bytes / 1024).toFixed(2)} KB`);
    });

    console.log('\n' + '═'.repeat(80));

    // 2. Confirmar eliminación
    const answer = await question(
      `\n⚠️  ¿ELIMINAR TODOS estos ${allFiles.length} archivos? (si/no): `
    );

    if (answer.toLowerCase() !== 'si' && answer.toLowerCase() !== 's') {
      console.log('\n❌ Operación cancelada\n');
      rl.close();
      return;
    }

    console.log('\n🔄 FORZANDO eliminación con invalidate=true...\n');

    // 3. Eliminar con invalidate
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const file of allFiles) {
      try {
        const result = await cloudinary.uploader.destroy(file.public_id, {
          resource_type: file.resource_type,
          invalidate: true // ⚡ Fuerza limpieza de cache de CDN
        });
        
        if (result.result === 'ok' || result.result === 'not found') {
          console.log(`✅ ${file.public_id} → ${result.result}`);
          successCount++;
        } else {
          console.log(`⚠️  ${file.public_id} → ${result.result}`);
          errors.push({ file: file.public_id, result: result.result });
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ ${file.public_id} → ERROR: ${error.message}`);
        errors.push({ file: file.public_id, error: error.message });
        errorCount++;
      }

      // Pequeño delay para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n' + '═'.repeat(80));
    console.log(`\n📊 Resumen final:`);
    console.log(`   ✅ Exitosos: ${successCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log(`\n❌ Detalles de errores:`);
      errors.forEach(err => {
        console.log(`   - ${err.file}: ${err.result || err.error}`);
      });
    }

    // 4. Verificación final
    console.log('\n🔍 Verificación final...\n');

    const [finalImages, finalRaw] = await Promise.all([
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

    const finalFiles = [
      ...finalImages.resources,
      ...finalRaw.resources
    ];

    console.log(`📂 Archivos restantes: ${finalFiles.length}`);
    
    if (finalFiles.length > 0) {
      console.log('\n⚠️  Archivos que NO se eliminaron:');
      finalFiles.forEach((file, idx) => {
        console.log(`${idx + 1}. ${file.public_id}`);
      });
      console.log('\n💡 Puede tomar hasta 10 minutos para que se propaguen los cambios en el CDN de Cloudinary.');
    } else {
      console.log('✅ Cloudinary está completamente limpio');
    }

    console.log('\n' + '═'.repeat(80) + '\n');

    rl.close();

  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    rl.close();
  }
}

forceDeleteAll();
