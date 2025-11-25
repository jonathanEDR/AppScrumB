const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const TeamMember = require('../models/TeamMember');
const Task = require('../models/Task');
const User = require('../models/User');

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
    
    // Si no hay miembros del equipo, crear datos de demostración basados en usuarios existentes
    if (teamMembers.length === 0) {
      const users = await User.find({ is_active: true }).limit(10);
      
      const roles = ['developer', 'tester', 'designer', 'scrum_master', 'product_owner'];
      
      teamMembers = users.map((user, index) => {
        const selectedRole = user.role === 'user' ? roles[index % roles.length] : user.role;
        
        return {
          _id: new mongoose.Types.ObjectId(),
          user: {
            _id: user._id,
            firstName: user.nombre_negocio ? user.nombre_negocio.split(' ')[0] : 'Usuario',
            lastName: user.nombre_negocio ? user.nombre_negocio.split(' ').slice(1).join(' ') || 'Demo' : 'Demo',
            email: user.email,
            avatar: null,
            nombre_negocio: user.nombre_negocio
          },
          team: 'default',
          role: selectedRole,
          status: user.is_active ? 'active' : 'inactive',
          availability: Math.floor(Math.random() * 40) + 60, // 60-100%
          skills: [
            { name: 'JavaScript', level: 'intermediate' },
            { name: 'React', level: 'advanced' },
            { name: selectedRole === 'developer' ? 'Node.js' : 'Testing', level: 'intermediate' }
          ],
          workload: {
            currentStoryPoints: Math.floor(Math.random() * 15) + 5, // 5-20 puntos
            maxStoryPoints: 24,
            hoursWorked: Math.floor(Math.random() * 25) + 15, // 15-40 horas
            maxHours: 40
          },
          performance: {
            velocityAverage: Math.floor(Math.random() * 10) + 15, // 15-25
            completionRate: Math.floor(Math.random() * 30) + 70, // 70-100%
            qualityScore: Math.floor(Math.random() * 20) + 80 // 80-100%
          },
          currentSprint: null,
          joinedDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // Último año
          lastActiveDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Última semana
          createdAt: new Date(),
          updatedAt: new Date()
        };
      });
      
      // Nota: Estos son datos demo. En producción deberías tener TeamMembers reales
    }
    
    // Enriquecer datos con información calculada
    const enrichedMembers = teamMembers.map(member => {
      const workloadPercentage = member.workload?.maxStoryPoints > 0 
        ? Math.round((member.workload.currentStoryPoints / member.workload.maxStoryPoints) * 100)
        : 0;
      
      return {
        ...member.toObject ? member.toObject() : member,
        workloadPercentage,
        capacityRemaining: Math.max(0, (member.workload?.maxStoryPoints || 24) - (member.workload?.currentStoryPoints || 0)),
        isOverloaded: workloadPercentage > 100
      };
    });
    
    res.json({
      members: enrichedMembers,
      total: enrichedMembers.length,
      summary: {
        active: enrichedMembers.filter(m => m.status === 'active').length,
        busy: enrichedMembers.filter(m => m.status === 'busy').length,
        inactive: enrichedMembers.filter(m => m.status === 'inactive').length,
        overloaded: enrichedMembers.filter(m => m.isOverloaded).length,
        averageWorkload: enrichedMembers.length > 0 
          ? Math.round(enrichedMembers.reduce((sum, m) => sum + (m.workloadPercentage || 0), 0) / enrichedMembers.length)
          : 0
      }
    });
  } catch (error) {
    console.error('Error al obtener miembros del equipo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/team/:id - Obtener miembro específico del equipo
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

module.exports = router;
