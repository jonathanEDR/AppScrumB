/**
 * Script para verificar referencias de Cloudinary en MongoDB
 * Identifica archivos en Cloudinary que tienen o no tienen referencias en BD
 */

require('dotenv').config();
const mongoose = require('mongoose');
const BugReport = require('../models/BugReport');
const SystemConfig = require('../models/SystemConfig');
const cloudinary = require('cloudinary').v2;

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function checkCloudinaryReferences() {
  try {
    console.log('\n🔍 Verificando referencias de Cloudinary en MongoDB...\n');

    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    // 1. Obtener todos los archivos de Cloudinary
    console.log('📂 Archivos en Cloudinary:');
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

    const allCloudinaryFiles = [
      ...imageResults.resources.map(r => ({ ...r, resource_type: 'image' })),
      ...rawResults.resources.map(r => ({ ...r, resource_type: 'raw' }))
    ];

    console.log(`Total archivos en Cloudinary: ${allCloudinaryFiles.length}\n`);

    // 2. Obtener referencias en BugReports
    console.log('🐛 Referencias en BugReports:');
    console.log('─'.repeat(80));

    const bugReports = await BugReport.find({
      'attachments.0': { $exists: true }
    }).select('_id title attachments');

    const bugReportPublicIds = new Set();
    bugReports.forEach(bug => {
      console.log(`\nBug #${bug._id}: "${bug.title}"`);
      bug.attachments.forEach((att, idx) => {
        const publicId = att.cloudinaryData?.publicId || att.publicId;
        if (publicId) {
          bugReportPublicIds.add(publicId);
          console.log(`  ${idx + 1}. ${publicId}`);
        }
      });
    });

    console.log(`\nTotal referencias en BugReports: ${bugReportPublicIds.size}\n`);

    // 3. Obtener referencias en SystemConfig
    console.log('⚙️  Referencias en SystemConfig:');
    console.log('─'.repeat(80));

    const systemConfig = await SystemConfig.findOne({ configId: 'main' });
    const systemConfigPublicIds = new Set();

    if (systemConfig) {
      if (systemConfig.branding?.logoPublicId) {
        systemConfigPublicIds.add(systemConfig.branding.logoPublicId);
        console.log(`Logo principal: ${systemConfig.branding.logoPublicId}`);
      }
      if (systemConfig.branding?.logoSmallPublicId) {
        systemConfigPublicIds.add(systemConfig.branding.logoSmallPublicId);
        console.log(`Logo pequeño: ${systemConfig.branding.logoSmallPublicId}`);
      }
    }

    console.log(`Total referencias en SystemConfig: ${systemConfigPublicIds.size}\n`);

    // 4. Comparar archivos huérfanos
    console.log('🔎 Análisis de archivos:');
    console.log('─'.repeat(80));

    const allDbPublicIds = new Set([...bugReportPublicIds, ...systemConfigPublicIds]);

    console.log('\n📊 Resumen:\n');
    console.log(`Archivos en Cloudinary:        ${allCloudinaryFiles.length}`);
    console.log(`Referencias en MongoDB:        ${allDbPublicIds.size}`);

    // Archivos huérfanos (en Cloudinary pero sin referencia en BD)
    const orphanFiles = allCloudinaryFiles.filter(file => 
      !allDbPublicIds.has(file.public_id)
    );

    console.log(`\n🗑️  Archivos HUÉRFANOS (sin referencia en BD): ${orphanFiles.length}\n`);
    
    if (orphanFiles.length > 0) {
      orphanFiles.forEach((file, idx) => {
        console.log(`${idx + 1}. [${file.resource_type.toUpperCase()}] ${file.public_id}`);
        console.log(`   URL: ${file.secure_url}`);
        console.log(`   Tamaño: ${(file.bytes / 1024).toFixed(2)} KB`);
        console.log(`   Creado: ${new Date(file.created_at).toLocaleString()}\n`);
      });

      console.log('💡 Estos archivos pueden ser eliminados de forma segura.');
    }

    // Referencias rotas (en BD pero no en Cloudinary)
    const brokenRefs = Array.from(allDbPublicIds).filter(publicId =>
      !allCloudinaryFiles.some(file => file.public_id === publicId)
    );

    console.log(`\n⚠️  Referencias ROTAS (en BD pero no en Cloudinary): ${brokenRefs.length}\n`);
    
    if (brokenRefs.length > 0) {
      brokenRefs.forEach((publicId, idx) => {
        console.log(`${idx + 1}. ${publicId}`);
      });

      console.log('\n💡 Estas referencias deben ser limpiadas de la base de datos.');
    }

    // Referencias válidas
    const validRefs = allCloudinaryFiles.filter(file =>
      allDbPublicIds.has(file.public_id)
    );

    console.log(`\n✅ Referencias VÁLIDAS (en BD y Cloudinary): ${validRefs.length}\n`);
    
    if (validRefs.length > 0) {
      validRefs.forEach((file, idx) => {
        console.log(`${idx + 1}. [${file.resource_type.toUpperCase()}] ${file.public_id}`);
      });
    }

    console.log('\n' + '═'.repeat(80));
    console.log('✅ Análisis completado');
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Conexión a MongoDB cerrada');
  }
}

checkCloudinaryReferences();
