const mongoose = require('mongoose');
const BacklogItem = require('../models/BacklogItem');
const Sprint = require('../models/Sprint');
const Product = require('../models/Product');
const User = require('../models/User');
const Task = require('../models/Task'); // Agregar modelo Task
require('dotenv').config();

// Configuración de conexión a MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/AppScrum';

// Función para conectar a la base de datos
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.log('📊 RESUMEN TOTAL:');
    console.log(`   🔧 Tareas creadas: ${createdItems.tareas}`);
    console.log(`   🐛 Bugs creados: ${createdItems.bugs}`);
    console.log(`   ⚡ Mejoras creadas: ${createdItems.mejoras}`);
    console.log(`   📈 Total items técnicos: ${totalCreated}\n`);error('❌ Error conectando a MongoDB:', error);
    throw error;
  }
}

// =======================================
// TEMPLATES DE ITEMS TÉCNICOS REALISTAS
// =======================================

const TECHNICAL_TEMPLATES = {
  // Tareas específicas por contexto de proyecto
  tareas: {
    'AppScrum - Gestión Ágil': [
      {
        titulo: 'Configurar base de datos para autenticación de usuarios',
        descripcion: 'Crear tablas y relaciones necesarias para el sistema de autenticación seguro con roles de usuario (Product Owner, Scrum Master, Developer)',
        puntos_historia: 5,
        prioridad: 'alta',
        etiquetas: ['backend', 'database', 'authentication']
      },
      {
        titulo: 'Implementar middleware de autenticación con Clerk',
        descripcion: 'Desarrollar middleware que valide tokens JWT y gestione permisos basados en roles para endpoints protegidos',
        puntos_historia: 8,
        prioridad: 'muy_alta',
        etiquetas: ['backend', 'security', 'middleware']
      },
      {
        titulo: 'Crear componentes React para dashboard de métricas',
        descripcion: 'Desarrollar componentes reutilizables para visualización de burndown charts, velocity tracking y KPIs del proyecto',
        puntos_historia: 13,
        prioridad: 'alta',
        etiquetas: ['frontend', 'react', 'charts']
      },
      {
        titulo: 'Implementar API REST para gestión de sprints',
        descripcion: 'Crear endpoints para CRUD de sprints con validaciones, paginación y filtros avanzados',
        puntos_historia: 8,
        prioridad: 'alta',
        etiquetas: ['backend', 'api', 'sprints']
      },
      {
        titulo: 'Desarrollar sistema de notificaciones en tiempo real',
        descripcion: 'Implementar WebSockets para notificaciones instantáneas de cambios en sprints, backlog y asignaciones',
        puntos_historia: 13,
        prioridad: 'media',
        etiquetas: ['backend', 'websockets', 'notifications']
      },
      {
        titulo: 'Optimizar consultas de base de datos para reportes',
        descripcion: 'Crear índices y optimizar queries para mejorar performance en generación de reportes complejos',
        puntos_historia: 5,
        prioridad: 'media',
        etiquetas: ['database', 'performance', 'optimization']
      }
    ],
    'App Gestión Empresarial': [
      {
        titulo: 'Integrar sistema de facturación electrónica SUNAT',
        descripcion: 'Desarrollar integración con API de SUNAT para emisión automática de comprobantes electrónicos',
        puntos_historia: 21,
        prioridad: 'muy_alta',
        etiquetas: ['integration', 'billing', 'compliance']
      },
      {
        titulo: 'Implementar módulo de conciliación bancaria automática',
        descripcion: 'Crear sistema que reconcilie automáticamente movimientos bancarios con registros contables',
        puntos_historia: 13,
        prioridad: 'alta',
        etiquetas: ['accounting', 'banking', 'automation']
      },
      {
        titulo: 'Desarrollar dashboard financiero con KPIs',
        descripcion: 'Crear dashboard interactivo con métricas financieras clave: flujo de caja, rentabilidad, gastos',
        puntos_historia: 8,
        prioridad: 'alta',
        etiquetas: ['frontend', 'dashboard', 'finance']
      },
      {
        titulo: 'Configurar alertas de stock mínimo en inventario',
        descripcion: 'Implementar sistema de alertas automáticas cuando productos alcancen niveles mínimos de stock',
        puntos_historia: 5,
        prioridad: 'media',
        etiquetas: ['inventory', 'alerts', 'automation']
      },
      {
        titulo: 'Crear reportes automáticos de nómina',
        descripcion: 'Desarrollar generador de reportes de nómina con cálculos de beneficios sociales y deducciones',
        puntos_historia: 8,
        prioridad: 'alta',
        etiquetas: ['hr', 'reports', 'payroll']
      }
    ],
    'Integración de IA - SmartInput': [
      {
        titulo: 'Integrar OpenAI GPT-4 API para autocompletado',
        descripcion: 'Implementar conexión con API de OpenAI para generar sugerencias inteligentes en formularios',
        puntos_historia: 13,
        prioridad: 'muy_alta',
        etiquetas: ['ai', 'integration', 'openai']
      },
      {
        titulo: 'Desarrollar sistema de análisis de sentiment',
        descripcion: 'Crear módulo que analice el sentiment de feedback de usuarios usando NLP',
        puntos_historia: 8,
        prioridad: 'alta',
        etiquetas: ['ai', 'nlp', 'sentiment']
      },
      {
        titulo: 'Implementar cache Redis para respuestas de IA',
        descripcion: 'Configurar sistema de cache que almacene respuestas frecuentes para optimizar performance',
        puntos_historia: 5,
        prioridad: 'alta',
        etiquetas: ['cache', 'redis', 'performance']
      },
      {
        titulo: 'Crear chatbot con contexto conversacional',
        descripcion: 'Desarrollar chatbot que mantenga contexto de conversación y proporcione respuestas coherentes',
        puntos_historia: 21,
        prioridad: 'alta',
        etiquetas: ['ai', 'chatbot', 'conversation']
      },
      {
        titulo: 'Implementar OCR para digitalización de documentos',
        descripcion: 'Integrar tecnología OCR para extraer texto de imágenes y documentos PDF automáticamente',
        puntos_historia: 13,
        prioridad: 'media',
        etiquetas: ['ai', 'ocr', 'documents']
      }
    ]
  },

  // Bugs comunes por tipo de aplicación
  bugs: {
    'AppScrum - Gestión Ágil': [
      {
        titulo: 'Error de permisos en edición de backlog items',
        descripcion: 'Usuarios con rol Developer pueden editar items que solo deberían modificar Product Owners',
        puntos_historia: 3,
        prioridad: 'alta',
        etiquetas: ['security', 'permissions', 'backlog']
      },
      {
        titulo: 'Fechas de sprint se superponen en calendario',
        descripcion: 'Al crear sprints consecutivos, las fechas se superponen causando conflictos en la planificación',
        puntos_historia: 2,
        prioridad: 'media',
        etiquetas: ['calendar', 'dates', 'sprints']
      },
      {
        titulo: 'Burndown chart muestra datos incorrectos',
        descripcion: 'El gráfico de burndown no actualiza correctamente cuando se completan tareas, mostrando progreso erróneo',
        puntos_historia: 3,
        prioridad: 'alta',
        etiquetas: ['charts', 'metrics', 'dashboard']
      },
      {
        titulo: 'Error de memoria en carga de proyectos grandes',
        descripcion: 'La aplicación se vuelve lenta y consume excesiva memoria al cargar proyectos con +1000 backlog items',
        puntos_historia: 5,
        prioridad: 'alta',
        etiquetas: ['performance', 'memory', 'optimization']
      }
    ],
    'App Gestión Empresarial': [
      {
        titulo: 'Cálculo incorrecto de IVA en facturas',
        descripcion: 'El sistema calcula mal el IVA cuando hay productos con diferentes tipos de impuestos en la misma factura',
        puntos_historia: 5,
        prioridad: 'muy_alta',
        etiquetas: ['billing', 'tax', 'calculation']
      },
      {
        titulo: 'Conciliación bancaria duplica movimientos',
        descripcion: 'Al importar archivos bancarios, algunos movimientos se duplican causando descuadres contables',
        puntos_historia: 3,
        prioridad: 'alta',
        etiquetas: ['banking', 'accounting', 'duplicates']
      },
      {
        titulo: 'Reportes financieros exportan datos incompletos',
        descripcion: 'Al exportar reportes a Excel, se pierden algunas filas y totales no coinciden',
        puntos_historia: 2,
        prioridad: 'media',
        etiquetas: ['reports', 'export', 'excel']
      },
      {
        titulo: 'Error de stock negativo en inventario',
        descripcion: 'El sistema permite ventas que resultan en stock negativo sin mostrar alertas apropiadas',
        puntos_historia: 3,
        prioridad: 'alta',
        etiquetas: ['inventory', 'validation', 'stock']
      }
    ],
    'Integración de IA - SmartInput': [
      {
        titulo: 'API de OpenAI retorna respuestas inconsistentes',
        descripcion: 'Las sugerencias de autocompletado varían drásticamente para inputs similares, confundiendo a usuarios',
        puntos_historia: 3,
        prioridad: 'alta',
        etiquetas: ['ai', 'consistency', 'openai']
      },
      {
        titulo: 'Error de encoding con caracteres especiales',
        descripcion: 'El sistema falla al procesar texto con emojis, tildes y caracteres UTF-8 especiales',
        puntos_historia: 2,
        prioridad: 'media',
        etiquetas: ['encoding', 'utf8', 'text-processing']
      },
      {
        titulo: 'Timeout en análisis de documentos grandes',
        descripcion: 'El OCR falla con timeout al procesar documentos PDF de más de 10MB',
        puntos_historia: 3,
        prioridad: 'alta',
        etiquetas: ['ocr', 'timeout', 'performance']
      },
      {
        titulo: 'Chatbot pierde contexto después de 5 mensajes',
        descripcion: 'En conversaciones largas, el chatbot olvida el contexto inicial y da respuestas irrelevantes',
        puntos_historia: 5,
        prioridad: 'alta',
        etiquetas: ['chatbot', 'context', 'memory']
      }
    ]
  },

  // Mejoras por producto
  mejoras: {
    'AppScrum - Gestión Ágil': [
      {
        titulo: 'Implementar drag & drop para reordenar backlog',
        descripcion: 'Agregar funcionalidad de arrastrar y soltar para reordenar items del product backlog de forma intuitiva',
        puntos_historia: 8,
        prioridad: 'media',
        etiquetas: ['ux', 'backlog', 'drag-drop']
      },
      {
        titulo: 'Agregar modo oscuro a la aplicación',
        descripcion: 'Implementar tema oscuro con persistencia de preferencia del usuario para mejorar experiencia nocturna',
        puntos_historia: 5,
        prioridad: 'baja',
        etiquetas: ['ui', 'theme', 'accessibility']
      },
      {
        titulo: 'Crear plantillas predefinidas de user stories',
        descripcion: 'Agregar plantillas comunes de historias de usuario para acelerar la creación de backlog items',
        puntos_historia: 3,
        prioridad: 'media',
        etiquetas: ['templates', 'productivity', 'backlog']
      },
      {
        titulo: 'Implementar notificaciones push para móviles',
        descripcion: 'Agregar notificaciones push para alertar sobre cambios importantes en sprints y asignaciones',
        puntos_historia: 13,
        prioridad: 'baja',
        etiquetas: ['mobile', 'notifications', 'push']
      }
    ],
    'App Gestión Empresarial': [
      {
        titulo: 'Agregar dashboard de predicciones financieras',
        descripcion: 'Implementar algoritmos de ML para predecir flujo de caja y tendencias financieras',
        puntos_historia: 21,
        prioridad: 'media',
        etiquetas: ['ml', 'predictions', 'finance']
      },
      {
        titulo: 'Implementar firma digital en documentos',
        descripcion: 'Agregar capacidad de firmar digitalmente contratos y documentos importantes',
        puntos_historia: 13,
        prioridad: 'media',
        etiquetas: ['digital-signature', 'documents', 'security']
      },
      {
        titulo: 'Crear app móvil para consultas rápidas',
        descripcion: 'Desarrollar aplicación móvil para consultar inventario, ventas y reportes básicos',
        puntos_historia: 34,
        prioridad: 'baja',
        etiquetas: ['mobile', 'app', 'consulting']
      },
      {
        titulo: 'Optimizar rendimiento de reportes complejos',
        descripcion: 'Implementar paginación y lazy loading en reportes con grandes volúmenes de datos',
        puntos_historia: 8,
        prioridad: 'alta',
        etiquetas: ['performance', 'reports', 'optimization']
      }
    ],
    'Integración de IA - SmartInput': [
      {
        titulo: 'Implementar aprendizaje personalizado por usuario',
        descripcion: 'Crear sistema que aprenda patrones individuales de cada usuario para mejorar sugerencias',
        puntos_historia: 21,
        prioridad: 'alta',
        etiquetas: ['ai', 'personalization', 'learning']
      },
      {
        titulo: 'Agregar soporte para múltiples idiomas',
        descripcion: 'Extender capacidades de IA para procesar y responder en español, inglés y portugués',
        puntos_historia: 13,
        prioridad: 'media',
        etiquetas: ['i18n', 'multilingual', 'ai']
      },
      {
        titulo: 'Implementar métricas de calidad de respuestas',
        descripcion: 'Crear dashboard para monitorear precisión, relevancia y satisfacción de respuestas de IA',
        puntos_historia: 8,
        prioridad: 'media',
        etiquetas: ['metrics', 'quality', 'monitoring']
      },
      {
        titulo: 'Crear marketplace de prompts predefinidos',
        descripcion: 'Implementar biblioteca de prompts reutilizables para diferentes casos de uso empresariales',
        puntos_historia: 13,
        prioridad: 'baja',
        etiquetas: ['prompts', 'marketplace', 'reusability']
      }
    ]
  }
};

