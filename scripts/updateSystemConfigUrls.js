/**
 * Script para actualizar SystemConfig con URLs de Cloudinary correctas
 */

const mongoose = require('mongoose');
const SystemConfig = require('../models/SystemConfig');
require('dotenv').config();

async function updateSystemConfigUrls() {
  try {
    console.log('\n🔧 Actualizando SystemConfig con URLs de Cloudinary\n');

    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/appscrum');
    console.log('✅ Conectado a MongoDB\n');

    const config = await SystemConfig.findOne();
    
    if (!config) {
      console.log('⚠️  No se encontró configuración del sistema');
      await mongoose.disconnect();
      return;
    }

    console.log('📋 URLs actuales:');
    console.log('   logo:', config.branding?.logo);
    console.log('   logoSmall:', config.branding?.logoSmall);
    console.log('\n');

    // Actualizar con las URLs correctas de Cloudinary
    const updates = {
      'branding.logo': 'https://res.cloudinary.com/dcwobe8gh/image/upload/v1763858076/appscrum/branding/logo-main-1763838726613-48483123.png',
      'branding.logoSmall': 'https://res.cloudinary.com/dcwobe8gh/image/upload/v1763858077/appscrum/branding/logo-main-1763838727239-790314174.png',
      'branding.logoPublicId': 'appscrum/branding/logo-main-1763838726613-48483123',
      'branding.logoSmallPublicId': 'appscrum/branding/logo-main-1763838727239-790314174'
    };

    await SystemConfig.updateOne(
      { _id: config._id },
      { $set: updates }
    );

    console.log('✅ URLs actualizadas:\n');
    console.log('   logo:', updates['branding.logo']);
    console.log('   logoSmall:', updates['branding.logoSmall']);

    // Verificar
    const updatedConfig = await SystemConfig.findOne();
    console.log('\n📋 Verificación:');
    console.log('   logo:', updatedConfig.branding?.logo);
    console.log('   logoSmall:', updatedConfig.branding?.logoSmall);

    await mongoose.disconnect();
    console.log('\n✅ Desconectado de MongoDB');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

updateSystemConfigUrls();
