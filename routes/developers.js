const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const developersService = require('../services/developersService');
const Task = require('../models/Task');
const TimeTracking = require('../models/TimeTracking');
const BugReport = require('../models/BugReport');
const Commit = require('../models/Commit');
const PullRequest = require('../models/PullRequest');

// Middleware para verificar rol de developer
const requireDeveloperRole = (req, res, next) => {
  if (!req.user || !['developer', 'developers', 'scrum_master', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ 
      error: 'Acceso denegado. Se requiere rol de developer o superior.' 
    });
  }
  next();
};

// GET /api/developers/dashboard - Dashboard del developer
router.get('/dashboard', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const userId = req.user.id;
    const dashboardData = await developersService.getDashboardMetrics(userId);
    
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Error al obtener dashboard del developer:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

// GET /api/developers/tasks - Obtener tareas del developer
router.get('/tasks', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, priority, sprint, search, page = 1, limit = 20 } = req.query;

    // Construir filtros
    const filters = { assignee: userId };
    if (status && status !== 'all') filters.status = status;
    if (priority) filters.priority = priority;
    if (sprint) filters.sprint = sprint;
    if (search) {
      filters.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const tasks = await Task.find(filters)
      .populate('sprint', 'nombre estado fecha_inicio fecha_fin')
      .populate('reporter', 'firstName lastName email')
      .populate('backlogItem', 'titulo')
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Task.countDocuments(filters);

    // Obtener tiempo tracking para cada tarea
    const tasksWithTime = await Promise.all(tasks.map(async (task) => {
      const timeTracking = await TimeTracking.aggregate([
        {
          $match: {
            task: task._id,
            endTime: { $ne: null }
          }
        },
        {
          $group: {
            _id: null,
            totalMinutes: { $sum: '$duration' }
          }
        }
      ]);

      return {
        ...task.toObject(),
        spentHours: Math.round((timeTracking[0]?.totalMinutes || 0) / 60 * 100) / 100
      };
    }));

    res.json({
      success: true,
      data: {
        tasks: tasksWithTime,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Error al obtener tareas del developer:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/developers/tasks/:id/status - Actualizar estado de tarea
router.put('/tasks/:id/status', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'El estado es requerido'
      });
    }
    
    const updatedTask = await developersService.updateTaskStatus(id, status, userId);
    
    res.json({
      success: true,
      data: updatedTask,
      message: 'Estado de tarea actualizado correctamente'
    });
  } catch (error) {
    console.error('Error al actualizar estado de tarea:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

// GET /api/developers/sprint-board - Obtener datos del sprint board
router.get('/sprint-board', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sprintId } = req.query;
    
    const sprintData = await developersService.getSprintBoardData(userId, sprintId);
    
    res.json({
      success: true,
      data: sprintData
    });
  } catch (error) {
    console.error('Error al obtener datos del sprint board:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

// GET /api/developers/time-tracking/stats - Estadísticas de time tracking
router.get('/time-tracking/stats', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'week' } = req.query;
    
    const stats = await developersService.getTimeTrackingStats(userId, period);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de time tracking:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

module.exports = router;
