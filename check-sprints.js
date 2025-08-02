const mongoose = require('mongoose');
const Sprint = require('./models/Sprint');
const Product = require('./models/Product');
const User = require('./models/User');

async function checkSprints() {
  try {
    await mongoose.connect('mongodb://localhost:27017/AppScrum');
    console.log('Conectado a MongoDB');
    
    const sprints = await Sprint.find().sort({ createdAt: -1 });
    console.log('Sprints encontrados:', sprints.length);
    
    sprints.forEach(sprint => {
      console.log(`- ${sprint.nombre}: ${sprint.estado} (${sprint.fecha_inicio} - ${sprint.fecha_fin})`);
    });
    
    const activeSprints = sprints.filter(s => s.estado === 'activo');
    console.log('Sprints activos:', activeSprints.length);
    
    const currentDate = new Date();
    const currentSprints = sprints.filter(s => 
      new Date(s.fecha_inicio) <= currentDate && 
      new Date(s.fecha_fin) >= currentDate
    );
    console.log('Sprints en rango actual:', currentSprints.length);
    
    if (activeSprints.length === 0) {
      console.log('\n🔨 No hay sprints activos. Creando uno nuevo...');
      
      // Buscar un producto existente
      let product = await Product.findOne();
      if (!product) {
        console.log('Creando producto de ejemplo...');
        const user = await User.findOne();
        product = new Product({
          nombre: 'AppScrum Development',
          descripcion: 'Producto principal de desarrollo',
          owner: user ? user._id : new mongoose.Types.ObjectId(),
          created_by: user ? user._id : new mongoose.Types.ObjectId()
        });
        await product.save();
        console.log('Producto creado:', product.nombre);
      }
      
      // Crear sprint activo
      const user = await User.findOne();
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + 14); // Sprint de 2 semanas
      
      const newSprint = new Sprint({
        nombre: `Sprint ${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        objetivo: 'Sprint de desarrollo activo',
        fecha_inicio: startDate,
        fecha_fin: endDate,
        estado: 'activo',
        producto: product._id,
        velocidad_planificada: 40,
        created_by: user ? user._id : new mongoose.Types.ObjectId()
      });
      
      await newSprint.save();
      console.log('Sprint activo creado:', newSprint.nombre);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkSprints();
