const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const Impediment = require('../models/Impediment');

// GET /api/impediments - Obtener todos los impedimentos
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, priority, responsible, category } = req.query;
    
    // Construir filtros de consulta
    const filters = {};
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (category) filters.category = category;
    if (responsible) {
      filters.responsible = { $regex: responsible, $options: 'i' };
    }
    
    const impediments = await Impediment.find(filters)
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .sort({ createdDate: -1 });
    
    res.json({
      impediments,
      total: impediments.length
    });
  } catch (error) {
    console.error('Error al obtener impedimentos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/impediments/:id - Obtener impedimento específico
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const impediment = await Impediment.findById(id)
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email');
    
    if (!impediment) {
      return res.status(404).json({ error: 'Impedimento no encontrado' });
    }
    
    res.json(impediment);
  } catch (error) {
    console.error('Error al obtener impedimento:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID de impedimento inválido' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/impediments - Crear nuevo impedimento
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, description, responsible, priority, category, assignedTo } = req.body;
    
    // Validaciones básicas
    if (!title || !description || !responsible) {
      return res.status(400).json({ 
        error: 'Los campos título, descripción y responsable son obligatorios' 
      });
    }
    
    const impedimentData = {
      title,
      description,
      responsible,
      priority: priority || 'medium',
      category: category || 'technical',
      createdBy: req.user.id
    };
    
    if (assignedTo) {
      impedimentData.assignedTo = assignedTo;
    }
    
    const newImpediment = new Impediment(impedimentData);
    await newImpediment.save();
    
    // Populate the response
    await newImpediment.populate('createdBy', 'firstName lastName email');
    if (newImpediment.assignedTo) {
      await newImpediment.populate('assignedTo', 'firstName lastName email');
    }
    
    res.status(201).json({
      message: 'Impedimento creado exitosamente',
      impediment: newImpediment
    });
  } catch (error) {
    console.error('Error al crear impedimento:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/impediments/:id - Actualizar impedimento
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, responsible, status, priority, category, assignedTo } = req.body;
    
    const impediment = await Impediment.findById(id);
    
    if (!impediment) {
      return res.status(404).json({ error: 'Impedimento no encontrado' });
    }
    
    // Actualizar campos
    if (title) impediment.title = title;
    if (description) impediment.description = description;
    if (responsible) impediment.responsible = responsible;
    if (priority) impediment.priority = priority;
    if (category) impediment.category = category;
    if (assignedTo !== undefined) impediment.assignedTo = assignedTo;
    
    // Si se está resolviendo el impedimento
    if (status && status === 'resolved' && impediment.status !== 'resolved') {
      impediment.status = 'resolved';
      impediment.resolvedDate = new Date();
    } else if (status) {
      impediment.status = status;
      if (status !== 'resolved') {
        impediment.resolvedDate = null;
      }
    }
    
    await impediment.save();
    
    // Populate the response
    await impediment.populate('createdBy', 'firstName lastName email');
    if (impediment.assignedTo) {
      await impediment.populate('assignedTo', 'firstName lastName email');
    }
    
    res.json({
      message: 'Impedimento actualizado exitosamente',
      impediment
    });
  } catch (error) {
    console.error('Error al actualizar impedimento:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID de impedimento inválido' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/impediments/:id - Eliminar impedimento
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const impediment = await Impediment.findById(id);
    
    if (!impediment) {
      return res.status(404).json({ error: 'Impedimento no encontrado' });
    }
    
    await Impediment.findByIdAndDelete(id);
    
    res.json({ message: 'Impedimento eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar impedimento:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID de impedimento inválido' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/impediments/:id/status - Cambiar estado del impedimento
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !['open', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ 
        error: 'Estado inválido. Debe ser: open, in_progress, o resolved' 
      });
    }
    
    const impediment = await Impediment.findById(id);
    
    if (!impediment) {
      return res.status(404).json({ error: 'Impedimento no encontrado' });
    }
    
    impediment.status = status;
    
    if (status === 'resolved') {
      impediment.resolvedDate = new Date();
    } else if (impediment.resolvedDate) {
      impediment.resolvedDate = null;
    }
    
    await impediment.save();
    
    // Populate the response
    await impediment.populate('createdBy', 'firstName lastName email');
    if (impediment.assignedTo) {
      await impediment.populate('assignedTo', 'firstName lastName email');
    }
    
    res.json({
      message: 'Estado del impedimento actualizado exitosamente',
      impediment
    });
  } catch (error) {
    console.error('Error al cambiar estado del impedimento:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID de impedimento inválido' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/impediments/stats - Obtener estadísticas de impedimentos
router.get('/stats/summary', authenticate, async (req, res) => {
  try {
    const total = await Impediment.countDocuments();
    const open = await Impediment.countDocuments({ status: 'open' });
    const inProgress = await Impediment.countDocuments({ status: 'in_progress' });
    const resolved = await Impediment.countDocuments({ status: 'resolved' });
    const critical = await Impediment.countDocuments({ priority: 'high' });
    
    // Calcular tiempo promedio de resolución usando agregación
    const avgResolutionStats = await Impediment.aggregate([
      {
        $match: {
          status: 'resolved',
          resolvedDate: { $exists: true, $ne: null }
        }
      },
      {
        $project: {
          resolutionTime: {
            $divide: [
              { $subtract: ['$resolvedDate', '$createdDate'] },
              1000 * 60 * 60 * 24 // convertir a días
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgResolutionTime: { $avg: '$resolutionTime' }
        }
      }
    ]);
    
    const avgResolutionTime = avgResolutionStats.length > 0 
      ? Math.round(avgResolutionStats[0].avgResolutionTime * 10) / 10 
      : 0;
    
    res.json({
      total,
      open,
      inProgress,
      resolved,
      critical,
      avgResolutionTime,
      resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
