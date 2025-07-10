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

    console.log('Datos de ejemplo creados exitosamente');
    console.log(`- ${impediments.length} impedimentos`);
    console.log(`- ${ceremonies.length} ceremonias`);

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
