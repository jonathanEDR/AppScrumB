const Task = require('../models/Task');
const TimeTracking = require('../models/TimeTracking');
const BugReport = require('../models/BugReport');
const Sprint = require('../models/Sprint');
const TeamMember = require('../models/TeamMember');
const SprintHelpers = require('../utils/sprintHelpers');
const BacklogItemHelpers = require('../utils/backlogItemHelpers');

class DevelopersService {
  /**
   * Obtiene lista de sprints disponibles para el developer
   */
  async getAvailableSprints() {
    try {
      console.log('🔍 getAvailableSprints - Obteniendo sprints disponibles');
      
      const sprints = await Sprint.find({})
        .select('_id nombre objetivo fecha_inicio fecha_fin estado')
        .sort({ fecha_inicio: -1 });

      console.log('📋 Sprints encontrados:', {
        total: sprints.length,
        sprints: sprints.map(s => ({ 
          id: s._id, 
          nombre: s.nombre, 
          estado: s.estado 
        }))
      });

      return sprints;
    } catch (error) {
      console.error('❌ Error en getAvailableSprints:', error);
      throw new Error(`Error al obtener sprints disponibles: ${error.message}`);
    }
  }

  /**
   * Obtiene las métricas del dashboard para un developer
   * OPTIMIZADO: Usa aggregation pipeline para reducir queries
   */
  async getDashboardMetrics(userId) {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));

      // Query 1: Métricas de tareas con aggregation (antes eran 3 queries)
      const [taskMetrics] = await Task.aggregate([
        {
          $facet: {
            assignedTasks: [
              { $match: { assignee: userId, status: { $ne: 'done' } } },
              { $count: 'count' }
            ],
            completedToday: [
              { $match: { assignee: userId, status: 'done', updatedAt: { $gte: startOfDay } } },
              { $count: 'count' }
            ],
            recentTasks: [
              { $match: { assignee: userId } },
              { $sort: { updatedAt: -1 } },
              { $limit: 5 },
              {
                $lookup: {
                  from: 'sprints',
                  localField: 'sprint',
                  foreignField: '_id',
                  as: 'sprint'
                }
              },
              { $unwind: { path: '$sprint', preserveNullAndEmptyArrays: true } },
              {
                $project: {
                  title: 1,
                  status: 1,
                  priority: 1,
                  storyPoints: 1,
                  updatedAt: 1,
                  'sprint._id': 1,
                  'sprint.name': 1,
                  'sprint.nombre': 1
                }
              }
            ]
          }
        }
      ]);

      // Query 2: Métricas de time tracking y bugs en paralelo
      const [timeTrackingResult, bugsResult] = await Promise.all([
        TimeTracking.aggregate([
          {
            $match: {
              user: userId,
              date: { $gte: startOfWeek },
              endTime: { $ne: null }
            }
          },
          {
            $group: {
              _id: null,
              totalSeconds: { $sum: '$duration' }
            }
          }
        ]),
        BugReport.countDocuments({
          assignedTo: userId,
          status: 'resolved',
          resolvedAt: { $gte: startOfWeek }
        })
      ]);

      // Calcular horas trabajadas (duration está en segundos)
      const totalSeconds = timeTrackingResult[0]?.totalSeconds || 0;
      const hoursWorkedThisWeek = Math.round((totalSeconds / 3600) * 10) / 10;

      return {
        metrics: {
          assignedTasks: taskMetrics.assignedTasks[0]?.count || 0,
          completedToday: taskMetrics.completedToday[0]?.count || 0,
          bugsResolvedThisWeek: bugsResult,
          hoursWorkedThisWeek: hoursWorkedThisWeek
        },
        recentTasks: taskMetrics.recentTasks || []
      };
    } catch (error) {
      throw new Error(`Error al obtener métricas del dashboard: ${error.message}`);
    }
  }

  /**
   * Obtiene las tareas del developer con filtros
   */
  async getDeveloperTasks(userId, filters = {}) {
    try {
      const query = { assignee: userId };
      
      if (filters.status) {
        query.status = filters.status;
      }
      
      if (filters.priority) {
        query.priority = filters.priority;
      }
      
      if (filters.sprint) {
        query.sprint = filters.sprint;
      }

      const tasks = await Task.find(query)
        .populate('sprint', 'name startDate endDate')
        .populate('assignee', 'firstName lastName')
        .sort({ updatedAt: -1 });

      return tasks;
    } catch (error) {
      throw new Error(`Error al obtener tareas del developer: ${error.message}`);
    }
  }

  /**
   * Obtiene todos los sprints disponibles
   */
  async getAvailableSprints() {
    try {
      const sprints = await Sprint.find()
        .select('_id nombre objetivo fecha_inicio fecha_fin estado')
        .sort({ fecha_inicio: -1 });

      // Mapear campos para compatibilidad
      const sprintsData = sprints.map(sprint => ({
        _id: sprint._id,
        name: sprint.nombre,
        goal: sprint.objetivo,
        startDate: sprint.fecha_inicio,
        endDate: sprint.fecha_fin,
        status: sprint.estado
      }));

      return sprintsData;
    } catch (error) {
      throw new Error(`Error al obtener sprints disponibles: ${error.message}`);
    }
  }

  /**
   * Obtiene datos del sprint board para el developer
   */
  async getSprintBoardData(userId, sprintId = null, filterMode = 'all') {
  try {
      // Usar SprintHelpers para obtener el sprint (elimina duplicación)
      const sprint = await SprintHelpers.getSprintByIdOrActive(sprintId);

      if (!sprint) {
        throw new Error('No se encontró un sprint disponible');
      }

      console.log('📋 Sprint encontrado para Sprint Board:', {
        id: sprint._id,
        name: sprint.nombre,
        estado: sprint.estado,
        filterMode
      });

      let developerTasks = [];
      let technicalItems = [];
      
      // Buscar tareas regulares (Task) asignadas al usuario
      if (filterMode === 'sprint' && sprintId) {
        // Mostrar solo tareas del sprint específico
        developerTasks = await Task.find({ 
          assignee: userId,
          sprint: sprintId
        })
        .populate('assignee', 'firstName lastName')
        .populate('sprint', 'nombre estado')
        .sort({ priority: -1, createdAt: -1 });
        
        console.log('📊 Tareas regulares del sprint específico:', {
          sprintId,
          total: developerTasks.length,
          sprintName: sprint.nombre
        });
      } else {
        // Mostrar todas las tareas del usuario (modo por defecto)
        developerTasks = await Task.find({ assignee: userId })
          .populate('assignee', 'firstName lastName')
          .populate('sprint', 'nombre estado')
          .sort({ priority: -1, createdAt: -1 });
          
        console.log('📊 Todas las tareas regulares del usuario:', {
          total: developerTasks.length,
          filterMode: 'all'
        });
      }

      // Buscar items técnicos (BacklogItem) asignados al usuario
      const BacklogItem = require('../models/BacklogItem');
      
      let backlogQuery = { 
        asignado_a: userId,
        tipo: { $in: ['tarea', 'bug', 'mejora'] } // Tipos de items técnicos correctos
      };
      
      // Si es modo sprint, buscar items técnicos de historias del sprint
      if (filterMode === 'sprint' && sprintId) {
        // Buscar tanto por sprint directo como por historias del sprint
        const sprintStories = await BacklogItem.find({ 
          sprint: sprintId, 
          tipo: 'historia' 
        }).select('_id');
        
        const storyIds = sprintStories.map(s => s._id);
        
        backlogQuery.$or = [
          { sprint: sprintId }, // Items técnicos asignados directamente al sprint
          { historia_padre: { $in: storyIds } } // Items técnicos de historias del sprint
        ];
      }
      
      technicalItems = await BacklogItem.find(backlogQuery)
        .populate('asignado_a', 'firstName lastName nombre_negocio email')
        .populate('sprint', 'nombre estado')
        .populate('historia_padre', 'titulo')
        .sort({ prioridad: -1, createdAt: -1 });

      console.log('📊 Items técnicos encontrados:', technicalItems.length);

      // Usar BacklogItemHelpers para convertir (elimina duplicación de lógica)
      const convertedTechnicalItems = BacklogItemHelpers.convertMultipleToTaskFormat(technicalItems);

      // Combinar tareas regulares e items técnicos usando helper
      const allTasks = BacklogItemHelpers.combineTasksAndBacklogItems(developerTasks, technicalItems);
      
      console.log('✅ Total de elementos para el developer:', {
        tareas: developerTasks.length,
        itemsTecnicos: technicalItems.length,
        total: allTasks.length
      });

      // Calcular métricas usando helper
      const metrics = BacklogItemHelpers.calculateSprintMetrics(allTasks);

      // Formatear sprint usando helper
      const sprintData = SprintHelpers.formatSprintForAPI(sprint);

      return {
        sprint: sprintData,
        tasks: allTasks, // Todas las tareas (regulares + items técnicos)
        allTasks: allTasks, // Para compatibilidad
        filterMode, // Incluir el modo de filtro en la respuesta
        metrics: metrics
      };
    } catch (error) {
      console.error('❌ Error en getSprintBoardData:', error);
      throw new Error(`Error al obtener datos del sprint board: ${error.message}`);
    }
  }

  /**
   * Actualiza el estado de una tarea
   */
  async updateTaskStatus(taskId, newStatus, userId) {
    try {
      const task = await Task.findById(taskId);
      
      if (!task) {
        throw new Error('Tarea no encontrada');
      }

      if (task.assignee.toString() !== userId) {
        throw new Error('No tienes permisos para actualizar esta tarea');
      }

      const validStatuses = ['todo', 'in_progress', 'code_review', 'testing', 'done'];
      if (!validStatuses.includes(newStatus)) {
        throw new Error('Estado de tarea inválido');
      }

      task.status = newStatus;
      task.updatedAt = new Date();

      // Si se marca como completada, registrar fecha de finalización
      if (newStatus === 'done' && !task.completedAt) {
        task.completedAt = new Date();
      }

      await task.save();
      return task;
    } catch (error) {
      throw new Error(`Error al actualizar estado de tarea: ${error.message}`);
    }
  }

  /**
   * Obtiene estadísticas de time tracking para el developer
   * OPTIMIZADO FASE 5: Usa aggregation pipeline con $facet (4+ queries → 1 query)
   */
  async getTimeTrackingStats(userId, period = 'week') {
    try {
      const now = new Date();
      
      // Calcular fechas de corte
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      today.setHours(0, 0, 0, 0);
      
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);

      // UNA SOLA QUERY con $facet para todas las métricas
      const [stats] = await TimeTracking.aggregate([
        {
          $match: {
            user: userId
          }
        },
        {
          $facet: {
            // 1. Estadísticas de HOY
            today: [
              { 
                $match: { 
                  date: { $gte: today },
                  endTime: { $ne: null }
                }
              },
              {
                $group: {
                  _id: null,
                  totalSeconds: { $sum: '$duration' },
                  count: { $sum: 1 }
                }
              }
            ],
            
            // 2. Estadísticas de la SEMANA
            week: [
              { 
                $match: { 
                  date: { $gte: weekAgo },
                  endTime: { $ne: null }
                }
              },
              {
                $group: {
                  _id: null,
                  totalSeconds: { $sum: '$duration' },
                  count: { $sum: 1 }
                }
              }
            ],
            
            // 3. Estadísticas del MES
            month: [
              { 
                $match: { 
                  date: { $gte: monthAgo },
                  endTime: { $ne: null }
                }
              },
              {
                $group: {
                  _id: null,
                  totalSeconds: { $sum: '$duration' },
                  count: { $sum: 1 }
                }
              }
            ],
            
            // 4. Sesiones ACTIVAS (timers sin endTime)
            activeSessions: [
              { 
                $match: { 
                  endTime: null
                }
              },
              { $count: 'count' }
            ],
            
            // 5. Tiempo agrupado por TIPO de tarea (última semana)
            byType: [
              { 
                $match: { 
                  date: { $gte: weekAgo },
                  endTime: { $ne: null }
                }
              },
              {
                $lookup: {
                  from: 'tasks',
                  localField: 'task',
                  foreignField: '_id',
                  as: 'taskInfo'
                }
              },
              { $unwind: { path: '$taskInfo', preserveNullAndEmptyArrays: true } },
              {
                $group: {
                  _id: { 
                    $ifNull: [
                      '$taskInfo.type',
                      { $ifNull: ['$taskInfo.tipo', 'other'] }
                    ]
                  },
                  totalSeconds: { $sum: '$duration' }
                }
              }
            ],
            
            // 6. Tiempo agrupado por DÍA (última semana)
            byDay: [
              { 
                $match: { 
                  date: { $gte: weekAgo },
                  endTime: { $ne: null }
                }
              },
              {
                $group: {
                  _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$date' }
                  },
                  totalSeconds: { $sum: '$duration' }
                }
              },
              { $sort: { _id: 1 } }
            ]
          }
        }
      ]);

      // Procesar resultados
      const totalSecondsToday = stats.today[0]?.totalSeconds || 0;
      const totalSecondsWeek = stats.week[0]?.totalSeconds || 0;
      const totalSecondsMonth = stats.month[0]?.totalSeconds || 0;
      const activeSessions = stats.activeSessions[0]?.count || 0;

      // Convertir byType a objeto
      const secondsByType = {};
      stats.byType.forEach(item => {
        secondsByType[item._id] = item.totalSeconds;
      });

      // Convertir byDay a objeto
      const secondsByDay = {};
      stats.byDay.forEach(item => {
        secondsByDay[item._id] = item.totalSeconds;
      });

      // Calcular promedio diario
      const averageDailyMinutes = totalSecondsWeek > 0 
        ? Math.round(totalSecondsWeek / 60 / 7) 
        : 0;

      return {
        // Formato en minutos para compatibilidad con frontend
        todayMinutes: Math.round(totalSecondsToday / 60),
        weekMinutes: Math.round(totalSecondsWeek / 60),
        monthMinutes: Math.round(totalSecondsMonth / 60),
        averageDailyMinutes: averageDailyMinutes,
        activeSessions: activeSessions,
        
        // En segundos para mayor precisión
        todaySeconds: totalSecondsToday,
        weekSeconds: totalSecondsWeek,
        monthSeconds: totalSecondsMonth,
        
        // Para compatibilidad (en horas)
        totalHoursToday: Math.round((totalSecondsToday / 3600) * 10) / 10,
        totalHoursWeek: Math.round((totalSecondsWeek / 3600) * 10) / 10,
        totalHoursMonth: Math.round((totalSecondsMonth / 3600) * 10) / 10,
        averagePerDay: Math.round((totalSecondsWeek / 3600 / 7) * 10) / 10,
        
        // Agrupaciones
        secondsByType,
        secondsByDay,
        entries: stats.week[0]?.count || 0
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas de time tracking: ${error.message}`);
    }
  }

  /**
   * Crea una nueva entrada de time tracking
   */
  async createTimeEntry(userId, timeData) {
    try {
      const { taskId, startTime, endTime, description, date } = timeData;

      // Validar que la tarea pertenezca al usuario
      const task = await Task.findOne({ _id: taskId, assignee: userId });
      if (!task) {
        throw new Error('Tarea no encontrada o no tienes permisos para registrar tiempo en ella');
      }

      // Calcular duración en minutos
      const start = new Date(startTime);
      const end = new Date(endTime);
      const duration = Math.round((end - start) / (1000 * 60));

      if (duration <= 0) {
        throw new Error('La hora de fin debe ser posterior a la hora de inicio');
      }

      const timeEntry = new TimeTracking({
        user: userId,
        task: taskId,
        date: new Date(date),
        startTime: start,
        endTime: end,
        duration,
        description: description || '',
        type: 'manual'
      });

      await timeEntry.save();
      await timeEntry.populate('task', 'title type');

      return timeEntry;
    } catch (error) {
      throw new Error(`Error al crear entrada de tiempo: ${error.message}`);
    }
  }

  /**
   * Inicia un timer para una tarea
   */
  async startTimer(userId, taskId) {
    try {
      // Verificar que la tarea pertenezca al usuario
      const task = await Task.findOne({ _id: taskId, assignee: userId });
      if (!task) {
        throw new Error('Tarea no encontrada o no tienes permisos');
      }

      // Verificar si hay un timer activo
      const activeTimer = await TimeTracking.findOne({
        user: userId,
        endTime: null
      });

      if (activeTimer) {
        throw new Error('Ya tienes un timer activo. Detén el timer actual antes de iniciar uno nuevo.');
      }

      const timeEntry = new TimeTracking({
        user: userId,
        task: taskId,
        date: new Date(),
        startTime: new Date(),
        type: 'timer'
      });

      await timeEntry.save();
      await timeEntry.populate('task', 'title type');

      return timeEntry;
    } catch (error) {
      throw new Error(`Error al iniciar timer: ${error.message}`);
    }
  }

  /**
   * Detiene un timer activo
   */
  async stopTimer(userId, description = '') {
    try {
      const activeTimer = await TimeTracking.findOne({
        user: userId,
        endTime: null
      });

      if (!activeTimer) {
        throw new Error('No hay un timer activo');
      }

      const endTime = new Date();
      // Calcular duración en segundos
      const durationMs = endTime - activeTimer.startTime;
      const duration = Math.max(1, Math.round(durationMs / 1000));

      activeTimer.endTime = endTime;
      activeTimer.duration = duration;
      activeTimer.description = description;

      await activeTimer.save();
      await activeTimer.populate('task', 'title titulo tipo type');

      return activeTimer;
    } catch (error) {
      throw new Error(`Error al detener timer: ${error.message}`);
    }
  }

  /**
   * Obtiene entradas de time tracking con filtros
   */
  async getTimeEntries(userId, filters = {}, options = {}) {
    try {
      const query = { user: userId };

      if (filters.taskId) {
        query.task = filters.taskId;
      }

      if (filters.date) {
        const startDate = new Date(filters.date);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        
        query.date = {
          $gte: startDate,
          $lt: endDate
        };
      }

      if (filters.startDate && filters.endDate) {
        query.date = {
          $gte: new Date(filters.startDate),
          $lte: new Date(filters.endDate)
        };
      }

      const { skip = 0, limit = 20 } = options;

      const entries = await TimeTracking.find(query)
        .populate('task', 'title titulo tipo type priority')
        .sort({ date: -1, startTime: -1 })
        .skip(skip)
        .limit(limit);

      return entries;
    } catch (error) {
      throw new Error(`Error al obtener entradas de tiempo: ${error.message}`);
    }
  }

  /**
   * Cuenta entradas de time tracking con filtros
   */
  async countTimeEntries(userId, filters = {}) {
    try {
      const query = { user: userId };

      if (filters.taskId) {
        query.task = filters.taskId;
      }

      if (filters.date) {
        const startDate = new Date(filters.date);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        
        query.date = {
          $gte: startDate,
          $lt: endDate
        };
      }

      if (filters.startDate && filters.endDate) {
        query.date = {
          $gte: new Date(filters.startDate),
          $lte: new Date(filters.endDate)
        };
      }

      return await TimeTracking.countDocuments(query);
    } catch (error) {
      throw new Error(`Error al contar entradas de tiempo: ${error.message}`);
    }
  }

  /**
   * Actualiza una entrada de time tracking
   */
  async updateTimeEntry(entryId, userId, updateData) {
    try {
      // Primero verificar si existe la entrada
      const entry = await TimeTracking.findById(entryId);
      
      if (!entry) {
        throw new Error('Entrada de tiempo no encontrada');
      }

      // Verificar si pertenece al usuario
      if (entry.user.toString() !== userId.toString()) {
        throw new Error('No tienes permisos para actualizar esta entrada');
      }

      // No permitir actualizar entradas de timer activo
      if (!entry.endTime) {
        throw new Error('No se puede editar un timer activo');
      }

      const { startTime, endTime, description } = updateData;

      if (startTime) entry.startTime = new Date(startTime);
      if (endTime) entry.endTime = new Date(endTime);
      if (description !== undefined) entry.description = description;

      // Recalcular duración si se cambió start o end time
      if (startTime || endTime) {
        const duration = Math.round((entry.endTime - entry.startTime) / (1000 * 60));
        if (duration <= 0) {
          throw new Error('La hora de fin debe ser posterior a la hora de inicio');
        }
        entry.duration = duration;
      }

      await entry.save();
      await entry.populate('task', 'title type priority');

      return entry;
    } catch (error) {
      throw new Error(`Error al actualizar entrada de tiempo: ${error.message}`);
    }
  }

  /**
   * Elimina una entrada de time tracking
   */
  async deleteTimeEntry(entryId, userId) {
    try {
      // Primero verificar si existe la entrada
      const entry = await TimeTracking.findById(entryId);
      
      if (!entry) {
        throw new Error('Entrada de tiempo no encontrada');
      }

      // Verificar si pertenece al usuario
      if (entry.user.toString() !== userId.toString()) {
        throw new Error('No tienes permisos para eliminar esta entrada');
      }

      await TimeTracking.findByIdAndDelete(entryId);

      return { message: 'Entrada de tiempo eliminada correctamente' };
    } catch (error) {
      throw new Error(`Error al eliminar entrada de tiempo: ${error.message}`);
    }
  }

  /**
   * Obtiene bugs reportados por el developer
   */
  async getBugReports(userId, filters = {}) {
    try {
      const query = { reportedBy: userId }; // Usar reportedBy en lugar de reporter

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.priority) {
        query.priority = filters.priority;
      }

      if (filters.project) {
        query.project = filters.project;
      }

      if (filters.severity) {
        query.severity = filters.severity;
      }

      const bugReports = await BugReport.find(query)
        .populate('project', 'nombre')
        .populate('assignedTo', 'firstName lastName')
        .populate('sprint', 'nombre')
        .sort({ createdAt: -1 });

      return bugReports;
    } catch (error) {
      throw new Error(`Error al obtener reportes de bugs: ${error.message}`);
    }
  }

  /**
   * Crea un nuevo reporte de bug
   */
  async createBugReport(userId, bugData) {
    try {
      const {
        title,
        description,
        priority,
        severity,
        type,
        stepsToReproduce,
        expectedBehavior,
        actualBehavior,
        environment,
        project,
        relatedTask,
        attachments
      } = bugData;

      // Convertir relatedTask singular a relatedTasks array
      const relatedTasks = relatedTask ? [relatedTask] : [];

      const bugReport = new BugReport({
        title,
        description,
        priority: priority || 'medium',
        severity: severity || 'major',
        type: type || 'bug',
        stepsToReproduce,
        expectedBehavior,
        actualBehavior,
        environment,
        project,
        relatedTasks,
        reportedBy: userId, // Usar reportedBy en lugar de reporter
        status: 'open',
        attachments: attachments || []
      });

      await bugReport.save();
      
      // Populate solo si el campo existe
      const populateFields = [
        { path: 'reportedBy', select: 'firstName lastName' }
      ];
      
      if (bugReport.project) {
        populateFields.push({ path: 'project', select: 'nombre' });
      }

      if (bugReport.relatedTasks && bugReport.relatedTasks.length > 0) {
        populateFields.push({ path: 'relatedTasks', select: 'titulo title status priority' });
      }
      
      await bugReport.populate(populateFields);

      return bugReport;
    } catch (error) {
      throw new Error(`Error al crear reporte de bug: ${error.message}`);
    }
  }

  /**
   * Obtiene el timer activo del usuario
   */
  async getActiveTimer(userId) {
    try {
      const activeTimer = await TimeTracking.findOne({
        user: userId,
        endTime: null
      }).populate('task', 'title type priority');

      if (activeTimer) {
        // Calcular tiempo transcurrido
        const now = new Date();
        const elapsedMs = now - activeTimer.startTime;
        const elapsedMinutes = Math.round(elapsedMs / (1000 * 60));
        
        // Convertir a objeto plano para poder agregar campos
        const timerObj = activeTimer.toObject();
        timerObj.elapsedMinutes = elapsedMinutes;
        timerObj.elapsedHours = Math.round((elapsedMinutes / 60) * 10) / 10;
        
        return timerObj;
      }

      return activeTimer;
    } catch (error) {
      throw new Error(`Error al obtener timer activo: ${error.message}`);
    }
  }
}

module.exports = new DevelopersService();
