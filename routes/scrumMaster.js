const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authenticate, authorize } = require('../middleware/authenticate');
const Sprint = require('../models/Sprint');
const BacklogItem = require('../models/BacklogItem');
const TeamMember = require('../models/TeamMember');
const Product = require('../models/Product');
const BugReport = require('../models/BugReport');
const Comment = require('../models/Comment');
const logger = require('../config/logger');

// Middleware para verificar rol de Scrum Master
const requireScrumMaster = authorize('scrum_master', 'super_admin');

/**
 * ============================================================================
 * ENDPOINT CONSOLIDADO PARA DASHBOARD DE SCRUM MASTER
 * ============================================================================
 * 
 * Este endpoint optimizado devuelve TODOS los datos necesarios para el 
 * dashboard del Scrum Master en una sola petición HTTP.
 * 
 * Reduce de 5-8 consultas separadas a solo 1 consulta consolidada.
 * 
 * GET /api/scrum-master/dashboard
 * 
 * Retorna:
 * - Sprints (últimos 10, ordenados por fecha)
 * - Sprint activo (si existe)
 * - Items del backlog (historias pendientes/en progreso)
 * - Items técnicos (tareas, bugs, mejoras)
 * - Miembros del equipo con workload
 * - Productos
 * - Métricas calculadas
 * ============================================================================
 */
