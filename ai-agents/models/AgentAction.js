const mongoose = require('mongoose');

/**
 * Modelo AgentAction - Registra cada acción ejecutada por un agente
 * Sistema de auditoría completo para trazabilidad y análisis
 */
const AgentActionSchema = new mongoose.Schema({
  agent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
    description: 'Agente que ejecutó la acción'
  },
  session_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AgentSession',
    description: 'Sesión en la que se ejecutó la acción'
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    description: 'Usuario en nombre del cual se ejecutó la acción'
  },
  
  // Tipo y categoría de la acción
  action_type: {
    type: String,
    required: true,
    enum: [
      // Backlog actions
      'create_backlog_item',
      'update_backlog_item',
      'delete_backlog_item',
      'prioritize_backlog',
      'refine_user_story',
      'generate_acceptance_criteria',
      
      // Sprint actions
      'create_sprint',
      'update_sprint',
      'plan_sprint',
      'generate_sprint_goal',
      
      // Product actions
      'create_product',
      'update_product',
      'analyze_product_metrics',
      
      // Analysis actions
      'analyze_backlog',
      'analyze_business_value',
      'suggest_releases',
      'generate_report',
      
      // General
      'consultation',
      'recommendation',
      'other'
    ],
    description: 'Tipo específico de acción ejecutada'
  },
  category: {
    type: String,
    enum: ['creation', 'modification', 'deletion', 'analysis', 'consultation'],
    required: true
  },
  
  // Input y output de la acción
  input: {
    user_prompt: {
      type: String,
      required: true,
      description: 'Prompt original del usuario'
    },
    processed_input: {
      type: mongoose.Schema.Types.Mixed,
      description: 'Input procesado que se envió al AI'
    },
    context_provided: {
      type: mongoose.Schema.Types.Mixed,
      description: 'Contexto que se incluyó en la solicitud'
    }
  },
  
  // Respuesta del AI
  ai_response: {
    raw_response: {
      type: String,
      description: 'Respuesta cruda del modelo AI'
    },
    parsed_response: {
      type: mongoose.Schema.Types.Mixed,
      description: 'Respuesta parseada y estructurada'
    },
    reasoning: {
      type: String,
      description: 'Razonamiento del AI sobre la decisión'
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      description: 'Nivel de confianza del AI en la respuesta'
    }
  },
  
  // Resultado de la ejecución
  result: {
    status: {
      type: String,
      enum: ['success', 'partial_success', 'failure', 'cancelled'],
      required: true,
      default: 'success'
    },
    items_affected: [{
      collection: {
        type: String,
        description: 'Colección afectada (BacklogItem, Sprint, etc.)'
      },
      item_id: {
        type: mongoose.Schema.Types.ObjectId,
        description: 'ID del documento afectado'
      },
      operation: {
        type: String,
        enum: ['created', 'updated', 'deleted'],
        description: 'Operación realizada'
      },
      changes: {
        type: mongoose.Schema.Types.Mixed,
        description: 'Cambios específicos realizados'
      }
    }],
    error_message: {
      type: String
    },
    error_stack: {
      type: String
    }
  },
  
  // Métricas de la acción
  metrics: {
    tokens_used: {
      prompt_tokens: { type: Number, default: 0 },
      completion_tokens: { type: Number, default: 0 },
      total_tokens: { type: Number, default: 0 }
    },
    cost: {
      type: Number,
      default: 0,
      description: 'Costo en USD de la operación'
    },
    execution_time_ms: {
      type: Number,
      description: 'Tiempo total de ejecución en milisegundos'
    },
    ai_response_time_ms: {
      type: Number,
      description: 'Tiempo de respuesta del AI en milisegundos'
    },
    database_operations: {
      type: Number,
      default: 0,
      description: 'Número de operaciones de BD realizadas'
    }
  },
  
  // Contexto de la acción
  context: {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    sprint_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sprint'
    },
    ip_address: String,
    user_agent: String,
    api_endpoint: String
  },
  
  // Validación y aprobación
  validation: {
    requires_approval: {
      type: Boolean,
      default: false,
      description: 'Si la acción requiere aprobación humana'
    },
    approved: {
      type: Boolean,
      description: 'Si fue aprobada'
    },
    approved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approved_at: {
      type: Date
    },
    rejection_reason: {
      type: String
    }
  },
  
  // Feedback y mejora continua
  feedback: {
    was_helpful: {
      type: Boolean,
      description: '¿Fue útil la acción?'
    },
    accuracy_rating: {
      type: Number,
      min: 1,
      max: 5,
      description: 'Precisión de la acción (1-5)'
    },
    user_comment: {
      type: String
    },
    submitted_at: {
      type: Date
    }
  },
  
  // Rollback
  rollback: {
    can_rollback: {
      type: Boolean,
      default: true
    },
    rolled_back: {
      type: Boolean,
      default: false
    },
    rolled_back_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rolled_back_at: {
      type: Date
    },
    rollback_reason: {
      type: String
    },
    original_state: {
      type: mongoose.Schema.Types.Mixed,
      description: 'Estado original antes de la acción'
    }
  },
  
  // Metadata
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false // Usamos created_at manual
});

