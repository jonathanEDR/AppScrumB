const mongoose = require('mongoose');
const BacklogItem = require('../models/BacklogItem');
const Product = require('../models/Product');
const User = require('../models/User');
require('dotenv').config();

// Configuración de conexión a MongoDB local
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/AppScrum';

// Datos de historias de usuario por producto
const HISTORIAS_POR_PRODUCTO = {
  'AppScrum - Gestión Ágil': [
    {
      titulo: 'Como Product Owner, quiero crear y gestionar el product backlog',
      descripcion: 'Necesito poder crear, editar, eliminar y priorizar elementos del product backlog para mantener una visión clara de los requisitos del producto.',
      tipo: 'historia',
      prioridad: 'muy_alta',
      puntos_historia: 13,
      etiquetas: ['producto-owner', 'backlog', 'gestión'],
      criterios_aceptacion: [
        { descripcion: 'Puedo crear nuevos elementos del backlog con título, descripción y prioridad', completado: false },
        { descripcion: 'Puedo editar elementos existentes del backlog', completado: false },
        { descripcion: 'Puedo reordenar elementos por arrastrar y soltar', completado: false },
        { descripcion: 'Puedo eliminar elementos del backlog', completado: false }
      ]
    },
    {
      titulo: 'Como Scrum Master, quiero facilitar las ceremonias de Scrum',
      descripcion: 'Necesito herramientas para planificar y ejecutar las ceremonias de Scrum como daily standups, sprint planning, retrospectivas y reviews.',
      tipo: 'historia',
      prioridad: 'alta',
      puntos_historia: 21,
      etiquetas: ['scrum-master', 'ceremonias', 'facilitación'],
      criterios_aceptacion: [
        { descripcion: 'Puedo programar y gestionar daily standups', completado: false },
        { descripcion: 'Puedo crear y gestionar sprint planning meetings', completado: false },
        { descripcion: 'Puedo facilitar retrospectivas con templates', completado: false },
        { descripcion: 'Puedo organizar sprint reviews con stakeholders', completado: false }
      ]
    },
    {
      titulo: 'Como Developer, quiero ver y actualizar mis tareas asignadas',
      descripcion: 'Necesito una vista clara de mis tareas asignadas y poder actualizar su estado para mantener al equipo informado sobre mi progreso.',
      tipo: 'historia',
      prioridad: 'alta',
      puntos_historia: 8,
      etiquetas: ['developer', 'tareas', 'progreso'],
      criterios_aceptacion: [
        { descripcion: 'Puedo ver todas mis tareas asignadas en un dashboard', completado: false },
        { descripcion: 'Puedo cambiar el estado de mis tareas (En progreso, En revisión, Completado)', completado: false },
        { descripcion: 'Puedo agregar comentarios y tiempo trabajado', completado: false },
        { descripcion: 'Puedo reportar impedimentos', completado: false }
      ]
    },
    {
      titulo: 'Como usuario, quiero un sistema de autenticación seguro',
      descripcion: 'Necesito un sistema de login y registro seguro que proteja los datos del proyecto y permita diferentes niveles de acceso.',
      tipo: 'historia',
      prioridad: 'muy_alta',
      puntos_historia: 5,
      etiquetas: ['autenticación', 'seguridad', 'roles'],
      criterios_aceptacion: [
        { descripcion: 'Puedo registrarme con email y contraseña', completado: false },
        { descripcion: 'Puedo hacer login de forma segura', completado: false },
        { descripcion: 'El sistema asigna roles apropiados (Product Owner, Scrum Master, Developer)', completado: false },
        { descripcion: 'Puedo cerrar sesión de forma segura', completado: false }
      ]
    },
    {
      titulo: 'Como equipo, queremos métricas y reportes de progreso',
      descripcion: 'Necesitamos dashboards y reportes que muestren el progreso del sprint, burndown charts y métricas clave del equipo.',
      tipo: 'historia',
      prioridad: 'media',
      puntos_historia: 13,
      etiquetas: ['métricas', 'reportes', 'analytics'],
      criterios_aceptacion: [
        { descripcion: 'Puedo ver burndown charts del sprint actual', completado: false },
        { descripcion: 'Puedo ver velocity del equipo por sprint', completado: false },
        { descripcion: 'Puedo generar reportes de progreso por producto', completado: false },
        { descripcion: 'Puedo exportar métricas en formato PDF/Excel', completado: false }
      ]
    }
  ],
  
  'App Gestión Empresarial': [
    {
      titulo: 'Como gerente, quiero un dashboard ejecutivo integral',
      descripcion: 'Necesito una vista consolidada de KPIs empresariales, métricas financieras y operacionales para tomar decisiones estratégicas informadas.',
      tipo: 'historia',
      prioridad: 'muy_alta',
      puntos_historia: 21,
      etiquetas: ['gerencia', 'dashboard', 'kpis'],
      criterios_aceptacion: [
        { descripcion: 'Puedo ver métricas financieras en tiempo real', completado: false },
        { descripcion: 'Puedo visualizar KPIs operacionales con gráficos', completado: false },
        { descripcion: 'Puedo filtrar datos por período temporal', completado: false },
        { descripcion: 'Puedo exportar reportes ejecutivos', completado: false }
      ]
    },
    {
      titulo: 'Como empleado, quiero gestionar mis recursos humanos',
      descripcion: 'Necesito poder ver y gestionar mi información personal, solicitar vacaciones, ver mi historial de evaluaciones y acceder a políticas de la empresa.',
      tipo: 'historia',
      prioridad: 'alta',
      puntos_historia: 13,
      etiquetas: ['rrhh', 'empleados', 'autoservicio'],
      criterios_aceptacion: [
        { descripcion: 'Puedo actualizar mi información personal', completado: false },
        { descripcion: 'Puedo solicitar vacaciones y ver mi balance', completado: false },
        { descripcion: 'Puedo acceder a mi historial de evaluaciones', completado: false },
        { descripcion: 'Puedo descargar documentos de políticas', completado: false }
      ]
    },
    {
      titulo: 'Como contador, quiero gestionar la contabilidad empresarial',
      descripcion: 'Necesito herramientas para registrar transacciones, generar estados financieros, gestionar cuentas por cobrar/pagar y manejar la facturación.',
      tipo: 'historia',
      prioridad: 'muy_alta',
      puntos_historia: 34,
      etiquetas: ['contabilidad', 'finanzas', 'facturación'],
      criterios_aceptacion: [
        { descripcion: 'Puedo registrar asientos contables', completado: false },
        { descripcion: 'Puedo generar balance general y estado de resultados', completado: false },
        { descripcion: 'Puedo gestionar facturas y pagos', completado: false },
        { descripcion: 'Puedo realizar conciliaciones bancarias', completado: false }
      ]
    },
    {
      titulo: 'Como usuario, quiero gestión de inventarios en tiempo real',
      descripcion: 'Necesito un sistema para rastrear productos, gestionar stock, configurar alertas de inventario bajo y manejar movimientos de almacén.',
      tipo: 'historia',
      prioridad: 'alta',
      puntos_historia: 21,
      etiquetas: ['inventario', 'stock', 'almacén'],
      criterios_aceptacion: [
        { descripcion: 'Puedo agregar y categorizar productos', completado: false },
        { descripcion: 'Puedo rastrear niveles de stock en tiempo real', completado: false },
        { descripcion: 'Recibo alertas cuando el stock está bajo', completado: false },
        { descripcion: 'Puedo registrar entradas y salidas de inventario', completado: false }
      ]
    },
    {
      titulo: 'Como vendedor, quiero un CRM para gestionar clientes',
      descripcion: 'Necesito herramientas para gestionar leads, seguimiento de oportunidades, historial de comunicaciones y análisis de ventas.',
      tipo: 'historia',
      prioridad: 'alta',
      puntos_historia: 18,
      etiquetas: ['crm', 'ventas', 'clientes'],
      criterios_aceptacion: [
        { descripcion: 'Puedo registrar y segmentar clientes', completado: false },
        { descripcion: 'Puedo gestionar oportunidades de venta', completado: false },
        { descripcion: 'Puedo registrar comunicaciones con clientes', completado: false },
        { descripcion: 'Puedo generar reportes de pipeline de ventas', completado: false }
      ]
    }
  ],

  'Integración de IA - SmartInput': [
    {
      titulo: 'Como usuario, quiero procesamiento inteligente de texto',
      descripcion: 'Necesito que la IA analice y procese automáticamente el texto que ingreso, proporcionando sugerencias, correcciones y mejoras contextuales.',
      tipo: 'historia',
      prioridad: 'muy_alta',
      puntos_historia: 21,
      etiquetas: ['ia', 'nlp', 'procesamiento-texto'],
      criterios_aceptacion: [
        { descripcion: 'La IA puede detectar y corregir errores ortográficos', completado: false },
        { descripcion: 'La IA sugiere mejoras de estilo y claridad', completado: false },
        { descripcion: 'La IA puede resumir textos largos automáticamente', completado: false },
        { descripcion: 'La IA mantiene el contexto durante la conversación', completado: false }
      ]
    },
    {
      titulo: 'Como desarrollador, quiero autocompletado inteligente de código',
      descripcion: 'Necesito que la IA proporcione sugerencias de código contextualmente relevantes, detecte patrones y ayude con la documentación automática.',
      tipo: 'historia',
      prioridad: 'muy_alta',
      puntos_historia: 34,
      etiquetas: ['ia', 'código', 'autocompletado'],
      criterios_aceptacion: [
        { descripcion: 'La IA sugiere completados de código precisos', completado: false },
        { descripcion: 'La IA puede generar documentación automática', completado: false },
        { descripcion: 'La IA detecta y sugiere refactorizaciones', completado: false },
        { descripcion: 'La IA puede explicar código complejo', completado: false }
      ]
    },
    {
      titulo: 'Como analista, quiero insights automáticos de datos',
      descripcion: 'Necesito que la IA analice conjuntos de datos y proporcione insights, patrones y recomendaciones automáticas sin intervención manual.',
      tipo: 'historia',
      prioridad: 'alta',
      puntos_historia: 25,
      etiquetas: ['ia', 'análisis-datos', 'insights'],
      criterios_aceptacion: [
        { descripcion: 'La IA puede identificar patrones en datasets', completado: false },
        { descripcion: 'La IA genera visualizaciones automáticas', completado: false },
        { descripcion: 'La IA proporciona recomendaciones basadas en datos', completado: false },
        { descripcion: 'La IA puede predecir tendencias futuras', completado: false }
      ]
    },
    {
      titulo: 'Como usuario, quiero interface conversacional intuitiva',
      descripcion: 'Necesito poder interactuar con la IA a través de lenguaje natural, hacer preguntas complejas y recibir respuestas contextualmente apropiadas.',
      tipo: 'historia',
      prioridad: 'alta',
      puntos_historia: 13,
      etiquetas: ['ia', 'interfaz', 'conversación'],
      criterios_aceptacion: [
        { descripcion: 'Puedo hacer preguntas en lenguaje natural', completado: false },
        { descripcion: 'La IA mantiene contexto de conversaciones previas', completado: false },
        { descripcion: 'La IA puede manejar consultas complejas y multipasos', completado: false },
        { descripcion: 'La interfaz es intuitiva y fácil de usar', completado: false }
      ]
    },
    {
      titulo: 'Como administrador, quiero configuración y monitoreo de IA',
      descripcion: 'Necesito herramientas para configurar parámetros de IA, monitorear rendimiento, gestionar costos y asegurar la calidad de las respuestas.',
      tipo: 'historia',
      prioridad: 'media',
      puntos_historia: 13,
      etiquetas: ['ia', 'administración', 'monitoreo'],
      criterios_aceptacion: [
        { descripcion: 'Puedo configurar parámetros de los modelos de IA', completado: false },
        { descripcion: 'Puedo monitorear uso y costos de API', completado: false },
        { descripcion: 'Puedo establecer límites y restricciones', completado: false },
        { descripcion: 'Puedo auditar calidad de respuestas', completado: false }
      ]
    }
  ]
};