router.get('/dashboard', authenticate, requireScrumMaster, async (req, res) => {
  const startTime = Date.now();
  
  try {
    logger.info('Scrum Master Dashboard - Iniciando carga consolidada', {
      context: 'ScrumMasterDashboard',
      userId: req.user.id,
      userRole: req.user.role
    });

    // ========================================================================
    // PASO 1: CONSULTAS PARALELAS OPTIMIZADAS
    // ========================================================================
    // Todas las consultas se ejecutan en paralelo para máxima velocidad
    
    const [
      sprints,
      backlogItems,
      technicalItems,
      teamMembers,
      products
    ] = await Promise.all([
      // 1. SPRINTS - Últimos 10 sprints ordenados por fecha
      Sprint.find()
        .populate('producto', 'nombre descripcion')
        .populate('created_by', 'firstName lastName')
        .select('nombre objetivo fecha_inicio fecha_fin estado progreso capacidad_planificada velocidad_esperada velocidad_real')
        .sort({ fecha_inicio: -1 })
        .limit(10)
        .lean(),

      // 2. BACKLOG ITEMS (HISTORIAS) - Solo pendientes y en progreso
      BacklogItem.find({
        tipo: 'historia',
        estado: { $in: ['pendiente', 'en_progreso'] }
      })
        .populate('producto', 'nombre')
        .populate('asignado_a', 'nombre_negocio email firstName lastName')
        .populate('sprint', 'nombre fecha_inicio fecha_fin')
        .select('titulo descripcion puntos_historia prioridad estado tipo producto asignado_a sprint criterios_aceptacion')
        .sort({ prioridad: 1, fecha_creacion: -1 })
        .limit(50)
        .lean(),

      // 3. TECHNICAL ITEMS - Tareas, bugs y mejoras
      BacklogItem.find({
        tipo: { $in: ['tarea', 'bug', 'mejora'] }
      })
        .populate('producto', 'nombre')
        .populate('asignado_a', 'nombre_negocio email firstName lastName')
        .populate('historia_padre', 'titulo')
        .select('titulo descripcion tipo estado prioridad asignado_a producto historia_padre')
        .sort({ prioridad: 1, tipo: 1 })
        .limit(100)
        .lean(),

      // 4. TEAM MEMBERS - Miembros activos con workload
      TeamMember.find({ status: 'active' })
        .populate('user', 'firstName lastName email avatar nombre_negocio')
        .populate('currentSprint', 'nombre fecha_inicio fecha_fin')
        .select('user role skills availability workload status currentSprint')
        .sort({ role: 1 })
        .lean(),

      // 5. PRODUCTS - Productos del sistema
      Product.find()
        .select('nombre descripcion estado')
        .sort({ nombre: 1 })
        .lean()
    ]);

    logger.info('Consultas paralelas completadas', {
      context: 'ScrumMasterDashboard',
      sprints: sprints.length,
      backlogItems: backlogItems.length,
      technicalItems: technicalItems.length,
      teamMembers: teamMembers.length,
      products: products.length,
      duration: Date.now() - startTime
    });

    // ========================================================================
    // PASO 2: IDENTIFICAR SPRINT ACTIVO
    // ========================================================================
    
    const activeSprint = sprints.find(s => s.estado === 'activo') || null;
    let activeSprintItems = [];
    let activeSprintTechnicalItems = [];

    // Si hay sprint activo, obtener sus items específicos
    if (activeSprint) {
      const sprintId = activeSprint._id;

      // Consulta adicional solo si hay sprint activo
      [activeSprintItems, activeSprintTechnicalItems] = await Promise.all([
        BacklogItem.find({
          sprint: sprintId,
          tipo: 'historia'
        })
          .populate('asignado_a', 'nombre_negocio email firstName lastName')
          .select('titulo puntos_historia estado tipo asignado_a')
          .lean(),

        BacklogItem.find({
          sprint: sprintId,
          tipo: { $in: ['tarea', 'bug', 'mejora'] }
        })
          .populate('asignado_a', 'nombre_negocio email firstName lastName')
          .select('titulo tipo estado prioridad asignado_a')
          .lean()
      ]);

      logger.info('Items del sprint activo cargados', {
        context: 'ScrumMasterDashboard',
        sprintId: sprintId.toString(),
        historias: activeSprintItems.length,
        technicalItems: activeSprintTechnicalItems.length
      });
    }

    // ========================================================================
    // PASO 3: CALCULAR MÉTRICAS EN EL SERVIDOR
    // ========================================================================
    
    const metrics = calculateMetrics({
      sprints,
      activeSprint,
      activeSprintItems,
      backlogItems,
      technicalItems: activeSprintTechnicalItems.length > 0 ? activeSprintTechnicalItems : technicalItems,
      teamMembers
    });

    // ========================================================================
    // PASO 4: ENRIQUECER DATOS DE TEAM MEMBERS
    // ========================================================================
    
    const enrichedTeamMembers = enrichTeamMembersData(teamMembers, activeSprintItems);

    // ========================================================================
    // PASO 5: CONSTRUIR RESPUESTA
    // ========================================================================
    
    const dashboardData = {
      sprints,
      activeSprint,
      activeSprintItems,
      backlogItems,
      technicalItems,
      teamMembers: enrichedTeamMembers,
      products,
      metrics,
      timestamp: Date.now()
    };

    const duration = Date.now() - startTime;

    logger.info('Dashboard Scrum Master cargado exitosamente', {
      context: 'ScrumMasterDashboard',
      duration,
      userId: req.user.id,
      dataSize: {
        sprints: sprints.length,
        backlogItems: backlogItems.length,
        technicalItems: technicalItems.length,
        teamMembers: enrichedTeamMembers.length,
        products: products.length
      }
    });

    res.json(dashboardData);

  } catch (error) {
    logger.error('Error al cargar dashboard Scrum Master', {
      context: 'ScrumMasterDashboard',
      error: error.message,
      stack: error.stack,
      userId: req.user.id
    });

    res.status(500).json({
      error: 'Error al cargar datos del dashboard',
      message: error.message
    });
  }
});

/**
 * ============================================================================
 * FUNCIÓN: CALCULAR MÉTRICAS
 * ============================================================================
 * Calcula todas las métricas necesarias para el dashboard en el servidor
 * para reducir procesamiento en el cliente.
 */
