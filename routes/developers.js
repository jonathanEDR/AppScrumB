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
const Comment = require('../models/Comment');
const multer = require('multer');
const { bugReportsStorage } = require('../config/cloudinaryConfig');
const uploadService = require('../services/uploadService');
const { 
  uploadConfigs, 
  handleMulterError 
} = require('../middleware/imageValidation');
const {
  mapTaskStatusToBacklogStatus,
  mapBacklogStatusToTaskStatus,
  mapBacklogPriorityToTaskPriority,
  mapBacklogTypeToTaskType
} = require('../utils/taskMappings');

// Configuración de multer con Cloudinary para bug reports
const upload = multer({
  storage: bugReportsStorage,
  limits: uploadConfigs.bugReports.limits,
  fileFilter: uploadConfigs.bugReports.fileFilter
});

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

    console.log('=== OBTENIENDO TAREAS DEL DEVELOPER ===');
    console.log('Developer ID:', userId.toString());
    console.log('Filtros:', { status, priority, sprint, search, page, limit });

    // === 1. BUSCAR TASKS REGULARES ===
    const taskFilters = { assignee: userId };
    if (status && status !== 'all') taskFilters.status = status;
    if (priority) taskFilters.priority = priority;
    if (sprint) taskFilters.sprint = sprint;
    if (search) {
      taskFilters.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const tasks = await Task.find(taskFilters)
      .populate('sprint', 'nombre estado fecha_inicio fecha_fin')
      .populate('reporter', 'firstName lastName email nombre_negocio')
      .populate('assignee', 'firstName lastName email nombre_negocio')
      .populate('backlogItem', 'titulo')
      .sort({ updatedAt: -1 });

    console.log('📋 Tasks regulares encontradas:', tasks.length);

    // === 2. BUSCAR BACKLOG ITEMS ASIGNADOS ===
    const BacklogItem = require('../models/BacklogItem');
    const backlogFilters = { asignado_a: userId };
    
    if (sprint) backlogFilters.sprint = sprint;
    if (search) {
      backlogFilters.$or = [
        { titulo: { $regex: search, $options: 'i' } },
        { descripcion: { $regex: search, $options: 'i' } }
      ];
    }

    const backlogItems = await BacklogItem.find(backlogFilters)
      .populate('sprint', 'nombre estado fecha_inicio fecha_fin')
      .populate('asignado_a', 'firstName lastName email nombre_negocio')
      .populate('historia_padre', 'titulo')
      .sort({ updatedAt: -1 });

    console.log('📋 BacklogItems asignados encontrados:', backlogItems.length);

    // === 3. CONVERTIR BACKLOG ITEMS A FORMATO TASK ===
    const convertedBacklogItems = backlogItems.map(item => {
      // Mapear estados
      const statusMap = {
        'pendiente': 'todo',
        'en_progreso': 'in_progress', 
        'en_revision': 'code_review',
        'revision': 'code_review',
        'pruebas': 'testing',
        'completado': 'done'
      };

      // Mapear prioridades
      const priorityMap = {
        'alta': 'high',
        'media': 'medium',
        'baja': 'low'
      };

      return {
        _id: item._id,
        title: item.titulo,
        description: item.descripcion,
        status: statusMap[item.estado] || 'todo',
        priority: priorityMap[item.prioridad] || 'medium',
        storyPoints: item.story_points || 0,
        assignee: item.asignado_a,
        sprint: item.sprint,
        type: 'backlog-item', // Marcar el origen
        backlogItem: {
          _id: item._id,
          titulo: item.titulo
        },
        historia_padre: item.historia_padre,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        spentHours: 0 // Por ahora sin time tracking para BacklogItems
      };
    });

    console.log('🔄 BacklogItems convertidos:', convertedBacklogItems.length);

    // === 4. COMBINAR Y FILTRAR POR STATUS SI APLICA ===
    let allTasks = [...tasks.map(task => ({ ...task.toObject(), type: 'task' })), ...convertedBacklogItems];
    
    // Filtrar por status si se especificó (después de convertir)
    if (status && status !== 'all') {
      allTasks = allTasks.filter(task => task.status === status);
    }

    // Filtrar por prioridad si se especificó (después de convertir)
    if (priority) {
      allTasks = allTasks.filter(task => task.priority === priority);
    }

    console.log('✅ Total tareas combinadas:', allTasks.length);

    // === 5. PAGINACIÓN ===
    const total = allTasks.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedTasks = allTasks.slice(startIndex, endIndex);

    // === 6. AGREGAR TIME TRACKING PARA TASKS REGULARES ===
    const tasksWithTime = await Promise.all(paginatedTasks.map(async (task) => {
      if (task.type === 'task') {
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
          ...task,
          spentHours: Math.round((timeTracking[0]?.totalMinutes || 0) / 60 * 100) / 100
        };
      }
      
      return task; // BacklogItems ya tienen spentHours: 0
    }));

    res.json({
      success: true,
      data: {
        tasks: tasksWithTime,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        },
        summary: {
          totalTasks: tasks.length,
          totalBacklogItems: backlogItems.length,
          totalCombined: total
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
    const { taskId, date, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    const filters = {};
    if (taskId) filters.taskId = taskId;
    if (date) filters.date = date;
    if (startDate && endDate) {
      filters.startDate = startDate;
      filters.endDate = endDate;
    }
    
    // Calcular paginación
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    const entries = await developersService.getTimeEntries(userId, filters, { skip, limit: limitNum });
    const total = await developersService.countTimeEntries(userId, filters);
    
    res.json({
      success: true,
      data: entries || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
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
    
    const errorMsg = error.message.toLowerCase();
    
    // Diferenciar entre error de no encontrado y otros errores
    if (errorMsg.includes('no encontrada')) {
      return res.status(404).json({ 
        success: false,
        error: error.message 
      });
    }
    
    // Diferenciar error de permisos
    if (errorMsg.includes('no tienes permisos') || errorMsg.includes('timer activo')) {
      return res.status(403).json({ 
        success: false,
        error: error.message 
      });
    }
    
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
    
    const errorMsg = error.message.toLowerCase();
    
    // Diferenciar entre error de no encontrado y otros errores
    if (errorMsg.includes('no encontrada')) {
      return res.status(404).json({ 
        success: false,
        error: error.message 
      });
    }
    
    // Diferenciar error de permisos
    if (errorMsg.includes('no tienes permisos')) {
      return res.status(403).json({ 
        success: false,
        error: error.message 
      });
    }
    
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
    
    // Diferenciar entre error de no encontrado y otros errores
    if (error.message.includes('no encontrada') || error.message.includes('no tienes permisos')) {
      return res.status(404).json({ 
        success: false,
        error: error.message 
      });
    }
    
    // Error si ya hay un timer activo
    if (error.message.includes('timer activo')) {
      return res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
    
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
    const { description = '' } = req.body || {};
    
    const timer = await developersService.stopTimer(userId, description);
    
    res.json({
      success: true,
      data: timer,
      message: 'Timer detenido correctamente'
    });
  } catch (error) {
    console.error('Error al detener timer:', error);
    
    // Diferenciar entre error de no encontrado y otros errores
    if (error.message.includes('No hay un timer activo')) {
      return res.status(404).json({ 
        success: false,
        error: error.message 
      });
    }
    
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

// GET /api/developers/bug-reports/:id - Obtener un bug report específico
router.get('/bug-reports/:id', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const { id } = req.params;
    
    const bugReport = await BugReport.findById(id)
      .populate('reportedBy', 'firstName lastName email role')
      .populate('assignedTo', 'firstName lastName email role')
      .populate('project', 'nombre')
      .populate('sprint', 'nombre startDate endDate')
      .populate('relatedTasks', 'titulo title status priority')
      .lean();

    if (!bugReport) {
      return res.status(404).json({
        success: false,
        error: 'Bug report no encontrado'
      });
    }

    res.json({
      success: true,
      data: bugReport
    });
  } catch (error) {
    console.error('Error al obtener bug report:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// PUT /api/developers/bug-reports/:id - Actualizar bug report
router.put('/bug-reports/:id', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user.id;

    const bugReport = await BugReport.findById(id);

    if (!bugReport) {
      return res.status(404).json({
        success: false,
        error: 'Bug report no encontrado'
      });
    }

    // Verificar permisos: solo el reportedBy, asignado o admin puede actualizar
    const canUpdate = bugReport.reportedBy.toString() === userId.toString() ||
                      (bugReport.assignedTo && bugReport.assignedTo.toString() === userId.toString()) ||
                      ['scrum_master', 'super_admin'].includes(req.user.role);

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para actualizar este bug report'
      });
    }

    // Campos que se pueden actualizar
    const allowedFields = ['title', 'description', 'severity', 'priority', 'type', 
                           'environment', 'stepsToReproduce', 'expectedBehavior', 
                           'actualBehavior', 'tags'];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        bugReport[field] = updateData[field];
      }
    });

    await bugReport.save();

    res.json({
      success: true,
      data: bugReport,
      message: 'Bug report actualizado correctamente'
    });
  } catch (error) {
    console.error('Error al actualizar bug report:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// PATCH /api/developers/bug-reports/:id/status - Cambiar estado del bug
router.patch('/bug-reports/:id/status', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution, comment } = req.body;
    const userId = req.user.id;

    const bugReport = await BugReport.findById(id);

    if (!bugReport) {
      return res.status(404).json({
        success: false,
        error: 'Bug report no encontrado'
      });
    }

    const oldStatus = bugReport.status;
    bugReport.status = status;

    // Si se marca como resuelto o cerrado, guardar resolución
    if (['resolved', 'closed'].includes(status) && resolution) {
      bugReport.resolution = resolution;
      bugReport.resolvedAt = new Date();
      bugReport.resolvedBy = userId;
    }

    await bugReport.save();

    // Crear comentario del sistema sobre el cambio de estado
    if (comment || oldStatus !== status) {
      const statusComment = new Comment({
        resourceType: 'BugReport',
        resourceId: id,
        author: userId,
        content: comment || `Estado cambiado de ${oldStatus} a ${status}`,
        type: 'status_change',
        metadata: {
          oldStatus,
          newStatus: status,
          resolution
        }
      });
      await statusComment.save();
    }

    res.json({
      success: true,
      data: bugReport,
      message: `Estado actualizado a ${status}`
    });
  } catch (error) {
    console.error('Error al cambiar estado de bug:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// PATCH /api/developers/bug-reports/:id/assign - Asignar bug a un desarrollador
router.patch('/bug-reports/:id/assign', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;
    const userId = req.user.id;

    const bugReport = await BugReport.findById(id);

    if (!bugReport) {
      return res.status(404).json({
        success: false,
        error: 'Bug report no encontrado'
      });
    }

    // Verificar permisos: solo scrum master o admin
    if (!['scrum_master', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Solo Scrum Master o Admin pueden asignar bugs'
      });
    }

    const oldAssignee = bugReport.assignedTo;
    bugReport.assignedTo = assignedTo;
    await bugReport.save();

    // Crear comentario del sistema
    const assignComment = new Comment({
      resourceType: 'BugReport',
      resourceId: id,
      author: userId,
      content: `Bug asignado a nuevo desarrollador`,
      type: 'system',
      metadata: {
        action: 'assign',
        oldAssignee,
        newAssignee: assignedTo
      }
    });
    await assignComment.save();

    res.json({
      success: true,
      data: bugReport,
      message: 'Bug asignado correctamente'
    });
  } catch (error) {
    console.error('Error al asignar bug:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// POST /api/developers/bug-reports/:id/attachments - Subir archivos adjuntos
router.post('/bug-reports/:id/attachments', 
  authenticate, 
  requireDeveloperRole, 
  upload.array('attachments', 5), // Máximo 5 archivos
  async (req, res) => {
    try {
      const { id } = req.params;

      const bugReport = await BugReport.findById(id);

      if (!bugReport) {
        // Eliminar archivos subidos si el bug no existe
        req.files?.forEach(file => {
          fs.unlinkSync(file.path);
        });

        return res.status(404).json({
          success: false,
          error: 'Bug report no encontrado'
        });
      }

      // Agregar información de los archivos subidos
      // Procesar archivos subidos a Cloudinary
      const attachments = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: file.path, // URL de Cloudinary
        publicId: file.filename, // Public ID de Cloudinary
        cloudinaryData: {
          publicId: file.filename,
          url: file.path,
          secureUrl: file.path,
          format: file.originalname.split('.').pop(),
          resourceType: file.mimetype.startsWith('image/') ? 'image' : 'raw'
        },
        uploadedAt: new Date()
      }));

      bugReport.attachments.push(...attachments);
      await bugReport.save();

      res.json({
        success: true,
        data: {
          bugReport,
          uploadedFiles: attachments.length
        },
        message: `${attachments.length} archivo(s) subido(s) correctamente`
      });
    } catch (error) {
      console.error('Error al subir archivos:', error);
      
      // Limpiar archivos de Cloudinary si hay error
      if (req.files && req.files.length > 0) {
        const publicIds = req.files.map(f => f.filename);
        uploadService.deleteMultipleFiles(publicIds, 'raw').catch(err => 
          console.error('Error limpiando archivos de Cloudinary:', err)
        );
      }

      res.status(500).json({
        success: false,
        error: 'Error al subir archivos',
        message: error.message
      });
    }
});

// DELETE /api/developers/bug-reports/:id - Eliminar bug report (soft delete)
router.delete('/bug-reports/:id', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const bugReport = await BugReport.findById(id);

    if (!bugReport) {
      return res.status(404).json({
        success: false,
        error: 'Bug report no encontrado'
      });
    }

    // Solo el reporter o admin puede eliminar
    const canDelete = bugReport.reportedBy.toString() === userId.toString() ||
                      ['scrum_master', 'super_admin'].includes(req.user.role);

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para eliminar este bug report'
      });
    }

    // Soft delete
    bugReport.status = 'closed';
    bugReport.resolution = 'wont_fix';
    bugReport.resolvedAt = new Date();
    bugReport.resolvedBy = userId;
    await bugReport.save();

    res.json({
      success: true,
      message: 'Bug report eliminado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar bug report:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// GET /api/developers/bug-reports/:id/comments - Obtener comentarios de un bug
router.get('/bug-reports/:id/comments', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const result = await Comment.getCommentThread('BugReport', id, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: result.comments,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error al obtener comentarios:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// POST /api/developers/bug-reports/:id/comments - Agregar comentario
router.post('/bug-reports/:id/comments', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, parentComment } = req.body;
    const userId = req.user.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'El contenido del comentario es requerido'
      });
    }

    // Verificar que el bug existe
    const bugReport = await BugReport.findById(id);
    if (!bugReport) {
      return res.status(404).json({
        success: false,
        error: 'Bug report no encontrado'
      });
    }

    const comment = new Comment({
      resourceType: 'BugReport',
      resourceId: id,
      author: userId,
      content: content.trim(),
      type: 'comment',
      parentComment: parentComment || null
    });

    await comment.save();
    await comment.populate('author', 'name email avatar role');

    res.status(201).json({
      success: true,
      data: comment,
      message: 'Comentario agregado correctamente'
    });
  } catch (error) {
    console.error('Error al crear comentario:', error);
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

    // Primero intentar buscar como Task regular
    let task = await Task.findById(id);
    let isBacklogItem = false;

    if (!task) {
      // Si no es una Task, verificar si es un BacklogItem
      console.log('🔍 Task no encontrada, buscando como BacklogItem...');
      
      const BacklogItem = require('../models/BacklogItem');
      const backlogItem = await BacklogItem.findById(id);
      
      if (!backlogItem) {
        return res.status(404).json({
          success: false,
          message: 'Tarea no encontrada'
        });
      }

      // Verificar que el usuario es el asignado al BacklogItem
      if (backlogItem.asignado_a.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para actualizar esta tarea'
        });
      }

      console.log('✅ BacklogItem encontrado:', {
        id: backlogItem._id,
        titulo: backlogItem.titulo,
        estadoActual: backlogItem.estado,
        nuevoEstado: status
      });

      // Mapear estado de Task a estado de BacklogItem
      let backlogStatus = 'pendiente'; // default
      switch(status) {
        case 'todo':
          backlogStatus = 'pendiente';
          break;
        case 'in_progress':
          backlogStatus = 'en_progreso';
          break;
        case 'code_review':
          backlogStatus = 'revision';
          break;
        case 'testing':
          backlogStatus = 'pruebas';
          break;
        case 'done':
          backlogStatus = 'completado';
          break;
        default:
          backlogStatus = 'pendiente';
      }

      // Actualizar el BacklogItem
      const updatedBacklogItem = await BacklogItem.findByIdAndUpdate(
        id,
        { 
          estado: backlogStatus,
          updated_by: userId,
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      ).populate([
        { path: 'asignado_a', select: 'firstName lastName email' },
        { path: 'sprint', select: 'nombre estado fecha_inicio fecha_fin' },
        { path: 'historia_padre', select: 'titulo' }
      ]);

      console.log('✅ BacklogItem actualizado exitosamente');

      return res.json({
        success: true,
        message: 'Estado actualizado exitosamente',
        data: {
          backlogItem: updatedBacklogItem,
          type: 'technical'
        }
      });
    }

    // Si llegamos aquí, es una Task regular
    console.log('✅ Task regular encontrada');

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

    console.log('✅ Task regular actualizada exitosamente');

    res.json({
      success: true,
      message: 'Estado actualizado exitosamente',
      data: {
        task: updatedTask,
        type: 'regular'
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

// DELETE /api/developers/tasks/:id/unassign - Des-asignar una tarea (devolverla al backlog)
router.delete('/tasks/:id/unassign', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;

    console.log('=== DEVELOPER UNASSIGNING TASK ===');
    console.log('Task ID:', id);
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
        message: 'No tienes permisos para des-asignar esta tarea'
      });
    }

    // Si tiene backlogItem, des-asignar también del backlog
    if (task.backlogItem) {
      const BacklogItem = require('../models/BacklogItem');
      await BacklogItem.findByIdAndUpdate(
        task.backlogItem,
        { 
          $unset: { asignado_a: 1 }, // Remover asignación
          estado: 'pendiente', // Volver a pendiente
          updated_by: userId
        }
      );
      console.log('✅ BacklogItem des-asignado');
    }

    // Eliminar la task (ya que fue auto-creada al asignarse)
    await Task.findByIdAndDelete(id);
    console.log('✅ Task eliminada');

    // Detener timer si está activo
    const activeTimer = await TimeTracking.findOne({
      user: userId,
      endTime: null
    });

    if (activeTimer && activeTimer.task.toString() === id) {
      activeTimer.endTime = new Date();
      activeTimer.duration = Math.floor((activeTimer.endTime - activeTimer.startTime) / 1000 / 60);
      activeTimer.description = 'Tarea des-asignada';
      await activeTimer.save();
      console.log('✅ Timer activo detenido');
    }

    res.json({
      success: true,
      message: 'Tarea des-asignada exitosamente. Ahora está disponible nuevamente.'
    });

  } catch (error) {
    console.error('Error al des-asignar tarea:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

module.exports = router;
