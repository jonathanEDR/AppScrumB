/**
 * Script para eliminar archivos huérfanos de Cloudinary
 * (archivos sin referencia en MongoDB)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const BugReport = require('../models/BugReport');
const SystemConfig = require('../models/SystemConfig');
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

async function cleanOrphanFiles() {
  try {
    console.log('\n🧹 Limpieza de archivos huérfanos en Cloudinary\n');

    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    // 1. Obtener todos los archivos de Cloudinary
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

    const allCloudinaryFiles = [
      ...imageResults.resources.map(r => ({ ...r, resource_type: 'image' })),
      ...rawResults.resources.map(r => ({ ...r, resource_type: 'raw' }))
    ];

    console.log(`📂 Total archivos en Cloudinary: ${allCloudinaryFiles.length}\n`);

    // 2. Obtener referencias en MongoDB
    const bugReports = await BugReport.find({
      'attachments.0': { $exists: true }
    }).select('attachments');

    const systemConfig = await SystemConfig.findOne({ configId: 'main' });

    const allDbPublicIds = new Set();

    // Referencias en BugReports
    bugReports.forEach(bug => {
      bug.attachments.forEach(att => {
        const publicId = att.cloudinaryData?.publicId || att.publicId;
        if (publicId) allDbPublicIds.add(publicId);
      });
    });

    // Referencias en SystemConfig
    if (systemConfig) {
      if (systemConfig.branding?.logoPublicId) {
        allDbPublicIds.add(systemConfig.branding.logoPublicId);
      }
      if (systemConfig.branding?.logoSmallPublicId) {
        allDbPublicIds.add(systemConfig.branding.logoSmallPublicId);
      }
    }

    console.log(`📚 Total referencias en MongoDB: ${allDbPublicIds.size}\n`);

    // 3. Identificar archivos huérfanos
    const orphanFiles = allCloudinaryFiles.filter(file => 
      !allDbPublicIds.has(file.public_id)
    );

    if (orphanFiles.length === 0) {
      console.log('✅ No hay archivos huérfanos. Todo está sincronizado.\n');
      rl.close();
      await mongoose.connection.close();
      return;
    }

    console.log(`🗑️  Archivos HUÉRFANOS encontrados: ${orphanFiles.length}\n`);
    console.log('═'.repeat(80));
    
    orphanFiles.forEach((file, idx) => {
      const sizeKB = (file.bytes / 1024).toFixed(2);
      const date = new Date(file.created_at).toLocaleString();
      console.log(`\n${idx + 1}. [${file.resource_type.toUpperCase()}] ${file.public_id}`);
      console.log(`   📏 Tamaño: ${sizeKB} KB`);
      console.log(`   📅 Creado: ${date}`);
    });

    console.log('\n' + '═'.repeat(80));

    // 4. Confirmar eliminación
    const answer = await question(
      `\n⚠️  ¿Deseas eliminar estos ${orphanFiles.length} archivos huérfanos? (si/no): `
    );

    if (answer.toLowerCase() !== 'si' && answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 's') {
      console.log('\n❌ Operación cancelada\n');
      rl.close();
      await mongoose.connection.close();
      return;
    }

    console.log('\n🔄 Eliminando archivos...\n');

    // 5. Eliminar archivos
    let successCount = 0;
    let errorCount = 0;

    for (const file of orphanFiles) {
      try {
        await cloudinary.uploader.destroy(file.public_id, {
          resource_type: file.resource_type,
          invalidate: true
        });
        
        console.log(`✅ Eliminado: ${file.public_id}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Error eliminando ${file.public_id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log(`\n📊 Resumen:`);
    console.log(`   ✅ Eliminados exitosamente: ${successCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);
    console.log(`   📂 Archivos restantes en Cloudinary: ${allCloudinaryFiles.length - successCount}`);
    console.log('\n' + '═'.repeat(80) + '\n');

    rl.close();
    await mongoose.connection.close();
    console.log('🔌 Conexión a MongoDB cerrada\n');

  } catch (error) {
    console.error('❌ Error:', error);
    rl.close();
    await mongoose.connection.close();
  }
}

cleanOrphanFiles();
