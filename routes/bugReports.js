const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const BugReport = require('../models/BugReport');
const multer = require('multer');
const path = require('path');

// Configuración de multer para archivos adjuntos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/bug-reports/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB límite
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|txt|log|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  }
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

// GET /api/developers/bugs - Obtener bug reports
router.get('/', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const { 
      status, 
      priority, 
      type, 
      assignedToMe, 
      reportedByMe, 
      page = 1, 
      limit = 20,
      search
    } = req.query;

    const userId = req.user.id;
    
    // Construir filtros
    const filters = {};
    if (status && status !== 'all') filters.status = status;
    if (priority) filters.priority = priority;
    if (type) filters.type = type;
    if (assignedToMe === 'true') filters.assignedTo = userId;
    if (reportedByMe === 'true') filters.reportedBy = userId;
    
    if (search) {
      filters.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const bugs = await BugReport.find(filters)
      .populate('reportedBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .populate('project', 'nombre')
      .populate('sprint', 'nombre')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await BugReport.countDocuments(filters);

    // Estadísticas rápidas
    const stats = await BugReport.aggregate([
      { $match: filters },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        bugs,
        stats,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Error al obtener bug reports:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/developers/bugs/:id - Obtener bug report específico
router.get('/:id', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const { id } = req.params;

    const bug = await BugReport.findById(id)
      .populate('reportedBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .populate('project', 'nombre')
      .populate('sprint', 'nombre')
      .populate('comments.author', 'firstName lastName email')
      .populate('relatedTasks', 'title status priority');

    if (!bug) {
      return res.status(404).json({ error: 'Bug report no encontrado' });
    }

    res.json({
      success: true,
      data: bug
    });

  } catch (error) {
    console.error('Error al obtener bug report:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID de bug report inválido' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/developers/bugs - Crear nuevo bug report
router.post('/', authenticate, requireDeveloperRole, upload.array('attachments', 5), async (req, res) => {
  try {
    const {
      title,
      description,
      type = 'bug',
      priority = 'medium',
      severity = 'major',
      stepsToReproduce,
      expectedBehavior,
      actualBehavior,
      environment,
      project,
      sprint,
      tags
    } = req.body;

    // Validaciones básicas
    if (!title || !description || !actualBehavior) {
      return res.status(400).json({ 
        error: 'Los campos título, descripción y comportamiento actual son obligatorios' 
      });
    }

    // Procesar archivos adjuntos
    const attachments = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        attachments.push({
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          path: file.path
        });
      });
    }

    // Procesar environment si viene como string JSON
    let parsedEnvironment = {};
    if (environment) {
      try {
        parsedEnvironment = typeof environment === 'string' 
          ? JSON.parse(environment) 
          : environment;
      } catch (e) {
        parsedEnvironment = { description: environment };
      }
    }

    const bugReportData = {
      title,
      description,
      type,
      priority,
      severity,
      stepsToReproduce,
      expectedBehavior,
      actualBehavior,
      environment: parsedEnvironment,
      reportedBy: req.user.id,
      attachments
    };

    if (project) bugReportData.project = project;
    if (sprint) bugReportData.sprint = sprint;
    if (tags) {
      bugReportData.tags = typeof tags === 'string' 
        ? tags.split(',').map(tag => tag.trim())
        : tags;
    }

    const newBugReport = new BugReport(bugReportData);
    await newBugReport.save();

    // Populate para la respuesta
    await newBugReport.populate('reportedBy', 'firstName lastName email');
    if (newBugReport.project) {
      await newBugReport.populate('project', 'nombre');
    }

    res.status(201).json({
      success: true,
      message: 'Bug report creado exitosamente',
      data: newBugReport
    });

  } catch (error) {
    console.error('Error al crear bug report:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/developers/bugs/:id - Actualizar bug report
router.put('/:id', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updateData = req.body;

    const bug = await BugReport.findById(id);
    if (!bug) {
      return res.status(404).json({ error: 'Bug report no encontrado' });
    }

    // Verificar permisos (solo el reportador, asignado o admin pueden editar)
    const canEdit = bug.reportedBy.toString() === userId.toString() ||
                   (bug.assignedTo && bug.assignedTo.toString() === userId.toString()) ||
                   ['scrum_master', 'super_admin'].includes(req.user.role);

    if (!canEdit) {
      return res.status(403).json({ 
        error: 'No tienes permisos para editar este bug report' 
      });
    }

    // Campos que se pueden actualizar
    const allowedUpdates = [
      'title', 'description', 'priority', 'severity', 'status',
      'stepsToReproduce', 'expectedBehavior', 'actualBehavior',
      'environment', 'assignedTo', 'tags', 'resolution', 'resolutionNote'
    ];

    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        bug[field] = updateData[field];
      }
    });

    await bug.save();
    await bug.populate('reportedBy', 'firstName lastName email');
    await bug.populate('assignedTo', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Bug report actualizado exitosamente',
      data: bug
    });

  } catch (error) {
    console.error('Error al actualizar bug report:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/developers/bugs/:id/comments - Agregar comentario
router.post('/:id/comments', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, isInternal = false } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'El contenido del comentario es requerido' });
    }

    const bug = await BugReport.findById(id);
    if (!bug) {
      return res.status(404).json({ error: 'Bug report no encontrado' });
    }

    const comment = {
      author: req.user.id,
      content: content.trim(),
      isInternal,
      createdAt: new Date()
    };

    bug.comments.push(comment);
    await bug.save();

    // Populate el comentario agregado
    await bug.populate('comments.author', 'firstName lastName email');
    const addedComment = bug.comments[bug.comments.length - 1];

    res.status(201).json({
      success: true,
      message: 'Comentario agregado exitosamente',
      data: addedComment
    });

  } catch (error) {
    console.error('Error al agregar comentario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/developers/bugs/:id/assign - Asignar bug
router.put('/:id/assign', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    // Solo scrum masters y admins pueden asignar bugs
    if (!['scrum_master', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'No tienes permisos para asignar bugs' 
      });
    }

    const bug = await BugReport.findById(id);
    if (!bug) {
      return res.status(404).json({ error: 'Bug report no encontrado' });
    }

    bug.assignedTo = assignedTo || null;
    if (assignedTo && bug.status === 'open') {
      bug.status = 'in_progress';
    }

    await bug.save();
    await bug.populate('assignedTo', 'firstName lastName email');

    res.json({
      success: true,
      message: assignedTo ? 'Bug asignado exitosamente' : 'Asignación removida exitosamente',
      data: bug
    });

  } catch (error) {
    console.error('Error al asignar bug:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/developers/bugs/stats/dashboard - Estadísticas para dashboard
router.get('/stats/dashboard', authenticate, requireDeveloperRole, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));

    // Bugs reportados por el usuario
    const reportedStats = await BugReport.aggregate([
      {
        $match: {
          reportedBy: userId
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Bugs asignados al usuario
    const assignedStats = await BugReport.aggregate([
      {
        $match: {
          assignedTo: userId
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Bugs resueltos esta semana
    const resolvedThisWeek = await BugReport.countDocuments({
      assignedTo: userId,
      status: 'resolved',
      resolvedAt: { $gte: startOfWeek }
    });

    res.json({
      success: true,
      data: {
        reported: reportedStats,
        assigned: assignedStats,
        resolvedThisWeek
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas de bugs:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
