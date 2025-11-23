/**
 * Script para probar la eliminación de archivos en Cloudinary
 */

const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function testCloudinaryOperations() {
  try {
    console.log('\n🧪 Testing Cloudinary Operations\n');
    
    // 1. Listar archivos
    console.log('📋 Listing files...');
    const imagesResult = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'appscrum',
      max_results: 10,
      resource_type: 'image'
    });
    
    const rawResult = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'appscrum',
      max_results: 10,
      resource_type: 'raw'
    });

    console.log(`   Images found: ${imagesResult.resources.length}`);
    console.log(`   Raw files found: ${rawResult.resources.length}`);
    
    // Mostrar primeros archivos
    console.log('\n📁 Files in Cloudinary:');
    imagesResult.resources.forEach((resource, i) => {
      console.log(`   ${i + 1}. [IMAGE] ${resource.public_id} (${resource.format})`);
    });
    rawResult.resources.forEach((resource, i) => {
      console.log(`   ${i + 1 + imagesResult.resources.length}. [RAW] ${resource.public_id}`);
    });

    // 2. Probar eliminación (comentado por seguridad)
    /*
    if (imagesResult.resources.length > 0) {
      const testPublicId = imagesResult.resources[0].public_id;
      console.log(`\n🗑️ Testing deletion of: ${testPublicId}`);
      
      const deleteResult = await cloudinary.uploader.destroy(testPublicId, {
        resource_type: 'image',
        invalidate: true
      });
      
      console.log('   Delete result:', deleteResult);
    }
    */

    console.log('\n✅ Test completed');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.http_code) {
      console.error('   HTTP Code:', error.http_code);
    }
  }
}

// Ejecutar test
testCloudinaryOperations();
