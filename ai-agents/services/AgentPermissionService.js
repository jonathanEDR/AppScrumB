/**
 * AgentPermissionService - Sistema de gestión de permisos para agentes
 * Controla qué puede hacer cada agente según la delegación del usuario
 */

const Agent = require('../models/Agent');
const AgentDelegation = require('../models/AgentDelegation');
const { RolePermissionsService } = require('../../services/rolePermissionsService');

class AgentPermissionService {
  /**
   * Crear una nueva delegación de permisos
   */
  static async createDelegation(userId, agentId, permissions, scope = {}) {
    try {
      // Verificar que el agente existe
      const agent = await Agent.findById(agentId);
      if (!agent) {
        throw new Error('Agente no encontrado');
      }

      // Verificar que el agente está activo
      if (agent.status !== 'active') {
        throw new Error(`El agente está en estado: ${agent.status}`);
      }

      // Verificar que no existe una delegación activa
      const existingDelegation = await AgentDelegation.findOne({
        user_id: userId,
        agent_id: agentId,
        status: 'active'
      });

      if (existingDelegation) {
        throw new Error('Ya existe una delegación activa para este agente. Revócala primero.');
      }

      // Formatear permisos
      const formattedPermissions = permissions.map(p => ({
        permission_key: typeof p === 'string' ? p : p.permission_key,
        permission_name: typeof p === 'string' ? this.getPermissionName(p) : p.permission_name,
        granted_at: new Date()
      }));

      // Crear delegación
      const delegation = new AgentDelegation({
        user_id: userId,
        agent_id: agentId,
        delegated_permissions: formattedPermissions,
        scope: {
          products: scope.products || [],
          all_products: scope.all_products !== undefined ? scope.all_products : true,
          sprints: scope.sprints || [],
          max_actions_per_hour: scope.max_actions_per_hour || 50,
          max_actions_per_day: scope.max_actions_per_day || 200,
          max_cost_per_day: scope.max_cost_per_day || 5,
          can_create: scope.can_create !== undefined ? scope.can_create : true,
          can_edit: scope.can_edit !== undefined ? scope.can_edit : true,
          can_delete: scope.can_delete !== undefined ? scope.can_delete : false,
          requires_approval: scope.requires_approval || false
        },
        status: 'active',
        valid_from: scope.valid_from || new Date(),
        valid_until: scope.valid_until || null,
        created_by: userId,
        updated_by: userId
      });

      // Agregar al historial
      delegation.change_history.push({
        change_type: 'created',
        description: 'Delegación creada',
        changed_by: userId
      });

      await delegation.save();

      return delegation;
    } catch (error) {
      console.error('Error creando delegación:', error);
      throw error;
    }
  }

  /**
   * Verificar si un usuario tiene una delegación activa para un agente
   */
  static async hasActiveDelegation(userId, agentId) {
    const delegation = await AgentDelegation.getActiveDelegation(userId, agentId);
    return !!delegation && delegation.isValid();
  }

  /**
   * Obtener delegación activa
   */
  static async getActiveDelegation(userId, agentId) {
    const delegation = await AgentDelegation.getActiveDelegation(userId, agentId);
    
    if (!delegation) {
      return null;
    }

    // Verificar validez
    if (!delegation.isValid()) {
      return null;
    }

    return delegation;
  }

