// Script para crear datos de ejemplo para testing de métricas
const mongoose = require('mongoose');
const Release = require('./models/Release');
const Sprint = require('./models/Sprint');

// Función para crear datos de ejemplo
async function crearDatosEjemplo() {
  try {
    // Crear sprints de ejemplo con velocidades
    const sprintsEjemplo = [
      {
        nombre: 'Sprint 1',
        objetivo: 'Setup inicial del proyecto',
        fecha_inicio: new Date('2025-07-01'),
        fecha_fin: new Date('2025-07-14'),
        estado: 'completado',
        velocidad_planificada: 20,
        velocidad_real: 18,
        producto: '6086391d0fff1fde73cea2ac' // ID de ejemplo
      },
      {
        nombre: 'Sprint 2', 
        objetivo: 'Funcionalidades básicas',
        fecha_inicio: new Date('2025-07-15'),
        fecha_fin: new Date('2025-07-28'),
        estado: 'completado',
        velocidad_planificada: 25,
        velocidad_real: 23,
        producto: '6086391d0fff1fde73cea2ac'
      },
      {
        nombre: 'Sprint 3',
        objetivo: 'Mejoras UX',
        fecha_inicio: new Date('2025-07-29'),
        fecha_fin: new Date('2025-08-11'),
        estado: 'activo',
        velocidad_planificada: 22,
        velocidad_real: 0,
        producto: '6086391d0fff1fde73cea2ac'
      }
    ];

    // Crear releases de ejemplo
    const releasesEjemplo = [
      {
        nombre: 'Release 1.0',
        version: '1.0.0',
        descripcion: 'Primera versión estable',
        fecha_objetivo: new Date('2025-08-15'),
        fecha_lanzamiento: new Date('2025-08-10'), // Exitoso: a tiempo
        estado: 'lanzado',
        progreso: 100,
        producto: '6086391d0fff1fde73cea2ac'
      },
      {
        nombre: 'Release 1.1',
        version: '1.1.0', 
        descripcion: 'Mejoras y correcciones',
        fecha_objetivo: new Date('2025-09-01'),
        fecha_lanzamiento: new Date('2025-09-05'), // Tardío
        estado: 'lanzado',
        progreso: 100,
        producto: '6086391d0fff1fde73cea2ac'
      },
      {
        nombre: 'Release 2.0',
        version: '2.0.0',
        descripcion: 'Nueva funcionalidad mayor',
        fecha_objetivo: new Date('2025-10-01'),
        estado: 'en_desarrollo',
        progreso: 45,
        producto: '6086391d0fff1fde73cea2ac'
      }
    ];

    console.log('Datos de ejemplo creados para testing de métricas');
    console.log('Sprints:', sprintsEjemplo.length);
    console.log('Releases:', releasesEjemplo.length);
    
    return { sprints: sprintsEjemplo, releases: releasesEjemplo };
  } catch (error) {
    console.error('Error creando datos de ejemplo:', error);
  }
}

module.exports = { crearDatosEjemplo };
