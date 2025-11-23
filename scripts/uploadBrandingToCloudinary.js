/**
 * Script para subir archivos de branding local a Cloudinary
 * y actualizar las URLs en la base de datos
 */

const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const SystemConfig = require('../models/SystemConfig');
require('dotenv').config();

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Sube un archivo local a Cloudinary
 */
async function uploadLocalFileToCloudinary(localPath, folder) {
  try {
    console.log(`📤 Subiendo: ${localPath}`);
    
    const result = await cloudinary.uploader.upload(localPath, {
      folder: `appscrum/${folder}`,
      resource_type: 'auto',
      use_filename: true,
      unique_filename: false
    });

    console.log(`✅ Subido exitosamente: ${result.secure_url}`);
    return result;

  } catch (error) {
    console.error(`❌ Error subiendo ${localPath}:`, error.message);
    throw error;
  }
}

/**
 * Actualiza las URLs en SystemConfig
 */
async function updateSystemConfig(filename, newUrl) {
  try {
    const config = await SystemConfig.findOne();
    
    if (!config) {
      console.log('⚠️  No se encontró configuración del sistema');
      return;
    }

    let updated = false;

    // Buscar por nombre de archivo en las URLs
    if (config.branding) {
      // Actualizar logo principal
      if (config.branding.logo && config.branding.logo.includes(filename)) {
        console.log('   Actualizando logo:', config.branding.logo, '->', newUrl);
        config.branding.logo = newUrl;
        updated = true;
      }

      // Actualizar logo small
      if (config.branding.logoSmall && config.branding.logoSmall.includes(filename)) {
        console.log('   Actualizando logoSmall:', config.branding.logoSmall, '->', newUrl);
        config.branding.logoSmall = newUrl;
        updated = true;
      }

      // También actualizar campos legacy
      if (config.branding.logoUrl && config.branding.logoUrl.includes(filename)) {
        console.log('   Actualizando logoUrl:', config.branding.logoUrl, '->', newUrl);
        config.branding.logoUrl = newUrl;
        updated = true;
      }

      if (config.branding.faviconUrl && config.branding.faviconUrl.includes(filename)) {
        console.log('   Actualizando faviconUrl:', config.branding.faviconUrl, '->', newUrl);
        config.branding.faviconUrl = newUrl;
        updated = true;
      }
    }

    if (updated) {
      await config.save();
      console.log('   ✅ Configuración guardada');
    } else {
      console.log('   ℹ️  No se encontraron referencias a actualizar');
    }

  } catch (error) {
    console.error('❌ Error actualizando SystemConfig:', error.message);
    throw error;
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log('\n🚀 Iniciando migración de archivos de branding a Cloudinary\n');

    // Conectar a MongoDB
    const mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/appscrum');
    console.log('✅ Conectado a MongoDB\n');

    const brandingDir = path.join(__dirname, '../uploads/branding');
    
    // Verificar si existe el directorio
    if (!fs.existsSync(brandingDir)) {
      console.log('⚠️  Directorio de branding no existe');
      process.exit(0);
    }

    // Listar archivos
    const files = fs.readdirSync(brandingDir);
    console.log(`📁 Archivos encontrados: ${files.length}\n`);

    for (const file of files) {
      const localPath = path.join(brandingDir, file);
      const stat = fs.statSync(localPath);

      if (stat.isFile()) {
        console.log(`\n▶️  Procesando: ${file}`);

        // Subir a Cloudinary
        const result = await uploadLocalFileToCloudinary(localPath, 'branding');

        // Actualizar en base de datos usando el nombre del archivo
        await updateSystemConfig(file, result.secure_url);

        console.log(`   Cloudinary URL: ${result.secure_url}`);
      }
    }

    console.log('\n✨ Migración completada exitosamente\n');
    
    await mongoose.disconnect();
    console.log('✅ Desconectado de MongoDB');

  } catch (error) {
    console.error('\n❌ Error en la migración:', error);
    process.exit(1);
  }
}

// Ejecutar
main();