  /**
   * Verificar si la delegación permite una acción específica
   */
  static async canPerformAction(userId, agentId, actionType, context = {}) {
    try {
      // Obtener delegación activa
      const delegation = await this.getActiveDelegation(userId, agentId);
      
      if (!delegation) {
        return {
          allowed: false,
          reason: 'no_active_delegation',
          message: 'No hay una delegación activa para este agente'
        };
      }

      // Verificar límites (rate limiting)
      const limitsCheck = await delegation.checkLimits();
      if (!limitsCheck.allowed) {
        return limitsCheck;
      }

      // Verificar permisos específicos según el tipo de acción
      const requiredPermission = this.getRequiredPermission(actionType);
      
      if (requiredPermission && !delegation.hasPermission(requiredPermission)) {
        return {
          allowed: false,
          reason: 'insufficient_permissions',
          message: `Permiso requerido: ${requiredPermission}`
        };
      }

      // Verificar alcance (scope) - productos
      if (context.product_id) {
        if (!delegation.canAccessProduct(context.product_id)) {
          return {
            allowed: false,
            reason: 'product_not_in_scope',
            message: 'El agente no tiene acceso a este producto'
          };
        }
      }

      // Verificar restricciones según el tipo de operación
      const operation = this.getOperationType(actionType);
      
      if (operation === 'create' && !delegation.scope.can_create) {
        return {
          allowed: false,
          reason: 'create_not_allowed',
          message: 'La delegación no permite crear elementos'
        };
      }

      if (operation === 'edit' && !delegation.scope.can_edit) {
        return {
          allowed: false,
          reason: 'edit_not_allowed',
          message: 'La delegación no permite editar elementos'
        };
      }

      if (operation === 'delete' && !delegation.scope.can_delete) {
        return {
          allowed: false,
          reason: 'delete_not_allowed',
          message: 'La delegación no permite eliminar elementos'
        };
      }

      // Todo OK
      return {
        allowed: true,
        delegation,
        requires_approval: delegation.scope.requires_approval
      };

    } catch (error) {
      console.error('Error verificando permisos de agente:', error);
      return {
        allowed: false,
        reason: 'verification_error',
        message: error.message
      };
    }
  }

  /**
   * Revocar una delegación
   */
  static async revokeDelegation(delegationId, revokedBy, reason = 'Revocado por el usuario') {
    const delegation = await AgentDelegation.findById(delegationId);
    
    if (!delegation) {
      throw new Error('Delegación no encontrada');
    }

    if (delegation.status === 'revoked') {
      throw new Error('La delegación ya está revocada');
    }

    await delegation.revoke(reason, revokedBy);
    
    return delegation;
  }

  /**
   * Suspender una delegación temporalmente
   */
  static async suspendDelegation(delegationId, suspendedBy, reason = 'Suspendido temporalmente') {
    const delegation = await AgentDelegation.findById(delegationId);
    
    if (!delegation) {
      throw new Error('Delegación no encontrada');
    }

    if (delegation.status !== 'active') {
      throw new Error('Solo se pueden suspender delegaciones activas');
    }

    await delegation.suspend(reason, suspendedBy);
    
    return delegation;
  }

  /**
   * Reactivar una delegación suspendida
   */
  static async reactivateDelegation(delegationId, reactivatedBy) {
    const delegation = await AgentDelegation.findById(delegationId);
    
    if (!delegation) {
      throw new Error('Delegación no encontrada');
    }

    await delegation.reactivate(reactivatedBy);
    
    return delegation;
  }

  /**
   * Obtener delegaciones de un usuario
   */
  static async getUserDelegations(userId, status = 'active') {
    return await AgentDelegation.getUserDelegations(userId, status);
  }

  /**
   * Actualizar alcance de una delegación
   */
  static async updateDelegationScope(delegationId, updatedBy, newScope) {
    const delegation = await AgentDelegation.findById(delegationId);
    
    if (!delegation) {
      throw new Error('Delegación no encontrada');
    }

    const previousScope = { ...delegation.scope };

    // Actualizar scope
    Object.assign(delegation.scope, newScope);
    delegation.updated_by = updatedBy;

    // Agregar al historial
    delegation.change_history.push({
      change_type: 'updated',
      description: 'Alcance actualizado',
      changed_by: updatedBy,
      previous_state: { scope: previousScope }
    });

    await delegation.save();

    return delegation;
  }

  /**
   * Registrar uso de delegación
   */
  static async recordDelegationUse(delegationId, success, cost = 0) {
    const delegation = await AgentDelegation.findById(delegationId);
    
    if (delegation) {
      await delegation.recordAction(success, cost);
    }
  }

  /**
   * Obtener nombre legible de un permiso
   */
  static getPermissionName(permissionKey) {
    const names = {
      'canCreateBacklogItems': 'Crear items de backlog',
      'canEditBacklogItems': 'Editar items de backlog',
      'canDeleteBacklogItems': 'Eliminar items de backlog',
      'canPrioritizeBacklog': 'Priorizar backlog',
      'canCreateSprints': 'Crear sprints',
      'canEditSprints': 'Editar sprints',
      'canCloseSprints': 'Cerrar sprints',
      'canCreateProducts': 'Crear productos',
      'canEditProducts': 'Editar productos',
      'canViewMetrics': 'Ver métricas',
      'canGenerateReports': 'Generar reportes'
    };

    return names[permissionKey] || permissionKey;
  }

