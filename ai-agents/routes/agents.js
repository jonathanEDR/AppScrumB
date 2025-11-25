/**
 * Rutas para gestión de agentes AI
 * CRUD completo de agentes y delegación de permisos
 */

const express = require('express');
const router = express.Router();
const Agent = require('../models/Agent');
const AgentDelegation = require('../models/AgentDelegation');
const AgentAction = require('../models/AgentAction');
const AgentPermissionService = require('../services/AgentPermissionService');
const { authenticate, authorize } = require('../../middleware/authenticate');

// Middlewares de autorización
const requireSuperAdmin = authorize('super_admin');
const requireProductOwner = authorize('product_owner', 'super_admin');

// ============= RUTAS DE AGENTES =============

/**
 * GET /api/ai-agents/agents
 * Listar todos los agentes disponibles
 */
router.get('/agents', authenticate, async (req, res) => {
  try {
    const { status = 'active', type } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    
    // Si no es super_admin, solo mostrar agentes que puede usar según su rol
    if (req.user.role !== 'super_admin') {
      filter['limitations.allowed_roles'] = req.user.role;
    }
    
    const agents = await Agent.find(filter)
      .select('-system_prompt -training') // Ocultar detalles sensibles
      .sort({ type: 1, name: 1 });
    
    // Agregar información de si el usuario tiene delegación activa
    const agentsWithDelegationStatus = await Promise.all(
      agents.map(async (agent) => {
        const hasDelegation = await AgentPermissionService.hasActiveDelegation(
          req.user._id,
          agent._id
        );
        
        return {
          ...agent.toObject(),
          has_active_delegation: hasDelegation
        };
      })
    );
    
    res.json({
      status: 'success',
      agents: agentsWithDelegationStatus,
      total: agentsWithDelegationStatus.length
    });
  } catch (error) {
    console.error('Error listando agentes:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al listar agentes',
      error: error.message
    });
  }
});

/**
 * GET /api/ai-agents/agents/:id
 * Obtener detalles de un agente específico
 */
router.get('/agents/:id', authenticate, async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);
    
    if (!agent) {
      return res.status(404).json({
        status: 'error',
        message: 'Agente no encontrado'
      });
    }
    
    // Verificar que el usuario puede ver este agente
    if (req.user.role !== 'super_admin' && !agent.canBeUsedBy(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para ver este agente'
      });
    }
    
    // Obtener delegación activa si existe
    const delegation = await AgentPermissionService.getActiveDelegation(
      req.user._id,
      agent._id
    );
    
    // Ocultar system_prompt si no es super_admin
    const agentData = agent.toObject();
    if (req.user.role !== 'super_admin') {
      delete agentData.system_prompt;
      delete agentData.training;
    }
    
    res.json({
      status: 'success',
      agent: agentData,
      delegation: delegation || null
    });
  } catch (error) {
    console.error('Error obteniendo agente:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener agente',
      error: error.message
    });
  }
});

/**
 * POST /api/ai-agents/agents
 * Crear un nuevo agente (solo super_admin)
 */
router.post('/agents', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const {
      name,
      display_name,
      type,
      description,
      configuration,
      system_prompt,
      capabilities,
      context_requirements,
      limitations
    } = req.body;
    
    // Validar datos requeridos
    if (!name || !display_name || !type || !description || !system_prompt) {
      return res.status(400).json({
        status: 'error',
        message: 'Campos requeridos: name, display_name, type, description, system_prompt'
      });
    }
    
    // Verificar que no existe un agente con el mismo nombre
    const existingAgent = await Agent.findOne({ name });
    if (existingAgent) {
      return res.status(409).json({
        status: 'error',
        message: 'Ya existe un agente con ese nombre'
      });
    }
    
    const agent = new Agent({
      name,
      display_name,
      type,
      description,
      configuration: configuration || {},
      system_prompt,
      capabilities: capabilities || [],
      context_requirements: context_requirements || {},
      limitations: limitations || {},
      created_by: req.user._id,
      updated_by: req.user._id
    });
    
    await agent.save();
    
    res.status(201).json({
      status: 'success',
      message: 'Agente creado exitosamente',
      agent
    });
  } catch (error) {
    console.error('Error creando agente:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al crear agente',
      error: error.message
    });
  }
});

/**
 * PUT /api/ai-agents/agents/:id
 * Actualizar un agente existente (solo super_admin)
 */
