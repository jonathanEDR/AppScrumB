const mongoose = require('mongoose');
const Sprint = require('../models/Sprint');
const Product = require('../models/Product');
const Release = require('../models/Release');
const User = require('../models/User');
require('dotenv').config();

// Configuración de conexión a MongoDB local
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/AppScrum';

// PASO 1: Datos de Releases por producto
const RELEASES_POR_PRODUCTO = {
  'AppScrum - Gestión Ágil': [
    {
      nombre: 'v1.0.0 - MVP Gestión Ágil',
      descripcion: 'Primera versión funcional con características básicas de gestión Scrum',
      version: '1.0.0',
      fecha_objetivo: new Date('2025-10-31'), // 3 meses adelante
      prioridad: 'alta',
      estado: 'planificado'
    },
    {
      nombre: 'v1.1.0 - Mejoras Avanzadas',
      descripcion: 'Funcionalidades avanzadas de análisis y reportes',
      version: '1.1.0',
      fecha_objetivo: new Date('2025-01-15'), // 5 meses adelante
      prioridad: 'media',
      estado: 'planificado'
    }
  ],
  'App Gestión Empresarial': [
    {
      nombre: 'v2.0.0 - Core Empresarial',
      descripcion: 'Suite completa de gestión empresarial con contabilidad e inventarios',
      version: '2.0.0',
      fecha_objetivo: new Date('2025-12-15'), // 4 meses adelante
      prioridad: 'alta',
      estado: 'planificado'
    }
  ],
  'Integración de IA - SmartInput': [
    {
      nombre: 'v0.8.0 - Beta IA',
      descripcion: 'Versión beta con capacidades básicas de IA conversacional',
      version: '0.8.0',
      fecha_objetivo: new Date('2025-09-30'), // 2 meses adelante
      prioridad: 'critica',
      estado: 'en_desarrollo'
    },
    {
      nombre: 'v1.0.0 - IA Production',
      descripcion: 'Versión de producción con IA completa y integrations',
      version: '1.0.0',
      fecha_objetivo: new Date('2025-11-30'), // 4 meses adelante
      prioridad: 'alta',
      estado: 'planificado'
    }
  ]
};

// PASO 2: Datos de Sprints ASOCIADOS a releases
const SPRINTS_ASOCIADOS = {
  'AppScrum - Gestión Ágil': {
    'v1.0.0 - MVP Gestión Ágil': [
      {
        nombre: 'Sprint 1 - Autenticación y Roles',
        objetivo: 'Implementar sistema de autenticación seguro y gestión de roles de usuario',
        duracion_semanas: 2,
        velocidad_planificada: 25,
        prioridad: 'alta',
        capacidad_equipo: 80,
        progreso: 0,
        estado: 'activo'
      },
      {
        nombre: 'Sprint 2 - Product Backlog MVP',
        objetivo: 'Desarrollar funcionalidades básicas del product backlog',
        duracion_semanas: 2,
        velocidad_planificada: 30,
        prioridad: 'alta',
        capacidad_equipo: 80,
        progreso: 0,
        estado: 'activo'
      },
      {
        nombre: 'Sprint 3 - Dashboard Básico',
        objetivo: 'Crear dashboard principal con métricas esenciales',
        duracion_semanas: 2,
        velocidad_planificada: 28,
        prioridad: 'alta',
        capacidad_equipo: 80,
        progreso: 0,
        estado: 'activo'
      }
    ],
    'v1.1.0 - Mejoras Avanzadas': [
      {
        nombre: 'Sprint 4 - Análisis Avanzado',
        objetivo: 'Implementar métricas avanzadas y reportes detallados',
        duracion_semanas: 3,
        velocidad_planificada: 35,
        prioridad: 'media',
        capacidad_equipo: 120,
        progreso: 0,
        estado: 'activo'
      }
    ]
  },
  'App Gestión Empresarial': {
    'v2.0.0 - Core Empresarial': [
      {
        nombre: 'Sprint 1 - Contabilidad Core',
        objetivo: 'Desarrollar módulo central de contabilidad empresarial',
        duracion_semanas: 3,
        velocidad_planificada: 40,
        prioridad: 'alta',
        capacidad_equipo: 120,
        progreso: 0,
        estado: 'activo'
      },
      {
        nombre: 'Sprint 2 - Inventarios Básicos',
        objetivo: 'Sistema básico de gestión de inventarios',
        duracion_semanas: 2,
        velocidad_planificada: 35,
        prioridad: 'alta',
        capacidad_equipo: 80,
        progreso: 0,
        estado: 'activo'
      }
    ]
  },
  'Integración de IA - SmartInput': {
    'v0.8.0 - Beta IA': [
      {
        nombre: 'Sprint 1 - Motor IA Beta',
        objetivo: 'Desarrollar versión beta del motor de IA conversacional',
        duracion_semanas: 4,
        velocidad_planificada: 35,
        prioridad: 'critica',
        capacidad_equipo: 160,
        progreso: 0,
        estado: 'activo'
      }
    ],
    'v1.0.0 - IA Production': [
      {
        nombre: 'Sprint 2 - IA Optimizada',
        objetivo: 'Optimizar motor de IA para producción',
        duracion_semanas: 3,
        velocidad_planificada: 38,
        prioridad: 'alta',
        capacidad_equipo: 120,
        progreso: 0,
        estado: 'activo'
      },
      {
        nombre: 'Sprint 3 - Integraciones Final',
        objetivo: 'Completar integraciones y preparar para producción',
        duracion_semanas: 2,
        velocidad_planificada: 30,
        prioridad: 'alta',
        capacidad_equipo: 80,
        progreso: 0,
        estado: 'activo'
      }
    ]
  }
};

