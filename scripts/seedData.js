const mongoose = require('mongoose');
require('dotenv').config();

const Impediment = require('../models/Impediment');
const Ceremony = require('../models/Ceremony');
const User = require('../models/User');

const seedData = async () => {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conexión exitosa');

    // Limpiar datos existentes
    console.log('Limpiando datos existentes...');
    await Impediment.deleteMany({});
    await Ceremony.deleteMany({});
    
    // Limpiar datos del módulo de developers
    const Task = require('../models/Task');
    const TimeTracking = require('../models/TimeTracking');
    const BugReport = require('../models/BugReport');
    const Sprint = require('../models/Sprint');
    
    await Task.deleteMany({});
    await TimeTracking.deleteMany({});
    await BugReport.deleteMany({});
    await Sprint.deleteMany({});

    // Crear usuarios de ejemplo (si no existen)
    let scrumMaster = await User.findOne({ email: 'scrummaster@example.com' });
    if (!scrumMaster) {
      scrumMaster = new User({
        clerk_id: 'clerk_scrummaster_demo',
        nombre_negocio: 'Scrum Master',
        email: 'scrummaster@example.com',
        role: 'scrum_master'
      });
      await scrumMaster.save();
    }

    let developer1 = await User.findOne({ email: 'ana.garcia@example.com' });
    if (!developer1) {
      developer1 = new User({
        clerk_id: 'clerk_ana_garcia_demo',
        nombre_negocio: 'Ana García',
        email: 'ana.garcia@example.com',
        role: 'developers'
      });
      await developer1.save();
    }

    let developer2 = await User.findOne({ email: 'carlos.lopez@example.com' });
    if (!developer2) {
      developer2 = new User({
        clerk_id: 'clerk_carlos_lopez_demo',
        nombre_negocio: 'Carlos López',
        email: 'carlos.lopez@example.com',
        role: 'developers'
      });
      await developer2.save();
    }

    // Crear impedimentos de ejemplo
    console.log('Creando impedimentos de ejemplo...');
    const impediments = [
      {
        title: 'Dependencia con API externa',
        description: 'El servicio de pagos está experimentando problemas de conectividad que impiden completar las pruebas.',
        responsible: 'Carlos López',
        status: 'open',
        priority: 'high',
        category: 'external_dependency',
        createdBy: scrumMaster._id,
        assignedTo: developer2._id
      },
      {
        title: 'Conflicto en base de datos',
        description: 'Hay un conflicto en el esquema de la base de datos que está bloqueando el desarrollo del módulo de reportes.',
        responsible: 'Ana García',
        status: 'in_progress',
        priority: 'medium',
        category: 'technical',
        createdBy: scrumMaster._id,
        assignedTo: developer1._id
      },
      {
        title: 'Falta de claridad en requisitos',
        description: 'El Product Owner no ha definido claramente los criterios de aceptación para la historia US-105.',
        responsible: 'María Rodríguez',
        status: 'resolved',
        priority: 'medium',
        category: 'requirements',
        createdBy: scrumMaster._id,
        resolvedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // hace 2 días
      }
    ];

    await Impediment.insertMany(impediments);
    console.log('Impedimentos creados exitosamente');

    // Crear ceremonias de ejemplo
    console.log('Creando ceremonias de ejemplo...');
    const ceremonies = [
      {
        type: 'sprint_planning',
        title: 'Sprint Planning - Sprint 23',
        description: 'Planificación del Sprint 23 - Módulo de reportes y métricas',
        date: new Date(Date.now() + 24 * 60 * 60 * 1000), // mañana
        startTime: '09:00',
        duration: 120,
        status: 'scheduled',
        facilitator: scrumMaster._id,
        participants: [
          { user: scrumMaster._id, role: 'facilitator' },
          { user: developer1._id, role: 'participant' },
          { user: developer2._id, role: 'participant' }
        ],
        goals: [
          'Definir objetivos del Sprint 23',
          'Estimar historias de usuario',
          'Asignar tareas al equipo'
        ],
        createdBy: scrumMaster._id
      },
      {
        type: 'daily_standup',
        title: 'Daily Standup',
        description: 'Reunión diaria de sincronización del equipo',
        date: new Date(), // hoy
        startTime: '09:00',
        duration: 15,
        status: 'completed',
        facilitator: scrumMaster._id,
        participants: [
          { user: scrumMaster._id, role: 'facilitator', attendance: 'confirmed' },
          { user: developer1._id, role: 'participant', attendance: 'confirmed' },
          { user: developer2._id, role: 'participant', attendance: 'confirmed' }
        ],
        notes: 'Revisión de progreso diario. Carlos reportó bloqueo con API externa.',
        blockers: [{ description: 'Dependencia con API de pagos', owner: developer2._id }],
        createdBy: scrumMaster._id
      },
      {
        type: 'retrospective',
        title: 'Sprint Retrospective - Sprint 22',
        description: 'Retrospectiva del Sprint 22 para identificar mejoras',
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // hace una semana
        startTime: '14:00',
        duration: 90,
        status: 'completed',
        facilitator: scrumMaster._id,
        participants: [
          { user: scrumMaster._id, role: 'facilitator', attendance: 'confirmed' },
          { user: developer1._id, role: 'participant', attendance: 'confirmed' },
          { user: developer2._id, role: 'participant', attendance: 'tentative' }
        ],
        goals: [
          'Identificar qué funcionó bien',
          'Detectar áreas de mejora',
          'Definir acciones para el próximo sprint'
        ],
        createdBy: scrumMaster._id
      }
    ];

    await Ceremony.insertMany(ceremonies);
    console.log('Ceremonias creadas exitosamente');

    // Crear Producto de ejemplo
    const Product = require('../models/Product');
    let product = await Product.findOne({ nombre: 'AppScrum Demo' });
    if (!product) {
      product = new Product({
        nombre: 'AppScrum Demo',
        descripcion: 'Aplicación de gestión Scrum para demostración',
        responsable: scrumMaster._id,
        estado: 'activo',
        fecha_inicio: new Date('2025-01-01'),
        created_by: scrumMaster._id
      });
      await product.save();
    }
    console.log('Producto creado exitosamente');

    // Crear Sprint de ejemplo
    const sprint = new Sprint({
      nombre: 'Sprint 2025-01',
      objetivo: 'Implementar sistema de autenticación y mejoras de rendimiento',
      fecha_inicio: new Date('2025-01-01'),
      fecha_fin: new Date('2025-01-14'),
      estado: 'activo',
      producto: product._id,
      velocidad_planificada: 80,
      velocidad_real: 65,
      created_by: scrumMaster._id
    });
    await sprint.save();
    console.log('Sprint creado exitosamente');

    // Crear tareas de ejemplo
    const taskIds = [];
    const tasks = [
      {
        title: 'Implementar autenticación JWT',
        description: 'Desarrollar sistema de autenticación usando JSON Web Tokens',
        type: 'story',
        status: 'in_progress',
        priority: 'high',
        storyPoints: 8,
        estimatedHours: 16,
        actualHours: 10,
        assignee: developer1._id,
        reporter: scrumMaster._id,
        sprint: sprint._id,
        createdBy: scrumMaster._id
      },
      {
        title: 'Corregir bug en validación',
        description: 'Solucionar problema de validación en formularios',
        type: 'bug',
        status: 'todo',
        priority: 'medium',
        storyPoints: 3,
        estimatedHours: 6,
        assignee: developer1._id,
        reporter: scrumMaster._id,
        sprint: sprint._id,
        createdBy: scrumMaster._id
      },
      {
        title: 'Optimizar consultas DB',
        description: 'Mejorar rendimiento de consultas a la base de datos',
        type: 'task',
        status: 'done',
        priority: 'low',
        storyPoints: 5,
        estimatedHours: 12,
        actualHours: 8,
        assignee: developer1._id,
        reporter: scrumMaster._id,
        sprint: sprint._id,
        completedAt: new Date(),
        createdBy: scrumMaster._id
      },
      {
        title: 'Tests unitarios',
        description: 'Escribir tests unitarios para módulo de autenticación',
        type: 'task',
        status: 'in_progress',
        priority: 'high',
        storyPoints: 13,
        estimatedHours: 24,
        actualHours: 15,
        assignee: developer1._id,
        reporter: scrumMaster._id,
        sprint: sprint._id,
        createdBy: scrumMaster._id
      },
      {
        title: 'Diseño de componentes',
        description: 'Crear componentes UI para el dashboard',
        type: 'story',
        status: 'todo',
        priority: 'medium',
        storyPoints: 5,
        estimatedHours: 10,
        assignee: developer2._id,
        reporter: scrumMaster._id,
        sprint: sprint._id,
        createdBy: scrumMaster._id
      },
      {
        title: 'Integración API externa',
        description: 'Conectar con API de terceros',
        type: 'story',
        status: 'in_progress',
        priority: 'high',
        storyPoints: 8,
        estimatedHours: 16,
        actualHours: 6,
        assignee: developer2._id,
        reporter: scrumMaster._id,
        sprint: sprint._id,
        createdBy: scrumMaster._id
      },
      {
        title: 'Documentación técnica',
        description: 'Escribir documentación del API',
        type: 'task',
        status: 'done',
        priority: 'low',
        storyPoints: 3,
        estimatedHours: 8,
        actualHours: 6,
        assignee: developer2._id,
        reporter: scrumMaster._id,
        sprint: sprint._id,
        completedAt: new Date(Date.now() - 86400000), // Ayer
        createdBy: scrumMaster._id
      }
    ];

    const insertedTasks = await Task.insertMany(tasks);
    console.log('Tareas creadas exitosamente');

    // Crear registros de time tracking
    const timeTrackingEntries = [
      {
        user: developer1._id,
        task: insertedTasks[0]._id,
        startTime: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 horas atrás
        endTime: new Date(),
        duration: 240, // 4 horas en minutos
        hours: 4,
        description: 'Investigación sobre JWT y configuración inicial',
        date: new Date(),
        category: 'development'
      },
      {
        user: developer1._id,
        task: insertedTasks[0]._id,
        startTime: new Date(Date.now() - 86400000 - 6 * 60 * 60 * 1000), // Ayer, 6 horas
        endTime: new Date(Date.now() - 86400000),
        duration: 360, // 6 horas en minutos
        hours: 6,
        description: 'Implementación del middleware de autenticación',
        date: new Date(Date.now() - 86400000), // Ayer
        category: 'development'
      },
      {
        user: developer1._id,
        task: insertedTasks[3]._id,
        startTime: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 horas atrás
        endTime: new Date(),
        duration: 180, // 3 horas en minutos
        hours: 3,
        description: 'Setup de testing framework',
        date: new Date(),
        category: 'testing'
      },
      {
        user: developer2._id,
        task: insertedTasks[5]._id,
        startTime: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 horas atrás
        endTime: new Date(),
        duration: 360, // 6 horas en minutos
        hours: 6,
        description: 'Configuración inicial de API externa',
        date: new Date(),
        category: 'development'
      }
    ];

    await TimeTracking.insertMany(timeTrackingEntries);
    console.log('Registros de time tracking creados exitosamente');

    // Crear reportes de bugs
    const bugReports = [
      {
        title: 'Error en login con credenciales especiales',
        description: 'El sistema falla cuando el usuario tiene caracteres especiales en la contraseña',
        severity: 'major',
        priority: 'high',
        status: 'open',
        category: 'authentication',
        stepsToReproduce: 'Ir a la página de login\nIngresar email válido\nIngresar contraseña con caracteres especiales (@#$%)\nHacer click en "Iniciar Sesión"',
        expectedBehavior: 'El usuario debería poder iniciar sesión correctamente',
        actualBehavior: 'Se muestra error 500 y el usuario no puede ingresar',
        environment: {
          browser: 'Chrome 120.0',
          os: 'Windows 11',
          device: 'Desktop'
        },
        reportedBy: developer2._id,
        assignedTo: developer1._id,
        tags: ['login', 'authentication', 'special-characters']
      },
      {
        title: 'Dashboard no carga en móviles',
        description: 'El dashboard principal no se renderiza correctamente en dispositivos móviles',
        severity: 'major',
        priority: 'medium',
        status: 'in_progress',
        category: 'ui',
        stepsToReproduce: 'Abrir la aplicación en un dispositivo móvil\nIniciar sesión correctamente\nNavegar al dashboard',
        expectedBehavior: 'El dashboard debería mostrarse responsive',
        actualBehavior: 'Los elementos se superponen y no es usable',
        environment: {
          browser: 'Safari Mobile',
          os: 'iOS 17',
          device: 'iPhone 14'
        },
        reportedBy: developer1._id,
        assignedTo: developer2._id,
        tags: ['responsive', 'mobile', 'dashboard']
      }
    ];

    await BugReport.insertMany(bugReports);
    console.log('Reportes de bugs creados exitosamente');

    console.log('Datos de ejemplo creados exitosamente');
    console.log(`- ${impediments.length} impedimentos`);
    console.log(`- ${ceremonies.length} ceremonias`);
    console.log(`- 1 producto`);
    console.log(`- 1 sprint activo`);
    console.log(`- ${insertedTasks.length} tareas`);
    console.log(`- ${timeTrackingEntries.length} registros de time tracking`);
    console.log(`- ${bugReports.length} reportes de bugs`);

  } catch (error) {
    console.error('Error al crear datos de ejemplo:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Conexión cerrada');
  }
};

// Ejecutar si el archivo se llama directamente
if (require.main === module) {
  seedData();
}

module.exports = seedData;
