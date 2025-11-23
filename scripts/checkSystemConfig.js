/**
 * Script para verificar y mostrar el contenido de SystemConfig
 */

const mongoose = require('mongoose');
const SystemConfig = require('../models/SystemConfig');
require('dotenv').config();

async function checkSystemConfig() {
  try {
    console.log('\n🔍 Verificando SystemConfig\n');

    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/appscrum');
    console.log('✅ Conectado a MongoDB\n');

    const config = await SystemConfig.findOne();
    
    if (!config) {
      console.log('⚠️  No se encontró configuración del sistema');
      await mongoose.disconnect();
      return;
    }

    console.log('📋 SystemConfig completo:');
    console.log(JSON.stringify(config, null, 2));

    console.log('\n📋 Branding específico:');
    console.log('   Logo URL:', config.branding?.logoUrl);
    console.log('   Logo:', config.branding?.logo);
    console.log('   Logo Small:', config.branding?.logoSmall);
    console.log('   Favicon URL:', config.branding?.faviconUrl);
    console.log('   Favicon:', config.branding?.favicon);

    await mongoose.disconnect();
    console.log('\n✅ Desconectado de MongoDB');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

checkSystemConfig();
