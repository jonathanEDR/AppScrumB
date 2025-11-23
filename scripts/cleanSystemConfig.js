/**
 * Script para limpiar SystemConfig y actualizar URLs locales a Cloudinary
 */

const mongoose = require('mongoose');
const SystemConfig = require('../models/SystemConfig');
require('dotenv').config();

async function cleanSystemConfig() {
  try {
    console.log('\n🧹 Iniciando limpieza de SystemConfig\n');

    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/appscrum');
    console.log('✅ Conectado a MongoDB\n');

    const config = await SystemConfig.findOne();
    
    if (!config) {
      console.log('⚠️  No se encontró configuración del sistema');
      await mongoose.disconnect();
      return;
    }

    console.log('📋 Configuración actual:');
    console.log('   Logo URL:', config.branding?.logoUrl);
    console.log('   Favicon URL:', config.branding?.faviconUrl);
    console.log('\n');

    let updated = false;

    // Limpiar URLs locales de branding
    if (config.branding) {
      if (config.branding.logoUrl && config.branding.logoUrl.startsWith('/uploads/')) {
        console.log('❌ Eliminando logo con URL local:', config.branding.logoUrl);
        config.branding.logoUrl = null;
        updated = true;
      }

      if (config.branding.faviconUrl && config.branding.faviconUrl.startsWith('/uploads/')) {
        console.log('❌ Eliminando favicon con URL local:', config.branding.faviconUrl);
        config.branding.faviconUrl = null;
        updated = true;
      }
    }

    if (updated) {
      await config.save();
      console.log('\n✅ SystemConfig limpiado exitosamente');
      console.log('\n📋 Nueva configuración:');
      console.log('   Logo URL:', config.branding?.logoUrl || 'null');
      console.log('   Favicon URL:', config.branding?.faviconUrl || 'null');
    } else {
      console.log('✨ SystemConfig ya está limpio (sin URLs locales)');
    }

    await mongoose.disconnect();
    console.log('\n✅ Desconectado de MongoDB');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

cleanSystemConfig();