  /**
   * Obtener permiso requerido según el tipo de acción
   */
  static getRequiredPermission(actionType) {
    const permissions = {
      'create_backlog_item': 'canCreateBacklogItems',
      'update_backlog_item': 'canEditBacklogItems',
      'delete_backlog_item': 'canDeleteBacklogItems',
      'prioritize_backlog': 'canPrioritizeBacklog',
      'refine_user_story': 'canEditBacklogItems',
      'generate_acceptance_criteria': 'canEditBacklogItems',
      'create_sprint': 'canCreateSprints',
      'update_sprint': 'canEditSprints',
      'plan_sprint': 'canEditSprints',
      'generate_sprint_goal': 'canEditSprints',
      'create_product': 'canCreateProducts',
      'update_product': 'canEditProducts',
      'analyze_backlog': 'canViewMetrics',
      'analyze_business_value': 'canViewMetrics',
      'suggest_releases': 'canViewMetrics',
      'generate_report': 'canGenerateReports'
    };

    return permissions[actionType] || null;
  }

  /**
   * Obtener tipo de operación según el tipo de acción
   */
  static getOperationType(actionType) {
    if (actionType.startsWith('create_')) return 'create';
    if (actionType.startsWith('update_') || actionType.startsWith('edit_')) return 'edit';
    if (actionType.startsWith('delete_')) return 'delete';
    if (actionType.startsWith('analyze_') || actionType.startsWith('generate_')) return 'read';
    return 'other';
  }

  /**
   * Verificar que el usuario tiene los permisos base para delegar
   */
  static async canUserDelegatePermissions(user, permissionsToDelegate) {
    // El usuario debe tener los permisos que quiere delegar
    const userPermissions = RolePermissionsService.getPermissions(user.role);

    for (const permission of permissionsToDelegate) {
      const permKey = typeof permission === 'string' ? permission : permission.permission_key;
      
      if (!userPermissions[permKey]) {
        return {
          allowed: false,
          missing_permission: permKey,
          message: `No tienes el permiso ${permKey} para delegarlo`
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Limpiar delegaciones expiradas (ejecutar periódicamente)
   */
  static async cleanupExpiredDelegations() {
    const count = await AgentDelegation.expireOldDelegations();
    console.log(`Delegaciones expiradas limpiadas: ${count}`);
    return count;
  }

  /**
   * Obtener permisos disponibles para delegar según el tipo de agente
   */
  static getAvailablePermissionsForAgentType(agentType) {
    const permissions = {
      product_owner: [
        { key: 'canCreateBacklogItems', name: 'Crear items de backlog', default: true },
        { key: 'canEditBacklogItems', name: 'Editar items de backlog', default: true },
        { key: 'canDeleteBacklogItems', name: 'Eliminar items de backlog', default: false },
        { key: 'canPrioritizeBacklog', name: 'Priorizar backlog', default: true },
        { key: 'canCreateSprints', name: 'Crear sprints', default: true },
        { key: 'canEditSprints', name: 'Editar sprints', default: true },
        { key: 'canCreateProducts', name: 'Crear productos', default: false },
        { key: 'canEditProducts', name: 'Editar productos', default: true },
        { key: 'canViewMetrics', name: 'Ver métricas', default: true },
        { key: 'canGenerateReports', name: 'Generar reportes', default: true }
      ],
      scrum_master: [
        { key: 'canCreateBacklogItems', name: 'Crear items de backlog', default: false },
        { key: 'canEditBacklogItems', name: 'Editar items de backlog', default: true },
        { key: 'canCreateSprints', name: 'Crear sprints', default: true },
        { key: 'canEditSprints', name: 'Editar sprints', default: true },
        { key: 'canCloseSprints', name: 'Cerrar sprints', default: true },
        { key: 'canViewMetrics', name: 'Ver métricas', default: true }
      ],
      developer: [
        { key: 'canEditBacklogItems', name: 'Editar items asignados', default: true },
        { key: 'canViewMetrics', name: 'Ver métricas propias', default: true }
      ]
    };

    return permissions[agentType] || [];
  }
}

module.exports = AgentPermissionService;
