const mongoose = require('mongoose');

/**
 * Modelo AgentDelegation - Sistema de delegación de permisos
 * Permite a los usuarios delegar permisos específicos a los agentes
 */
const AgentDelegationSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    description: 'Usuario que delega los permisos'
  },
  agent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
    description: 'Agente que recibe los permisos'
  },
  
  // Permisos delegados
  delegated_permissions: [{
    permission_key: {
      type: String,
      required: true,
      description: 'Clave del permiso (canCreateBacklogItems, canEditBacklog, etc.)'
    },
    permission_name: {
      type: String,
      required: true,
      description: 'Nombre legible del permiso'
    },
    granted_at: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Alcance y limitaciones de la delegación
  scope: {
    // Limitación por productos
    products: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      description: 'Productos específicos donde aplica la delegación'
    }],
    all_products: {
      type: Boolean,
      default: false,
      description: 'Si aplica a todos los productos del usuario'
    },
    
    // Limitación por sprints
    sprints: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sprint'
    }],
    
    // Limitaciones de uso
    max_actions_per_hour: {
      type: Number,
      default: 50,
      description: 'Máximo de acciones por hora'
    },
    max_actions_per_day: {
      type: Number,
      default: 200,
      description: 'Máximo de acciones por día'
    },
    max_cost_per_day: {
      type: Number,
      default: 5,
      description: 'Costo máximo diario en USD'
    },
    
    // Restricciones específicas
    can_create: {
      type: Boolean,
      default: true,
      description: 'Puede crear nuevos elementos'
    },
    can_edit: {
      type: Boolean,
      default: true,
      description: 'Puede editar elementos existentes'
    },
    can_delete: {
      type: Boolean,
      default: false,
      description: 'Puede eliminar elementos'
    },
    requires_approval: {
      type: Boolean,
      default: false,
      description: 'Acciones requieren aprobación antes de ejecutarse'
    }
  },
  
  // Estado de la delegación
  status: {
    type: String,
    enum: ['active', 'suspended', 'revoked', 'expired'],
    default: 'active',
    description: 'Estado actual de la delegación'
  },
  
  // Vigencia temporal
  valid_from: {
    type: Date,
    default: Date.now,
    description: 'Fecha desde la cual es válida'
  },
  valid_until: {
    type: Date,
    description: 'Fecha hasta la cual es válida (null = sin expiración)'
  },
  
  // Configuración de notificaciones
  notifications: {
    notify_on_action: {
      type: Boolean,
      default: false,
      description: 'Notificar al usuario cada vez que el agente ejecuta una acción'
    },
    notify_on_error: {
      type: Boolean,
      default: true,
      description: 'Notificar cuando hay errores'
    },
    daily_summary: {
      type: Boolean,
      default: true,
      description: 'Enviar resumen diario de actividad'
    }
  },
  
  // Métricas de uso de la delegación
  usage_metrics: {
    total_actions: {
      type: Number,
      default: 0
    },
    successful_actions: {
      type: Number,
      default: 0
    },
    failed_actions: {
      type: Number,
      default: 0
    },
    total_cost: {
      type: Number,
      default: 0
    },
    last_used_at: {
      type: Date
    }
  },
  
  // Historial de cambios
  change_history: [{
    changed_at: {
      type: Date,
      default: Date.now
    },
    changed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    change_type: {
      type: String,
      enum: ['created', 'updated', 'suspended', 'reactivated', 'revoked'],
      required: true
    },
    description: {
      type: String
    },
    previous_state: {
      type: mongoose.Schema.Types.Mixed
    }
  }],
  
  // Razón de suspensión/revocación
  suspension_reason: {
    type: String
  },
  revocation_reason: {
    type: String
  },
  
  // Metadata
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    description: 'Usuario que creó la delegación (normalmente el mismo user_id)'
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Índices
AgentDelegationSchema.index({ user_id: 1, agent_id: 1 });
AgentDelegationSchema.index({ agent_id: 1, status: 1 });
AgentDelegationSchema.index({ status: 1, valid_until: 1 });
AgentDelegationSchema.index({ 'scope.products': 1 });

// Validación única: un usuario solo puede tener una delegación activa por agente
AgentDelegationSchema.index(
  { user_id: 1, agent_id: 1, status: 1 },
  { 
    unique: true,
    partialFilterExpression: { status: 'active' }
  }
);

// Métodos del esquema
AgentDelegationSchema.methods.isValid = function() {
  if (this.status !== 'active') return false;
  
  const now = new Date();
  if (now < this.valid_from) return false;
  if (this.valid_until && now > this.valid_until) return false;
  
  return true;
};

AgentDelegationSchema.methods.hasPermission = function(permissionKey) {
  return this.delegated_permissions.some(p => p.permission_key === permissionKey);
};