// Función principal del script
async function seedBacklog() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conexión exitosa a MongoDB');

    // Limpiar backlog existente
    console.log('🧹 Limpiando backlog existente...');
    const deletedCount = await BacklogItem.deleteMany({});
    console.log(`✅ ${deletedCount.deletedCount} elementos del backlog eliminados`);

    // Obtener productos existentes
    console.log('📦 Obteniendo productos existentes...');
    const productos = await Product.find({}).populate('responsable', 'email nombre_negocio');
    
    if (productos.length === 0) {
      console.log('❌ No se encontraron productos. Ejecuta primero el script de productos.');
      return;
    }
    
    console.log(`📋 Productos encontrados: ${productos.length}`);

    // Obtener usuarios para asignar como created_by
    const usuarios = await User.find({});
    if (usuarios.length === 0) {
      console.log('❌ No se encontraron usuarios en la base de datos.');
      return;
    }

    let totalHistoriasCreadas = 0;
    const resultados = [];

    // Crear historias para cada producto
    for (const producto of productos) {
      const historiasTemplate = HISTORIAS_POR_PRODUCTO[producto.nombre];
      
      if (!historiasTemplate) {
        console.log(`⚠️  No hay historias definidas para el producto: ${producto.nombre}`);
        continue;
      }

      console.log(`\n📝 Creando historias para: ${producto.nombre}`);
      
      const historiasDelProducto = [];
      let orden = 1;

      for (const template of historiasTemplate) {
        // Seleccionar un usuario aleatorio como created_by
        const createdBy = usuarios[Math.floor(Math.random() * usuarios.length)];
        
        const historia = new BacklogItem({
          ...template,
          producto: producto._id,
          orden: orden++,
          created_by: createdBy._id,
          updated_by: createdBy._id
        });

        const historiaGuardada = await historia.save();
        historiasDelProducto.push(historiaGuardada);
        totalHistoriasCreadas++;
      }

      // Calcular estadísticas del producto
      const totalPuntos = historiasDelProducto.reduce((sum, h) => sum + (h.puntos_historia || 0), 0);
      const prioridadAlta = historiasDelProducto.filter(h => ['muy_alta', 'alta'].includes(h.prioridad)).length;
      
      resultados.push({
        producto: producto.nombre,
        responsable: producto.responsable?.email || 'Sin asignar',
        historias: historiasDelProducto.length,
        puntos_totales: totalPuntos,
        alta_prioridad: prioridadAlta
      });

      console.log(`   ✅ ${historiasDelProducto.length} historias creadas (${totalPuntos} puntos totales)`);
    }

    // Mostrar resumen final
    console.log('\n🎉 ¡BACKLOG CREADO EXITOSAMENTE!\n');
    
    resultados.forEach((resultado, index) => {
      console.log(`${index + 1}. 📖 ${resultado.producto}`);
      console.log(`   Responsable: ${resultado.responsable}`);
      console.log(`   Historias: ${resultado.historias}`);
      console.log(`   Puntos de Historia: ${resultado.puntos_totales}`);
      console.log(`   Alta Prioridad: ${resultado.alta_prioridad}`);
      console.log(`   ─────────────────────────────\n`);
    });

    console.log('📊 RESUMEN DE BACKLOG:');
    console.log(`   • Total historias: ${totalHistoriasCreadas}`);
    console.log(`   • Total productos con backlog: ${resultados.length}`);
    console.log(`   • Puntos de historia totales: ${resultados.reduce((sum, r) => sum + r.puntos_totales, 0)}`);
    console.log(`   • Historias de alta prioridad: ${resultados.reduce((sum, r) => sum + r.alta_prioridad, 0)}`);

  } catch (error) {
    console.error('❌ Error ejecutando el script:', error);
  } finally {
    console.log('\n🔐 Cerrando conexión a MongoDB...');
    await mongoose.connection.close();
    console.log('✅ Conexión cerrada');
    console.log('✨ Script completado. ¡Puedes revisar el backlog en tu aplicación!');
  }
}

// Ejecutar el script
if (require.main === module) {
  seedBacklog();
}

module.exports = seedBacklog;
