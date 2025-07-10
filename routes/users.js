const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const User = require('../models/User');
const Product = require('../models/Product');
const Task = require('../models/Task');
const TimeTracking = require('../models/TimeTracking');
const TeamMember = require('../models/TeamMember');

// Obtener dashboard del usuario
router.get('/dashboard/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verificar que el usuario existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Buscar TeamMember asociado al usuario
    const teamMember = await TeamMember.findOne({ user: userId });
    
    // Obtener proyectos donde el usuario es responsable o miembro del equipo
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
      .lean();

    // Obtener tareas asignadas al usuario
    let tasks = [];
    if (teamMember) {
      tasks = await Task.find({ 
        assignee: teamMember._id,
        status: { $ne: 'done' }
      }).lean();
    }

    // Obtener horas trabajadas esta semana
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const currentWeekTracking = await TimeTracking.find({
      user: userId,
      startTime: { $gte: startOfWeek, $lte: endOfWeek }
    });

    const currentWeekHours = currentWeekTracking.reduce((total, entry) => {
      return total + (entry.duration || 0);
    }, 0) / 60; // Convertir de minutos a horas

    // Obtener horas de la semana anterior para comparación
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    
    const endOfLastWeek = new Date(startOfWeek);
    endOfLastWeek.setMilliseconds(endOfLastWeek.getMilliseconds() - 1);

    const lastWeekTracking = await TimeTracking.find({
      user: userId,
      startTime: { $gte: startOfLastWeek, $lte: endOfLastWeek }
    });

    const lastWeekHours = lastWeekTracking.reduce((total, entry) => {
      return total + (entry.duration || 0);
    }, 0) / 60;

    // Calcular variación de horas
    const hoursVariation = currentWeekHours - lastWeekHours;
    const hoursVariationPercent = lastWeekHours > 0 ? ((hoursVariation / lastWeekHours) * 100) : 0;

    // Formatear proyectos con información adicional
    const formattedProjects = await Promise.all(projects.map(async (project) => {
      // Obtener tareas del proyecto para calcular progreso
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
        _id: project._id,
        nombre: project.nombre,
        descripcion: project.descripcion,
        responsable: project.responsable,
        estado: project.estado,
        statusColor,
        statusLabel,
        progress,
        fecha_fin: project.fecha_fin,
        equipo: 'Equipo Alpha' // Esto se puede mejorar obteniendo el nombre real del equipo
      };
    }));

    // Respuesta del dashboard
    const dashboardData = {
      user: {
        _id: user._id,
        email: user.email,
        nombre_negocio: user.nombre_negocio,
        role: user.role
      },
      metrics: {
        totalProjects: projects.length,
        pendingTasks: tasks.length,
        weeklyHours: Math.round(currentWeekHours * 100) / 100,
        hoursVariation: Math.round(hoursVariation * 100) / 100,
        hoursVariationPercent: Math.round(hoursVariationPercent * 100) / 100,
        isIncrease: hoursVariation >= 0
      },
      projects: formattedProjects,
      recentTasks: tasks.slice(0, 5) // Últimas 5 tareas pendientes
    };

    res.json(dashboardData);

  } catch (error) {
    console.error('Error al obtener dashboard del usuario:', error);
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Obtener proyectos del usuario
router.get('/projects/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Buscar TeamMember asociado al usuario
    const teamMember = await TeamMember.findOne({ user: userId });
    
    // Obtener proyectos donde el usuario es responsable o miembro del equipo
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

    // Formatear proyectos con información adicional
    const formattedProjects = await Promise.all(projects.map(async (project) => {
      const projectTasks = await Task.find({ 
        $or: [
          { project: project._id },
          { product: project._id }
        ]
      });

      const totalTasks = projectTasks.length;
      const completedTasks = projectTasks.filter(task => task.status === 'done').length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        ...project,
        progress,
        totalTasks,
        completedTasks
      };
    }));

    res.json(formattedProjects);

  } catch (error) {
    console.error('Error al obtener proyectos del usuario:', error);
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Obtener actividades del usuario
router.get('/activities/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // Buscar TeamMember asociado al usuario
    const teamMember = await TeamMember.findOne({ user: userId });
    
    if (!teamMember) {
      return res.json({
        activities: [],
        totalPages: 0,
        currentPage: parseInt(page),
        total: 0
      });
    }

    // Obtener actividades de time tracking del usuario
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const activities = await TimeTracking.find({ user: userId })
      .populate('task', 'title type status')
      .populate('sprint', 'name')
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalActivities = await TimeTracking.countDocuments({ user: userId });
    const totalPages = Math.ceil(totalActivities / parseInt(limit));

    // Formatear actividades
    const formattedActivities = activities.map(activity => ({
      _id: activity._id,
      task: activity.task,
      sprint: activity.sprint,
      startTime: activity.startTime,
      endTime: activity.endTime,
      duration: activity.duration,
      description: activity.description,
      category: activity.category,
      productivity: activity.productivity,
      isActive: activity.isActive
    }));

    res.json({
      activities: formattedActivities,
      totalPages,
      currentPage: parseInt(page),
      total: totalActivities
    });

  } catch (error) {
    console.error('Error al obtener actividades del usuario:', error);
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Obtener perfil del usuario
router.get('/profile/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('-__v');
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Buscar información adicional del TeamMember si existe
    const teamMember = await TeamMember.findOne({ user: userId })
      .populate('team', 'name')
      .lean();

    const profileData = {
      _id: user._id,
      email: user.email,
      nombre_negocio: user.nombre_negocio,
      role: user.role,
      fecha_creacion: user.fecha_creacion,
      updated_at: user.updated_at,
      is_active: user.is_active,
      teamInfo: teamMember ? {
        position: teamMember.position,
        skills: teamMember.skills,
        team: teamMember.team
      } : null
    };

    res.json(profileData);

  } catch (error) {
    console.error('Error al obtener perfil del usuario:', error);
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Actualizar perfil del usuario
router.put('/profile/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const { nombre_negocio, ...otherFields } = req.body;

    // Validar que el usuario existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Actualizar campos permitidos
    const updateFields = {};
    if (nombre_negocio !== undefined) updateFields.nombre_negocio = nombre_negocio;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateFields,
      { new: true, runValidators: true }
    ).select('-__v');

    res.json({
      message: 'Perfil actualizado exitosamente',
      user: updatedUser
    });

  } catch (error) {
    console.error('Error al actualizar perfil del usuario:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Datos de entrada inválidos',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