// PASO 3: Sprints INDEPENDIENTES (no asociados a releases)
const SPRINTS_INDEPENDIENTES = [
  {
    nombre: 'Sprint Mantenimiento - Seguridad',
    objetivo: 'Actualizar dependencias de seguridad y resolver vulnerabilidades',
    producto: 'AppScrum - Gestión Ágil',
    duracion_semanas: 1,
    velocidad_planificada: 15,
    prioridad: 'alta',
    capacidad_equipo: 40,
    progreso: 0,
    estado: 'activo',
    fecha_inicio_custom: new Date('2025-07-19'), // Hace 2 semanas
    fecha_fin_custom: new Date('2025-07-26')     // Hace 1 semana
  },
  {
    nombre: 'Sprint Investigación - Performance',
    objetivo: 'Investigar y optimizar performance de consultas de base de datos',
    producto: 'App Gestión Empresarial',
    duracion_semanas: 2,
    velocidad_planificada: 20,
    prioridad: 'media',
    capacidad_equipo: 80,
    progreso: 0,
    estado: 'activo',
    fecha_inicio_custom: new Date('2025-08-09'), // En 1 semana
    fecha_fin_custom: new Date('2025-08-23')     // En 3 semanas
  },
  {
    nombre: 'Sprint Hotfix - Bugs Críticos',
    objetivo: 'Resolver bugs críticos reportados por usuarios en producción',
    producto: 'Integración de IA - SmartInput',
    duracion_semanas: 1,
    velocidad_planificada: 12,
    prioridad: 'critica',
    capacidad_equipo: 40,
    progreso: 0,
    estado: 'activo',
    fecha_inicio_custom: new Date('2025-07-30'), // Hace 3 días
    fecha_fin_custom: new Date('2025-08-06')     // En 4 días
  }
];

// Función para calcular fechas realistas
const calcularFechasSprint = (releaseDate, sprintIndex, duracionSemanas, estado) => {
  // Fecha base: 02/08/2025 (fecha actual según la imagen)
  const fechaBase = new Date('2025-08-02');
  let fechaInicio, fechaFin;
  
  if (estado === 'completado') {
    // Sprints completados: en el pasado (hace 3-6 semanas)
    const semanasAtras = 6 - sprintIndex * 2; // Hace 6, 4, 2 semanas
    fechaInicio = new Date(fechaBase.getTime() - (semanasAtras * 7 * 24 * 60 * 60 * 1000));
    fechaFin = new Date(fechaInicio.getTime() + (duracionSemanas * 7 * 24 * 60 * 60 * 1000));
  } else if (estado === 'activo') {
    // Sprint activo: fechas realistas distribuidas para simular sprints en curso
    const variacion = sprintIndex * 3; // Diferentes puntos de inicio para cada sprint
    fechaInicio = new Date(fechaBase.getTime() - (variacion * 24 * 60 * 60 * 1000)); // Días variados atrás
    fechaFin = new Date(fechaInicio.getTime() + (duracionSemanas * 7 * 24 * 60 * 60 * 1000));
  } else {
    // Sprints planificados: en el futuro (próximas semanas)
    const semanasAdelante = sprintIndex * duracionSemanas + 1; // 1, 3, 6, 9 semanas adelante
    fechaInicio = new Date(fechaBase.getTime() + (semanasAdelante * 7 * 24 * 60 * 60 * 1000));
    fechaFin = new Date(fechaInicio.getTime() + (duracionSemanas * 7 * 24 * 60 * 60 * 1000));
  }
  
  return { fechaInicio, fechaFin };
};

