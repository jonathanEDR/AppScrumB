/**
 * agentAuth - Middleware de autenticación y autorización para agentes AI
 * Verifica que el usuario está autenticado y tiene delegación activa para usar el agente
 */

const Agent = require('../models/Agent');
const AgentPermissionService = require('../services/AgentPermissionService');
const { authenticate } = require('../../../middleware/authenticate');

/**
 * Middleware principal: autenticación + verificación de delegación
 * Combina la autenticación normal con verificación de permisos de agente
 */
const agentAuth = async (req, res, next) => {
  try {
    // 1. Primero autenticar al usuario normalmente
    await new Promise((resolve, reject) => {
      authenticate(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 2. Verificar que el usuario está autenticado
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        code: 'AUTH_REQUIRED',
        message: 'Usuario no autenticado'
      });
    }

    // 3. Obtener agent_id de los parámetros o body
    const agentId = req.params.agent_id || req.body.agent_id || req.query.agent_id;

    if (!agentId) {
      return res.status(400).json({
        status: 'error',
        code: 'AGENT_ID_REQUIRED',
        message: 'Se requiere agent_id'
      });
    }

    // 4. Verificar que el agente existe y está activo
    const agent = await Agent.findById(agentId);

    if (!agent) {
      return res.status(404).json({
        status: 'error',
        code: 'AGENT_NOT_FOUND',
        message: 'Agente no encontrado'
      });
    }

    if (agent.status !== 'active') {
      return res.status(403).json({
        status: 'error',
        code: 'AGENT_INACTIVE',
        message: `El agente está en estado: ${agent.status}`
      });
    }

    // 5. Verificar que el usuario puede usar este agente (según rol)
    if (!agent.canBeUsedBy(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        code: 'AGENT_NOT_ALLOWED_FOR_ROLE',
        message: `Tu rol (${req.user.role}) no puede usar este agente`,
        allowed_roles: agent.limitations.allowed_roles
      });
    }

    // 6. Verificar que existe una delegación activa
    const hasActiveDelegation = await AgentPermissionService.hasActiveDelegation(
      req.user._id,
      agentId
    );

    if (!hasActiveDelegation) {
      return res.status(403).json({
        status: 'error',
        code: 'NO_ACTIVE_DELEGATION',
        message: 'No tienes una delegación activa para este agente',
        hint: 'Debes delegar permisos al agente antes de usarlo'
      });
    }

    // 7. Obtener la delegación completa
    const delegation = await AgentPermissionService.getActiveDelegation(
      req.user._id,
      agentId
    );

    // 8. Verificar límites del agente (rate limiting a nivel de agente)
    const agentLimitCheck = await agent.hasReachedLimit('hourly');
    if (agentLimitCheck) {
      return res.status(429).json({
        status: 'error',
        code: 'AGENT_RATE_LIMIT_REACHED',
        message: 'El agente ha alcanzado su límite de uso por hora'
      });
    }

    // 9. Agregar información al request para uso posterior
    req.agent = agent;
    req.delegation = delegation;

    // Log de auditoría
    console.log(`[AgentAuth] Usuario ${req.user.email} usando agente ${agent.name}`);

    next();

  } catch (error) {
    console.error('Error en agentAuth middleware:', error);
    return res.status(500).json({
      status: 'error',
      code: 'AUTH_ERROR',
      message: 'Error en autenticación de agente',
      error: error.message
    });
  }
};

/**
 * Middleware para verificar un permiso específico
 * Uso: agentRequirePermission('canCreateBacklogItems')
 */
const agentRequirePermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      if (!req.delegation) {
        return res.status(403).json({
          status: 'error',
          code: 'NO_DELEGATION',
          message: 'No hay delegación activa'
        });
      }

      if (!req.delegation.hasPermission(permissionKey)) {
        return res.status(403).json({
          status: 'error',
          code: 'PERMISSION_DENIED',
          message: `La delegación no tiene el permiso: ${permissionKey}`,
          required_permission: permissionKey
        });
      }

      next();
    } catch (error) {
      console.error('Error en agentRequirePermission:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  };
};

/**
 * Middleware para verificar que se puede ejecutar una acción específica
 * Uso: agentCanPerformAction('create_backlog_item')
 */
const agentCanPerformAction = (actionType) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.agent) {
        return res.status(403).json({
          status: 'error',
          message: 'Autenticación de agente requerida'
        });
      }

      // Obtener contexto de la acción
      const context = {
        product_id: req.body.product_id || req.params.product_id || req.query.product_id,
        sprint_id: req.body.sprint_id || req.params.sprint_id
      };

      // Verificar si puede realizar la acción
      const permissionCheck = await AgentPermissionService.canPerformAction(
        req.user._id,
        req.agent._id,
        actionType,
        context
      );

      if (!permissionCheck.allowed) {
        return res.status(403).json({
          status: 'error',
          code: permissionCheck.reason,
          message: permissionCheck.message
        });
      }

      // Agregar información al request
      req.actionPermissionCheck = permissionCheck;

      next();
    } catch (error) {
      console.error('Error en agentCanPerformAction:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  };
};

/**
 * Middleware para verificar alcance de producto
 * Verifica que el agente tiene acceso al producto especificado
 */
const agentCanAccessProduct = async (req, res, next) => {
  try {
    if (!req.delegation) {
      return res.status(403).json({
        status: 'error',
        message: 'No hay delegación activa'
      });
    }

    const productId = req.body.product_id || req.params.product_id || req.query.product_id;

    if (!productId) {
      return res.status(400).json({
        status: 'error',
        message: 'product_id es requerido'
      });
    }

    if (!req.delegation.canAccessProduct(productId)) {
      return res.status(403).json({
        status: 'error',
        code: 'PRODUCT_NOT_IN_SCOPE',
        message: 'El agente no tiene acceso a este producto',
        allowed_products: req.delegation.scope.products
      });
    }

    next();
  } catch (error) {
    console.error('Error en agentCanAccessProduct:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Middleware para verificar límites de uso
 * Previene exceso de uso (rate limiting a nivel de delegación)
 */
const agentCheckLimits = async (req, res, next) => {
  try {
    if (!req.delegation) {
      return res.status(403).json({
        status: 'error',
        message: 'No hay delegación activa'
      });
    }

    const limitsCheck = await req.delegation.checkLimits();

    if (!limitsCheck.allowed) {
      return res.status(429).json({
        status: 'error',
        code: limitsCheck.reason,
        message: limitsCheck.message
      });
    }

    next();
  } catch (error) {
    console.error('Error en agentCheckLimits:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Middleware combinado: verificación completa para acciones
 * Uso: agentFullAuth(actionType)
 */
const agentFullAuth = (actionType) => {
  return [
    agentAuth,
    agentCheckLimits,
    agentCanPerformAction(actionType)
  ];
};

module.exports = {
  agentAuth,
  agentRequirePermission,
  agentCanPerformAction,
  agentCanAccessProduct,
  agentCheckLimits,
  agentFullAuth
};
