const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const Ceremony = require('../models/Ceremony');

// GET /api/ceremonies - Obtener todas las ceremonias
router.get('/', authenticate, async (req, res) => {
  try {
    const { type, status, date_from, date_to } = req.query;
    
    // Construir filtros de consulta
    const filters = {};
    if (type) filters.type = type;
    if (status) filters.status = status;
    if (date_from || date_to) {
      filters.date = {};
      if (date_from) filters.date.$gte = new Date(date_from);
      if (date_to) filters.date.$lte = new Date(date_to);
    }
    
    const ceremonies = await Ceremony.find(filters)
      .populate('participants.user', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('facilitator', 'firstName lastName email')
      .sort({ date: -1, startTime: -1 });
    
    res.json({
      ceremonies,
      total: ceremonies.length
    });
  } catch (error) {
    console.error('Error al obtener ceremonias:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/ceremonies/:id - Obtener ceremonia específica
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const ceremony = await Ceremony.findById(id)
      .populate('participants.user', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('facilitator', 'firstName lastName email');
    
    if (!ceremony) {
      return res.status(404).json({ error: 'Ceremonia no encontrada' });
    }
    
    res.json(ceremony);
  } catch (error) {
    console.error('Error al obtener ceremonia:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID de ceremonia inválido' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/ceremonies - Crear nueva ceremonia
router.post('/', authenticate, async (req, res) => {
  try {
    const { 
      type, 
      title, 
      description,
      date, 
      startTime, 
      duration, 
      participants, 
      notes, 
      goals, 
      blockers 
    } = req.body;
    
    // Validaciones básicas
    if (!type || !title || !date || !startTime) {
      return res.status(400).json({ 
        error: 'Los campos tipo, título, fecha y hora son obligatorios' 
      });
    }
    
    if (!['sprint_planning', 'daily_standup', 'sprint_review', 'retrospective'].includes(type)) {
      return res.status(400).json({ 
        error: 'Tipo de ceremonia inválido' 
      });
    }
    
    const ceremonyData = {
      type,
      title,
      description: description || '',
      date: new Date(date),
      startTime,
      duration: duration || 60,
      createdBy: req.user.id,
      facilitator: req.user.id  // El creador es el facilitador por defecto
    };
    
    // Agregar participantes si se proporcionaron
    if (participants && Array.isArray(participants)) {
      ceremonyData.participants = participants.map(p => ({
        user: p.user || p,
        role: p.role || 'participant'
      }));
    }
    
    // Agregar notas, objetivos y bloqueadores si se proporcionaron
    if (notes) ceremonyData.notes = notes;
    if (goals && Array.isArray(goals)) ceremonyData.goals = goals;
    if (blockers && Array.isArray(blockers)) ceremonyData.blockers = blockers;
    
    const newCeremony = new Ceremony(ceremonyData);
    await newCeremony.save();
    
    // Populate the response
    await newCeremony.populate('participants.user', 'firstName lastName email');
    await newCeremony.populate('createdBy', 'firstName lastName email');
    await newCeremony.populate('facilitator', 'firstName lastName email');
    
    res.status(201).json({
      message: 'Ceremonia creada exitosamente',
      ceremony: newCeremony
    });
  } catch (error) {
    console.error('Error al crear ceremonia:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/ceremonies/:id - Actualizar ceremonia
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const ceremony = await Ceremony.findById(id);
    
    if (!ceremony) {
      return res.status(404).json({ error: 'Ceremonia no encontrada' });
    }
    
    // Actualizar campos permitidos
    const allowedFields = [
      'title', 'description', 'date', 'startTime', 'duration', 
      'participants', 'notes', 'goals', 'blockers', 'status'
    ];
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field === 'date' && updateData[field]) {
          ceremony[field] = new Date(updateData[field]);
        } else if (field === 'participants' && Array.isArray(updateData[field])) {
          ceremony[field] = updateData[field].map(p => ({
            user: p.user || p,
            role: p.role || 'participant',
            attendance: p.attendance || 'pending'
          }));
        } else {
          ceremony[field] = updateData[field];
        }
      }
    });
    
    await ceremony.save();
    
    // Populate the response
    await ceremony.populate('participants.user', 'firstName lastName email');
    await ceremony.populate('createdBy', 'firstName lastName email');
    await ceremony.populate('facilitator', 'firstName lastName email');
    
    res.json({
      message: 'Ceremonia actualizada exitosamente',
      ceremony
    });
  } catch (error) {
    console.error('Error al actualizar ceremonia:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID de ceremonia inválido' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/ceremonies/:id/status - Cambiar estado de la ceremonia
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !['scheduled', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ 
        error: 'Estado inválido. Debe ser: scheduled, in_progress, completed, o cancelled' 
      });
    }
    
    const ceremony = await Ceremony.findById(id);
    
    if (!ceremony) {
      return res.status(404).json({ error: 'Ceremonia no encontrada' });
    }
    
    ceremony.status = status;
    await ceremony.save();
    
    // Populate the response
    await ceremony.populate('participants.user', 'firstName lastName email');
    await ceremony.populate('createdBy', 'firstName lastName email');
    await ceremony.populate('facilitator', 'firstName lastName email');
    
    res.json({
      message: 'Estado de la ceremonia actualizado exitosamente',
      ceremony
    });
  } catch (error) {
    console.error('Error al cambiar estado de la ceremonia:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID de ceremonia inválido' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/ceremonies/:id - Eliminar ceremonia
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const ceremony = await Ceremony.findById(id);
    
    if (!ceremony) {
      return res.status(404).json({ error: 'Ceremonia no encontrada' });
    }
    
    await Ceremony.findByIdAndDelete(id);
    
    res.json({ message: 'Ceremonia eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar ceremonia:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID de ceremonia inválido' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/ceremonies/upcoming - Obtener próximas ceremonias
router.get('/upcoming/list', authenticate, async (req, res) => {
  try {
    const today = new Date();
    
    const upcomingCeremonies = await Ceremony.find({
      date: { $gte: today },
      status: 'scheduled'
    })
      .populate('participants.user', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('facilitator', 'firstName lastName email')
      .sort({ date: 1, startTime: 1 })
      .limit(5);
    
    res.json({
      ceremonies: upcomingCeremonies,
      total: upcomingCeremonies.length
    });
  } catch (error) {
    console.error('Error al obtener próximas ceremonias:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/ceremonies/stats - Obtener estadísticas de ceremonias
router.get('/stats/summary', authenticate, async (req, res) => {
  try {
    const { period = '30' } = req.query; // días
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));
    
    // Contar documentos por estado
    const total = await Ceremony.countDocuments({ date: { $gte: startDate } });
    const completed = await Ceremony.countDocuments({ 
      date: { $gte: startDate }, 
      status: 'completed' 
    });
    const scheduled = await Ceremony.countDocuments({ 
      date: { $gte: startDate }, 
      status: 'scheduled' 
    });
    const cancelled = await Ceremony.countDocuments({ 
      date: { $gte: startDate }, 
      status: 'cancelled' 
    });
    
    // Estadísticas por tipo usando agregación
    const byTypeStats = await Ceremony.aggregate([
      { 
        $match: { date: { $gte: startDate } } 
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const byType = {
      sprint_planning: 0,
      daily_standup: 0,
      sprint_review: 0,
      retrospective: 0
    };
    
    byTypeStats.forEach(stat => {
      byType[stat._id] = stat.count;
    });
    
    // Calcular duración promedio
    const avgDurationStats = await Ceremony.aggregate([
      {
        $match: {
          date: { $gte: startDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: '$duration' }
        }
      }
    ]);
    
    const avgDuration = avgDurationStats.length > 0 
      ? Math.round(avgDurationStats[0].avgDuration) 
      : 0;
    
    res.json({
      period: `${period} días`,
      total,
      completed,
      scheduled,
      cancelled,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgDuration,
      byType
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de ceremonias:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
