const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Task = require('../models/Task');
const TimeTracking = require('../models/TimeTracking');
const TeamMember = require('../models/TeamMember');

const getUserData = async (userId) => {
  const user = await User.findOne({ clerk_id: userId });  // Buscar al usuario por el ID de Clerk
  return user;
};

// Servicio para guardar datos del usuario
const saveUserData = async (userId, data) => {
  const user = await User.findOneAndUpdate(
    { clerk_id: userId },  // Buscar el usuario por su ID de Clerk
    data,  // Datos a actualizar
    { new: true, upsert: true }  // Si no existe el usuario, lo crea
  );
  return user;
};

/**
 * Obtener métricas del dashboard del usuario
 */
const getUserDashboardMetrics = async (userId) => {
  try {
    // Buscar TeamMember asociado al usuario
    const teamMember = await TeamMember.findOne({ user: userId });
    
    // Métricas de proyectos
    const projectMetrics = await getUserProjectMetrics(userId, teamMember);
    
    // Métricas de tareas
    const taskMetrics = await getUserTaskMetrics(teamMember);
    
    // Métricas de tiempo
    const timeMetrics = await getUserTimeMetrics(userId);
    
    return {
      projects: projectMetrics,
      tasks: taskMetrics,
      time: timeMetrics
    };
  } catch (error) {
    throw new Error(`Error al obtener métricas del usuario: ${error.message}`);
  }
};

/**
 * Obtener métricas de proyectos del usuario
 */