function calculateMetrics({ sprints, activeSprint, activeSprintItems, backlogItems, technicalItems, teamMembers }) {
  // Métricas del sprint activo
  const totalStoryPoints = activeSprintItems.reduce((sum, item) => 
    sum + (item.puntos_historia || 0), 0
  );
  
  const completedStoryPoints = activeSprintItems
    .filter(item => item.estado === 'completado')
    .reduce((sum, item) => sum + (item.puntos_historia || 0), 0);

  const inProgressStoryPoints = activeSprintItems
    .filter(item => item.estado === 'en_progreso')
    .reduce((sum, item) => sum + (item.puntos_historia || 0), 0);

  // Métricas de items técnicos
  const pendingTasks = technicalItems.filter(item => 
    item.tipo === 'tarea' && item.estado !== 'completado'
  ).length;

  const criticalBugs = technicalItems.filter(item => 
    item.tipo === 'bug' && ['muy_alta', 'alta'].includes(item.prioridad)
  ).length;

  const completedTasks = technicalItems.filter(item => 
    item.estado === 'completado'
  ).length;

  // Métricas del equipo
  const activeTeamMembers = teamMembers.filter(m => m.status === 'active').length;
  
  const teamCapacity = teamMembers.reduce((sum, member) => 
    sum + (member.workload?.maxStoryPoints || 24), 0
  );

  const teamCurrentLoad = teamMembers.reduce((sum, member) => 
    sum + (member.workload?.currentStoryPoints || 0), 0
  );

  // Velocidad del equipo (basada en sprints recientes)
  const recentSprints = sprints.filter(s => s.estado === 'completado').slice(0, 3);
  const averageVelocity = recentSprints.length > 0
    ? Math.round(recentSprints.reduce((sum, s) => sum + (s.velocidad_real || 0), 0) / recentSprints.length)
    : 0;

  // Progreso del sprint activo
  const sprintProgress = activeSprint && totalStoryPoints > 0
    ? Math.round((completedStoryPoints / totalStoryPoints) * 100)
    : 0;

  // Días restantes del sprint
  let daysRemaining = 0;
  if (activeSprint && activeSprint.fecha_fin) {
    const today = new Date();
    const endDate = new Date(activeSprint.fecha_fin);
    daysRemaining = Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)));
  }

  return {
    // Métricas del sprint
    totalStoryPoints,
    completedStoryPoints,
    inProgressStoryPoints,
    pendingStoryPoints: totalStoryPoints - completedStoryPoints - inProgressStoryPoints,
    sprintProgress,
    daysRemaining,
    
    // Métricas de items
    totalBacklogItems: backlogItems.length,
    totalTechnicalItems: technicalItems.length,
    pendingTasks,
    criticalBugs,
    completedTasks,
    
    // Métricas del equipo
    activeTeamMembers,
    teamCapacity,
    teamCurrentLoad,
    teamLoadPercentage: teamCapacity > 0 ? Math.round((teamCurrentLoad / teamCapacity) * 100) : 0,
    averageVelocity,
    
    // Alertas
    alerts: {
      overCapacity: teamCurrentLoad > teamCapacity,
      criticalBugs: criticalBugs > 0,
      sprintBehindSchedule: activeSprint && sprintProgress < 50 && daysRemaining < 7
    }
  };
}

/**
 * ============================================================================
 * FUNCIÓN: ENRIQUECER DATOS DE TEAM MEMBERS
 * ============================================================================
 * Agrega información adicional a los miembros del equipo basada en sus
 * asignaciones actuales en el sprint activo.
 */