// Índices para queries optimizadas
AgentActionSchema.index({ agent_id: 1, created_at: -1 });
AgentActionSchema.index({ user_id: 1, created_at: -1 });
AgentActionSchema.index({ session_id: 1 });
AgentActionSchema.index({ action_type: 1 });
AgentActionSchema.index({ 'result.status': 1 });
AgentActionSchema.index({ created_at: -1 });
AgentActionSchema.index({ 'context.product_id': 1 });
AgentActionSchema.index({ 'validation.requires_approval': 1, 'validation.approved': 1 });

// Índice compuesto para análisis de costos
AgentActionSchema.index({ agent_id: 1, created_at: -1, 'metrics.cost': 1 });

// Métodos del esquema
AgentActionSchema.methods.markAsSuccess = function(itemsAffected = []) {
  this.result.status = 'success';
  this.result.items_affected = itemsAffected;
  return this.save();
};

AgentActionSchema.methods.markAsFailure = function(errorMessage, errorStack = null) {
  this.result.status = 'failure';
  this.result.error_message = errorMessage;
  if (errorStack) {
    this.result.error_stack = errorStack;
  }
  return this.save();
};

AgentActionSchema.methods.addFeedback = function(wasHelpful, accuracyRating = null, comment = '') {
  this.feedback.was_helpful = wasHelpful;
  this.feedback.accuracy_rating = accuracyRating;
  this.feedback.user_comment = comment;
  this.feedback.submitted_at = new Date();
  return this.save();
};

AgentActionSchema.methods.approve = function(approvedBy) {
  this.validation.approved = true;
  this.validation.approved_by = approvedBy;
  this.validation.approved_at = new Date();
  return this.save();
};

AgentActionSchema.methods.reject = function(reason) {
  this.validation.approved = false;
  this.validation.rejection_reason = reason;
  return this.save();
};

AgentActionSchema.methods.performRollback = async function(rolledBackBy, reason) {
  if (!this.rollback.can_rollback) {
    throw new Error('Esta acción no puede ser revertida');
  }
  
  if (this.rollback.rolled_back) {
    throw new Error('Esta acción ya fue revertida');
  }
  
  // Marcar como revertida
  this.rollback.rolled_back = true;
  this.rollback.rolled_back_by = rolledBackBy;
  this.rollback.rolled_back_at = new Date();
  this.rollback.rollback_reason = reason;
  
  await this.save();
  
  // TODO: Implementar lógica específica de rollback según el tipo de acción
  // Esto se implementará en el servicio correspondiente
  
  return this;
};

// Métodos estáticos
AgentActionSchema.statics.getActionsByAgent = function(agentId, limit = 50) {
  return this.find({ agent_id: agentId })
    .sort({ created_at: -1 })
    .limit(limit)
    .populate('user_id', 'nombre_negocio email');
};

AgentActionSchema.statics.getActionsByUser = function(userId, limit = 50) {
  return this.find({ user_id: userId })
    .sort({ created_at: -1 })
    .limit(limit)
    .populate('agent_id', 'name display_name');
};

AgentActionSchema.statics.getSuccessRate = async function(agentId, startDate = null) {
  const match = { agent_id: mongoose.Types.ObjectId(agentId) };
  if (startDate) {
    match.created_at = { $gte: startDate };
  }
  
  const result = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        successful: {
          $sum: { $cond: [{ $eq: ['$result.status', 'success'] }, 1, 0] }
        }
      }
    }
  ]);
  
  if (result.length === 0) return 0;
  
  const { total, successful } = result[0];
  return (successful / total) * 100;
};

AgentActionSchema.statics.getTotalCost = async function(agentId = null, startDate = null, endDate = null) {
  const match = {};
  
  if (agentId) {
    match.agent_id = mongoose.Types.ObjectId(agentId);
  }
  
  if (startDate || endDate) {
    match.created_at = {};
    if (startDate) match.created_at.$gte = startDate;
    if (endDate) match.created_at.$lte = endDate;
  }
  
  const result = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total_cost: { $sum: '$metrics.cost' },
        total_tokens: { $sum: '$metrics.tokens_used.total_tokens' },
        action_count: { $sum: 1 }
      }
    }
  ]);
  
  return result[0] || { total_cost: 0, total_tokens: 0, action_count: 0 };
};

AgentActionSchema.statics.getPendingApprovals = function() {
  return this.find({
    'validation.requires_approval': true,
    'validation.approved': { $exists: false }
  })
  .populate('agent_id', 'name display_name')
  .populate('user_id', 'nombre_negocio email')
  .sort({ created_at: -1 });
};

module.exports = mongoose.models.AgentAction || mongoose.model('AgentAction', AgentActionSchema);