const getUserProjectMetrics = async (userId, teamMember = null) => {
  try {
    let projectsQuery = {};
    
    if (teamMember) {
      projectsQuery = {
        $or: [
          { responsable: userId },
          { 'equipo': teamMember._id }
        ]
      };
    } else {
      projectsQuery = { responsable: userId };
    }

    const projects = await Product.find(projectsQuery);
    
    const projectsByStatus = await Product.aggregate([
      { $match: projectsQuery },
      {
        $group: {
          _id: '$estado',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCounts = {
      activo: 0,
      inactivo: 0,
      completado: 0
    };

    projectsByStatus.forEach(status => {
      if (statusCounts.hasOwnProperty(status._id)) {
        statusCounts[status._id] = status.count;
      }
    });

    return {
      total: projects.length,
      active: statusCounts.activo,
      planning: statusCounts.inactivo,
      completed: statusCounts.completado
    };
  } catch (error) {
    throw new Error(`Error al obtener métricas de proyectos: ${error.message}`);
  }
};

/**
 * Obtener métricas de tareas del usuario
 */
const getUserTaskMetrics = async (teamMember) => {
  try {
    if (!teamMember) {
      return {
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0
      };
    }

    const tasks = await Task.find({ assignee: teamMember._id });
    
    const tasksByStatus = await Task.aggregate([
      { $match: { assignee: teamMember._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCounts = {
      todo: 0,
      in_progress: 0,
      code_review: 0,
      testing: 0,
      done: 0
    };

    tasksByStatus.forEach(status => {
      if (statusCounts.hasOwnProperty(status._id)) {
        statusCounts[status._id] = status.count;
      }
    });

    return {
      total: tasks.length,
      pending: statusCounts.todo,
      inProgress: statusCounts.in_progress + statusCounts.code_review + statusCounts.testing,
      completed: statusCounts.done
    };
  } catch (error) {
    throw new Error(`Error al obtener métricas de tareas: ${error.message}`);
  }
};

/**
 * Obtener métricas de tiempo del usuario
 */
const getUserTimeMetrics = async (userId) => {
  try {
    const now = new Date();
    
    // Semana actual
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Semana anterior
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    
    const endOfLastWeek = new Date(startOfWeek);
    endOfLastWeek.setMilliseconds(endOfLastWeek.getMilliseconds() - 1);

    // Mes actual
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Obtener datos de tiempo
    const [currentWeekData, lastWeekData, monthData] = await Promise.all([
      TimeTracking.find({
        user: userId,
        startTime: { $gte: startOfWeek, $lte: endOfWeek }
      }),
      TimeTracking.find({
        user: userId,
        startTime: { $gte: startOfLastWeek, $lte: endOfLastWeek }
      }),
      TimeTracking.find({
        user: userId,
        startTime: { $gte: startOfMonth, $lte: endOfMonth }
      })
    ]);

    // Calcular horas
    const currentWeekHours = calculateTotalHours(currentWeekData);
    const lastWeekHours = calculateTotalHours(lastWeekData);
    const monthHours = calculateTotalHours(monthData);

    // Calcular variación
    const hoursVariation = currentWeekHours - lastWeekHours;
    const variationPercent = lastWeekHours > 0 ? ((hoursVariation / lastWeekHours) * 100) : 0;

    return {
      currentWeekHours: Math.round(currentWeekHours * 100) / 100,
      lastWeekHours: Math.round(lastWeekHours * 100) / 100,
      monthHours: Math.round(monthHours * 100) / 100,
      hoursVariation: Math.round(hoursVariation * 100) / 100,
      variationPercent: Math.round(variationPercent * 100) / 100,
      isIncrease: hoursVariation >= 0
    };
  } catch (error) {
    throw new Error(`Error al obtener métricas de tiempo: ${error.message}`);
  }
};

/**
 * Calcular total de horas desde datos de TimeTracking
 */
const calculateTotalHours = (timeTrackingData) => {
  return timeTrackingData.reduce((total, entry) => {
    return total + (entry.duration || 0);
  }, 0) / 60; // Convertir de minutos a horas
};

/**
 * Obtener proyectos del usuario con información detallada
 */
const getUserProjectsWithDetails = async (userId) => {
  try {
    const teamMember = await TeamMember.findOne({ user: userId });
    
    let projectsQuery = {};
    if (teamMember) {
      projectsQuery = {
        $or: [
          { responsable: userId },
          { 'equipo': teamMember._id }
        ]
      };
    } else {
      projectsQuery = { responsable: userId };
    }

    const projects = await Product.find(projectsQuery)
      .populate('responsable', 'email nombre_negocio')
      .sort({ createdAt: -1 })
      .lean();

    // Agregar información de progreso a cada proyecto
    const projectsWithDetails = await Promise.all(projects.map(async (project) => {
      const projectTasks = await Task.find({ 
        $or: [
          { project: project._id },
          { product: project._id }
        ]
      });

      const totalTasks = projectTasks.length;
      const completedTasks = projectTasks.filter(task => task.status === 'done').length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Determinar estado visual
      let statusColor = 'blue';
      let statusLabel = 'Completado';
      
      switch (project.estado) {
        case 'activo':
          statusColor = 'green';
          statusLabel = 'Activo';
          break;
        case 'inactivo':
          statusColor = 'yellow';
          statusLabel = 'Planificación';
          break;
        case 'completado':
          statusColor = 'blue';
          statusLabel = 'Completado';
          break;
        default:
          statusColor = 'gray';
          statusLabel = project.estado;
      }

      return {
        ...project,
        progress,
        totalTasks,
        completedTasks,
        statusColor,
        statusLabel
      };
    }));

    return projectsWithDetails;
  } catch (error) {
    throw new Error(`Error al obtener proyectos del usuario: ${error.message}`);
  }
};

/**
 * Obtener actividades recientes del usuario
 */
const getUserRecentActivities = async (userId, limit = 10) => {
  try {
    const activities = await TimeTracking.find({ user: userId })
      .populate('task', 'title type status')
      .populate('sprint', 'name')
      .sort({ startTime: -1 })
      .limit(limit)
      .lean();

    return activities.map(activity => ({
      _id: activity._id,
      task: activity.task,
      sprint: activity.sprint,
      startTime: activity.startTime,
      endTime: activity.endTime,
      duration: Math.round((activity.duration || 0) / 60 * 100) / 100, // Convertir a horas
      description: activity.description,
      category: activity.category,
      productivity: activity.productivity,
      isActive: activity.isActive
    }));
  } catch (error) {
    throw new Error(`Error al obtener actividades del usuario: ${error.message}`);
  }
};

module.exports = { 
  getUserData, 
  saveUserData,
  getUserDashboardMetrics,
  getUserProjectMetrics,
  getUserTaskMetrics,
  getUserTimeMetrics,
  calculateTotalHours,
  getUserProjectsWithDetails,
  getUserRecentActivities
};