// Función principal
const setupTestingData = async () => {
  console.log('🔄 Conectando a MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Conexión exitosa a MongoDB');

  try {
    console.log('\n🎯 CONFIGURANDO DATOS DE TESTING (3 PASOS AUTOMÁTICOS)\n');

    // Obtener datos existentes
    const productos = await Product.find({});
    const usuarios = await User.find({});
    
    if (productos.length === 0) {
      throw new Error('❌ No se encontraron productos. Ejecuta primero: npm run seed:productos');
    }

    console.log(`📦 Productos encontrados: ${productos.length}`);
    console.log(`👥 Usuarios encontrados: ${usuarios.length}`);

    // ========================
    // PASO 1: CREAR RELEASES
    // ========================
    console.log('\n📦 PASO 1: Creando Releases...');
    const releasesCreados = [];

    for (const producto of productos) {
      const releasesData = RELEASES_POR_PRODUCTO[producto.nombre];
      if (!releasesData) continue;

      console.log(`\n   📋 Producto: ${producto.nombre}`);
      
      for (const releaseData of releasesData) {
        const nuevoRelease = new Release({
          nombre: releaseData.nombre,
          descripcion: releaseData.descripcion,
          version: releaseData.version,
          fecha_objetivo: releaseData.fecha_objetivo,
          producto: producto._id,
          prioridad: releaseData.prioridad,
          estado: releaseData.estado,
          created_by: usuarios[0]._id
        });

        await nuevoRelease.save();
        await nuevoRelease.populate('producto', 'nombre');
        releasesCreados.push(nuevoRelease);
        
        console.log(`   ✅ Release: ${releaseData.nombre} (${releaseData.version})`);
        console.log(`      Estado: ${releaseData.estado} | Objetivo: ${releaseData.fecha_objetivo.toLocaleDateString('es-ES')}`);
      }
    }

    // ===============================
    // PASO 2: CREAR SPRINTS ASOCIADOS
    // ===============================
    console.log('\n🏃‍♂️ PASO 2: Creando Sprints Asociados a Releases...');
    const sprintsAsociadosCreados = [];

    for (const producto of productos) {
      const sprintsData = SPRINTS_ASOCIADOS[producto.nombre];
      if (!sprintsData) continue;

      console.log(`\n   📋 Producto: ${producto.nombre}`);

      for (const [releaseNombre, sprints] of Object.entries(sprintsData)) {
        const release = releasesCreados.find(r => r.nombre === releaseNombre);
        if (!release) continue;

        console.log(`   📦 Release: ${releaseNombre}`);

        for (let i = 0; i < sprints.length; i++) {
          const sprintData = sprints[i];
          const { fechaInicio, fechaFin } = calcularFechasSprint(
            release.fecha_objetivo, i, sprintData.duracion_semanas, sprintData.estado
          );

          const nuevoSprint = new Sprint({
            nombre: sprintData.nombre,
            objetivo: sprintData.objetivo,
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
            estado: sprintData.estado,
            producto: producto._id,
            release_id: release._id, // ← ASOCIADO AL RELEASE
            velocidad_planificada: sprintData.velocidad_planificada,
            velocidad_real: sprintData.estado === 'completado' ? sprintData.velocidad_planificada : 0,
            prioridad: sprintData.prioridad,
            capacidad_equipo: sprintData.capacidad_equipo,
            progreso: sprintData.progreso,
            created_by: usuarios[0]._id
          });

          await nuevoSprint.save();
          sprintsAsociadosCreados.push(nuevoSprint);
          
          const formatFecha = (fecha) => fecha.toLocaleDateString('es-ES');
          console.log(`      ✅ ${sprintData.nombre}`);
          console.log(`         Estado: ${sprintData.estado} | ${formatFecha(fechaInicio)} → ${formatFecha(fechaFin)}`);
          console.log(`         Velocidad: ${sprintData.velocidad_planificada} puntos | Progreso: ${sprintData.progreso}%`);
        }
      }
    }

    // ==================================
    // PASO 3: CREAR SPRINTS INDEPENDIENTES
    // ==================================
    console.log('\n🆓 PASO 3: Creando Sprints Independientes...');
    const sprintsIndependientesCreados = [];

    for (const sprintData of SPRINTS_INDEPENDIENTES) {
      const producto = productos.find(p => p.nombre === sprintData.producto);
      if (!producto) continue;

      // Usar fechas personalizadas si existen, sino calcular
      let fechaInicio, fechaFin;
      if (sprintData.fecha_inicio_custom && sprintData.fecha_fin_custom) {
        fechaInicio = sprintData.fecha_inicio_custom;
        fechaFin = sprintData.fecha_fin_custom;
      } else {
        const fechasCalculadas = calcularFechasSprint(
          new Date(), 0, sprintData.duracion_semanas, sprintData.estado
        );
        fechaInicio = fechasCalculadas.fechaInicio;
        fechaFin = fechasCalculadas.fechaFin;
      }

      const nuevoSprint = new Sprint({
        nombre: sprintData.nombre,
        objetivo: sprintData.objetivo,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        estado: sprintData.estado,
        producto: producto._id,
        release_id: null, // ← INDEPENDIENTE (sin release)
        velocidad_planificada: sprintData.velocidad_planificada,
        velocidad_real: sprintData.estado === 'completado' ? sprintData.velocidad_planificada : 0,
        prioridad: sprintData.prioridad,
        capacidad_equipo: sprintData.capacidad_equipo,
        progreso: sprintData.progreso,
        created_by: usuarios[0]._id
      });

      await nuevoSprint.save();
      sprintsIndependientesCreados.push(nuevoSprint);
      
      const formatFecha = (fecha) => fecha.toLocaleDateString('es-ES');
      console.log(`   ✅ ${sprintData.nombre}`);
      console.log(`      Producto: ${sprintData.producto}`);
      console.log(`      Estado: ${sprintData.estado} | ${formatFecha(fechaInicio)} → ${formatFecha(fechaFin)}`);
      console.log(`      Tipo: INDEPENDIENTE (sin release)`);
    }

    // ============================
    // RESUMEN FINAL
    // ============================
    console.log('\n🎉 ¡DATOS DE TESTING CONFIGURADOS EXITOSAMENTE!\n');

    console.log('📊 RESUMEN POR TIPO:');
    console.log(`   📦 Releases creados: ${releasesCreados.length}`);
    console.log(`   🔗 Sprints asociados: ${sprintsAsociadosCreados.length}`);
    console.log(`   🆓 Sprints independientes: ${sprintsIndependientesCreados.length}`);
    console.log(`   📝 Total sprints: ${sprintsAsociadosCreados.length + sprintsIndependientesCreados.length}`);

    console.log('\n📋 RELEASES POR PRODUCTO:');
    for (const producto of productos) {
      const releases = releasesCreados.filter(r => r.producto._id.toString() === producto._id.toString());
      if (releases.length > 0) {
        console.log(`   📖 ${producto.nombre}: ${releases.length} releases`);
        releases.forEach(r => {
          console.log(`      - ${r.nombre} (${r.version}) - ${r.estado}`);
        });
      }
    }

    console.log('\n🏃‍♂️ SPRINTS POR ESTADO:');
    const todosLosSprints = [...sprintsAsociadosCreados, ...sprintsIndependientesCreados];
    const completados = todosLosSprints.filter(s => s.estado === 'completado').length;
    const activos = todosLosSprints.filter(s => s.estado === 'activo').length;
    const planificados = todosLosSprints.filter(s => s.estado === 'planificado').length;
    
    console.log(`   ✅ Completados: ${completados}`);
    console.log(`   🔄 Activos: ${activos}`);
    console.log(`   📅 Planificados: ${planificados}`);

    console.log('\n🔮 PRÓXIMO PASO (MANUAL):');
    console.log('   4️⃣ Ve al ProductBacklog y asigna historias a los sprints');
    console.log('   📝 Usa el modal de edición para asignar sprint a cada historia');
    console.log('   🎯 Verifica que sprints asociados e independientes aparezcan correctamente');
    console.log('   📊 Revisa el Roadmap para ver la distribución visual');

  } catch (error) {
    console.error('❌ Error configurando datos de testing:', error.message);
  } finally {
    console.log('\n🔐 Cerrando conexión a MongoDB...');
    await mongoose.connection.close();
    console.log('✅ Conexión cerrada');
    console.log('✨ Configuración completada. ¡Listos para testing manual!');
  }
};

// Ejecutar el script
if (require.main === module) {
  setupTestingData();
}

module.exports = setupTestingData;
