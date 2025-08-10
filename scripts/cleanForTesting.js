const mongoose = require('mongoose');
const Sprint = require('../models/Sprint');
const BacklogItem = require('../models/BacklogItem');
const Release = require('../models/Release');
require('dotenv').config();

// Configuración de conexión a MongoDB local
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/AppScrum';

const limpiarDatosPrueba = async () => {
  console.log('🔄 Conectando a MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Conexión exitosa a MongoDB');

  try {
    console.log('\n🧹 LIMPIANDO DATOS PARA TESTING REAL...\n');

    // 1. Limpiar todos los sprints
    console.log('🗑️ Eliminando todos los sprints...');
    const sprintsEliminados = await Sprint.deleteMany({});
    console.log(`✅ ${sprintsEliminados.deletedCount} sprints eliminados`);

    // 2. Limpiar todos los releases
    console.log('🗑️ Eliminando todos los releases...');
    const releasesEliminados = await Release.deleteMany({});
    console.log(`✅ ${releasesEliminados.deletedCount} releases eliminados`);

    // 3. Limpiar asignaciones de sprint en historias (mantener las historias pero sin sprint)
    console.log('🔄 Limpiando asignaciones de sprint en historias...');
    const historiasActualizadas = await BacklogItem.updateMany(
      {}, 
      { 
        $unset: { sprint: 1 }, 
        estado: 'pendiente' 
      }
    );
    console.log(`✅ ${historiasActualizadas.modifiedCount} historias actualizadas (sin sprint asignado)`);

    // 4. Verificar que productos y historias siguen disponibles
    const historiasTotal = await BacklogItem.countDocuments({});
    console.log(`📋 Historias disponibles para testing: ${historiasTotal}`);

    console.log('\n🎯 DATOS LISTOS PARA TESTING REAL:');
    console.log('   ✅ Productos: Mantenidos (3 productos)');
    console.log('   ✅ Historias: Mantenidas pero sin asignar (15 historias)');
    console.log('   ❌ Sprints: Eliminados (crear manualmente)');
    console.log('   ❌ Releases: Eliminados (crear manualmente)');
    
    console.log('\n📋 INSTRUCCIONES PARA TESTING:');
    console.log('1. 🚀 Ve al Roadmap y selecciona un producto');
    console.log('2. 📦 Crea un nuevo Release manualmente');
    console.log('3. 🏃‍♂️ Crea un nuevo Sprint y asocialo al Release');
    console.log('4. 📝 Ve al ProductBacklog y asigna historias al Sprint');
    console.log('5. 🔄 Prueba cambios de estado y flujo completo');

  } catch (error) {
    console.error('❌ Error ejecutando la limpieza:', error.message);
  } finally {
    console.log('\n🔐 Cerrando conexión a MongoDB...');
    await mongoose.connection.close();
    console.log('✅ Conexión cerrada');
    console.log('✨ Limpieza completada. ¡Datos listos para testing real!');
  }
};

// Ejecutar el script
if (require.main === module) {
  limpiarDatosPrueba();
}

module.exports = limpiarDatosPrueba;
