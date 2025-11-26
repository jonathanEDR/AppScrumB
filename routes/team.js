const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const TeamMember = require('../models/TeamMember');
const Task = require('../models/Task');
const User = require('../models/User');

/**
 * Team Management Routes
 * 
 * Endpoints para la gestión de equipos y miembros del equipo.
 * Incluye funcionalidades para:
 * - Obtener miembros del equipo con creación automática desde Users
 * - Generar resúmenes de tareas por miembro
 * - Obtener tareas específicas de usuarios
 * - CRUD de TeamMembers
 * 
 * Roles soportados: scrum_master, product_owner, developers, tester, designer, analyst, super_admin
 */

// GET /api/team - Obtener todos los miembros del equipo
router.get('/', authenticate, async (req, res) => {
  try {
    const { team, status, role } = req.query;
    
    // Construir filtros de consulta
    const filters = {};
    if (team) filters.team = team;
    if (status) filters.status = status;
    if (role) filters.role = role;
    
    const teamMembers = await TeamMember.find(filters)
      .populate('user', 'firstName lastName email avatar')
      .populate('currentSprint', 'name startDate endDate status')
      .sort({ role: 1, 'user.firstName': 1 });
    
    res.json({
      teamMembers,
      total: teamMembers.length
    });
  } catch (error) {
    console.error('Error al obtener miembros del equipo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/team/members - Alias para obtener todos los miembros del equipo
router.get('/members', authenticate, async (req, res) => {
  try {
    const { team, status, role } = req.query;
    
    // Construir filtros de consulta
    const filters = {};
    if (team) filters.team = team;
    if (status) filters.status = status;
    if (role) filters.role = role;
    
    let teamMembers = await TeamMember.find(filters)
      .populate('user', 'firstName lastName email avatar nombre_negocio')
      .populate('currentSprint', 'name startDate endDate status')
      .sort({ role: 1, 'user.firstName': 1 });
    
    // Verificar si hay usuarios sin TeamMember y crearlos automáticamente
    const users = await User.find({ is_active: true });
    
    // Crear TeamMembers automáticamente para usuarios que no tengan uno
    const createdMembers = [];
    
    for (const user of users) {
      // Verificar si ya existe un TeamMember para este usuario
      const existingMember = await TeamMember.findOne({ user: user._id });
      
      if (!existingMember) {
        // Determinar el rol basado en el rol del usuario
        let memberRole = user.role;
        
        // Mapear roles que no existen en TeamMember enum
        const roleMapping = {
          'user': 'developers',
          'developer': 'developers' // Por si acaso hay inconsistencias
        };
        
        // Verificar si el rol necesita mapeo
        if (roleMapping[user.role]) {
          memberRole = roleMapping[user.role];
        }
        
        // Lista de roles válidos en TeamMember
        const validRoles = ['scrum_master', 'product_owner', 'developers', 'tester', 'designer', 'analyst', 'super_admin'];
        
        // Si el rol no está en la lista válida, usar 'developers' por defecto
        if (!validRoles.includes(memberRole)) {
          memberRole = 'developers';
        }
        
        const newTeamMember = new TeamMember({
          user: user._id,
          team: 'default',
          role: memberRole,
          status: user.is_active ? 'active' : 'inactive',
          position: 'Miembro del equipo',
          skills: [
            { name: 'JavaScript', level: 'intermediate' },
            { name: 'React', level: 'intermediate' }
          ], // Skills en formato correcto
          availability: 80,
          joinedDate: user.createdAt || new Date(),
          lastActiveDate: new Date()
        });
        
        const savedMember = await newTeamMember.save();
        const populatedMember = await TeamMember.findById(savedMember._id)
          .populate('user', 'firstName lastName email avatar nombre_negocio')
          .populate('currentSprint', 'name startDate endDate status');
        
        createdMembers.push(populatedMember);
      }
    }
    
    // Recargar todos los TeamMembers después de crear los nuevos
    teamMembers = await TeamMember.find(filters)
      .populate('user', 'firstName lastName email avatar nombre_negocio')
      .populate('currentSprint', 'name startDate endDate status')
      .sort({ role: 1, 'user.firstName': 1 });
    
    // Procesar datos para el frontend
    const processedMembers = teamMembers.map(member => {
      return {
        _id: member._id,
        user: member.user,
        team: member.team,
        role: member.role,
        status: member.status,
        position: member.position,
        skills: member.skills || [],
        availability: member.availability || 80,
        joinedDate: member.joinedDate,
        lastActiveDate: member.lastActiveDate,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt
      };
    });
    
    res.json({
      members: processedMembers,
      total: processedMembers.length,
      summary: {
        active: processedMembers.filter(m => m.status === 'active').length,
        inactive: processedMembers.filter(m => m.status === 'inactive').length,
        byRole: processedMembers.reduce((acc, m) => {
          acc[m.role] = (acc[m.role] || 0) + 1;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Error al obtener miembros del equipo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/team/tasks-summary - Obtener resumen de tareas de todos los miembros del equipo
router.get('/tasks-summary', authenticate, async (req, res) => {
  try {
    // Primero, verificar todos los miembros sin filtro
    const allMembers = await TeamMember.find({})
      .populate('user', 'firstName lastName email nombre_negocio');
    
    // Ahora buscar solo los activos
    const teamMembers = await TeamMember.find({ status: 'active' })
      .populate('user', 'firstName lastName email nombre_negocio');
    
    // Si no hay miembros activos, usar todos los miembros
    const membersToUse = teamMembers.length > 0 ? teamMembers : allMembers;
    
    const tasksSummary = await Promise.all(
      membersToUse.map(async (member) => {
        try {
          // Buscar tareas por usuario (assignee referencia a User, no a TeamMember)
          const userId = member.user._id;
          
          const totalTasks = await Task.countDocuments({ assignee: userId });
          const completedTasks = await Task.countDocuments({ assignee: userId, status: 'done' });
          const inProgressTasks = await Task.countDocuments({ assignee: userId, status: 'in_progress' });
          const pendingTasks = await Task.countDocuments({ 
            assignee: userId, 
            status: { $in: ['todo', 'pending'] } 
          });
          
          return {
            userId: member.user.email, // Usar email como identificador
            teamMemberId: member._id, // ID del TeamMember
            userInfo: {
              _id: member.user._id,
              firstName: member.user.firstName,
              lastName: member.user.lastName,
              email: member.user.email,
              nombre_negocio: member.user.nombre_negocio,
              role: member.role
            },
            totalTasks,
            completedTasks,
            inProgressTasks,
            pendingTasks,
            progressPercentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
          };
        } catch (memberError) {
          console.error(`Error procesando miembro ${member.user.email}:`, memberError);
          return {
            userId: member.user.email,
            teamMemberId: member._id,
            userInfo: {
              _id: member.user._id,
              firstName: member.user.firstName,
              lastName: member.user.lastName,
              email: member.user.email,
              nombre_negocio: member.user.nombre_negocio,
              role: member.role
            },
            totalTasks: 0,
            completedTasks: 0,
            inProgressTasks: 0,
            pendingTasks: 0,
            progressPercentage: 0
          };
        }
      })
    );
    
    res.json({
      teamTasksSummary: tasksSummary
    });
  } catch (error) {
    console.error('Error al obtener resumen de tareas del equipo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/team/:id - Obtener miembro específico del equipo (DEBE IR AL FINAL)
// Esta ruta se movió al final del archivo para evitar conflictos con rutas específicas

// POST /api/team - Crear nuevo miembro del equipo
router.post('/', authenticate, async (req, res) => {
  try {
    const { 
      userId, 
      team, 
      role, 
      availability, 
      skills, 
      maxStoryPoints, 
      maxHours 
    } = req.body;
    
    // Validaciones básicas
    if (!userId || !team || !role) {
      return res.status(400).json({ 
        error: 'Los campos userId, team y role son obligatorios' 
      });
    }
    
    // Verificar que el usuario existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ error: 'Usuario no encontrado' });
    }
    
    // Verificar que no existe ya en el equipo
    const existingMember = await TeamMember.findOne({ user: userId, team });
    if (existingMember) {
      return res.status(400).json({ 
        error: 'El usuario ya es miembro de este equipo' 
      });
    }
    
    const teamMemberData = {
      user: userId,
      team,
      role,
      availability: availability || 100,
      skills: skills || [],
      workload: {
        maxStoryPoints: maxStoryPoints || 40,
        maxHours: maxHours || 40
      }
    };
    
    const newTeamMember = new TeamMember(teamMemberData);
    await newTeamMember.save();
    
    // Populate the response
    await newTeamMember.populate('user', 'firstName lastName email avatar');
    
    res.status(201).json({
      message: 'Miembro del equipo creado exitosamente',
      teamMember: newTeamMember
    });
  } catch (error) {
    console.error('Error al crear miembro del equipo:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/team/:id - Actualizar miembro del equipo
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      role, 
      status, 
      availability, 
      skills, 
      maxStoryPoints, 
      maxHours,
      currentSprint 
    } = req.body;
    
    const teamMember = await TeamMember.findById(id);
    
    if (!teamMember) {
      return res.status(404).json({ error: 'Miembro del equipo no encontrado' });
    }
    
    // Actualizar campos
    if (role) teamMember.role = role;
    if (status) teamMember.status = status;
    if (availability !== undefined) teamMember.availability = availability;
    if (skills) teamMember.skills = skills;
    if (currentSprint !== undefined) teamMember.currentSprint = currentSprint;
    
    if (maxStoryPoints !== undefined) {
      teamMember.workload.maxStoryPoints = maxStoryPoints;
    }
    if (maxHours !== undefined) {
      teamMember.workload.maxHours = maxHours;
    }
    
    await teamMember.save();
    
    // Populate the response
    await teamMember.populate('user', 'firstName lastName email avatar');
    await teamMember.populate('currentSprint', 'name startDate endDate status');
    
    res.json({
      message: 'Miembro del equipo actualizado exitosamente',
      teamMember
    });
  } catch (error) {
    console.error('Error al actualizar miembro del equipo:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID de miembro inválido' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/team/:id - Eliminar miembro del equipo
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const teamMember = await TeamMember.findById(id);
    
    if (!teamMember) {
      return res.status(404).json({ error: 'Miembro del equipo no encontrado' });
    }
    
    await TeamMember.findByIdAndDelete(id);
    
    res.json({ message: 'Miembro del equipo eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar miembro del equipo:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID de miembro inválido' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/team/overview/:teamName - Obtener resumen del equipo
router.get('/overview/:teamName', authenticate, async (req, res) => {
  try {
    const { teamName } = req.params;
    
    const overview = await TeamMember.getTeamOverview(teamName);
    const capacity = await TeamMember.getTeamCapacity(teamName);
    const skills = await TeamMember.getSkillsMatrix(teamName);
    
    res.json({
      overview,
      capacity: capacity[0] || {
        totalMembers: 0,
        totalCapacity: 0,
        currentWorkload: 0,
        averageAvailability: 0
      },
      skills
    });
  } catch (error) {
    console.error('Error al obtener resumen del equipo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/team/:id/workload - Actualizar carga de trabajo
router.put('/:id/workload', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { storyPoints, hours } = req.body;
    
    const teamMember = await TeamMember.findById(id);
    
    if (!teamMember) {
      return res.status(404).json({ error: 'Miembro del equipo no encontrado' });
    }
    
    await teamMember.updateWorkload(storyPoints || 0, hours || 0);
    
    res.json({
      message: 'Carga de trabajo actualizada exitosamente',
      workload: teamMember.workload
    });
  } catch (error) {
    console.error('Error al actualizar carga de trabajo:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID de miembro inválido' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/team/:id/skills - Agregar o actualizar habilidad
router.put('/:id/skills', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { skillName, level } = req.body;
    
    if (!skillName || !level) {
      return res.status(400).json({ 
        error: 'Los campos skillName y level son obligatorios' 
      });
    }
    
    const teamMember = await TeamMember.findById(id);
    
    if (!teamMember) {
      return res.status(404).json({ error: 'Miembro del equipo no encontrado' });
    }
    
    await teamMember.addSkill(skillName, level);
    
    res.json({
      message: 'Habilidad actualizada exitosamente',
      skills: teamMember.skills
    });
  } catch (error) {
    console.error('Error al actualizar habilidad:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID de miembro inválido' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/team/stats/:teamName - Obtener estadísticas del equipo
router.get('/stats/:teamName', authenticate, async (req, res) => {
  try {
    const { teamName } = req.params;
    
    const totalMembers = await TeamMember.countDocuments({ team: teamName });
    const activeMembers = await TeamMember.countDocuments({ 
      team: teamName, 
      status: 'active' 
    });
    const overloadedMembers = await TeamMember.countDocuments({ 
      team: teamName, 
      'workload.currentStoryPoints': { $gt: { $field: 'workload.maxStoryPoints' } }
    });
    
    // Calcular disponibilidad promedio
    const availabilityStats = await TeamMember.aggregate([
      { $match: { team: teamName, status: 'active' } },
      {
        $group: {
          _id: null,
          averageAvailability: { $avg: '$availability' },
          totalCapacity: { $sum: '$workload.maxStoryPoints' },
          currentWorkload: { $sum: '$workload.currentStoryPoints' }
        }
      }
    ]);
    
    const availability = availabilityStats[0] || {
      averageAvailability: 0,
      totalCapacity: 0,
      currentWorkload: 0
    };
    
    // Distribución por roles
    const roleDistribution = await TeamMember.aggregate([
      { $match: { team: teamName, status: 'active' } },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      totalMembers,
      activeMembers,
      overloadedMembers,
      averageAvailability: Math.round(availability.averageAvailability || 0),
      capacityUtilization: availability.totalCapacity > 0 
        ? Math.round((availability.currentWorkload / availability.totalCapacity) * 100)
        : 0,
      roleDistribution
    });
  } catch (error) {
    console.error('Error al obtener estadísticas del equipo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/team/members/:userId/tasks - Obtener tareas de un usuario específico
router.get('/members/:userId/tasks', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, priority, sprintId } = req.query;
    
    // Buscar usuario directamente
    let user;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId);
    } else {
      user = await User.findOne({ email: userId });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Construir filtros para las tareas
    const taskFilters = { assignee: user._id };
    if (status) taskFilters.status = status;
    if (priority) taskFilters.priority = priority;
    if (sprintId) taskFilters.sprint = sprintId;
    
    // Buscar tareas del usuario
    const tasks = await Task.find(taskFilters)
      .populate('sprint', 'name startDate endDate status')
      .populate('assignee', 'firstName lastName email avatar nombre_negocio')
      .populate('backlogItem', 'title priority')
      .sort({ updatedAt: -1 });
    
    if (tasks.length === 0) {
      
      // Crear algunas tareas demo para el usuario
      const demoTasks = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: `Implementar componente de login`,
          description: 'Desarrollar el componente de autenticación de usuarios',
          status: 'in_progress',
          priority: 'high',
          estimatedHours: 8,
          actualHours: 5,
          assignee: {
            _id: user._id,
            firstName: user.nombre_negocio ? user.nombre_negocio.split(' ')[0] : 'Usuario',
            lastName: user.nombre_negocio ? user.nombre_negocio.split(' ').slice(1).join(' ') || 'Demo' : 'Demo',
            email: user.email,
            avatar: null,
            nombre_negocio: user.nombre_negocio
          },
          type: 'feature',
          storyPoints: 5,
          tags: ['frontend', 'auth'],
          progress: 62,
          sprint: null,
          product: null,
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          updatedAt: new Date()
        },
        {
          _id: new mongoose.Types.ObjectId(),
          title: `Configurar base de datos`,
          description: 'Establecer conexión y configuración inicial de la base de datos',
          status: 'completed',
          priority: 'medium',
          estimatedHours: 4,
          actualHours: 4,
          assignee: {
            _id: user._id,
            firstName: user.nombre_negocio ? user.nombre_negocio.split(' ')[0] : 'Usuario',
            lastName: user.nombre_negocio ? user.nombre_negocio.split(' ').slice(1).join(' ') || 'Demo' : 'Demo',
            email: user.email,
            avatar: null,
            nombre_negocio: user.nombre_negocio
          },
          type: 'technical',
          storyPoints: 3,
          tags: ['backend', 'database'],
          progress: 100,
          sprint: null,
          product: null,
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        },
        {
          _id: new mongoose.Types.ObjectId(),
          title: `Diseñar interfaz de usuario`,
          description: 'Crear mockups y diseño de la interfaz principal',
          status: 'todo',
          priority: 'medium',
          estimatedHours: 6,
          actualHours: 0,
          assignee: {
            _id: user._id,
            firstName: user.nombre_negocio ? user.nombre_negocio.split(' ')[0] : 'Usuario',
            lastName: user.nombre_negocio ? user.nombre_negocio.split(' ').slice(1).join(' ') || 'Demo' : 'Demo',
            email: user.email,
            avatar: null,
            nombre_negocio: user.nombre_negocio
          },
          type: 'design',
          storyPoints: 4,
          tags: ['design', 'ui/ux'],
          progress: 0,
          sprint: null,
          product: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      // Aplicar filtros a las tareas demo
      let filteredTasks = demoTasks;
      if (status) {
        filteredTasks = demoTasks.filter(task => task.status === status);
      }
      if (priority) {
        filteredTasks = filteredTasks.filter(task => task.priority === priority);
      }
      
      return res.json({
        tasks: filteredTasks,
        total: filteredTasks.length,
        completed: filteredTasks.filter(t => t.status === 'completed').length,
        inProgress: filteredTasks.filter(t => t.status === 'in_progress').length,
        pending: filteredTasks.filter(t => ['todo', 'pending'].includes(t.status)).length,
        userInfo: {
          _id: user._id,
          firstName: user.nombre_negocio ? user.nombre_negocio.split(' ')[0] : 'Usuario',
          lastName: user.nombre_negocio ? user.nombre_negocio.split(' ').slice(1).join(' ') || 'Demo' : 'Demo',
          email: user.email,
          nombre_negocio: user.nombre_negocio,
          role: user.role || 'developer'
        }
      });
    }
    
    // Procesar tareas reales encontradas
    const processedTasks = tasks.map(task => {
      const progress = task.estimatedHours > 0 
        ? Math.round((task.actualHours / task.estimatedHours) * 100)
        : 0;
      
      return {
        ...task.toObject(),
        progress
      };
    });
    
    res.json({
      tasks: processedTasks,
      total: processedTasks.length,
      completed: processedTasks.filter(t => t.status === 'completed').length,
      inProgress: processedTasks.filter(t => t.status === 'in_progress').length,
      pending: processedTasks.filter(t => ['todo', 'pending'].includes(t.status)).length,
      userInfo: {
        _id: user._id,
        firstName: user.firstName || (user.nombre_negocio ? user.nombre_negocio.split(' ')[0] : 'Usuario'),
        lastName: user.lastName || (user.nombre_negocio ? user.nombre_negocio.split(' ').slice(1).join(' ') : 'Demo'),
        email: user.email,
        nombre_negocio: user.nombre_negocio,
        role: user.role || 'developer'
      }
    });
  } catch (error) {
    console.error('Error al obtener tareas del usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/team/:id - Obtener miembro específico del equipo
// IMPORTANTE: Esta ruta va al final para evitar conflictos con rutas más específicas
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const teamMember = await TeamMember.findById(id)
      .populate('user', 'firstName lastName email avatar')
      .populate('currentSprint', 'name startDate endDate status');
    
    if (!teamMember) {
      return res.status(404).json({ error: 'Miembro del equipo no encontrado' });
    }
    
    res.json(teamMember);
  } catch (error) {
    console.error('Error al obtener miembro del equipo:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID de miembro inválido' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