router.put('/agents/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);
    
    if (!agent) {
      return res.status(404).json({
        status: 'error',
        message: 'Agente no encontrado'
      });
    }
    
    // No permitir actualizar agentes del sistema
    if (agent.is_system_agent) {
      return res.status(403).json({
        status: 'error',
        message: 'No se puede modificar un agente del sistema'
      });
    }
    
    const allowedUpdates = [
      'display_name', 'description', 'status', 'configuration',
      'system_prompt', 'capabilities', 'context_requirements', 'limitations'
    ];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        agent[field] = req.body[field];
      }
    });
    
    agent.updated_by = req.user._id;
    await agent.save();
    
    res.json({
      status: 'success',
      message: 'Agente actualizado exitosamente',
      agent
    });
  } catch (error) {
    console.error('Error actualizando agente:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar agente',
      error: error.message
    });
  }
});

/**
 * DELETE /api/ai-agents/agents/:id
 * Eliminar un agente (solo super_admin)
 */
router.delete('/agents/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);
    
    if (!agent) {
      return res.status(404).json({
        status: 'error',
        message: 'Agente no encontrado'
      });
    }
    
    // No permitir eliminar agentes del sistema
    if (agent.is_system_agent) {
      return res.status(403).json({
        status: 'error',
        message: 'No se puede eliminar un agente del sistema'
      });
    }
    
    // Verificar si tiene delegaciones activas
    const activeDelegations = await AgentDelegation.find({
      agent_id: agent._id,
      status: 'active'
    });
    
    if (activeDelegations.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No se puede eliminar un agente con delegaciones activas',
        active_delegations_count: activeDelegations.length
      });
    }
    
    // Cambiar estado a deprecated en lugar de eliminar
    agent.status = 'deprecated';
    await agent.save();
    
    res.json({
      status: 'success',
      message: 'Agente marcado como deprecated'
    });
  } catch (error) {
    console.error('Error eliminando agente:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al eliminar agente',
      error: error.message
    });
  }
});

// ============= RUTAS DE DELEGACIÓN DE PERMISOS =============

/**
 * POST /api/ai-agents/delegate
 * Delegar permisos a un agente
 */
router.post('/delegate', authenticate, async (req, res) => {
  try {
    const { agent_id, permissions, scope } = req.body;
    
    if (!agent_id || !permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere agent_id y permissions (array)'
      });
    }
    
    // Verificar que el usuario tiene los permisos que quiere delegar
    const canDelegate = await AgentPermissionService.canUserDelegatePermissions(
      req.user,
      permissions
    );
    
    if (!canDelegate.allowed) {
      return res.status(403).json({
        status: 'error',
        message: canDelegate.message,
        missing_permission: canDelegate.missing_permission
      });
    }
    
    // Crear delegación
    const delegation = await AgentPermissionService.createDelegation(
      req.user._id,
      agent_id,
      permissions,
      scope || {}
    );
    
    await delegation.populate('agent_id', 'name display_name type');
    
    res.status(201).json({
      status: 'success',
      message: 'Delegación creada exitosamente',
      delegation
    });
  } catch (error) {
    console.error('Error creando delegación:', error);
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * GET /api/ai-agents/my-delegations
 * Obtener delegaciones del usuario actual
 */
router.get('/my-delegations', authenticate, async (req, res) => {
  try {
    const { status = 'active' } = req.query;
    
    const delegations = await AgentPermissionService.getUserDelegations(
      req.user._id,
      status
    );
    
    res.json({
      status: 'success',
      delegations,
      total: delegations.length
    });
  } catch (error) {
    console.error('Error obteniendo delegaciones:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener delegaciones',
      error: error.message
    });
  }
});

/**
 * DELETE /api/ai-agents/delegate/:id
 * Revocar una delegación
 */
