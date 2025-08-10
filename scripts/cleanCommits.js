const mongoose = require('mongoose');
require('dotenv').config();

// Importar modelos
const Commit = require('../models/Commit');

async function cleanCommits() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Eliminar todos los commits para evitar problemas de esquema
    const deleteResult = await Commit.deleteMany({});
    console.log(`🗑️ Eliminados ${deleteResult.deletedCount} commits`);

    console.log('✅ Limpieza de commits completada');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Conexión cerrada');
  }
}

cleanCommits();
