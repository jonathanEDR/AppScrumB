const mongoose = require('mongoose');
const Product = require('../models/Product');

// Configuración de conexión a MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/AppScrum';

// Datos de productos profesionales
const productosDemo = [
  {
    nombre: 'AppScrum - Gestión Ágil',
    descripcion: 'Plataforma integral para la gestión eficiente de proyectos mediante metodología Scrum. Incluye módulos de Product Owner, Scrum Master, Developers con métricas avanzadas, sprints, releases y dashboards interactivos.',
    estado: 'activo',
    prioridad: 'alta',
    fecha_inicio: new Date('2024-01-15'),
    fecha_fin: new Date('2025-06-30'),
    responsable: null, // Se asignará al primer usuario disponible
    features: [
      'Dashboard de Product Owner con métricas avanzadas',
      'Gestión de Sprints y Releases',
      'Timeline interactivo con milestones',
      'Sistema de alertas inteligentes',
      'Integración con repositorios de código',
      'Burndown charts y velocity tracking',
      'Gestión de dependencias entre releases'
    ],
    tecnologias: ['React', 'Node.js', 'MongoDB', 'Express', 'Tailwind CSS'],
    roi_esperado: 'Incremento del 40% en eficiencia de entrega',
    mercado_objetivo: 'Equipos de desarrollo ágil, Product Owners, Scrum Masters'
  },
  {
    nombre: 'App Gestión Empresarial',
    descripcion: 'Suite completa de gestión empresarial que optimiza procesos internos, recursos humanos, inventario, facturación y análisis financiero. Diseñada para PyMEs y empresas medianas que buscan digitalizar sus operaciones.',
    estado: 'activo',
    prioridad: 'alta',
    fecha_inicio: new Date('2024-03-01'),
    fecha_fin: new Date('2025-12-31'),
    responsable: null, // Se asignará al segundo usuario disponible
    features: [
      'Gestión de recursos humanos y nómina',
      'Control de inventario en tiempo real',
      'Facturación electrónica automatizada',
      'Dashboard financiero con KPIs',
      'CRM integrado para clientes',
      'Gestión de proyectos y tareas',
      'Reportes automáticos y analytics',
      'Portal de empleados self-service'
    ],
    tecnologias: ['Vue.js', 'Laravel', 'MySQL', 'Docker', 'AWS'],
    roi_esperado: 'Reducción del 60% en tiempo administrativo',
    mercado_objetivo: 'PyMEs, empresas medianas, consultorías'
  },
  {
    nombre: 'Integración de IA - SmartInput',
    descripcion: 'Sistema de inteligencia artificial que potencia la productividad mediante autocompletado inteligente, generación automática de contenido, análisis predictivo y asistencia contextual en tiempo real para aplicaciones empresariales.',
    estado: 'activo',
    prioridad: 'media',
    fecha_inicio: new Date('2025-01-15'),
    fecha_fin: new Date('2025-09-30'),
    responsable: null, // Se asignará al tercer usuario disponible
    features: [
      'Autocompletado inteligente en formularios',
      'Generación automática de descripciones',
      'Sugerencias contextuales basadas en historial',
      'Análisis de sentiment en feedback',
      'Predicción de tendencias de mercado',
      'Chatbot integrado para soporte 24/7',
      'OCR para digitalización de documentos',
      'Análisis predictivo de métricas de proyecto',
      'Recomendaciones automáticas de priorización',
      'Detección de riesgos en proyectos'
    ],
    tecnologias: ['Python', 'TensorFlow', 'OpenAI API', 'FastAPI', 'Redis'],
    roi_esperado: 'Incremento del 70% en velocidad de entrada de datos',
    mercado_objetivo: 'Empresas que buscan automatización, equipos de alto volumen de datos'
  }
];

async function seedProductos() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conexión exitosa a MongoDB');

    // Limpiar productos existentes
    console.log('🧹 Limpiando productos existentes...');
    await Product.deleteMany({});
    console.log('✅ Productos anteriores eliminados');

    // Obtener usuarios existentes para asignar como responsables
    const User = require('../models/User');
    const usuarios = await User.find({}).limit(3);
    console.log(`📋 Usuarios encontrados: ${usuarios.length}`);

    // Crear productos con responsables asignados
    const productosParaInsertar = productosDemo.map((producto, index) => ({
      ...producto,
      responsable: usuarios[index] ? usuarios[index]._id : null,
      created_by: usuarios[0] ? usuarios[0]._id : new mongoose.Types.ObjectId(), // Usuario que crea los productos
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    console.log('📦 Insertando productos de demostración...');
    const productosCreados = await Product.insertMany(productosParaInsertar);
    
    console.log('\n🎉 ¡PRODUCTOS CREADOS EXITOSAMENTE!\n');
    
    productosCreados.forEach((producto, index) => {
      console.log(`${index + 1}. 📱 ${producto.nombre}`);
      console.log(`   Estado: ${producto.estado.toUpperCase()}`);
      console.log(`   Responsable: ${usuarios[index] ? usuarios[index].email : 'Sin asignar'}`);
      console.log(`   Inicio: ${producto.fecha_inicio.toLocaleDateString('es-ES')}`);
      console.log(`   Fin: ${producto.fecha_fin.toLocaleDateString('es-ES')}`);
      console.log(`   ID: ${producto._id}`);
      console.log('   ─────────────────────────────\n');
    });

    console.log('📊 RESUMEN DE PORTFOLIO:');
    console.log(`   • Total productos: ${productosCreados.length}`);
    console.log(`   • Activos: ${productosCreados.filter(p => p.estado === 'activo').length}`);
    console.log(`   • Planificados: ${productosCreados.filter(p => p.estado === 'planificado').length}`);
    console.log(`   • Alta prioridad: ${productosCreados.filter(p => p.prioridad === 'alta').length}`);
    console.log(`   • Media prioridad: ${productosCreados.filter(p => p.prioridad === 'media').length}`);

  } catch (error) {
    console.error('❌ Error al crear productos:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔐 Conexión a MongoDB cerrada');
    console.log('✨ Script completado. ¡Puedes revisar los productos en tu aplicación!');
  }
}

// Verificar si se ejecuta directamente
if (require.main === module) {
  seedProductos();
}

module.exports = { seedProductos, productosDemo };
