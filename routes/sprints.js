
const express = require('express');
const router = express.Router();
const Sprint = require('../models/Sprint');
const BacklogItem = require('../models/BacklogItem');
const { authenticate } = require('../middleware/authenticate');
const mongoose = require('mongoose');

// GET /api/sprints - Obtener todos los sprints
router.get('/', authenticate, async (req, res) => {
  try {
    console.log('=== Getting sprints ===');
    console.log('Query params:', req.query);
    
    const { producto, estado, page = 1, limit = 10 } = req.query;
    
    const filtros = {};
    if (producto) filtros.producto = producto;
    if (estado) {
      // Manejar múltiples estados separados por coma
      const estados = estado.split(',').map(e => e.trim());
      if (estados.length > 1) {
        filtros.estado = { $in: estados };
      } else {
        filtros.estado = estado;
      }
    }

    console.log('Filters applied:', filtros);

    const sprints = await Sprint.find(filtros)
      .populate('producto', 'nombre')
      .populate('created_by', 'firstName lastName')
      .sort({ fecha_inicio: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Sprint.countDocuments(filtros);

    console.log('Sprints found:', sprints.length);
    console.log('Total sprints:', total);

    res.json({
      sprints,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error al obtener sprints:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/sprints/:id - Obtener sprint específico
router.get('/:id', async (req, res) => {
  try {
    // Validar que el id recibido es un ObjectId válido
    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.warn('Invalid sprint id received:', req.params.id);
      return res.status(400).json({ error: 'ID de sprint inválido' });
    }
    const sprint = await Sprint.findById(req.params.id)
      .populate('producto', 'nombre descripcion')
      .populate('created_by', 'firstName lastName')
      .populate('updated_by', 'firstName lastName');

    if (!sprint) {
      return res.status(404).json({ error: 'Sprint no encontrado' });
    }

    // Obtener historias del sprint
    const historias = await BacklogItem.find({ sprint: req.params.id })
      .select('titulo estado puntos_historia prioridad');

    const sprintCompleto = {
      ...sprint.toJSON(),
      historias,
      metricas: {
        total_historias: historias.length,
        historias_completadas: historias.filter(h => h.estado === 'hecho').length,
        puntos_totales: historias.reduce((sum, h) => sum + (h.puntos_historia || 0), 0),
        puntos_completados: historias.filter(h => h.estado === 'hecho')
          .reduce((sum, h) => sum + (h.puntos_historia || 0), 0)
      }
    };

    res.json(sprintCompleto);
  } catch (error) {
    console.error('Error al obtener sprint:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/sprints/:id/assign-story - Asignar historia a sprint
router.post('/:id/assign-story', authenticate, async (req, res) => {
  try {
    console.log('=== Assigning story to sprint ===');
    console.log('Sprint ID:', req.params.id);
    console.log('Story data:', req.body);
    
    const { storyId, assignedTo } = req.body;
    
    if (!storyId) {
      return res.status(400).json({ error: 'ID de historia requerido' });
    }

    // Verificar que el sprint existe y está en estado planificado o activo
    const sprint = await Sprint.findById(req.params.id);
    if (!sprint) {
      return res.status(404).json({ error: 'Sprint no encontrado' });
    }

    if (!['planificado', 'activo'].includes(sprint.estado)) {
      return res.status(400).json({ 
        error: 'Solo se pueden asignar historias a sprints planificados o activos' 
      });
    }

    // Verificar que la historia existe y no está asignada a otro sprint
    const story = await BacklogItem.findById(storyId);
    if (!story) {
      return res.status(404).json({ error: 'Historia no encontrada' });
    }

    if (story.sprint && story.sprint.toString() !== req.params.id) {
      return res.status(400).json({ 
        error: 'La historia ya está asignada a otro sprint' 
      });
    }

    // Asignar la historia al sprint
    const updateData = { sprint: req.params.id };
    if (assignedTo) {
      updateData.asignado_a = assignedTo;
    }

    const updatedStory = await BacklogItem.findByIdAndUpdate(
      storyId,
      updateData,
      { new: true }
    ).populate('asignado_a', 'firstName lastName email');

    console.log('Story assigned successfully:', updatedStory.titulo);

    res.json({
      message: 'Historia asignada al sprint exitosamente',
      story: updatedStory
    });

  } catch (error) {
    console.error('Error al asignar historia:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/sprints/:id/stories/:storyId - Desasignar historia del sprint
router.delete('/:id/stories/:storyId', authenticate, async (req, res) => {
  try {
    console.log('=== Unassigning story from sprint ===');
    console.log('Sprint ID:', req.params.id);
    console.log('Story ID:', req.params.storyId);
    
    // Verificar que el sprint existe
    const sprint = await Sprint.findById(req.params.id);
    if (!sprint) {
      return res.status(404).json({ error: 'Sprint no encontrado' });
    }

    // Verificar que la historia existe y está asignada a este sprint
    const story = await BacklogItem.findById(req.params.storyId);
    if (!story) {
      return res.status(404).json({ error: 'Historia no encontrada' });
    }

    if (!story.sprint || story.sprint.toString() !== req.params.id) {
      return res.status(400).json({ 
        error: 'La historia no está asignada a este sprint' 
      });
    }

    // Solo permitir desasignación si el sprint no está completado
    if (sprint.estado === 'completado') {
      return res.status(400).json({ 
        error: 'No se pueden desasignar historias de sprints completados' 
      });
    }

    // Desasignar la historia del sprint
    const updatedStory = await BacklogItem.findByIdAndUpdate(
      req.params.storyId,
      { 
        $unset: { sprint: 1 },
        estado: 'pendiente' // Resetear estado a pendiente
      },
      { new: true }
    );

    console.log('Story unassigned successfully:', updatedStory.titulo);

    res.json({
      message: 'Historia desasignada del sprint exitosamente',
      story: updatedStory
    });

  } catch (error) {
    console.error('Error al desasignar historia:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/sprints/:id/available-stories - Obtener historias disponibles para asignar
router.get('/:id/available-stories', authenticate, async (req, res) => {
  try {
    console.log('=== Getting available stories for sprint ===');
    console.log('Sprint ID:', req.params.id);
    
    const { prioridad, tipo, producto } = req.query;
    
    // Verificar que el sprint existe
    const sprint = await Sprint.findById(req.params.id);
    if (!sprint) {
      return res.status(404).json({ error: 'Sprint no encontrado' });
    }

    console.log('Sprint found:', sprint.nombre);

    // Primero, obtener TODAS las historias del backlog para debug
    const allBacklogItems = await BacklogItem.find({})
      .populate('producto', 'nombre')
      .select('titulo sprint estado producto');
    
    console.log('=== ALL BACKLOG ITEMS DEBUG ===');
    console.log('Total backlog items:', allBacklogItems.length);
    allBacklogItems.forEach(item => {
      console.log(`- ${item.titulo}: sprint=${item.sprint}, estado=${item.estado}, producto=${item.producto?.nombre}`);
    });

    // Construir filtros para historias disponibles
    const filtros = {
      $or: [
        { sprint: { $exists: false } }, // Sin campo sprint
        { sprint: null }                // Sprint es null
      ],
      estado: { $in: ['pendiente', 'en_progreso'] } // Estados válidos
    };

    // Si el sprint tiene producto específico, filtrar por ese producto
    if (sprint.producto) {
      filtros.producto = sprint.producto;
      console.log('Filtering by sprint product:', sprint.producto);
    }

    // Aplicar filtros adicionales si se proporcionan
    if (prioridad) filtros.prioridad = prioridad;
    if (tipo) filtros.tipo = tipo;
    if (producto) filtros.producto = producto;

    const availableStories = await BacklogItem.find(filtros)
      .populate('producto', 'nombre')
      .populate('asignado_a', 'firstName lastName email')
      .sort({ prioridad: 1, orden: 1 }); // Ordenar por prioridad y orden

    console.log('Filtros aplicados:', JSON.stringify(filtros, null, 2));
    console.log('Available stories found:', availableStories.length);
    console.log('Sample stories:', availableStories.slice(0, 2).map(s => ({
      _id: s._id,
      titulo: s.titulo,
      sprint: s.sprint,
      estado: s.estado,
      producto: s.producto?._id
    })));

    res.json({
      stories: availableStories,
      sprint: {
        _id: sprint._id,
        nombre: sprint.nombre,
        estado: sprint.estado
      }
    });

  } catch (error) {
    console.error('Error al obtener historias disponibles:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/sprints - Crear nuevo sprint
router.post('/', authenticate, async (req, res) => {
  try {
    console.log('=== Creating new sprint ===');
    console.log('Request body:', req.body);
    console.log('User:', req.user);
    
    const {
      nombre,
      objetivo,
      fecha_inicio,
      fecha_fin,
      producto,
      velocidad_planificada,
      // NUEVOS CAMPOS - Mejoras
      release_id,
      prioridad,
      capacidad_equipo,
      progreso
    } = req.body;

    // Validaciones básicas
    if (!nombre || !objetivo || !fecha_inicio || !fecha_fin || !producto) {
      console.log('Validation failed: missing required fields');
      return res.status(400).json({ 
        error: 'Nombre, objetivo, fechas y producto son requeridos' 
      });
    }

    // Validar fechas
    const inicio = new Date(fecha_inicio);
    const fin = new Date(fecha_fin);
    
    console.log('Date validation:', { fecha_inicio, fecha_fin, inicio, fin });
    
    if (fin <= inicio) {
      console.log('Date validation failed: end date is not after start date');
      return res.status(400).json({ 
        error: 'La fecha de fin debe ser posterior a la fecha de inicio' 
      });
    }

    // Verificar que no haya sprints activos superpuestos en el mismo producto
    const sprintsSuperpuestos = await Sprint.find({
      producto,
      estado: { $in: ['planificado', 'activo'] },
      $or: [
        { fecha_inicio: { $lte: fin }, fecha_fin: { $gte: inicio } }
      ]
    });

    if (sprintsSuperpuestos.length > 0) {
      return res.status(400).json({ 
        error: 'Ya existe un sprint activo o planificado que se superpone con estas fechas' 
      });
    }

    console.log('Creating sprint with data:', {
      nombre,
      objetivo,
      fecha_inicio: inicio,
      fecha_fin: fin,
      producto,
      velocidad_planificada: velocidad_planificada || 0,
      created_by: req.user._id
    });

    const nuevoSprint = new Sprint({
      nombre,
      objetivo,
      fecha_inicio: inicio,
      fecha_fin: fin,
      producto,
      velocidad_planificada: velocidad_planificada || 0,
      // NUEVOS CAMPOS - Mejoras
      release_id: release_id || null,
      prioridad: prioridad || 'media',
      capacidad_equipo: capacidad_equipo || 0,
      progreso: progreso || 0,
      created_by: req.user._id
    });

    await nuevoSprint.save();
    console.log('Sprint saved successfully:', nuevoSprint._id);
    await nuevoSprint.populate('producto', 'nombre');
    await nuevoSprint.populate('created_by', 'firstName lastName');

    res.status(201).json(nuevoSprint);
  } catch (error) {
    console.error('Error al crear sprint:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/sprints/:id - Actualizar sprint
router.put('/:id', authenticate, async (req, res) => {
  try {
    const {
      nombre,
      objetivo,
      fecha_inicio,
      fecha_fin,
      estado,
      velocidad_planificada,
      velocidad_real
    } = req.body;

    const sprint = await Sprint.findById(req.params.id);
    if (!sprint) {
      return res.status(404).json({ error: 'Sprint no encontrado' });
    }

    // Validaciones para cambio de estado
    if (estado && estado !== sprint.estado) {
      if (estado === 'activo') {
        // Verificar que no hay otro sprint activo en el mismo producto
        const sprintActivo = await Sprint.findOne({
          producto: sprint.producto,
          estado: 'activo',
          _id: { $ne: req.params.id }
        });
        
        if (sprintActivo) {
          return res.status(400).json({ 
            error: 'Ya existe un sprint activo para este producto' 
          });
        }
      }
      
      if (estado === 'completado' && !velocidad_real) {
        return res.status(400).json({ 
          error: 'Se requiere velocidad real para completar el sprint' 
        });
      }
    }

    // Actualizar campos
    if (nombre) sprint.nombre = nombre;
    if (objetivo) sprint.objetivo = objetivo;
    if (fecha_inicio) sprint.fecha_inicio = fecha_inicio;
    if (fecha_fin) sprint.fecha_fin = fecha_fin;
    if (estado) sprint.estado = estado;
    if (velocidad_planificada !== undefined) sprint.velocidad_planificada = velocidad_planificada;
    if (velocidad_real !== undefined) sprint.velocidad_real = velocidad_real;
    
    sprint.updated_by = req.user._id;

    await sprint.save();
    await sprint.populate('producto', 'nombre');
    await sprint.populate('created_by', 'firstName lastName');
    await sprint.populate('updated_by', 'firstName lastName');

    res.json(sprint);
  } catch (error) {
    console.error('Error al actualizar sprint:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/sprints/:id - Eliminar sprint
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const sprint = await Sprint.findById(req.params.id);
    if (!sprint) {
      return res.status(404).json({ error: 'Sprint no encontrado' });
    }

    // No permitir eliminar sprints activos o completados
    if (sprint.estado === 'activo' || sprint.estado === 'completado') {
      return res.status(400).json({ 
        error: 'No se puede eliminar un sprint activo o completado' 
      });
    }

    // Verificar si hay historias asignadas al sprint
    const historiasAsignadas = await BacklogItem.countDocuments({ sprint: req.params.id });
    if (historiasAsignadas > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar un sprint que tiene historias asignadas' 
      });
    }

    await Sprint.findByIdAndDelete(req.params.id);
    res.json({ mensaje: 'Sprint eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar sprint:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/sprints/:id/start - Iniciar sprint
router.post('/:id/start', authenticate, async (req, res) => {
  try {
    const sprint = await Sprint.findById(req.params.id);
    if (!sprint) {
      return res.status(404).json({ error: 'Sprint no encontrado' });
    }

    if (sprint.estado !== 'planificado') {
      return res.status(400).json({ 
        error: 'Solo se pueden iniciar sprints planificados' 
      });
    }

    // Verificar que no hay otro sprint activo
    const sprintActivo = await Sprint.findOne({
      producto: sprint.producto,
      estado: 'activo'
    });

    if (sprintActivo) {
      return res.status(400).json({ 
        error: 'Ya existe un sprint activo para este producto' 
      });
    }

    sprint.estado = 'activo';
    sprint.updated_by = req.user._id;
    await sprint.save();

    res.json(sprint);
  } catch (error) {
    console.error('Error al iniciar sprint:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/sprints/:id/complete - Completar sprint
router.post('/:id/complete', authenticate, async (req, res) => {
  try {
    const { velocidad_real } = req.body;
    
    const sprint = await Sprint.findById(req.params.id);
    if (!sprint) {
      return res.status(404).json({ error: 'Sprint no encontrado' });
    }

    if (sprint.estado !== 'activo') {
      return res.status(400).json({ 
        error: 'Solo se pueden completar sprints activos' 
      });
    }

    sprint.estado = 'completado';
    sprint.velocidad_real = velocidad_real || 0;
    sprint.updated_by = req.user._id;
    await sprint.save();

    res.json(sprint);
  } catch (error) {
    console.error('Error al completar sprint:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/sprints/metricas/:producto_id - Métricas de sprints por producto
router.get('/metricas/:producto_id', async (req, res) => {
  try {
    const { producto_id } = req.params;
    
    const sprints = await Sprint.find({ 
      producto: producto_id,
      estado: 'completado'
    }).sort({ fecha_fin: -1 }).limit(10);

    const metricas = {
      velocidad_promedio: 0,
      velocidad_historico: [],
      precision_estimacion: 0,
      sprints_completados: sprints.length
    };

    if (sprints.length > 0) {
      // Calcular velocidad promedio
      const velocidades = sprints.map(s => s.velocidad_real || 0);
      metricas.velocidad_promedio = velocidades.reduce((sum, v) => sum + v, 0) / velocidades.length;
      
      // Historial de velocidades
      metricas.velocidad_historico = sprints.map(s => ({
        sprint: s.nombre,
        planificada: s.velocidad_planificada,
        real: s.velocidad_real,
        fecha: s.fecha_fin
      }));

      // Precisión de estimación (comparar velocidad planificada vs real)
      const diferencias = sprints.map(s => {
        if (s.velocidad_planificada === 0) return 0;
        return Math.abs(s.velocidad_real - s.velocidad_planificada) / s.velocidad_planificada;
      });
      
      metricas.precision_estimacion = 1 - (diferencias.reduce((sum, d) => sum + d, 0) / diferencias.length);
    }

    res.json(metricas);
  } catch (error) {
    console.error('Error al obtener métricas de sprints:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/sprints/:id/burndown - Actualizar datos de burndown
router.post('/:id/burndown', authenticate, async (req, res) => {
  try {
    const { trabajo_restante, trabajo_completado } = req.body;
    
    const sprint = await Sprint.findById(req.params.id);
    if (!sprint) {
      return res.status(404).json({ error: 'Sprint no encontrado' });
    }

    if (!sprint.metricas) sprint.metricas = { burndown_data: [] };
    if (!sprint.metricas.burndown_data) sprint.metricas.burndown_data = [];

    sprint.metricas.burndown_data.push({
      fecha: new Date(),
      trabajo_restante: trabajo_restante || 0,
      trabajo_completado: trabajo_completado || 0
    });

    // Actualizar progreso automáticamente
    const total = trabajo_restante + trabajo_completado;
    if (total > 0) {
      sprint.progreso = Math.round((trabajo_completado / total) * 100);
    }

    await sprint.save();
    res.json({ message: 'Burndown actualizado', progreso: sprint.progreso });
  } catch (error) {
    console.error('Error al actualizar burndown:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/sprints/by-release/:releaseId - Obtener sprints por release
router.get('/by-release/:releaseId', async (req, res) => {
  try {
    const sprints = await Sprint.find({ release_id: req.params.releaseId })
      .populate('producto', 'nombre')
      .populate('created_by', 'firstName lastName')
      .sort({ fecha_inicio: 1 });

    res.json(sprints);
  } catch (error) {
    console.error('Error al obtener sprints por release:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/sprints/independent - Obtener sprints independientes
router.get('/independent', async (req, res) => {
  try {
    const sprints = await Sprint.find({ release_id: { $in: [null, undefined] } })
      .populate('producto', 'nombre')
      .populate('created_by', 'firstName lastName')
      .sort({ fecha_inicio: 1 });

    res.json(sprints);
  } catch (error) {
    console.error('Error al obtener sprints independientes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/sprints/:sprintId/assign-multiple - Asignar múltiples historias a sprint
router.post('/:sprintId/assign-multiple', authenticate, async (req, res) => {
  try {
    console.log('=== Assigning multiple stories to sprint ===');
    const { sprintId } = req.params;
    const { storyIds } = req.body;

    // Validar que se proporcionaron IDs
    if (!storyIds || !Array.isArray(storyIds) || storyIds.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de IDs de historias' });
    }

    // Verificar que el sprint existe
    const sprint = await Sprint.findById(sprintId);
    if (!sprint) {
      return res.status(404).json({ error: 'Sprint no encontrado' });
    }

    // Verificar que el sprint está en estado válido
    if (!['planificado', 'activo'].includes(sprint.estado)) {
      return res.status(400).json({ 
        error: 'Solo se pueden asignar historias a sprints planificados o activos' 
      });
    }

    // Obtener las historias a asignar
    const stories = await BacklogItem.find({ _id: { $in: storyIds } });
    
    if (stories.length !== storyIds.length) {
      return res.status(404).json({ 
        error: 'Algunas historias no fueron encontradas' 
      });
    }

    // Verificar que ninguna historia esté asignada a otro sprint
    const storiesInOtherSprints = stories.filter(
      story => story.sprint && story.sprint.toString() !== sprintId
    );
    
    if (storiesInOtherSprints.length > 0) {
      return res.status(400).json({ 
        error: `${storiesInOtherSprints.length} historia(s) ya están asignadas a otro sprint`,
        conflictingStories: storiesInOtherSprints.map(s => ({
          id: s._id,
          titulo: s.titulo,
          sprint: s.sprint
        }))
      });
    }

    // Calcular puntos totales
    const newPoints = stories.reduce((sum, story) => sum + (story.puntos_historia || 0), 0);
    
    // Obtener historias ya asignadas al sprint
    const existingStories = await BacklogItem.find({ sprint: sprintId });
    const currentPoints = existingStories.reduce((sum, story) => sum + (story.puntos_historia || 0), 0);
    const totalPoints = currentPoints + newPoints;

    // Validar capacidad si está definida
    let capacityWarning = null;
    if (sprint.capacidad_equipo > 0) {
      // Convertir capacidad de horas a puntos (asumiendo 1 punto = 4 horas)
      const capacityInPoints = sprint.capacidad_equipo / 4;
      const percentageUsed = (totalPoints / capacityInPoints) * 100;

      if (percentageUsed > 100) {
        capacityWarning = {
          severity: 'error',
          message: `Sobrecarga: ${totalPoints.toFixed(1)} pts de ${capacityInPoints.toFixed(1)} pts disponibles (${percentageUsed.toFixed(0)}%)`,
          percentageUsed: percentageUsed.toFixed(1),
          exceeded: true
        };
      } else if (percentageUsed > 90) {
        capacityWarning = {
          severity: 'warning',
          message: `Cerca del límite: ${percentageUsed.toFixed(0)}% de capacidad utilizada`,
          percentageUsed: percentageUsed.toFixed(1),
          exceeded: false
        };
      }
    }

    // Asignar todas las historias al sprint
    const updateResults = await BacklogItem.updateMany(
      { _id: { $in: storyIds } },
      { 
        $set: { 
          sprint: sprintId,
          estado: 'pendiente' // Asegurar que estén en estado pendiente
        }
      }
    );

    console.log(`Successfully assigned ${updateResults.modifiedCount} stories to sprint ${sprintId}`);

    // Obtener las historias actualizadas
    const updatedStories = await BacklogItem.find({ _id: { $in: storyIds } })
      .populate('producto', 'nombre')
      .populate('asignado_a', 'firstName lastName email');

    res.json({
      message: `${updateResults.modifiedCount} historia(s) asignadas exitosamente`,
      assigned: updateResults.modifiedCount,
      stories: updatedStories,
      capacity: {
        currentPoints,
        newPoints,
        totalPoints,
        capacityInPoints: sprint.capacidad_equipo > 0 ? sprint.capacidad_equipo / 4 : null,
        percentageUsed: sprint.capacidad_equipo > 0 ? ((totalPoints / (sprint.capacidad_equipo / 4)) * 100).toFixed(1) : null,
        warning: capacityWarning
      }
    });

  } catch (error) {
    console.error('Error al asignar historias:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/sprints/:sprintId/validate-capacity - Validar capacidad antes de asignar
router.post('/:sprintId/validate-capacity', authenticate, async (req, res) => {
  try {
    const { sprintId } = req.params;
    const { storyIds } = req.body;

    // Validar entrada
    if (!storyIds || !Array.isArray(storyIds) || storyIds.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de IDs de historias' });
    }

    // Obtener sprint
    const sprint = await Sprint.findById(sprintId);
    if (!sprint) {
      return res.status(404).json({ error: 'Sprint no encontrado' });
    }

    // Obtener las historias a validar
    const newStories = await BacklogItem.find({ _id: { $in: storyIds } });
    const newPoints = newStories.reduce((sum, story) => sum + (story.puntos_historia || 0), 0);

    // Obtener historias ya asignadas
    const existingStories = await BacklogItem.find({ sprint: sprintId });
    const currentPoints = existingStories.reduce((sum, story) => sum + (story.puntos_historia || 0), 0);
    const totalPoints = currentPoints + newPoints;

    // Calcular capacidad
    let validation = {
      isValid: true,
      currentPoints,
      newPoints,
      totalPoints,
      capacity: sprint.capacidad_equipo,
      capacityInPoints: sprint.capacidad_equipo > 0 ? sprint.capacidad_equipo / 4 : null,
      percentageUsed: null,
      recommendation: 'optimal',
      message: null,
      severity: 'success'
    };

    if (sprint.capacidad_equipo > 0) {
      const capacityInPoints = sprint.capacidad_equipo / 4;
      const percentageUsed = (totalPoints / capacityInPoints) * 100;
      
      validation.percentageUsed = percentageUsed.toFixed(1);

      if (percentageUsed > 100) {
        validation.isValid = false;
        validation.recommendation = 'overloaded';
        validation.severity = 'error';
        validation.message = `⚠️ Sobrecarga: ${totalPoints.toFixed(1)} pts excede capacidad de ${capacityInPoints.toFixed(1)} pts (${percentageUsed.toFixed(0)}%)`;
        validation.exceeds = (totalPoints - capacityInPoints).toFixed(1);
      } else if (percentageUsed > 90) {
        validation.isValid = true;
        validation.recommendation = 'near_limit';
        validation.severity = 'warning';
        validation.message = `⚠️ Cerca del límite: ${percentageUsed.toFixed(0)}% de capacidad`;
      } else if (percentageUsed < 70) {
        validation.isValid = true;
        validation.recommendation = 'underutilized';
        validation.severity = 'info';
        validation.message = `ℹ️ Capacidad subutilizada: ${percentageUsed.toFixed(0)}%. Considera agregar más historias`;
      } else {
        validation.isValid = true;
        validation.recommendation = 'optimal';
        validation.severity = 'success';
        validation.message = `✅ Capacidad óptima: ${percentageUsed.toFixed(0)}%`;
      }
    } else {
      validation.message = 'ℹ️ Sprint sin capacidad definida - no se puede validar';
      validation.severity = 'info';
    }

    // Detalles de las historias
    validation.stories = {
      existing: existingStories.length,
      new: newStories.length,
      total: existingStories.length + newStories.length,
      newStoriesDetails: newStories.map(s => ({
        id: s._id,
        titulo: s.titulo,
        puntos: s.puntos_historia || 0,
        prioridad: s.prioridad
      }))
    };

    res.json(validation);

  } catch (error) {
    console.error('Error al validar capacidad:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// ENDPOINT: Obtener datos de Burndown Chart automáticamente
// ============================================
router.get('/:id/burndown-data', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`=== Getting burndown data for sprint ${id} ===`);

    // Validar ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID de sprint inválido'
      });
    }

    // Obtener sprint con historias populadas
    const sprint = await Sprint.findById(id).populate('producto');
    
    if (!sprint) {
      return res.status(404).json({
        success: false,
        error: 'Sprint no encontrado'
      });
    }

    // Obtener todas las historias asignadas a este sprint
    const BacklogItem = require('../models/BacklogItem');
    const historias = await BacklogItem.find({ sprint: id }).select('puntos_historia estado fecha_completado createdAt updatedAt');

    console.log(`Found ${historias.length} stories in sprint`);

    // Calcular total de story points
    const totalPoints = historias.reduce((sum, h) => sum + (h.puntos_historia || 0), 0);
    
    if (totalPoints === 0) {
      return res.json({
        success: true,
        data: [],
        totalPoints: 0,
        prediction: {
          willComplete: true,
          daysAheadBehind: 0,
          estimatedCompletionDate: sprint.fecha_fin,
          message: 'No hay story points asignados al sprint'
        }
      });
    }

    // Calcular duración del sprint en días
    const startDate = new Date(sprint.fecha_inicio);
    const endDate = new Date(sprint.fecha_fin);
    const today = new Date();
    
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

    console.log(`Sprint duration: ${totalDays} days, Elapsed: ${daysElapsed}, Remaining: ${daysRemaining}`);

    // Generar datos del burndown
    const burndownData = [];
    
    for (let day = 0; day <= totalDays; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + day);
      
      // Línea ideal: decremento lineal
      const idealRemaining = totalPoints - (totalPoints / totalDays) * day;
      
      // Línea actual: calcular puntos completados hasta esta fecha
      const completedPoints = historias
        .filter(h => {
          if (h.estado === 'completado' || h.estado === 'cerrado') {
            const completedDate = h.fecha_completado ? new Date(h.fecha_completado) : new Date(h.updatedAt);
            return completedDate <= currentDate;
          }
          return false;
        })
        .reduce((sum, h) => sum + (h.puntos_historia || 0), 0);
      
      const actualRemaining = totalPoints - completedPoints;
      
      burndownData.push({
        day: day,
        date: currentDate.toISOString().split('T')[0],
        ideal: Math.max(0, Math.round(idealRemaining * 10) / 10),
        actual: Math.max(0, actualRemaining),
        completed: completedPoints
      });
    }

    console.log(`Generated ${burndownData.length} burndown data points`);

    // Calcular predicción
    const currentData = burndownData.find(d => d.day === daysElapsed) || burndownData[burndownData.length - 1];
    const pointsRemaining = currentData ? currentData.actual : totalPoints;
    const pointsCompleted = totalPoints - pointsRemaining;

    // Velocidad actual (puntos por día)
    const currentVelocity = daysElapsed > 0 ? pointsCompleted / daysElapsed : 0;
    
    // Días necesarios para completar el trabajo restante
    const daysNeededToComplete = currentVelocity > 0 ? Math.ceil(pointsRemaining / currentVelocity) : Infinity;
    
    // Fecha estimada de completación
    const estimatedCompletionDate = new Date(today);
    estimatedCompletionDate.setDate(estimatedCompletionDate.getDate() + daysNeededToComplete);
    
    // Comparar con fecha fin del sprint
    const willCompleteOnTime = estimatedCompletionDate <= endDate && daysNeededToComplete !== Infinity;
    const daysAheadBehind = willCompleteOnTime 
      ? Math.ceil((endDate - estimatedCompletionDate) / (1000 * 60 * 60 * 24))
      : Math.ceil((estimatedCompletionDate - endDate) / (1000 * 60 * 60 * 24));

    // Agregar línea de predicción si el sprint está en progreso
    if (sprint.estado === 'activo' && daysRemaining > 0 && currentVelocity > 0) {
      for (let day = daysElapsed + 1; day <= totalDays; day++) {
        const projectedRemaining = pointsRemaining - (currentVelocity * (day - daysElapsed));
        burndownData[day].prediction = Math.max(0, Math.round(projectedRemaining * 10) / 10);
      }
    }

    // Calcular tendencia
    let trend = 'on-track';
    const percentComplete = (pointsCompleted / totalPoints) * 100;
    const percentTimeElapsed = (daysElapsed / totalDays) * 100;
    
    if (percentComplete >= percentTimeElapsed + 10) {
      trend = 'ahead';
    } else if (percentComplete <= percentTimeElapsed - 10) {
      trend = 'behind';
    }

    // Preparar mensaje de predicción
    let predictionMessage = '';
    if (sprint.estado === 'completado') {
      predictionMessage = 'Sprint completado';
    } else if (sprint.estado === 'planificado') {
      predictionMessage = 'Sprint no iniciado';
    } else if (willCompleteOnTime) {
      predictionMessage = `Se completará ${daysAheadBehind} día(s) antes de la fecha límite`;
    } else if (daysNeededToComplete === Infinity) {
      predictionMessage = 'Sin progreso suficiente para estimar completación';
    } else {
      predictionMessage = `Se completará ${daysAheadBehind} día(s) después de la fecha límite`;
    }

    res.json({
      success: true,
      data: burndownData,
      totalPoints,
      pointsCompleted,
      pointsRemaining,
      totalDays,
      daysElapsed,
      daysRemaining,
      currentVelocity: Math.round(currentVelocity * 10) / 10,
      percentComplete: Math.round(percentComplete),
      trend,
      prediction: {
        willComplete: willCompleteOnTime,
        daysAheadBehind,
        estimatedCompletionDate: estimatedCompletionDate.toISOString().split('T')[0],
        message: predictionMessage
      },
      sprint: {
        nombre: sprint.nombre,
        estado: sprint.estado,
        fecha_inicio: sprint.fecha_inicio,
        fecha_fin: sprint.fecha_fin
      }
    });

  } catch (error) {
    console.error('Error getting burndown data:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener datos de burndown',
      details: error.message
    });
  }
});

module.exports = router;