// =======================================
// FUNCIONES DE GENERACIÓN
// =======================================

// Función para obtener items aleatorios
function getRandomItems(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, array.length));
}

// Función para determinar estado realista
function getRealisticState() {
  const random = Math.random();
  if (random < 0.7) return 'pendiente';      // 70% pendientes (más disponibles)
  else if (random < 0.9) return 'en_progreso'; // 20% en progreso
  else return 'completado';                   // 10% completados
}

// Función para asignar desarrollador
function assignRandomDeveloper(developers) {
  // 40% probabilidad de asignación (más tareas disponibles para developers)
  if (Math.random() < 0.4 && developers.length > 0) {
    return developers[Math.floor(Math.random() * developers.length)]._id;
  }
  return null; // 60% quedan sin asignar = disponibles para tomar
}

// Función para convertir estado de BacklogItem a Task
function mapBacklogStatusToTaskStatus(backlogStatus) {
  switch (backlogStatus) {
    case 'pendiente': return 'todo';
    case 'en_progreso': return 'in_progress';
    case 'completado': return 'done';
    case 'bloqueado': return 'todo'; // Tasks bloqueadas vuelven a todo
    default: return 'todo';
  }
}

// Función para convertir prioridad de BacklogItem a Task
function mapBacklogPriorityToTaskPriority(backlogPriority) {
  switch (backlogPriority) {
    case 'muy_alta': return 'critical';
    case 'alta': return 'high';
    case 'media': return 'medium';
    case 'baja': return 'low';
    default: return 'medium';
  }
}

