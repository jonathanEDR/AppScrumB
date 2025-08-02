const express = require('express');
const router = express.Router();
const Release = require('../models/Release');
const Sprint = require('../models/Sprint');
const BacklogItem = require('../models/BacklogItem');
const { authenticate } = require('../middleware/authenticate');

// GET /api/releases - Obtener todas las releases
router.get('/', async (req, res) => {
  try {
    const { producto, estado, page = 1, limit = 10 } = req.query;
    
    const filtros = {};
    if (producto) filtros.producto = producto;
    if (estado) filtros.estado = estado;

    const releases = await Release.find(filtros)
      .populate('producto', 'nombre')
      .populate('sprints', 'nombre estado fecha_inicio fecha_fin')
      .populate('backlog_items', 'titulo estado')
      .populate('created_by', 'firstName lastName')
      .sort({ fecha_objetivo: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Release.countDocuments(filtros);

    res.json({
      releases,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error al obtener releases:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/releases/:id - Obtener release específico
router.get('/:id', async (req, res) => {
  try {
    const release = await Release.findById(req.params.id)
      .populate('producto', 'nombre descripcion')
      .populate('sprints')
      .populate('backlog_items')
      .populate('created_by', 'firstName lastName')
      .populate('updated_by', 'firstName lastName');

    if (!release) {
      return res.status(404).json({ error: 'Release no encontrado' });
    }

    // Calcular progreso actualizado
    await release.calcularProgreso();
    await release.save();

    res.json(release);
  } catch (error) {
    console.error('Error al obtener release:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/releases - Crear nuevo release
router.post('/', authenticate, async (req, res) => {
  try {
    console.log('=== Creating new release ===');
    console.log('Request body:', req.body);
    console.log('User:', req.user);
    
    const {
      nombre,
      version,
      descripcion,
      fecha_objetivo,
      producto,
      prioridad,
      notas
    } = req.body;

    // Validaciones básicas
    if (!nombre || !version || !fecha_objetivo || !producto) {
      console.log('Validation failed: missing required fields');
      return res.status(400).json({ 
        error: 'Nombre, versión, fecha objetivo y producto son requeridos' 
      });
    }

    // Verificar que la fecha objetivo no sea pasada (permitir fecha actual)
    const fechaObjetivo = new Date(fecha_objetivo);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Reset time to start of day
    fechaObjetivo.setHours(0, 0, 0, 0);
    
    console.log('Date validation:', { fechaObjetivo, hoy, isValid: fechaObjetivo >= hoy });
    
    if (fechaObjetivo < hoy) {
      console.log('Date validation failed');
      return res.status(400).json({ 
        error: 'La fecha objetivo no puede ser anterior a hoy' 
      });
    }

    console.log('Creating release with data:', {
      nombre,
      version,
      descripcion,
      fecha_objetivo,
      producto,
      prioridad: prioridad || 'media',
      notas,
      created_by: req.user._id
    });

    const nuevoRelease = new Release({
      nombre,
      version,
      descripcion,
      fecha_objetivo,
      producto,
      prioridad: prioridad || 'media',
      notas,
      created_by: req.user._id
    });

    await nuevoRelease.save();
    console.log('Release saved successfully:', nuevoRelease._id);
    await nuevoRelease.populate('producto', 'nombre');
    await nuevoRelease.populate('created_by', 'firstName lastName');

    res.status(201).json(nuevoRelease);
  } catch (error) {
    console.error('Error al crear release:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/releases/:id - Actualizar release
router.put('/:id', authenticate, async (req, res) => {
  try {
    const {
      nombre,
      version,
      descripcion,
      fecha_objetivo,
      fecha_lanzamiento,
      estado,
      prioridad,
      notas
    } = req.body;

    const release = await Release.findById(req.params.id);
    if (!release) {
      return res.status(404).json({ error: 'Release no encontrado' });
    }

    // Validar cambio de estado
    if (estado && estado !== release.estado) {
      if (estado === 'lanzado' && !fecha_lanzamiento) {
        return res.status(400).json({ 
          error: 'Se requiere fecha de lanzamiento para marcar como lanzado' 
        });
      }
      // Usar el método del modelo para cambio de estado con historial
      release.cambiarEstado(estado, req.user._id, `Estado cambiado desde ${release.estado} a ${estado}`);
    }

    // Actualizar otros campos
    if (nombre) release.nombre = nombre;
    if (version) release.version = version;
    if (descripcion !== undefined) release.descripcion = descripcion;
    if (fecha_objetivo) release.fecha_objetivo = fecha_objetivo;
    if (fecha_lanzamiento) release.fecha_lanzamiento = fecha_lanzamiento;
    if (prioridad) release.prioridad = prioridad;
    if (notas !== undefined) release.notas = notas;
    
    release.updated_by = req.user._id;

    // Recalcular progreso
    await release.calcularProgreso();
    await release.save();
    await release.populate('producto', 'nombre');
    await release.populate('created_by', 'firstName lastName');
    await release.populate('updated_by', 'firstName lastName');

    res.json(release);
  } catch (error) {
    console.error('Error al actualizar release:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/releases/:id - Eliminar release
router.delete('/:id', async (req, res) => {
  try {
    const release = await Release.findById(req.params.id);
    if (!release) {
      return res.status(404).json({ error: 'Release no encontrado' });
    }

    // No permitir eliminar releases ya lanzados
    if (release.estado === 'lanzado') {
      return res.status(400).json({ 
        error: 'No se puede eliminar un release ya lanzado' 
      });
    }

    await Release.findByIdAndDelete(req.params.id);
    res.json({ mensaje: 'Release eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar release:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/releases/:id/sprints - Asociar sprint a release
router.post('/:id/sprints', authenticate, async (req, res) => {
  try {
    const { sprint_id } = req.body;
    
    const release = await Release.findById(req.params.id);
    if (!release) {
      return res.status(404).json({ error: 'Release no encontrado' });
    }

    const sprint = await Sprint.findById(sprint_id);
    if (!sprint) {
      return res.status(404).json({ error: 'Sprint no encontrado' });
    }

    // Verificar que el sprint pertenece al mismo producto
    if (sprint.producto.toString() !== release.producto.toString()) {
      return res.status(400).json({ 
        error: 'El sprint debe pertenecer al mismo producto que el release' 
      });
    }

    // Agregar sprint si no está ya asociado
    if (!release.sprints.includes(sprint_id)) {
      release.sprints.push(sprint_id);
      release.updated_by = req.user._id;
      await release.save();
    }

    await release.populate('sprints');
    res.json(release);
  } catch (error) {
    console.error('Error al asociar sprint:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/releases/:id/sprints/:sprint_id - Desasociar sprint de release
router.delete('/:id/sprints/:sprint_id', authenticate, async (req, res) => {
  try {
    const release = await Release.findById(req.params.id);
    if (!release) {
      return res.status(404).json({ error: 'Release no encontrado' });
    }

    release.sprints = release.sprints.filter(
      sprintId => sprintId.toString() !== req.params.sprint_id
    );
    
    release.updated_by = req.user._id;
    await release.save();
    await release.populate('sprints');

    res.json(release);
  } catch (error) {
    console.error('Error al desasociar sprint:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/releases/:id/backlog-items - Asociar historia a release
router.post('/:id/backlog-items', authenticate, async (req, res) => {
  try {
    const { backlog_item_id } = req.body;
    
    const release = await Release.findById(req.params.id);
    if (!release) {
      return res.status(404).json({ error: 'Release no encontrado' });
    }

    const backlogItem = await BacklogItem.findById(backlog_item_id);
    if (!backlogItem) {
      return res.status(404).json({ error: 'Historia no encontrada' });
    }

    // Verificar que la historia pertenece al mismo producto
    if (backlogItem.producto.toString() !== release.producto.toString()) {
      return res.status(400).json({ 
        error: 'La historia debe pertenecer al mismo producto que el release' 
      });
    }

    // Agregar historia si no está ya asociada
    if (!release.backlog_items.includes(backlog_item_id)) {
      release.backlog_items.push(backlog_item_id);
      release.updated_by = req.user._id;
      await release.save();
    }

    await release.populate('backlog_items');
    res.json(release);
  } catch (error) {
    console.error('Error al asociar historia:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/releases/roadmap/:producto_id - Vista de roadmap para un producto
router.get('/roadmap/:producto_id', async (req, res) => {
  try {
    const { producto_id } = req.params;
    
    const releases = await Release.find({ producto: producto_id })
      .populate('sprints', 'nombre estado fecha_inicio fecha_fin velocidad_planificada velocidad_real')
      .populate('backlog_items', 'titulo estado puntos_historia prioridad')
      .sort({ fecha_objetivo: 1 });

    // Calcular métricas de roadmap
    const roadmapData = {
      releases: releases,
      resumen: {
        total_releases: releases.length,
        planificados: releases.filter(r => r.estado === 'planificado').length,
        en_desarrollo: releases.filter(r => r.estado === 'en_desarrollo').length,
        lanzados: releases.filter(r => r.estado === 'lanzado').length,
        retrasados: releases.filter(r => r.esta_retrasado).length
      }
    };

    res.json(roadmapData);
  } catch (error) {
    console.error('Error al obtener roadmap:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/releases/:id/estado - Cambiar estado de release con historial
router.patch('/:id/estado', authenticate, async (req, res) => {
  try {
    const { estado, notas = '' } = req.body;
    
    if (!estado) {
      return res.status(400).json({ error: 'Estado es requerido' });
    }

    const release = await Release.findById(req.params.id)
      .populate('sprints')
      .populate('producto', 'nombre');
      
    if (!release) {
      return res.status(404).json({ error: 'Release no encontrado' });
    }

    // Validar estado válido
    const estadosValidos = ['planificado', 'en_desarrollo', 'testing', 'lanzado'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ 
        error: 'Estado no válido. Estados permitidos: ' + estadosValidos.join(', ') 
      });
    }

    // Usar método del modelo para cambiar estado con historial
    await release.cambiarEstado(estado, req.user._id, notas);
    
    console.log('Progreso después del cambio:', release.progreso);
    
    await release.save();

    res.json({
      message: 'Estado actualizado correctamente',
      release: {
        id: release._id,
        estado: release.estado,
        progreso: release.progreso,
        historial: release.historial.slice(-5) // Últimos 5 cambios
      }
    });
  } catch (error) {
    console.error('Error al cambiar estado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/releases/:id/historial - Obtener historial completo
router.get('/:id/historial', async (req, res) => {
  try {
    const release = await Release.findById(req.params.id)
      .populate('historial.usuario', 'firstName lastName')
      .select('historial nombre version');
      
    if (!release) {
      return res.status(404).json({ error: 'Release no encontrado' });
    }

    res.json({
      release: {
        id: release._id,
        nombre: release.nombre,
        version: release.version
      },
      historial: release.historial.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