function enrichTeamMembersData(teamMembers, activeSprintItems) {
  return teamMembers.map(member => {
    const memberId = member.user?._id?.toString() || member.user?.toString();
    
    // Encontrar items asignados a este miembro en el sprint activo
    const assignedItems = activeSprintItems.filter(item => {
      const assignedId = item.asignado_a?._id?.toString() || item.asignado_a?.toString();
      return assignedId === memberId;
    });

    // Calcular métricas del miembro
    const assignedStoryPoints = assignedItems.reduce((sum, item) => 
      sum + (item.puntos_historia || 0), 0
    );

    const completedItems = assignedItems.filter(item => 
      item.estado === 'completado'
    );

    const completedStoryPoints = completedItems.reduce((sum, item) => 
      sum + (item.puntos_historia || 0), 0
    );

    const inProgressItems = assignedItems.filter(item => 
      item.estado === 'en_progreso'
    ).length;

    // Calcular carga de trabajo
    const maxCapacity = member.workload?.maxStoryPoints || 24;
    const workloadPercentage = maxCapacity > 0 
      ? Math.round((assignedStoryPoints / maxCapacity) * 100) 
      : 0;

    return {
      ...member,
      sprintAssignment: {
        totalItems: assignedItems.length,
        completedItems: completedItems.length,
        inProgressItems,
        assignedStoryPoints,
        completedStoryPoints,
        workloadPercentage
      }
    };
  });
}

/**
 * ============================================================================
 * ENDPOINT: INVALIDAR CACHÉ
 * ============================================================================
 * Endpoint para invalidar el caché del dashboard cuando se hacen cambios.
 * El frontend puede llamar a este endpoint después de crear/editar/eliminar
 * sprints, items, etc.
 */
router.post('/dashboard/invalidate', authenticate, requireScrumMaster, async (req, res) => {
  try {
    logger.info('Cache invalidation solicitada', {
      context: 'ScrumMasterDashboard',
      userId: req.user.id
    });

    // Por ahora solo enviamos un mensaje de éxito
    // El caché real se maneja en el frontend con DataContext
    res.json({ 
      success: true, 
      message: 'Cache invalidado correctamente',
      timestamp: Date.now()
    });
  } catch (error) {
    logger.error('Error al invalidar caché', {
      context: 'ScrumMasterDashboard',
      error: error.message
    });
    
    res.status(500).json({
      error: 'Error al invalidar caché',
      message: error.message
    });
  }
});

/**
 * ============================================================================
 * ENDPOINT: MÉTRICAS DEL SPRINT ESPECÍFICO
 * ============================================================================
 * Obtiene métricas detalladas de un sprint específico.
 * Útil para vista de detalles de sprint.
 */
router.get('/sprint/:sprintId/metrics', authenticate, requireScrumMaster, async (req, res) => {
  try {
    const { sprintId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sprintId)) {
      return res.status(400).json({ error: 'ID de sprint inválido' });
    }

    const [sprint, sprintItems, technicalItems] = await Promise.all([
      Sprint.findById(sprintId)
        .populate('producto', 'nombre')
        .lean(),
      
      BacklogItem.find({ 
        sprint: sprintId,
        tipo: 'historia'
      })
        .populate('asignado_a', 'nombre_negocio firstName lastName')
        .lean(),
      
      BacklogItem.find({
        sprint: sprintId,
        tipo: { $in: ['tarea', 'bug', 'mejora'] }
      }).lean()
    ]);

    if (!sprint) {
      return res.status(404).json({ error: 'Sprint no encontrado' });
    }

    const metrics = calculateMetrics({
      sprints: [sprint],
      activeSprint: sprint,
      activeSprintItems: sprintItems,
      backlogItems: sprintItems,
      technicalItems,
      teamMembers: []
    });

    res.json({
      sprint,
      items: sprintItems,
      technicalItems,
      metrics
    });

  } catch (error) {
    logger.error('Error al obtener métricas del sprint', {
      context: 'ScrumMasterDashboard',
      sprintId: req.params.sprintId,
      error: error.message
    });
    
    res.status(500).json({
      error: 'Error al obtener métricas del sprint',
      message: error.message
    });
  }
});

/**
 * ============================================================================
 * ENDPOINT PARA GESTIÓN DE BUG REPORTS - SCRUM MASTER
 * ============================================================================
 * 
 * Este endpoint permite al Scrum Master visualizar todos los bug reports
 * del proyecto/equipo para poder tener visibilidad completa.
 * 
 * GET /api/scrum-master/bugs
 * 
 * Query parameters:
 * - status: filtrar por estado (open, in_progress, resolved, closed, rejected)
 * - priority: filtrar por prioridad (low, medium, high, critical)
 * - severity: filtrar por severidad (minor, major, critical, blocker)
 * - assignedTo: filtrar por usuario asignado
 * - reportedBy: filtrar por quien reportó
 * - project: filtrar por proyecto
 * - page: página (default: 1)
 * - limit: límite por página (default: 20)
 * ============================================================================
 */
