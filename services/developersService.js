const Task = require('../models/Task');
const TimeTracking = require('../models/TimeTracking');
const BugReport = require('../models/BugReport');
const Commit = require('../models/Commit');
const PullRequest = require('../models/PullRequest');
const Repository = require('../models/Repository');
const Sprint = require('../models/Sprint');
const TeamMember = require('../models/TeamMember');

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
   */
  async getDashboardMetrics(userId) {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Tareas asignadas activas
      const assignedTasks = await Task.countDocuments({ 
        assignee: userId,
        status: { $ne: 'done' }
      });

      // Tareas completadas hoy
      const completedToday = await Task.countDocuments({
        assignee: userId,
        status: 'done',
        updatedAt: { $gte: startOfDay }
      });

      // Bugs resueltos esta semana
      const bugsResolvedThisWeek = await BugReport.countDocuments({
        assignedTo: userId,
        status: 'resolved',
        resolvedAt: { $gte: startOfWeek }
      });

      // Commits esta semana
      const commitsThisWeek = await Commit.countDocuments({
        'author.user': userId,
        createdAt: { $gte: startOfWeek }
      });

      // Horas trabajadas esta semana
      const timeEntries = await TimeTracking.find({
        user: userId,
        date: { $gte: startOfWeek }
      });
      const hoursWorkedThisWeek = timeEntries.reduce((total, entry) => total + entry.hours, 0);

      // Pull requests activos
      const activePRs = await PullRequest.countDocuments({
        author: userId,
        status: { $in: ['draft', 'open', 'review'] }
      });

      // Tareas recientes
      const recentTasks = await Task.find({
        assignee: userId
      })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate('sprint', 'name')
      .select('title status priority storyPoints updatedAt sprint');

      return {
        metrics: {
          assignedTasks,
          completedToday,
          bugsResolvedThisWeek,
          commitsThisWeek,
          hoursWorkedThisWeek: Math.round(hoursWorkedThisWeek * 10) / 10,
          activePRs
        },
        recentTasks
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
      console.log('🔍 getSprintBoardData - userId:', userId, 'sprintId:', sprintId, 'filterMode:', filterMode);
      
      let sprint;
      
      if (sprintId) {
        sprint = await Sprint.findById(sprintId);
      } else {
        // Intentar obtener el sprint activo primero
        sprint = await Sprint.findOne({
          estado: 'activo'
        });
        
        // Si no hay sprint activo, buscar el sprint actual por fechas
        if (!sprint) {
          const now = new Date();
          sprint = await Sprint.findOne({
            fecha_inicio: { $lte: now },
            fecha_fin: { $gte: now }
          }).sort({ fecha_inicio: -1 });
        }
        
        // Si aún no hay sprint, tomar el más reciente
        if (!sprint) {
          sprint = await Sprint.findOne().sort({ fecha_inicio: -1 });
        }
      }

      if (!sprint) {
        throw new Error('No se encontró un sprint disponible');
      }

      console.log('📋 Sprint encontrado para Sprint Board:', {
        id: sprint._id,
        name: sprint.nombre,
        estado: sprint.estado,
        filterMode
      });

      let developerTasks;
      
      // Determinar qué tareas mostrar según el modo de filtro
      if (filterMode === 'sprint' && sprintId) {
        // Mostrar solo tareas del sprint específico
        developerTasks = await Task.find({ 
          assignee: userId,
          sprint: sprintId
        })
        .populate('assignee', 'firstName lastName')
        .populate('sprint', 'nombre estado')
        .sort({ priority: -1, createdAt: -1 });
        
        console.log('📊 Tareas del sprint específico:', {
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
          
        console.log('📊 Todas las tareas del usuario:', {
          total: developerTasks.length,
          filterMode: 'all'
        });
      }

      // Para las métricas, usar las tareas filtradas
      const allRelevantTasks = developerTasks;

      console.log('✅ Tareas del developer mostradas:', developerTasks.length);

      // Calcular métricas basadas en las tareas filtradas
      const totalPoints = allRelevantTasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0);
      const completedPoints = allRelevantTasks
        .filter(task => task.status === 'done')
        .reduce((sum, task) => sum + (task.storyPoints || 0), 0);
      
      const sprintProgress = totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0;

      // Mapear campos del sprint para compatibilidad
      const sprintData = {
        _id: sprint._id,
        name: sprint.nombre,
        goal: sprint.objetivo,
        startDate: sprint.fecha_inicio,
        endDate: sprint.fecha_fin,
        status: sprint.estado,
        progress: Math.round(sprintProgress)
      };

      return {
        sprint: sprintData,
        tasks: developerTasks, // Tareas filtradas según el modo
        allTasks: allRelevantTasks, // Mismas tareas para compatibilidad
        filterMode, // Incluir el modo de filtro en la respuesta
        metrics: {
          totalPoints,
          completedPoints,
          sprintProgress: Math.round(sprintProgress),
          todoTasks: developerTasks.filter(t => t.status === 'todo').length,
          inProgressTasks: developerTasks.filter(t => t.status === 'in_progress').length,
          codeReviewTasks: developerTasks.filter(t => t.status === 'code_review').length,
          testingTasks: developerTasks.filter(t => t.status === 'testing').length,
          doneTasks: developerTasks.filter(t => t.status === 'done').length
        }
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
   */
  async getTimeTrackingStats(userId, period = 'week') {
    try {
      const now = new Date();
      let startDate;

      switch (period) {
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - now.getDay()));
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          break;
        default:
          startDate = new Date(now.setDate(now.getDate() - 7));
      }

      const timeEntries = await TimeTracking.find({
        user: userId,
        date: { $gte: startDate }
      }).populate('task', 'title type');

      const totalHours = timeEntries.reduce((total, entry) => total + entry.hours, 0);
      
      // Agrupar por tipo de tarea
      const hoursByType = timeEntries.reduce((acc, entry) => {
        const type = entry.task?.type || 'other';
        acc[type] = (acc[type] || 0) + entry.hours;
        return acc;
      }, {});

      // Agrupar por día
      const hoursByDay = timeEntries.reduce((acc, entry) => {
        const day = entry.date.toISOString().split('T')[0];
        acc[day] = (acc[day] || 0) + entry.hours;
        return acc;
      }, {});

      return {
        totalHours: Math.round(totalHours * 10) / 10,
        averagePerDay: Math.round((totalHours / 7) * 10) / 10,
        hoursByType,
        hoursByDay,
        entries: timeEntries
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas de time tracking: ${error.message}`);
    }
  }

  /**
   * Obtiene los repositorios del developer
   */
  async getDeveloperRepositories(userId) {
    try {
      const repositories = await Repository.find({
        $or: [
          { 'contributors.user': userId },
          { maintainers: userId }
        ]
      }).populate('project', 'nombre')
        .populate('maintainers', 'firstName lastName')
        .populate('contributors.user', 'firstName lastName');

      return repositories;
    } catch (error) {
      throw new Error(`Error al obtener repositorios: ${error.message}`);
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
      const duration = Math.round((endTime - activeTimer.startTime) / (1000 * 60));

      activeTimer.endTime = endTime;
      activeTimer.duration = duration;
      activeTimer.description = description;

      await activeTimer.save();
      await activeTimer.populate('task', 'title type');

      return activeTimer;
    } catch (error) {
      throw new Error(`Error al detener timer: ${error.message}`);
    }
  }

  /**
   * Obtiene entradas de time tracking con filtros
   */
  async getTimeEntries(userId, filters = {}) {
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

      const entries = await TimeTracking.find(query)
        .populate('task', 'title type priority')
        .sort({ date: -1, startTime: -1 });

      return entries;
    } catch (error) {
      throw new Error(`Error al obtener entradas de tiempo: ${error.message}`);
    }
  }

  /**
   * Actualiza una entrada de time tracking
   */
  async updateTimeEntry(entryId, userId, updateData) {
    try {
      const entry = await TimeTracking.findOne({ _id: entryId, user: userId });
      
      if (!entry) {
        throw new Error('Entrada de tiempo no encontrada');
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
      const entry = await TimeTracking.findOneAndDelete({ _id: entryId, user: userId });
      
      if (!entry) {
        throw new Error('Entrada de tiempo no encontrada');
      }

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
      const query = { reporter: userId };

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.priority) {
        query.priority = filters.priority;
      }

      if (filters.project) {
        query.project = filters.project;
      }

      const bugReports = await BugReport.find(query)
        .populate('project', 'nombre')
        .populate('assignedTo', 'firstName lastName')
        .populate('sprint', 'name')
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
        type,
        stepsToReproduce,
        expectedBehavior,
        actualBehavior,
        environment,
        project,
        attachments
      } = bugData;

      const bugReport = new BugReport({
        title,
        description,
        priority: priority || 'medium',
        type: type || 'bug',
        stepsToReproduce,
        expectedBehavior,
        actualBehavior,
        environment,
        project,
        reporter: userId,
        status: 'open',
        attachments: attachments || []
      });

      await bugReport.save();
      await bugReport.populate([
        { path: 'project', select: 'nombre' },
        { path: 'reporter', select: 'firstName lastName' }
      ]);

      return bugReport;
    } catch (error) {
      throw new Error(`Error al crear reporte de bug: ${error.message}`);
    }
  }

  /**
   * Obtiene commits del developer
   */
  async getCommitHistory(userId, filters = {}) {
    try {
      const query = { 'author.user': userId };

      if (filters.repository) {
        query.repository = filters.repository;
      }

      if (filters.branch) {
        query.branch = filters.branch;
      }

      if (filters.startDate && filters.endDate) {
        query.createdAt = {
          $gte: new Date(filters.startDate),
          $lte: new Date(filters.endDate)
        };
      }

      const commits = await Commit.find(query)
        .populate('repository', 'name url')
        .sort({ createdAt: -1 })
        .limit(50);

      return commits;
    } catch (error) {
      throw new Error(`Error al obtener historial de commits: ${error.message}`);
    }
  }

  /**
   * Obtiene pull requests del developer
   */
  async getPullRequests(userId, filters = {}) {
    try {
      const query = { author: userId };

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.repository) {
        query.repository = filters.repository;
      }

      const pullRequests = await PullRequest.find(query)
        .populate('repository', 'name url')
        .populate('assignedReviewers', 'firstName lastName')
        .sort({ createdAt: -1 });

      return pullRequests;
    } catch (error) {
      throw new Error(`Error al obtener pull requests: ${error.message}`);
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

      return activeTimer;
    } catch (error) {
      throw new Error(`Error al obtener timer activo: ${error.message}`);
    }
  }
}

module.exports = new DevelopersService();