router.delete('/delegate/:id', authenticate, async (req, res) => {
  try {
    const delegation = await AgentDelegation.findById(req.params.id);
    
    if (!delegation) {
      return res.status(404).json({
        status: 'error',
        message: 'Delegación no encontrada'
      });
    }
    
    // Verificar que es el dueño de la delegación o super_admin
    if (delegation.user_id.toString() !== req.user._id.toString() && 
        req.user.role !== 'super_admin') {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para revocar esta delegación'
      });
    }
    
    await AgentPermissionService.revokeDelegation(
      req.params.id,
      req.user._id,
      req.body.reason || 'Revocado por el usuario'
    );
    
    res.json({
      status: 'success',
      message: 'Delegación revocada exitosamente'
    });
  } catch (error) {
    console.error('Error revocando delegación:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * PUT /api/ai-agents/delegate/:id/suspend
 * Suspender temporalmente una delegación
 */
router.put('/delegate/:id/suspend', authenticate, async (req, res) => {
  try {
    const delegation = await AgentDelegation.findById(req.params.id);
    
    if (!delegation) {
      return res.status(404).json({
        status: 'error',
        message: 'Delegación no encontrada'
      });
    }
    
    // Verificar permisos
    if (delegation.user_id.toString() !== req.user._id.toString() && 
        req.user.role !== 'super_admin') {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para suspender esta delegación'
      });
    }
    
    await AgentPermissionService.suspendDelegation(
      req.params.id,
      req.user._id,
      req.body.reason || 'Suspendido temporalmente'
    );
    
    res.json({
      status: 'success',
      message: 'Delegación suspendida exitosamente'
    });
  } catch (error) {
    console.error('Error suspendiendo delegación:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * PUT /api/ai-agents/delegate/:id/reactivate
 * Reactivar una delegación suspendida
 */
router.put('/delegate/:id/reactivate', authenticate, async (req, res) => {
  try {
    const delegation = await AgentDelegation.findById(req.params.id);
    
    if (!delegation) {
      return res.status(404).json({
        status: 'error',
        message: 'Delegación no encontrada'
      });
    }
    
    // Verificar permisos
    if (delegation.user_id.toString() !== req.user._id.toString() && 
        req.user.role !== 'super_admin') {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permiso para reactivar esta delegación'
      });
    }
    
    await AgentPermissionService.reactivateDelegation(
      req.params.id,
      req.user._id
    );
    
    res.json({
      status: 'success',
      message: 'Delegación reactivada exitosamente'
    });
  } catch (error) {
    console.error('Error reactivando delegación:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * GET /api/ai-agents/available-permissions/:agentType
 * Obtener permisos disponibles para un tipo de agente
 */
router.get('/available-permissions/:agentType', authenticate, async (req, res) => {
  try {
    const permissions = AgentPermissionService.getAvailablePermissionsForAgentType(
      req.params.agentType
    );
    
    res.json({
      status: 'success',
      agent_type: req.params.agentType,
      permissions
    });
  } catch (error) {
    console.error('Error obteniendo permisos disponibles:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// ============= RUTAS DE AUDITORÍA =============

/**
 * GET /api/ai-agents/actions/my-actions
 * Obtener acciones ejecutadas por agentes del usuario actual
 */
router.get('/actions/my-actions', authenticate, async (req, res) => {
  try {
    const { limit = 50, page = 1, agent_id } = req.query;
    const skip = (page - 1) * limit;
    
    const filter = { user_id: req.user._id };
    if (agent_id) filter.agent_id = agent_id;
    
    const [actions, total] = await Promise.all([
      AgentAction.find(filter)
        .populate('agent_id', 'name display_name type')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AgentAction.countDocuments(filter)
    ]);
    
    res.json({
      status: 'success',
      actions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error obteniendo acciones:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * GET /api/ai-agents/metrics/my-usage
 * Métricas de uso de agentes del usuario actual
 */
router.get('/metrics/my-usage', authenticate, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calcular fecha de inicio según el período
    const now = new Date();
    let startDate;
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    const metrics = await AgentAction.aggregate([
      {
        $match: {
          user_id: req.user._id,
          created_at: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          total_actions: { $sum: 1 },
          successful_actions: {
            $sum: { $cond: [{ $eq: ['$result.status', 'success'] }, 1, 0] }
          },
          failed_actions: {
            $sum: { $cond: [{ $eq: ['$result.status', 'failure'] }, 1, 0] }
          },
          total_tokens: { $sum: '$metrics.tokens_used.total_tokens' },
          total_cost: { $sum: '$metrics.cost' }
        }
      }
    ]);
    
    const result = metrics[0] || {
      total_actions: 0,
      successful_actions: 0,
      failed_actions: 0,
      total_tokens: 0,
      total_cost: 0
    };
    
    res.json({
      status: 'success',
      period,
      metrics: result
    });
  } catch (error) {
    console.error('Error obteniendo métricas:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;
