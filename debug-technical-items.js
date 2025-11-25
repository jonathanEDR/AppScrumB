const mongoose = require('mongoose');
const BacklogItem = require('./models/BacklogItem');
const Task = require('./models/Task');
const User = require('./models/User');

// Conectar a MongoDB
mongoose.connect('mongodb://localhost:27017/appscrum')
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Error conectando a MongoDB:', err));

async function debugTechnicalItems() {
  try {
    console.log('=== INVESTIGACIÓN DE ITEMS TÉCNICOS ===');
    
    // 1. Verificar todos los items técnicos en la BD
    const allTechnicalItems = await BacklogItem.find({ tipo: 'tecnico' });
    console.log('\n1. TODOS los items técnicos en la BD:', allTechnicalItems.length);
    allTechnicalItems.forEach((item, index) => {
      console.log(`   ${index + 1}. ID: ${item._id}`);
      console.log(`      Título: ${item.titulo}`);
      console.log(`      Asignado a: ${item.asignado_a}`);
      console.log(`      Estado: ${item.estado}`);
      console.log('---');
    });
    
    // 2. Verificar el usuario específico (Jonathan)
    const jonathan = await User.findOne({ email: 'edjonathan5@gmail.com' });
    console.log('\n2. Usuario Jonathan:', jonathan ? {
      id: jonathan._id,
      email: jonathan.email,
      nombre: jonathan.nombre_negocio,
      role: jonathan.role
    } : 'NO ENCONTRADO');
    
    if (jonathan) {
      // 3. Buscar items técnicos asignados a Jonathan
      const jonathanTechnicalItems = await BacklogItem.find({
        asignado_a: jonathan._id,
        tipo: 'tecnico'
      });
      console.log('\n3. Items técnicos asignados a Jonathan:', jonathanTechnicalItems.length);
      jonathanTechnicalItems.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.titulo} - Estado: ${item.estado}`);
      });
      
      // 4. Verificar Tasks creadas para Jonathan
      const jonathanTasks = await Task.find({ assigned_to: jonathan._id });
      console.log('\n4. Tasks asignadas a Jonathan:', jonathanTasks.length);
      jonathanTasks.forEach((task, index) => {
        console.log(`   ${index + 1}. ${task.title} - Status: ${task.status} - Type: ${task.type || 'regular'}`);
      });
    }
    
    // 5. Verificar items técnicos que tienen asignado_a
    const technicalItemsWithAssignment = await BacklogItem.find({
      tipo: 'tecnico',
      asignado_a: { $exists: true, $ne: null }
    }).populate('asignado_a');
    
    console.log('\n5. Items técnicos CON asignación:', technicalItemsWithAssignment.length);
    technicalItemsWithAssignment.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.titulo}`);
      console.log(`      Asignado a: ${item.asignado_a?.email || 'Usuario no encontrado'}`);
      console.log('---');
    });
    
    console.log('\n=== FIN INVESTIGACIÓN ===');
    process.exit(0);
  } catch (error) {
    console.error('Error en investigación:', error);
    process.exit(1);
  }
}

debugTechnicalItems();