router.get('/bugs', authenticate, requireScrumMaster, async (req, res) => {
  const startTime = Date.now();
  
  try {
    logger.info('Scrum Master Bug Reports - Iniciando consulta', {
      context: 'ScrumMasterBugs',
      userId: req.user.id,
      userRole: req.user.role,
      query: req.query
    });

    const {
      status,
      priority,
      severity,
      assignedTo,
      reportedBy,
      project,
      search,
      page = 1,
      limit = 20
    } = req.query;

    // Construir filtros
    const filters = {};
    
    if (status && status !== 'all') {
      filters.status = status;
    }
    
    if (priority && priority !== 'all') {
      filters.priority = priority;
    }
    
    if (severity && severity !== 'all') {
      filters.severity = severity;
    }
    
    if (assignedTo && assignedTo !== 'all') {
      filters.assignedTo = assignedTo;
    }
    
    if (reportedBy && reportedBy !== 'all') {
      filters.reportedBy = reportedBy;
    }
    
    if (project && project !== 'all') {
      filters.project = project;
    }

    // Filtro de búsqueda por texto
    if (search) {
      filters.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Paginación
    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNumber - 1) * limitNumber;

    logger.info('Filtros aplicados para bug reports', {
      context: 'ScrumMasterBugs',
      filters,
      pagination: { page: pageNumber, limit: limitNumber, skip }
    });

    // Consulta principal con populate
    const bugsPromise = BugReport.find(filters)
      .populate('reportedBy', 'firstName lastName email role nombre_negocio')
      .populate('assignedTo', 'firstName lastName email role nombre_negocio')
      .populate('project', 'nombre descripcion')
      .populate('sprint', 'nombre fecha_inicio fecha_fin estado')
      .populate('relatedTasks', 'titulo title status priority')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean();

    // Contar total para paginación
    const totalPromise = BugReport.countDocuments(filters);

    // Ejecutar consultas en paralelo
    const [bugs, totalBugs] = await Promise.all([bugsPromise, totalPromise]);

    // Calcular estadísticas rápidas
    const statsPromise = BugReport.aggregate([
      { $match: project ? { project } : {} },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          critical: { $sum: { $cond: [{ $eq: ['$priority', 'critical'] }, 1, 0] } },
          high: { $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] } },
          blockers: { $sum: { $cond: [{ $eq: ['$severity', 'blocker'] }, 1, 0] } }
        }
      }
    ]);

    const [stats] = await statsPromise;

    const finalStats = stats || {
      total: 0,
      open: 0,
      inProgress: 0,
      resolved: 0,
      critical: 0,
      high: 0,
      blockers: 0
    };

    // Calcular información de paginación
    const totalPages = Math.ceil(totalBugs / limitNumber);
    const hasNextPage = pageNumber < totalPages;
    const hasPreviousPage = pageNumber > 1;

    const queryTime = Date.now() - startTime;

    logger.info('Bug reports obtenidos exitosamente', {
      context: 'ScrumMasterBugs',
      count: bugs.length,
      totalBugs,
      queryTime: `${queryTime}ms`,
      stats: finalStats
    });

    res.json({
      success: true,
      data: {
        bugs,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalBugs,
          limit: limitNumber,
          hasNextPage,
          hasPreviousPage
        },
        stats: finalStats
      },
      meta: {
        queryTime: `${queryTime}ms`,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    const queryTime = Date.now() - startTime;
    
    logger.error('Error al obtener bug reports para Scrum Master', {
      context: 'ScrumMasterBugs',
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      queryTime: `${queryTime}ms`
    });

    res.status(500).json({
      success: false,
      error: 'Error interno del servidor al obtener bug reports',
      message: error.message,
      meta: {
        queryTime: `${queryTime}ms`,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * ============================================================================
 * ENDPOINT PARA OBTENER DETALLE DE BUG REPORT - SCRUM MASTER
 * ============================================================================
 * 
 * GET /api/scrum-master/bugs/:id
 * 
 * Permite al Scrum Master obtener el detalle completo de un bug report
 * ============================================================================
 */
router.get('/bugs/:id', authenticate, requireScrumMaster, async (req, res) => {
  try {
    const { id } = req.params;
    
    const bugReport = await BugReport.findById(id)
      .populate('reportedBy', 'firstName lastName email role nombre_negocio')
      .populate('assignedTo', 'firstName lastName email role nombre_negocio')
      .populate('project', 'nombre descripcion')
      .populate('sprint', 'nombre fecha_inicio fecha_fin estado')
      .populate('relatedTasks', 'titulo title status priority')
      .lean();

    if (!bugReport) {
      return res.status(404).json({
        success: false,
        error: 'Bug report no encontrado'
      });
    }

    logger.info('Bug report obtenido por Scrum Master', {
      context: 'ScrumMasterBugs',
      bugId: id,
      userId: req.user.id
    });

    res.json({
      success: true,
      data: bugReport
    });
  } catch (error) {
    logger.error('Error al obtener bug report para Scrum Master', {
      context: 'ScrumMasterBugs',
      error: error.message,
      bugId: req.params.id,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * ============================================================================
 * ENDPOINT PARA OBTENER COMENTARIOS DE BUG REPORT - SCRUM MASTER
 * ============================================================================
 * 
 * GET /api/scrum-master/bugs/:id/comments
 * 
 * Permite al Scrum Master ver todos los comentarios de un bug report
 * ============================================================================
 */
router.get('/bugs/:id/comments', authenticate, requireScrumMaster, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await Comment.getCommentThread('BugReport', id, {
      populate: [
        { path: 'author', select: 'firstName lastName email role nombre_negocio' },
        { path: 'replies.author', select: 'firstName lastName email role nombre_negocio' }
      ]
    });

    res.json({
      success: true,
      data: result.comments,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Error al obtener comentarios de bug report', {
      context: 'ScrumMasterBugs',
      error: error.message,
      bugId: req.params.id,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Error al obtener comentarios',
      message: error.message
    });
  }
});

/**
 * ============================================================================
 * ENDPOINT PARA AGREGAR COMENTARIOS A BUG REPORT - SCRUM MASTER
 * ============================================================================
 * 
 * POST /api/scrum-master/bugs/:id/comments
 * 
 * Permite al Scrum Master agregar comentarios a un bug report
 * ============================================================================
 */
router.post('/bugs/:id/comments', authenticate, requireScrumMaster, async (req, res) => {
  try {
    const { id } = req.params;
    const { text, content, parentComment } = req.body;
    
    // Usar text o content (compatibilidad)
    const commentContent = text || content;

    if (!commentContent || !commentContent.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El contenido del comentario es requerido'
      });
    }

    // Verificar que el bug report existe
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
      author: req.user.id,
      content: commentContent.trim(),
      parentComment: parentComment || null,
      metadata: {
        userRole: 'scrum_master',
        source: 'scrum_master_dashboard'
      }
    });

    await comment.save();
    
    // Populate para la respuesta
    await comment.populate('author', 'firstName lastName email role nombre_negocio');

    logger.info('Comentario agregado por Scrum Master', {
      context: 'ScrumMasterBugs',
      bugId: id,
      commentId: comment._id,
      userId: req.user.id
    });

    res.status(201).json({
      success: true,
      data: comment,
      message: 'Comentario agregado correctamente'
    });
  } catch (error) {
    logger.error('Error al agregar comentario como Scrum Master', {
      context: 'ScrumMasterBugs',
      error: error.message,
      bugId: req.params.id,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Error al agregar comentario',
      message: error.message
    });
  }
});

module.exports = router;
