const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const developersService = require('../services/developersService');
const {
  validateTimeEntry,
  validateTaskStatusUpdate,
  validateBugReport,
  validateTimerStart,
  validateTimeTrackingQuery,
  validateObjectId
} = require('../middleware/validation/developersValidation');
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

// GET /api/developers/sprints - Obtener lista de sprints disponibles
router.get('/sprints', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const sprints = await developersService.getAvailableSprints();
    
    res.json({
      success: true,
      data: sprints
    });
  } catch (error) {
    console.error('Error al obtener sprints disponibles:', error);
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
    const { sprintId, filterMode } = req.query;
    
    const sprintData = await developersService.getSprintBoardData(userId, sprintId, filterMode);
    
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
      data: stats || {}
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de time tracking:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      message: error.message,
      data: {}
    });
  }
});

// GET /api/developers/time-tracking - Obtener entradas de time tracking
router.get('/time-tracking', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId, date, startDate, endDate } = req.query;
    
    const filters = {};
    if (taskId) filters.taskId = taskId;
    if (date) filters.date = date;
    if (startDate && endDate) {
      filters.startDate = startDate;
      filters.endDate = endDate;
    }
    
    const entries = await developersService.getTimeEntries(userId, filters);
    
    res.json({
      success: true,
      data: entries || []
    });
  } catch (error) {
    console.error('Error al obtener entradas de time tracking:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      message: error.message,
      data: []
    });
  }
});

// POST /api/developers/time-tracking - Crear entrada de time tracking
router.post('/time-tracking', authenticate, requireDeveloperRole, validateTimeEntry, async (req, res) => {
  try {
    const userId = req.user.id;
    const timeData = req.body;
    
    const timeEntry = await developersService.createTimeEntry(userId, timeData);
    
    res.status(201).json({
      success: true,
      data: timeEntry,
      message: 'Entrada de tiempo creada correctamente'
    });
  } catch (error) {
    console.error('Error al crear entrada de time tracking:', error);
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
});

// PUT /api/developers/time-tracking/:id - Actualizar entrada de time tracking
router.put('/time-tracking/:id', authenticate, requireDeveloperRole, validateObjectId('id'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updateData = req.body;
    
    const updatedEntry = await developersService.updateTimeEntry(id, userId, updateData);
    
    res.json({
      success: true,
      data: updatedEntry,
      message: 'Entrada de tiempo actualizada correctamente'
    });
  } catch (error) {
    console.error('Error al actualizar entrada de time tracking:', error);
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
});

// DELETE /api/developers/time-tracking/:id - Eliminar entrada de time tracking
router.delete('/time-tracking/:id', authenticate, requireDeveloperRole, validateObjectId('id'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const result = await developersService.deleteTimeEntry(id, userId);
    
    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Error al eliminar entrada de time tracking:', error);
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
});

// POST /api/developers/timer/start - Iniciar timer
router.post('/timer/start', authenticate, requireDeveloperRole, validateTimerStart, async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.body;
    
    const timer = await developersService.startTimer(userId, taskId);
    
    res.status(201).json({
      success: true,
      data: timer,
      message: 'Timer iniciado correctamente'
    });
  } catch (error) {
    console.error('Error al iniciar timer:', error);
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
});

// POST /api/developers/timer/stop - Detener timer
router.post('/timer/stop', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const userId = req.user.id;
    const { description } = req.body;
    
    const timer = await developersService.stopTimer(userId, description);
    
    res.json({
      success: true,
      data: timer,
      message: 'Timer detenido correctamente'
    });
  } catch (error) {
    console.error('Error al detener timer:', error);
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
});

// GET /api/developers/timer/active - Obtener timer activo
router.get('/timer/active', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const activeTimer = await developersService.getActiveTimer(userId);
    
    res.json({
      success: true,
      data: activeTimer || null
    });
  } catch (error) {
    console.error('Error al obtener timer activo:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      message: error.message,
      data: null
    });
  }
});

