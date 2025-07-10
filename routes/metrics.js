const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const Sprint = require('../models/Sprint');
const Task = require('../models/Task');
const TeamMember = require('../models/TeamMember');
const Impediment = require('../models/Impediment');
const Ceremony = require('../models/Ceremony');

// GET /api/metricas/dashboard - Dashboard de métricas principales
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const { team, period = '30' } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));
    
    // Obtener sprints del período
    const sprintsQuery = { startDate: { $gte: startDate } };
    if (team) sprintsQuery.team = team;
    
    const sprints = await Sprint.find(sprintsQuery).sort({ startDate: -1 });
    const sprintIds = sprints.map(s => s._id);
    
    // Obtener miembros del equipo
    const teamQuery = team ? { team } : {};
    const teamMembers = await TeamMember.find(teamQuery).populate('user');
    const teamMemberIds = teamMembers.map(tm => tm._id);
    
    // Obtener tareas del período
    const tasks = await Task.find({
      $or: [
        { sprint: { $in: sprintIds } },
        { assignee: { $in: teamMemberIds }, createdAt: { $gte: startDate } }
      ]
    }).populate('assignee');
    
    // Obtener impedimentos
    const impediments = await Impediment.find({
      createdDate: { $gte: startDate }
    });
    
    // Calcular métricas
    const completedSprints = sprints.filter(s => s.status === 'completed');
    const completedTasks = tasks.filter(t => t.status === 'done');
    const activeTasks = tasks.filter(t => ['todo', 'in_progress', 'code_review', 'testing'].includes(t.status));
    
    // Velocidad del equipo
    const velocity = completedSprints.length > 0 
      ? completedSprints.reduce((sum, sprint) => {
          const sprintTasks = completedTasks.filter(t => t.sprint?.toString() === sprint._id.toString());
          return sum + sprintTasks.reduce((taskSum, task) => taskSum + task.storyPoints, 0);
        }, 0) / completedSprints.length
      : 0;
    
    // Burndown actual
    const currentSprint = sprints.find(s => s.status === 'active');
    let burndownData = [];
    if (currentSprint) {
      burndownData = await Task.getBurndownData(currentSprint._id);
    }
    
    // Distribución de trabajo
    const workDistribution = teamMembers.map(member => ({
      name: `${member.user.firstName} ${member.user.lastName}`,
      activeTasks: activeTasks.filter(t => t.assignee?.toString() === member._id.toString()).length,
      completedTasks: completedTasks.filter(t => t.assignee?.toString() === member._id.toString()).length,
      storyPoints: activeTasks
        .filter(t => t.assignee?.toString() === member._id.toString())
        .reduce((sum, task) => sum + task.storyPoints, 0),
      workloadPercentage: member.workloadPercentage
    }));
    
    // Impedimentos por estado
    const impedimentStats = {
      total: impediments.length,
      open: impediments.filter(i => i.status === 'open').length,
      inProgress: impediments.filter(i => i.status === 'in_progress').length,
      resolved: impediments.filter(i => i.status === 'resolved').length
    };
    
    // Tiempo promedio de resolución de impedimentos
    const resolvedImpediments = impediments.filter(i => i.status === 'resolved' && i.resolvedDate);
    const avgResolutionTime = resolvedImpediments.length > 0
      ? resolvedImpediments.reduce((sum, imp) => {
          const diffTime = Math.abs(imp.resolvedDate - imp.createdDate);
          return sum + Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }, 0) / resolvedImpediments.length
      : 0;
    
    res.json({
      summary: {
        totalSprints: sprints.length,
        completedSprints: completedSprints.length,
        activeTasks: activeTasks.length,
        completedTasks: completedTasks.length,
        teamMembers: teamMembers.length,
        activeImpediments: impedimentStats.open + impedimentStats.inProgress
      },
      velocity: {
        average: Math.round(velocity * 10) / 10,
        current: currentSprint ? 
          completedTasks
            .filter(t => t.sprint?.toString() === currentSprint._id.toString())
            .reduce((sum, task) => sum + task.storyPoints, 0) : 0,
        trend: 'stable' // Aquí podrías calcular la tendencia comparando con sprints anteriores
      },
      burndown: burndownData,
      workDistribution,
      impediments: {
        ...impedimentStats,
        avgResolutionTime: Math.round(avgResolutionTime * 10) / 10
      },
      productivity: {
        tasksPerSprint: completedSprints.length > 0 
          ? Math.round(completedTasks.length / completedSprints.length * 10) / 10 : 0,
        storyPointsPerSprint: Math.round(velocity * 10) / 10,
        completionRate: tasks.length > 0 
          ? Math.round((completedTasks.length / tasks.length) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Error al obtener métricas del dashboard:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/metricas/velocity - Velocidad del equipo
router.get('/velocity', authenticate, async (req, res) => {
  try {
    const { team, sprints: sprintCount = 5 } = req.query;
    
    // Obtener últimos sprints
    const sprintsQuery = team ? { team } : {};
    const sprints = await Sprint.find(sprintsQuery)
      .sort({ startDate: -1 })
      .limit(parseInt(sprintCount));
    
    const velocityData = await Task.getTeamVelocity(
      [], // teamMemberIds - se calculará internamente
      sprints.map(s => s._id)
    );
    
    res.json({
      sprints: velocityData.map(data => ({
        sprintName: data.sprintInfo.name,
        storyPoints: data.totalStoryPoints,
        taskCount: data.taskCount,
        totalHours: data.totalHours,
        startDate: data.sprintInfo.startDate,
        endDate: data.sprintInfo.endDate
      })),
      average: velocityData.length > 0 
        ? Math.round(velocityData.reduce((sum, d) => sum + d.totalStoryPoints, 0) / velocityData.length * 10) / 10
        : 0,
      trend: velocityData.length >= 2 
        ? velocityData[0].totalStoryPoints > velocityData[1].totalStoryPoints ? 'up' : 'down'
        : 'stable'
    });
  } catch (error) {
    console.error('Error al obtener velocidad del equipo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/metricas/burndown/:sprintId - Burndown chart para un sprint específico
router.get('/burndown/:sprintId', authenticate, async (req, res) => {
  try {
    const { sprintId } = req.params;
    
    const sprint = await Sprint.findById(sprintId);
    if (!sprint) {
      return res.status(404).json({ error: 'Sprint no encontrado' });
    }
    
    const burndownData = await Task.getBurndownData(sprintId);
    
    // Calcular línea ideal
    const totalStoryPoints = burndownData.length > 0 ? burndownData[0].remaining : 0;
    const sprintDuration = Math.ceil((sprint.endDate - sprint.startDate) / (1000 * 60 * 60 * 24));
    
    const idealLine = [];
    for (let day = 0; day <= sprintDuration; day++) {
      const date = new Date(sprint.startDate);
      date.setDate(date.getDate() + day);
      idealLine.push({
        date,
        remaining: totalStoryPoints - (totalStoryPoints * day / sprintDuration)
      });
    }
    
    res.json({
      sprint: {
        name: sprint.name,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        status: sprint.status
      },
      actualBurndown: burndownData,
      idealBurndown: idealLine,
      totalStoryPoints
    });
  } catch (error) {
    console.error('Error al obtener burndown chart:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID de sprint inválido' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/metricas/team-performance - Rendimiento del equipo
router.get('/team-performance', authenticate, async (req, res) => {
  try {
    const { team, period = '30' } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));
    
    const teamQuery = team ? { team, status: 'active' } : { status: 'active' };
    const teamMembers = await TeamMember.find(teamQuery).populate('user');
    
    const performance = await Promise.all(teamMembers.map(async (member) => {
      // Tareas completadas en el período
      const completedTasks = await Task.find({
        assignee: member._id,
        status: 'done',
        completedDate: { $gte: startDate }
      });
      
      // Tareas activas
      const activeTasks = await Task.find({
        assignee: member._id,
        status: { $in: ['todo', 'in_progress', 'code_review', 'testing'] }
      });
      
      // Calcular métricas
      const totalStoryPoints = completedTasks.reduce((sum, task) => sum + task.storyPoints, 0);
      const totalHours = completedTasks.reduce((sum, task) => sum + task.actualHours, 0);
      const avgTaskTime = completedTasks.length > 0 
        ? completedTasks.reduce((sum, task) => sum + task.daysInProgress, 0) / completedTasks.length
        : 0;
      
      return {
        member: {
          id: member._id,
          name: `${member.user.firstName} ${member.user.lastName}`,
          role: member.role,
          avatar: member.user.avatar
        },
        metrics: {
          completedTasks: completedTasks.length,
          activeTasks: activeTasks.length,
          storyPoints: totalStoryPoints,
          hoursWorked: totalHours,
          avgTaskCompletionTime: Math.round(avgTaskTime * 10) / 10,
          workloadPercentage: member.workloadPercentage,
          efficiency: totalHours > 0 ? Math.round((totalStoryPoints / totalHours) * 10) / 10 : 0
        }
      };
    }));
    
    res.json(performance);
  } catch (error) {
    console.error('Error al obtener rendimiento del equipo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/metricas/quality - Métricas de calidad
router.get('/quality', authenticate, async (req, res) => {
  try {
    const { team, period = '30' } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));
    
    // Obtener tareas del período
    const taskQuery = { 
      createdAt: { $gte: startDate }
    };
    
    if (team) {
      const teamMembers = await TeamMember.find({ team }).select('_id');
      taskQuery.assignee = { $in: teamMembers.map(tm => tm._id) };
    }
    
    const tasks = await Task.find(taskQuery);
    
    // Tareas por tipo
    const tasksByType = tasks.reduce((acc, task) => {
      acc[task.type] = (acc[task.type] || 0) + 1;
      return acc;
    }, {});
    
    // Bugs vs features
    const bugs = tasks.filter(t => t.type === 'bug').length;
    const features = tasks.filter(t => t.type === 'story').length;
    const bugRatio = (bugs + features) > 0 ? Math.round((bugs / (bugs + features)) * 100) : 0;
    
    // Tareas reabiertas (que cambiaron de 'done' a otro estado)
    const reopenedTasks = await Task.find({
      ...taskQuery,
      status: { $ne: 'done' },
      completedDate: { $ne: null }
    }).length;
    
    // Tiempo promedio de revisión de código
    const codeReviewTasks = tasks.filter(t => t.status === 'code_review' || t.status === 'done');
    // Aquí podrías calcular el tiempo promedio en code review si tienes un historial de cambios de estado
    
    // Impedimentos relacionados con calidad
    const qualityImpediments = await Impediment.find({
      createdDate: { $gte: startDate },
      category: { $in: ['technical', 'requirements'] }
    });
    
    res.json({
      taskDistribution: tasksByType,
      qualityMetrics: {
        bugRatio,
        reopenedTasks,
        qualityImpediments: qualityImpediments.length,
        defectEscapeRate: bugRatio, // Simplificado
        codeReviewCoverage: Math.round((codeReviewTasks.length / tasks.length) * 100) || 0
      },
      trends: {
        bugsOverTime: [], // Podrías implementar un análisis temporal
        qualityScore: Math.max(0, 100 - bugRatio - (reopenedTasks * 5)) // Score simplificado
      }
    });
  } catch (error) {
    console.error('Error al obtener métricas de calidad:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/metricas/ceremonies - Métricas de ceremonias
router.get('/ceremonies', authenticate, async (req, res) => {
  try {
    const { team, period = '30' } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));
    
    const ceremonyQuery = { 
      date: { $gte: startDate }
    };
    
    const ceremonies = await Ceremony.find(ceremonyQuery)
      .populate('participants.user', 'firstName lastName');
    
    // Estadísticas por tipo de ceremonia
    const ceremonyStats = ceremonies.reduce((acc, ceremony) => {
      const type = ceremony.type;
      if (!acc[type]) {
        acc[type] = {
          total: 0,
          completed: 0,
          avgAttendance: 0,
          totalParticipants: 0
        };
      }
      
      acc[type].total++;
      if (ceremony.status === 'completed') {
        acc[type].completed++;
      }
      
      const attendees = ceremony.participants.filter(p => p.attendance === 'present').length;
      acc[type].totalParticipants += ceremony.participants.length;
      acc[type].avgAttendance += ceremony.participants.length > 0 
        ? (attendees / ceremony.participants.length) * 100 
        : 0;
      
      return acc;
    }, {});
    
    // Calcular promedios
    Object.keys(ceremonyStats).forEach(type => {
      const stat = ceremonyStats[type];
      stat.completionRate = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;
      stat.avgAttendance = stat.total > 0 ? Math.round(stat.avgAttendance / stat.total) : 0;
    });
    
    // Próximas ceremonias
    const upcomingCeremonies = await Ceremony.find({
      date: { $gte: new Date() },
      status: 'scheduled'
    }).sort({ date: 1 }).limit(5);
    
    res.json({
      ceremonyStats,
      totalCeremonies: ceremonies.length,
      completedCeremonies: ceremonies.filter(c => c.status === 'completed').length,
      upcomingCeremonies: upcomingCeremonies.map(c => ({
        type: c.type,
        title: c.title,
        date: c.date,
        startTime: c.startTime,
        duration: c.duration,
        participantCount: c.participants.length
      }))
    });
  } catch (error) {
    console.error('Error al obtener métricas de ceremonias:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/metricas/reports/sprint/:sprintId - Reporte completo de sprint
router.get('/reports/sprint/:sprintId', authenticate, async (req, res) => {
  try {
    const { sprintId } = req.params;
    
    const sprint = await Sprint.findById(sprintId);
    if (!sprint) {
      return res.status(404).json({ error: 'Sprint no encontrado' });
    }
    
    // Obtener todas las tareas del sprint
    const tasks = await Task.find({ sprint: sprintId })
      .populate('assignee')
      .populate('reporter', 'firstName lastName');
    
    // Obtener ceremonias del sprint
    const ceremonies = await Ceremony.find({
      date: { $gte: sprint.startDate, $lte: sprint.endDate }
    });
    
    // Obtener impedimentos del sprint
    const impediments = await Impediment.find({
      createdDate: { $gte: sprint.startDate, $lte: sprint.endDate }
    });
    
    // Calcular métricas del sprint
    const completedTasks = tasks.filter(t => t.status === 'done');
    const totalStoryPoints = tasks.reduce((sum, task) => sum + task.storyPoints, 0);
    const completedStoryPoints = completedTasks.reduce((sum, task) => sum + task.storyPoints, 0);
    
    const report = {
      sprint: {
        name: sprint.name,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        status: sprint.status,
        goal: sprint.goal
      },
      summary: {
        totalTasks: tasks.length,
        completedTasks: completedTasks.length,
        totalStoryPoints,
        completedStoryPoints,
        completionRate: totalStoryPoints > 0 ? Math.round((completedStoryPoints / totalStoryPoints) * 100) : 0
      },
      taskBreakdown: {
        byStatus: tasks.reduce((acc, task) => {
          acc[task.status] = (acc[task.status] || 0) + 1;
          return acc;
        }, {}),
        byType: tasks.reduce((acc, task) => {
          acc[task.type] = (acc[task.type] || 0) + 1;
          return acc;
        }, {}),
        byPriority: tasks.reduce((acc, task) => {
          acc[task.priority] = (acc[task.priority] || 0) + 1;
          return acc;
        }, {})
      },
      teamPerformance: tasks.reduce((acc, task) => {
        if (task.assignee) {
          const assigneeName = `${task.assignee.user?.firstName || ''} ${task.assignee.user?.lastName || ''}`.trim();
          if (!acc[assigneeName]) {
            acc[assigneeName] = {
              assigned: 0,
              completed: 0,
              storyPoints: 0
            };
          }
          acc[assigneeName].assigned++;
          if (task.status === 'done') {
            acc[assigneeName].completed++;
            acc[assigneeName].storyPoints += task.storyPoints;
          }
        }
        return acc;
      }, {}),
      ceremonies: {
        total: ceremonies.length,
        completed: ceremonies.filter(c => c.status === 'completed').length,
        types: ceremonies.reduce((acc, ceremony) => {
          acc[ceremony.type] = (acc[ceremony.type] || 0) + 1;
          return acc;
        }, {})
      },
      impediments: {
        total: impediments.length,
        resolved: impediments.filter(i => i.status === 'resolved').length,
        byCategory: impediments.reduce((acc, imp) => {
          acc[imp.category] = (acc[imp.category] || 0) + 1;
          return acc;
        }, {})
      }
    };
    
    res.json(report);
  } catch (error) {
    console.error('Error al generar reporte de sprint:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID de sprint inválido' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
