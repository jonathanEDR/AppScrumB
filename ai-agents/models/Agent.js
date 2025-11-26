const mongoose = require('mongoose');

/**
 * Modelo Agent - Define un agente AI en el sistema
 * Cada agente tiene capacidades específicas y configuración propia
 */
const AgentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    description: 'Nombre único del agente (ej: product-owner-ai)'
  },
  display_name: {
    type: String,
    required: true,
    description: 'Nombre para mostrar en UI (ej: Product Owner AI)'
  },
  type: {
    type: String,
    enum: ['product_owner', 'scrum_master', 'developer', 'tester', 'custom'],
    required: true,
    description: 'Tipo de agente según rol Scrum'
  },
  description: {
    type: String,
    required: true,
    description: 'Descripción de las capacidades del agente'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'training', 'deprecated'],
    default: 'active',
    description: 'Estado operacional del agente'
  },
  version: {
    type: String,
    default: '1.0.0',
    description: 'Versión del agente para control de cambios'
  },
  
  // Configuración del modelo AI
  configuration: {
    provider: {
      type: String,
      enum: ['openai', 'anthropic', 'google', 'cohere', 'custom'],
      default: 'openai',
      description: 'Proveedor de AI a utilizar'
    },
    model: {
      type: String,
      required: true,
      default: 'gpt-4-turbo',
      description: 'Modelo específico (gpt-4-turbo, claude-3-5-sonnet, etc.)'
    },
    temperature: {
      type: Number,
      min: 0,
      max: 2,
      default: 0.7,
      description: 'Creatividad del modelo (0=determinista, 2=muy creativo)'
    },
    max_tokens: {
      type: Number,
      default: 4096,
      description: 'Máximo de tokens en la respuesta'
    },
    top_p: {
      type: Number,
      min: 0,
      max: 1,
      default: 1,
      description: 'Nucleus sampling'
    },
    frequency_penalty: {
      type: Number,
      min: -2,
      max: 2,
      default: 0
    },
    presence_penalty: {
      type: Number,
      min: -2,
      max: 2,
      default: 0
    }
  },
  
  // System prompt del agente
  system_prompt: {
    type: String,
    required: true,
    description: 'Prompt de sistema que define el comportamiento del agente'
  },
  
  // Capacidades y permisos del agente
  capabilities: [{
    name: {
      type: String,
      required: true,
      description: 'Nombre de la capacidad (create_user_story, prioritize_backlog, etc.)'
    },
    description: {
      type: String,
      required: true
    },
    requires_permission: {
      type: String,
      description: 'Permiso necesario para ejecutar (canCreateBacklogItems, etc.)'
    },
    enabled: {
      type: Boolean,
      default: true
    }
  }],
  
  // Contexto que el agente necesita para funcionar
  context_requirements: {
    needs_product_data: {
      type: Boolean,
      default: true
    },
    needs_backlog_data: {
      type: Boolean,
      default: true
    },
    needs_sprint_data: {
      type: Boolean,
      default: false
    },
    needs_team_data: {
      type: Boolean,
      default: false
    },
    needs_metrics_data: {
      type: Boolean,
      default: false
    },
    custom_requirements: [{
      name: String,
      description: String
    }]
  },
  
  // Configuración de entrenamiento/fine-tuning
  training: {
    is_fine_tuned: {
      type: Boolean,
      default: false
    },
    fine_tune_model_id: {
      type: String,
      description: 'ID del modelo fine-tuned en el provider'
    },
    training_dataset_count: {
      type: Number,
      default: 0
    },
    last_trained_at: {
      type: Date
    },
    training_metrics: {
      accuracy: Number,
      loss: Number,
      examples_count: Number
    }
  },
  
  // Métricas de uso y rendimiento
  metrics: {
    total_interactions: {
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
    average_response_time: {
      type: Number,
      default: 0,
      description: 'Tiempo promedio de respuesta en ms'
    },
    total_tokens_used: {
      type: Number,
      default: 0
    },
    total_cost: {
      type: Number,
      default: 0,
      description: 'Costo total acumulado en USD'
    },
    user_satisfaction: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
      description: 'Rating promedio de satisfacción'
    },
    last_used_at: {
      type: Date
    }
  },
  
  // Limitaciones y cuotas
  limitations: {
    max_requests_per_hour: {
      type: Number,
      default: 100
    },
    max_tokens_per_day: {
      type: Number,
      default: 100000
    },
    max_cost_per_day: {
      type: Number,
      default: 10,
      description: 'Máximo costo diario en USD'
    },
    allowed_roles: [{
      type: String,
      enum: ['super_admin', 'product_owner', 'scrum_master', 'developers', 'user'],
      description: 'Roles que pueden usar este agente'
    }]
  },
  
  // Metadata y auditoría
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  is_system_agent: {
    type: Boolean,
    default: false,
    description: 'Si es true, es un agente del sistema que no se puede eliminar'
  }
}, {
  timestamps: true
});

// Índices para optimización
// Note: name field already has unique index, so no need to add separate index
AgentSchema.index({ type: 1 });
AgentSchema.index({ status: 1 });
AgentSchema.index({ 'limitations.allowed_roles': 1 });

// Métodos del esquema
AgentSchema.methods.incrementInteractions = function() {
  this.metrics.total_interactions += 1;
  this.metrics.last_used_at = new Date();
  return this.save();
};

AgentSchema.methods.recordSuccess = function(tokensUsed, cost, responseTime) {
  this.metrics.successful_actions += 1;
  this.metrics.total_tokens_used += tokensUsed;
  this.metrics.total_cost += cost;
  
  // Calcular nuevo promedio de tiempo de respuesta
  const totalActions = this.metrics.successful_actions + this.metrics.failed_actions;
  this.metrics.average_response_time = 
    (this.metrics.average_response_time * (totalActions - 1) + responseTime) / totalActions;
  
  return this.save();
};

AgentSchema.methods.recordFailure = function() {
  this.metrics.failed_actions += 1;
  return this.save();
};

AgentSchema.methods.canBeUsedBy = function(userRole) {
  if (this.limitations.allowed_roles.length === 0) return true;
  return this.limitations.allowed_roles.includes(userRole);
};

AgentSchema.methods.hasReachedLimit = async function(limitType) {
  const now = new Date();
  const AgentAction = require('./AgentAction');
  
  switch (limitType) {
    case 'hourly': {
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const count = await AgentAction.countDocuments({
        agent_id: this._id,
        created_at: { $gte: oneHourAgo }
      });
      return count >= this.limitations.max_requests_per_hour;
    }
    case 'daily_tokens': {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));
      const result = await AgentAction.aggregate([
        { $match: { agent_id: this._id, created_at: { $gte: startOfDay } } },
        { $group: { _id: null, total: { $sum: '$tokens_used' } } }
      ]);
      const totalTokens = result[0]?.total || 0;
      return totalTokens >= this.limitations.max_tokens_per_day;
    }
    case 'daily_cost': {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));
      const result = await AgentAction.aggregate([
        { $match: { agent_id: this._id, created_at: { $gte: startOfDay } } },
        { $group: { _id: null, total: { $sum: '$cost' } } }
      ]);
      const totalCost = result[0]?.total || 0;
      return totalCost >= this.limitations.max_cost_per_day;
    }
    default:
      return false;
  }
};

// Método estático para obtener agente por tipo
AgentSchema.statics.findByType = function(type, status = 'active') {
  return this.findOne({ type, status });
};

module.exports = mongoose.models.Agent || mongoose.model('Agent', AgentSchema);
