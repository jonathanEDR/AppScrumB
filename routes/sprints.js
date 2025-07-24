
const express = require('express');
const router = express.Router();
const Sprint = require('../models/Sprint');
const BacklogItem = require('../models/BacklogItem');
const { authenticate } = require('../middleware/authenticate');

// GET /api/sprints - Obtener todos los sprints
router.get('/', async (req, res) => {
  try {
    console.log('=== Getting sprints ===');
    console.log('Query params:', req.query);
    
    const { producto, estado, page = 1, limit = 10 } = req.query;
    
    const filtros = {};
    if (producto) filtros.producto = producto;
    if (estado) filtros.estado = estado;

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
      velocidad_planificada
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

module.exports = router;