AgentDelegationSchema.methods.canAccessProduct = function(productId) {
  if (this.scope.all_products) return true;
  
  return this.scope.products.some(p => 
    p.toString() === productId.toString()
  );
};

AgentDelegationSchema.methods.suspend = function(reason, suspendedBy) {
  this.status = 'suspended';
  this.suspension_reason = reason;
  this.updated_by = suspendedBy;
  
  this.change_history.push({
    change_type: 'suspended',
    description: reason,
    changed_by: suspendedBy,
    previous_state: { status: 'active' }
  });
  
  return this.save();
};

AgentDelegationSchema.methods.reactivate = function(reactivatedBy) {
  if (this.status !== 'suspended') {
    throw new Error('Solo se pueden reactivar delegaciones suspendidas');
  }
  
  this.status = 'active';
  this.suspension_reason = null;
  this.updated_by = reactivatedBy;
  
  this.change_history.push({
    change_type: 'reactivated',
    changed_by: reactivatedBy,
    previous_state: { status: 'suspended' }
  });
  
  return this.save();
};

AgentDelegationSchema.methods.revoke = function(reason, revokedBy) {
  this.status = 'revoked';
  this.revocation_reason = reason;
  this.updated_by = revokedBy;
  
  this.change_history.push({
    change_type: 'revoked',
    description: reason,
    changed_by: revokedBy,
    previous_state: { status: this.status }
  });
  
  return this.save();
};

AgentDelegationSchema.methods.recordAction = function(success, cost = 0) {
  this.usage_metrics.total_actions += 1;
  this.usage_metrics.last_used_at = new Date();
  
  if (success) {
    this.usage_metrics.successful_actions += 1;
  } else {
    this.usage_metrics.failed_actions += 1;
  }
  
  if (cost > 0) {
    this.usage_metrics.total_cost += cost;
  }
  
  return this.save();
};

AgentDelegationSchema.methods.checkLimits = async function() {
  const now = new Date();
  const AgentAction = require('./AgentAction');
  
  // Verificar límite por hora
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const actionsLastHour = await AgentAction.countDocuments({
    agent_id: this.agent_id,
    user_id: this.user_id,
    created_at: { $gte: oneHourAgo }
  });
  
  if (actionsLastHour >= this.scope.max_actions_per_hour) {
    return {
      allowed: false,
      reason: 'hourly_limit_reached',
      message: `Límite de ${this.scope.max_actions_per_hour} acciones por hora alcanzado`
    };
  }
  
  // Verificar límite diario
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const actionsToday = await AgentAction.countDocuments({
    agent_id: this.agent_id,
    user_id: this.user_id,
    created_at: { $gte: startOfDay }
  });
  
  if (actionsToday >= this.scope.max_actions_per_day) {
    return {
      allowed: false,
      reason: 'daily_limit_reached',
      message: `Límite de ${this.scope.max_actions_per_day} acciones por día alcanzado`
    };
  }
  
  // Verificar costo diario
  const costResult = await AgentAction.aggregate([
    {
      $match: {
        agent_id: this.agent_id,
        user_id: this.user_id,
        created_at: { $gte: startOfDay }
      }
    },
    {
      $group: {
        _id: null,
        total_cost: { $sum: '$metrics.cost' }
      }
    }
  ]);
  
  const totalCostToday = costResult[0]?.total_cost || 0;
  if (totalCostToday >= this.scope.max_cost_per_day) {
    return {
      allowed: false,
      reason: 'daily_cost_limit_reached',
      message: `Límite de costo diario de $${this.scope.max_cost_per_day} alcanzado`
    };
  }
  
  return { allowed: true };
};

// Métodos estáticos
AgentDelegationSchema.statics.getActiveDelegation = function(userId, agentId) {
  return this.findOne({
    user_id: userId,
    agent_id: agentId,
    status: 'active',
    valid_from: { $lte: new Date() },
    $or: [
      { valid_until: null },
      { valid_until: { $gte: new Date() } }
    ]
  })
  .populate('agent_id')
  .populate('user_id', 'nombre_negocio email role');
};

AgentDelegationSchema.statics.getUserDelegations = function(userId, status = 'active') {
  return this.find({ user_id: userId, status })
    .populate('agent_id', 'name display_name type')
    .sort({ created_at: -1 });
};

AgentDelegationSchema.statics.expireOldDelegations = async function() {
  const now = new Date();
  const result = await this.updateMany(
    {
      status: 'active',
      valid_until: { $lt: now }
    },
    {
      $set: { status: 'expired' },
      $push: {
        change_history: {
          change_type: 'updated',
          description: 'Delegación expirada automáticamente',
          changed_at: now
        }
      }
    }
  );
  return result.modifiedCount;
};

module.exports = mongoose.models.AgentDelegation || mongoose.model('AgentDelegation', AgentDelegationSchema);
