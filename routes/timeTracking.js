const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const TimeTracking = require('../models/TimeTracking');
const Task = require('../models/Task');

// Middleware para verificar rol de developer
const requireDeveloperRole = (req, res, next) => {
  if (!req.user || !['developer', 'developers', 'scrum_master', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ 
      error: 'Acceso denegado. Se requiere rol de developer o superior.' 
    });
  }
  next();
};

// GET /api/developers/time-tracking - Obtener registros de tiempo
router.get('/', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const userId = req.user.id;
    const { task, period = 'week', page = 1, limit = 50 } = req.query;

    // Calcular fechas según el período
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.setDate(now.getDate() - 7));
    }

    // Construir filtros
    const filters = { 
      user: userId,
      createdAt: { $gte: startDate }
    };
    if (task) filters.task = task;

    const timeRecords = await TimeTracking.find(filters)
      .populate('task', 'title status priority storyPoints')
      .populate('sprint', 'nombre')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await TimeTracking.countDocuments(filters);

    // Obtener estadísticas del período
    const stats = await TimeTracking.aggregate([
      {
        $match: {
          user: userId,
          createdAt: { $gte: startDate },
          endTime: { $ne: null }
        }
      },
      {
        $group: {
          _id: null,
          totalMinutes: { $sum: '$duration' },
          totalSessions: { $sum: 1 },
          avgSessionLength: { $avg: '$duration' }
        }
      }
    ]);

    // Estadísticas por categoría
    const categoryStats = await TimeTracking.aggregate([
      {
        $match: {
          user: userId,
          createdAt: { $gte: startDate },
          endTime: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$category',
          totalMinutes: { $sum: '$duration' },
          sessions: { $sum: 1 }
        }
      }
    ]);

    // Obtener sesión activa si existe
    const activeSession = await TimeTracking.findOne({
      user: userId,
      isActive: true
    }).populate('task', 'title');

    res.json({
      success: true,
      data: {
        timeRecords,
        statistics: {
          ...stats[0],
          totalHours: stats[0] ? Math.round(stats[0].totalMinutes / 60 * 100) / 100 : 0,
          avgSessionHours: stats[0] ? Math.round(stats[0].avgSessionLength / 60 * 100) / 100 : 0
        },
        categoryStats,
        activeSession,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Error al obtener registros de tiempo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/developers/time-tracking/start - Iniciar tracking de tiempo
router.post('/start', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId, description, category = 'development' } = req.body;

    if (!taskId) {
      return res.status(400).json({ error: 'El ID de la tarea es requerido' });
    }

    // Verificar que la tarea existe y está asignada al usuario
    const task = await Task.findOne({ _id: taskId, assignee: userId });
    if (!task) {
      return res.status(404).json({ error: 'Tarea no encontrada o no asignada a ti' });
    }

    // Verificar que no hay otra sesión activa
    const activeSession = await TimeTracking.findOne({
      user: userId,
      isActive: true
    });

    if (activeSession) {
      return res.status(400).json({ 
        error: 'Ya tienes una sesión de tiempo activa. Detén la sesión actual antes de iniciar una nueva.' 
      });
    }

    const timeTracking = new TimeTracking({
      user: userId,
      task: taskId,
      sprint: task.sprint,
      startTime: new Date(),
      description: description || '',
      category,
      isActive: true
    });

    await timeTracking.save();
    await timeTracking.populate('task', 'title status');

    res.status(201).json({
      success: true,
      message: 'Tracking de tiempo iniciado exitosamente',
      data: timeTracking
    });

  } catch (error) {
    console.error('Error al iniciar tracking de tiempo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/developers/time-tracking/stop - Detener tracking de tiempo
router.put('/stop', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const userId = req.user.id;
    const { notes, productivity = 'medium' } = req.body;

    const activeSession = await TimeTracking.findOne({
      user: userId,
      isActive: true
    });

    if (!activeSession) {
      return res.status(404).json({ error: 'No hay sesión de tiempo activa' });
    }

    const endTime = new Date();
    const duration = Math.round((endTime - activeSession.startTime) / (1000 * 60)); // minutos

    activeSession.endTime = endTime;
    activeSession.duration = duration;
    activeSession.isActive = false;
    activeSession.productivity = productivity;
    if (notes) activeSession.notes = notes;

    await activeSession.save();
    await activeSession.populate('task', 'title status');

    // Actualizar el tiempo actual de la tarea
    await Task.findByIdAndUpdate(activeSession.task._id, {
      $inc: { actualHours: duration / 60 }
    });

    res.json({
      success: true,
      message: 'Tracking de tiempo detenido exitosamente',
      data: activeSession
    });

  } catch (error) {
    console.error('Error al detener tracking de tiempo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/developers/time-tracking/active - Obtener sesión activa
router.get('/active', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const userId = req.user.id;

    const activeSession = await TimeTracking.findOne({
      user: userId,
      isActive: true
    }).populate('task', 'title status priority');

    res.json({
      success: true,
      data: activeSession
    });

  } catch (error) {
    console.error('Error al obtener sesión activa:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/developers/time-tracking/:id - Actualizar registro de tiempo
router.put('/:id', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { description, category, productivity, notes } = req.body;

    const timeRecord = await TimeTracking.findOne({ _id: id, user: userId });
    if (!timeRecord) {
      return res.status(404).json({ error: 'Registro de tiempo no encontrado' });
    }

    if (timeRecord.isActive) {
      return res.status(400).json({ error: 'No puedes editar una sesión activa' });
    }

    if (description !== undefined) timeRecord.description = description;
    if (category !== undefined) timeRecord.category = category;
    if (productivity !== undefined) timeRecord.productivity = productivity;
    if (notes !== undefined) timeRecord.notes = notes;

    await timeRecord.save();
    await timeRecord.populate('task', 'title status');

    res.json({
      success: true,
      message: 'Registro de tiempo actualizado exitosamente',
      data: timeRecord
    });

  } catch (error) {
    console.error('Error al actualizar registro de tiempo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/developers/time-tracking/:id - Eliminar registro de tiempo
router.delete('/:id', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const timeRecord = await TimeTracking.findOne({ _id: id, user: userId });
    if (!timeRecord) {
      return res.status(404).json({ error: 'Registro de tiempo no encontrado' });
    }

    if (timeRecord.isActive) {
      return res.status(400).json({ error: 'No puedes eliminar una sesión activa' });
    }

    // Restar el tiempo de la tarea
    if (timeRecord.duration > 0) {
      await Task.findByIdAndUpdate(timeRecord.task, {
        $inc: { actualHours: -(timeRecord.duration / 60) }
      });
    }

    await TimeTracking.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Registro de tiempo eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar registro de tiempo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/developers/time-tracking/stats/:period - Obtener estadísticas de tiempo
router.get('/stats/:period', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const userId = req.user.id;
    const { period } = req.params;

    // Calcular fechas según el período
    const now = new Date();
    let startDate, endDate = now;
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        return res.status(400).json({ error: 'Período inválido' });
    }

    // Estadísticas generales
    const generalStats = await TimeTracking.aggregate([
      {
        $match: {
          user: userId,
          createdAt: { $gte: startDate, $lte: endDate },
          endTime: { $ne: null }
        }
      },
      {
        $group: {
          _id: null,
          totalMinutes: { $sum: '$duration' },
          totalSessions: { $sum: 1 },
          avgSessionLength: { $avg: '$duration' }
        }
      }
    ]);

    // Estadísticas por día
    const dailyStats = await TimeTracking.aggregate([
      {
        $match: {
          user: userId,
          createdAt: { $gte: startDate, $lte: endDate },
          endTime: { $ne: null }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          totalMinutes: { $sum: '$duration' },
          sessions: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Top tareas por tiempo
    const topTasks = await TimeTracking.aggregate([
      {
        $match: {
          user: userId,
          createdAt: { $gte: startDate, $lte: endDate },
          endTime: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$task',
          totalMinutes: { $sum: '$duration' },
          sessions: { $sum: 1 }
        }
      },
      { $sort: { totalMinutes: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'tasks',
          localField: '_id',
          foreignField: '_id',
          as: 'taskInfo'
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        period,
        dateRange: { startDate, endDate },
        general: {
          ...generalStats[0],
          totalHours: generalStats[0] ? Math.round(generalStats[0].totalMinutes / 60 * 100) / 100 : 0,
          avgSessionHours: generalStats[0] ? Math.round(generalStats[0].avgSessionLength / 60 * 100) / 100 : 0
        },
        dailyStats,
        topTasks
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas de tiempo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
