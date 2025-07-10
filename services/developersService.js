const Task = require('../models/Task');
const TimeTracking = require('../models/TimeTracking');
const BugReport = require('../models/BugReport');
const Commit = require('../models/Commit');
const PullRequest = require('../models/PullRequest');
const CodeRepository = require('../models/CodeRepository');
const Sprint = require('../models/Sprint');
const TeamMember = require('../models/TeamMember');

class DevelopersService {
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
   * Obtiene datos del sprint board para el developer
   */
  async getSprintBoardData(userId, sprintId = null) {
    try {
      let sprint;
      
      if (sprintId) {
        sprint = await Sprint.findById(sprintId);
      } else {
        // Obtener el sprint activo
        sprint = await Sprint.findOne({
          status: 'active',
          startDate: { $lte: new Date() },
          endDate: { $gte: new Date() }
        });
      }

      if (!sprint) {
        throw new Error('No se encontró un sprint activo');
      }

      // Obtener todas las tareas del sprint
      const allSprintTasks = await Task.find({ sprint: sprint._id })
        .populate('assignee', 'firstName lastName')
        .sort({ priority: -1, createdAt: -1 });

      // Filtrar tareas del developer
      const developerTasks = allSprintTasks.filter(
        task => task.assignee && task.assignee._id.toString() === userId
      );

      // Calcular métricas del sprint
      const totalPoints = allSprintTasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0);
      const completedPoints = allSprintTasks
        .filter(task => task.status === 'done')
        .reduce((sum, task) => sum + (task.storyPoints || 0), 0);
      
      const sprintProgress = totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0;

      return {
        sprint: {
          ...sprint.toObject(),
          progress: Math.round(sprintProgress)
        },
        tasks: developerTasks,
        allTasks: allSprintTasks,
        metrics: {
          totalPoints,
          completedPoints,
          sprintProgress: Math.round(sprintProgress),
          todoTasks: allSprintTasks.filter(t => t.status === 'todo').length,
          inProgressTasks: allSprintTasks.filter(t => t.status === 'in_progress').length,
          doneTasks: allSprintTasks.filter(t => t.status === 'done').length
        }
      };
    } catch (error) {
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
      const repositories = await CodeRepository.find({
        $or: [
          { 'collaborators.user': userId },
          { owner: userId }
        ]
      }).populate('owner', 'firstName lastName')
        .populate('collaborators.user', 'firstName lastName');

      return repositories;
    } catch (error) {
      throw new Error(`Error al obtener repositorios: ${error.message}`);
    }
  }
}

module.exports = new DevelopersService();