// Función para convertir tipo de BacklogItem a Task
function mapBacklogTypeToTaskType(backlogType) {
  switch (backlogType) {
    case 'tarea': return 'task';
    case 'bug': return 'bug';
    case 'mejora': return 'task'; // Las mejoras se mapean como tasks
    case 'historia': return 'story';
    default: return 'task';
  }
}

// NOTA: Las Tasks se crean automáticamente cuando un developer se auto-asigna
// No creamos Tasks en este script, solo BacklogItems disponibles para asignación

// =======================================
// FUNCIÓN PRINCIPAL
// =======================================

async function createComprehensiveTechnicalItems() {
  console.log('🚀 CREANDO ITEMS TÉCNICOS PARA TESTING COMPLETO\n');
  
  try {
    // Obtener datos base
    console.log('📊 Recopilando datos base...');
    const [productos, sprints, historias, desarrolladores, usuarios] = await Promise.all([
      Product.find({}),
      Sprint.find({ estado: 'activo' }).populate('producto'),
      BacklogItem.find({ tipo: 'historia', sprint: { $exists: true } }).populate('producto').populate('sprint'),
      User.find({ role: { $in: ['developer', 'tech_lead'] } }),
      User.find({}) // Obtener todos los usuarios para encontrar un created_by
    ]);

    console.log(`   📦 Productos: ${productos.length}`);
    console.log(`   🏃‍♂️ Sprints activos: ${sprints.length}`);
    console.log(`   📝 Historias asignadas: ${historias.length}`);
    console.log(`   👥 Desarrolladores: ${desarrolladores.length}`);
    console.log(`   👤 Usuarios totales: ${usuarios.length}\n`);

    if (sprints.length === 0) {
      console.log('❌ No hay sprints activos. Ejecuta primero los scripts de setup.');
      return;
    }

    if (usuarios.length === 0) {
      console.log('❌ No hay usuarios en la base de datos. Ejecuta primero los scripts de setup.');
      return;
    }

    // Usuario para asignar como creador (puede ser cualquier usuario)
    const createdBy = usuarios[0]._id;

    // Verificar items técnicos existentes
    const existingTechnicalItems = await BacklogItem.countDocuments({
      tipo: { $in: ['tarea', 'bug', 'mejora'] }
    });

    if (existingTechnicalItems > 0) {
      console.log(`⚠️  ATENCIÓN: Ya existen ${existingTechnicalItems} items técnicos en la base de datos`);
      console.log('   El script omitirá duplicados basándose en título y contexto\n');
    }

    // =======================================
    // ESTRATEGIA DE CREACIÓN
    // =======================================
    console.log('🎯 ESTRATEGIA DE CREACIÓN:');
    console.log('   • Para cada sprint: 3-6 tareas técnicas SIN ASIGNAR');
    console.log('   • Para cada sprint: 1-3 bugs realistas SIN ASIGNAR');
    console.log('   • Para cada producto: 2-3 mejoras SIN ASIGNAR');
    console.log('   • Todos los items disponibles para auto-asignación');
    console.log('   • Items listos para asignación manual por Scrum Master\n');

    let totalCreated = 0;
    const createdItems = {
      tareas: 0,
      bugs: 0,
      mejoras: 0
    };

    // =======================================
    // 1. CREAR TAREAS TÉCNICAS SIN ASIGNAR
    // =======================================
    console.log('🔧 PASO 1: Creando tareas técnicas sin asignar...\n');
    
    for (const sprint of sprints) {
      const productoNombre = sprint.producto.nombre;
      const templates = TECHNICAL_TEMPLATES.tareas[productoNombre] || TECHNICAL_TEMPLATES.tareas['AppScrum - Gestión Ágil'];
      
      console.log(`   🏃‍♂️ Sprint: ${sprint.nombre}`);
      console.log(`      Producto: ${productoNombre}`);
      
      // Crear 3-6 tareas por sprint (sin asignar a historias)
      const numTareas = Math.floor(Math.random() * 4) + 3; // 3-6
      const tareasSeleccionadas = getRandomItems(templates, numTareas);
      
      for (const plantilla of tareasSeleccionadas) {
        // Verificar si ya existe una tarea similar en este sprint
        const existingTask = await BacklogItem.findOne({
          titulo: plantilla.titulo,
          tipo: 'tarea',
          sprint: sprint._id,
          producto: sprint.producto._id
        });

        if (existingTask) {
          console.log(`      ⚠️  Tarea ya existe: ${plantilla.titulo} (saltando)`);
          continue;
        }

        const nuevaTarea = new BacklogItem({
          titulo: plantilla.titulo,
          descripcion: plantilla.descripcion,
          tipo: 'tarea',
          prioridad: plantilla.prioridad,
          estado: 'pendiente', // Items sin asignar comienzan como pendientes
          puntos_historia: plantilla.puntos_historia,
          producto: sprint.producto._id,
          sprint: sprint._id,
          // NO incluir asignado_a - campo no existe = disponible para developers
          etiquetas: plantilla.etiquetas,
          created_by: createdBy,
          fecha_creacion: new Date(),
          fecha_actualizacion: new Date()
        });
        
        await nuevaTarea.save();
        createdItems.tareas++;
        totalCreated++;
        
        console.log(`      ✅ Tarea: ${plantilla.titulo} (${plantilla.puntos_historia} pts) - DISPONIBLE`);
      }
      console.log('');
    }

    // =======================================
    // 2. CREAR BUGS POR SPRINT
    // =======================================
    console.log('🐛 PASO 2: Creando bugs por sprint...\n');
    
    for (const sprint of sprints) {
      const productoNombre = sprint.producto.nombre;
      const templates = TECHNICAL_TEMPLATES.bugs[productoNombre] || TECHNICAL_TEMPLATES.bugs['AppScrum - Gestión Ágil'];
      
      console.log(`   🏃‍♂️ Sprint: ${sprint.nombre} (${productoNombre})`);
      
      // Crear 1-3 bugs por sprint
      const numBugs = Math.floor(Math.random() * 3) + 1; // 1-3
      const bugsSeleccionados = getRandomItems(templates, numBugs);
      
      for (const plantilla of bugsSeleccionados) {
        // Verificar si ya existe un bug similar en este sprint
        const existingBug = await BacklogItem.findOne({
          titulo: plantilla.titulo,
          tipo: 'bug',
          sprint: sprint._id,
          producto: sprint.producto._id
        });

        if (existingBug) {
          console.log(`      ⚠️  Bug ya existe: ${plantilla.titulo} (saltando)`);
          continue;
        }

        const nuevoBug = new BacklogItem({
          titulo: plantilla.titulo,
          descripcion: plantilla.descripcion,
          tipo: 'bug',
          prioridad: plantilla.prioridad,
          estado: 'pendiente', // Bugs sin asignar comienzan como pendientes
          puntos_historia: plantilla.puntos_historia,
          producto: sprint.producto._id,
          sprint: sprint._id,
          // NO incluir asignado_a - campo no existe = disponible para developers
          etiquetas: plantilla.etiquetas,
          created_by: createdBy,
          fecha_creacion: new Date(),
          fecha_actualizacion: new Date()
        });
        
        await nuevoBug.save();
        createdItems.bugs++;
        totalCreated++;
        
        console.log(`      🐛 Bug: ${plantilla.titulo} (${plantilla.puntos_historia} pts) - DISPONIBLE`);
      }
      console.log('');
    }

    // =======================================
    // 3. CREAR MEJORAS POR PRODUCTO
    // =======================================
    console.log('⚡ PASO 3: Creando mejoras por producto...\n');
    
    for (const producto of productos) {
      const templates = TECHNICAL_TEMPLATES.mejoras[producto.nombre] || TECHNICAL_TEMPLATES.mejoras['AppScrum - Gestión Ágil'];
      
      console.log(`   📦 Producto: ${producto.nombre}`);
      
      // Crear 2-3 mejoras por producto
      const numMejoras = Math.floor(Math.random() * 2) + 2; // 2-3
      const mejorasSeleccionadas = getRandomItems(templates, numMejoras);
      
      // Algunas mejoras asignadas a sprint, otras al backlog
      for (let i = 0; i < mejorasSeleccionadas.length; i++) {
        const plantilla = mejorasSeleccionadas[i];
        
        // Verificar si ya existe una mejora similar para este producto
        const existingMejora = await BacklogItem.findOne({
          titulo: plantilla.titulo,
          tipo: 'mejora',
          producto: producto._id
        });

        if (existingMejora) {
          console.log(`      ⚠️  Mejora ya existe: ${plantilla.titulo} (saltando)`);
          continue;
        }
        
        // 60% se asignan a sprint, 40% quedan en backlog
        let sprintAsignado = null;
        if (Math.random() < 0.6) {
          const sprintsProducto = sprints.filter(s => s.producto._id.toString() === producto._id.toString());
          if (sprintsProducto.length > 0) {
            sprintAsignado = sprintsProducto[Math.floor(Math.random() * sprintsProducto.length)]._id;
          }
        }
        
        const nuevaMejora = new BacklogItem({
          titulo: plantilla.titulo,
          descripcion: plantilla.descripcion,
          tipo: 'mejora',
          prioridad: plantilla.prioridad,
          estado: sprintAsignado ? 'pendiente' : 'pendiente', // Todas comienzan como pendientes
          puntos_historia: plantilla.puntos_historia,
          producto: producto._id,
          sprint: sprintAsignado,
          // NO incluir asignado_a - campo no existe = disponible para developers
          etiquetas: plantilla.etiquetas,
          created_by: createdBy,
          fecha_creacion: new Date(),
          fecha_actualizacion: new Date()
        });
        
        await nuevaMejora.save();
        createdItems.mejoras++;
        totalCreated++;
        
        const estado = sprintAsignado ? '(Asignada a sprint)' : '(En backlog)';
        console.log(`      ⚡ Mejora: ${plantilla.titulo} ${estado} (${plantilla.puntos_historia} pts) - DISPONIBLE`);
      }
      console.log('');
    }

    // =======================================
    // 4. RESUMEN FINAL
    // =======================================
    console.log('🎉 ¡CREACIÓN DE ITEMS TÉCNICOS COMPLETADA!\n');
    
    console.log('📊 RESUMEN TOTAL:');
    console.log(`   🔧 Tareas creadas: ${createdItems.tareas}`);
    console.log(`   🐛 Bugs creados: ${createdItems.bugs}`);
    console.log(`   ⚡ Mejoras creadas: ${createdItems.mejoras}`);
    console.log(`   � Tasks creadas: ${createdItems.tasks}`);
    console.log(`   �📈 Total items técnicos: ${totalCreated}\n`);
    
    // Estadísticas por estado
    const estadisticas = await Promise.all([
      BacklogItem.countDocuments({ tipo: { $in: ['tarea', 'bug', 'mejora'] }, estado: 'pendiente' }),
      BacklogItem.countDocuments({ tipo: { $in: ['tarea', 'bug', 'mejora'] }, estado: 'en_progreso' }),
      BacklogItem.countDocuments({ tipo: { $in: ['tarea', 'bug', 'mejora'] }, estado: 'completado' }),
      BacklogItem.countDocuments({ tipo: { $in: ['tarea', 'bug', 'mejora'] }, sprint: { $exists: true } }),
      BacklogItem.countDocuments({ tipo: { $in: ['tarea', 'bug', 'mejora'] }, sprint: { $exists: false } }),
      BacklogItem.countDocuments({ tipo: { $in: ['tarea', 'bug', 'mejora'] }, asignado_a: { $exists: true } })
    ]);
    
    console.log('📊 DISTRIBUCIÓN DE ITEMS TÉCNICOS:');
    console.log(`   ⏳ Pendientes: ${estadisticas[0]}`);
    console.log(`   🔄 En progreso: ${estadisticas[1]}`);
    console.log(`   ✅ Completados: ${estadisticas[2]}`);
    console.log(`   🏃‍♂️ Asignados a sprint: ${estadisticas[3]}`);
    console.log(`   📋 En backlog técnico: ${estadisticas[4]}`);
    console.log(`   👥 Con developer asignado: ${estadisticas[5]} (Todos disponibles para auto-asignación)\n`);
    
    console.log('✨ El entorno de testing está listo para pruebas manuales!');
    console.log('🔍 Puedes probar:');
    console.log('   • Asignación manual de items técnicos a historias');
    console.log('   • Gestión de sprints con items sin asignar');
    console.log('   • Auto-asignación de tareas por developers');
    console.log('   • Creación de nuevos bugs y mejoras');
    console.log('   • Visualización de métricas y progreso');
    console.log('   • Flujo completo de Scrum Master');
    console.log('   • Tasks se crearán cuando developers se auto-asignen');

  } catch (error) {
    console.error('❌ Error creando items técnicos:', error);
  }
}

// Función para limpiar items técnicos existentes
async function cleanTechnicalItems() {
  try {
    console.log('🧹 Limpiando items técnicos existentes...');
    
    // Eliminar BacklogItems técnicos (Tasks se crean dinámicamente al asignar)
    const backlogResult = await BacklogItem.deleteMany({
      tipo: { $in: ['tarea', 'bug', 'mejora'] }
    });
    
    console.log(`✅ Eliminados ${backlogResult.deletedCount} items técnicos del backlog`);
    
  } catch (error) {
    console.error('❌ Error limpiando items técnicos:', error);
  }
}

// Ejecutar script
async function run() {
  await connectDB();
  
  const args = process.argv.slice(2);
  
  if (args.includes('--clean')) {
    await cleanTechnicalItems();
  }
  
  if (!args.includes('--clean-only')) {
    await createComprehensiveTechnicalItems();
  }
  
  console.log('\n✨ Script finalizado');
  process.exit(0);
}

// Ejecutar si es el archivo principal
if (require.main === module) {
  run().catch(error => {
    console.error('❌ Error ejecutando script:', error);
    process.exit(1);
  });
}

module.exports = createComprehensiveTechnicalItems;
