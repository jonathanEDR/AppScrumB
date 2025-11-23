/**
 * Script para limpiar referencias huérfanas en MongoDB
 * (archivos que están en la BD pero no en Cloudinary)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const SystemConfig = require('../models/SystemConfig');
const cloudinary = require('cloudinary').v2;

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function checkFileExists(publicId, resourceType = 'image') {
  try {
    await cloudinary.api.resource(publicId, { resource_type: resourceType });
    return true;
  } catch (error) {
    if (error.http_code === 404) {
      return false;
    }
    console.error(`Error checking ${publicId}:`, error.message);
    return false;
  }
}

async function cleanOrphanReferences() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const systemConfig = await SystemConfig.findOne({ configId: 'main' });
    
    if (!systemConfig || !systemConfig.adminFiles || systemConfig.adminFiles.length === 0) {
      console.log('ℹ️  No adminFiles found in SystemConfig');
      process.exit(0);
    }

    console.log(`📋 Found ${systemConfig.adminFiles.length} files in MongoDB\n`);

    const orphanFiles = [];
    const validFiles = [];

    // Verificar cada archivo
    for (const file of systemConfig.adminFiles) {
      const resourceType = file.mimeType === 'image/svg+xml' ? 'raw' : 'image';
      const exists = await checkFileExists(file.publicId, resourceType);
      
      if (exists) {
        console.log(`✅ ${file.originalName} - EXISTS`);
        validFiles.push(file);
      } else {
        console.log(`❌ ${file.originalName} - NOT FOUND (orphan)`);
        orphanFiles.push(file);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Valid files: ${validFiles.length}`);
    console.log(`   Orphan files: ${orphanFiles.length}`);

    if (orphanFiles.length > 0) {
      console.log(`\n🗑️  Cleaning orphan references from MongoDB...`);
      systemConfig.adminFiles = validFiles;
      await systemConfig.save();
      console.log(`✅ Removed ${orphanFiles.length} orphan references`);
      
      console.log(`\n🧹 Orphan files removed:`);
      orphanFiles.forEach(file => {
        console.log(`   - ${file.originalName} (${file.publicId})`);
      });
    } else {
      console.log(`\n✨ No orphan references found. Database is clean!`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

cleanOrphanReferences();