// GET /api/developers/bug-reports - Obtener reportes de bugs
router.get('/bug-reports', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, priority, project } = req.query;
    
    const filters = {};
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (project) filters.project = project;
    
    const bugReports = await developersService.getBugReports(userId, filters);
    
    res.json({
      success: true,
      data: bugReports
    });
  } catch (error) {
    console.error('Error al obtener reportes de bugs:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

// POST /api/developers/bug-reports - Crear reporte de bug
router.post('/bug-reports', authenticate, requireDeveloperRole, validateBugReport, async (req, res) => {
  try {
    const userId = req.user.id;
    const bugData = req.body;
    
    const bugReport = await developersService.createBugReport(userId, bugData);
    
    res.status(201).json({
      success: true,
      data: bugReport,
      message: 'Reporte de bug creado correctamente'
    });
  } catch (error) {
    console.error('Error al crear reporte de bug:', error);
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
});

// GET /api/developers/repositories - Obtener repositorios del developer
router.get('/repositories', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const repositories = await developersService.getDeveloperRepositories(userId);
    
    res.json({
      success: true,
      data: repositories
    });
  } catch (error) {
    console.error('Error al obtener repositorios:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

// GET /api/developers/commits - Obtener historial de commits
router.get('/commits', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const userId = req.user.id;
    const { repository, branch, startDate, endDate } = req.query;
    
    const filters = {};
    if (repository) filters.repository = repository;
    if (branch) filters.branch = branch;
    if (startDate && endDate) {
      filters.startDate = startDate;
      filters.endDate = endDate;
    }
    
    const commits = await developersService.getCommitHistory(userId, filters);
    
    res.json({
      success: true,
      data: commits
    });
  } catch (error) {
    console.error('Error al obtener historial de commits:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

// GET /api/developers/pull-requests - Obtener pull requests
router.get('/pull-requests', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, repository } = req.query;
    
    const filters = {};
    if (status) filters.status = status;
    if (repository) filters.repository = repository;
    
    const pullRequests = await developersService.getPullRequests(userId, filters);
    
    res.json({
      success: true,
      data: pullRequests
    });
  } catch (error) {
    console.error('Error al obtener pull requests:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

// POST /api/developers/backlog/:itemId/take - Auto-asignarse una tarea del backlog
router.post('/backlog/:itemId/take', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user._id || req.user.id;

    console.log('=== DEVELOPER TAKING BACKLOG ITEM ===');
    console.log('Item ID:', itemId);
    console.log('User ID:', userId);
    console.log('User role:', req.user.role);

    // Importar modelo BacklogItem
    const BacklogItem = require('../models/BacklogItem');

    // Verificar que el item existe y asignarlo de forma atómica
    const item = await BacklogItem.findOneAndUpdate(
      { 
        _id: itemId,
        asignado_a: { $exists: false } // Solo si NO está asignado
      },
      { 
        asignado_a: userId,
        estado: 'en_progreso',
        updated_by: userId
      },
      { new: true, runValidators: true }
    ).populate([
      { path: 'producto', select: 'nombre' },
      { path: 'asignado_a', select: 'nombre_negocio email' },
      { path: 'sprint', select: 'nombre' }
    ]);

    // Si no se pudo actualizar, significa que ya estaba asignado o no existe
    if (!item) {
      // Verificar si existe para dar un mensaje más específico
      const existingItem = await BacklogItem.findById(itemId);
      if (!existingItem) {
        return res.status(404).json({ 
          success: false,
          message: 'Tarea no encontrada' 
        });
      }
      
      return res.status(400).json({ 
        success: false,
        message: 'Esta tarea ya está asignada a otro usuario' 
      });
    }

    // Crear una Task correspondiente para el sistema de time tracking y "Mis Tareas"
    // USAR EL MISMO SPRINT QUE MUESTRA EL SPRINT BOARD
    const Sprint = require('../models/Sprint');
    
    // Usar la MISMA lógica que usa getSprintBoardData para encontrar el sprint
    let activeSprint = await Sprint.findOne({ estado: 'activo' });
    
    // Si no hay activo, buscar el actual por fechas (MISMA LÓGICA)
    if (!activeSprint) {
      const now = new Date();
      activeSprint = await Sprint.findOne({
        fecha_inicio: { $lte: now },
        fecha_fin: { $gte: now }
      }).sort({ fecha_inicio: -1 });
    }
    
    // Si aún no hay sprint, tomar el más reciente (MISMA LÓGICA)
    if (!activeSprint) {
      activeSprint = await Sprint.findOne().sort({ fecha_inicio: -1 });
    }
    
    let sprintId = null;
    if (activeSprint) {
      sprintId = activeSprint._id;
      console.log('📌 Usando sprint CONSISTENTE:', {
        id: activeSprint._id,
        nombre: activeSprint.nombre,
        estado: activeSprint.estado
      });
      
      // También actualizar el BacklogItem para tener consistencia
      await BacklogItem.findByIdAndUpdate(
        itemId,
        { sprint: sprintId }
      );
    } else {
      console.log('⚠️ No se encontró sprint activo');
    }

    // Funciones de mapeo para convertir tipos de BacklogItem a Task
    const mapBacklogTypeToTaskType = (backlogType) => {
      const typeMapping = {
        'tarea': 'task',
        'historia': 'story', 
        'bug': 'bug',
        'mejora': 'story',
        'epic': 'epic',
        'spike': 'spike'
      };
      return typeMapping[backlogType] || 'task'; // Por defecto 'task'
    };

    const mapBacklogStatusToTaskStatus = (backlogStatus) => {
      const statusMapping = {
        'pendiente': 'todo',
        'en_progreso': 'in_progress', 
        'en_revision': 'code_review',
        'testing': 'testing',
        'completado': 'done',
        'done': 'done'
      };
      return statusMapping[backlogStatus] || 'todo';
    };

    const mapBacklogPriorityToTaskPriority = (backlogPriority) => {
      const priorityMapping = {
        'baja': 'low',
        'media': 'medium',
        'alta': 'high', 
        'critica': 'critical',
        'crítica': 'critical'
      };
      return priorityMapping[backlogPriority] || 'medium';
    };

    const newTask = new Task({
      title: item.titulo,
      description: item.descripcion,
      status: mapBacklogStatusToTaskStatus(item.estado),
      priority: mapBacklogPriorityToTaskPriority(item.prioridad),
      assignee: userId,
      sprint: sprintId, // Asignar al sprint activo si no tenía uno
      backlogItem: item._id,
      reporter: userId, // El que se auto-asigna es también el reporter
      type: mapBacklogTypeToTaskType(item.tipo), // CORREGIDO: Mapear el tipo correctamente
      storyPoints: item.puntos_historia,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const savedTask = await newTask.save();
    console.log('✅ Task creada automáticamente:', savedTask._id);
    console.log('📋 Sprint asignado:', sprintId);

    console.log('✅ Item asignado exitosamente al developer');
    console.log('- Item:', item.titulo);
    console.log('- Asignado a:', item.asignado_a?.nombre_negocio || 'Unknown');
    console.log('- Task creada:', savedTask._id);

    res.json({
      success: true,
      message: 'Tarea asignada exitosamente',
      data: {
        item: item,
        task: savedTask
      }
    });

  } catch (error) {
    console.error('Error al asignar tarea del backlog:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

// PUT /api/developers/tasks/:id/status - Actualizar estado de tarea
router.put('/tasks/:id/status', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user._id || req.user.id;

    console.log('=== UPDATING TASK STATUS ===');
    console.log('Task ID:', id);
    console.log('New Status:', status);
    console.log('User ID:', userId);

    // Buscar la task
    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Tarea no encontrada'
      });
    }

    // Verificar que el usuario es el asignado
    if (task.assignee.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para actualizar esta tarea'
      });
    }

    // Actualizar la task
    const updatedTask = await Task.findByIdAndUpdate(
      id,
      { 
        status: status,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).populate([
      { path: 'sprint', select: 'nombre estado fecha_inicio fecha_fin' },
      { path: 'reporter', select: 'firstName lastName email' },
      { path: 'backlogItem', select: 'titulo tipo puntos_historia' }
    ]);

    // Si la task está vinculada a un BacklogItem, sincronizar el estado
    if (task.backlogItem) {
      const BacklogItem = require('../models/BacklogItem');
      const backlogStatus = mapTaskStatusToBacklogStatus(status);
      
      await BacklogItem.findByIdAndUpdate(
        task.backlogItem,
        { 
          estado: backlogStatus,
          updated_by: userId
        }
      );

      console.log('✅ Estado sincronizado con BacklogItem:', backlogStatus);
    }

    console.log('✅ Task actualizada exitosamente');

    res.json({
      success: true,
      message: 'Estado actualizado exitosamente',
      data: {
        task: updatedTask
      }
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

// Función helper para mapear estados de Task a BacklogItem
function mapTaskStatusToBacklogStatus(taskStatus) {
  const statusMap = {
    'todo': 'pendiente',
    'in_progress': 'en_progreso',
    'code_review': 'en_revision',
    'testing': 'en_revision',
    'done': 'completado'
  };
  return statusMap[taskStatus] || 'pendiente';
}

// Funciones helper para mapear estados y prioridades
function mapBacklogStatusToTaskStatus(backlogStatus) {
  const statusMap = {
    'pendiente': 'todo',
    'en_progreso': 'in_progress',
    'en_revision': 'code_review',
    'completado': 'done'
  };
  return statusMap[backlogStatus] || 'todo';
}

function mapBacklogPriorityToTaskPriority(backlogPriority) {
  const priorityMap = {
    'muy_alta': 'critical',
    'alta': 'high',
    'media': 'medium',
    'baja': 'low'
  };
  return priorityMap[backlogPriority] || 'medium';
}

module.exports = router;
