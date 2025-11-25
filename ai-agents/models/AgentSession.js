const mongoose = require('mongoose');

/**
 * Modelo AgentSession - Representa una sesión de conversación con un agente
 * Mantiene el historial de mensajes y contexto de la interacción
 */
const AgentSessionSchema = new mongoose.Schema({
  session_id: {
    type: String,
    required: true,
    unique: true,
    description: 'UUID único de la sesión'
  },
  agent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
    description: 'Agente involucrado en la sesión'
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    description: 'Usuario que interactúa con el agente'
  },
  
  // Contexto de la sesión
  context: {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      description: 'Producto en el que se está trabajando'
    },
    sprint_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sprint',
      description: 'Sprint actual si aplica'
    },
    workspace: {
      type: String,
      description: 'Área de trabajo (backlog, sprint-planning, metrics, etc.)'
    },
    initial_intent: {
      type: String,
      description: 'Intención inicial del usuario'
    }
  },
  
  // Mensajes de la conversación
  messages: [{
    role: {
      type: String,
      enum: ['system', 'user', 'assistant', 'function'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    tokens: {
      type: Number,
      default: 0
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      description: 'Metadata adicional del mensaje'
    }
  }],
  
  // Estado de la sesión
  status: {
    type: String,
    enum: ['active', 'completed', 'expired', 'error'],
    default: 'active'
  },
  
  // Acciones ejecutadas durante la sesión
  actions_executed: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AgentAction'
  }],
  
  // Métricas de la sesión
  metrics: {
    total_messages: {
      type: Number,
      default: 0
    },
    total_tokens: {
      type: Number,
      default: 0
    },
    total_cost: {
      type: Number,
      default: 0
    },
    duration_seconds: {
      type: Number,
      default: 0
    },
    actions_count: {
      type: Number,
      default: 0
    }
  },
  
  // Resultado final de la sesión
  result: {
    success: {
      type: Boolean,
      default: true
    },
    summary: {
      type: String,
      description: 'Resumen de lo que se logró en la sesión'
    },
    items_created: [{
      type: {
        type: String,
        description: 'Tipo de item (backlog_item, sprint, etc.)'
      },
      id: {
        type: mongoose.Schema.Types.ObjectId,
        description: 'ID del item creado'
      }
    }],
    error_message: {
      type: String
    }
  },
  
  // Feedback del usuario
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5,
      description: 'Calificación de 1 a 5'
    },
    comment: {
      type: String
    },
    submitted_at: {
      type: Date
    }
  },
  
  // Metadata
  started_at: {
    type: Date,
    default: Date.now
  },
  ended_at: {
    type: Date
  },
  expires_at: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
    description: 'Sesión expira después de este tiempo'
  }
}, {
  timestamps: true
});

// Índices
AgentSessionSchema.index({ session_id: 1 });
AgentSessionSchema.index({ agent_id: 1, user_id: 1 });
AgentSessionSchema.index({ user_id: 1, status: 1 });
AgentSessionSchema.index({ expires_at: 1 }); // Para cleanup automático
AgentSessionSchema.index({ 'context.product_id': 1 });

// Métodos del esquema
AgentSessionSchema.methods.addMessage = function(role, content, tokens = 0, metadata = {}) {
  this.messages.push({
    role,
    content,
    tokens,
    metadata,
    timestamp: new Date()
  });
  
  this.metrics.total_messages += 1;
  this.metrics.total_tokens += tokens;
  
  return this.save();
};

AgentSessionSchema.methods.addAction = function(actionId) {
  this.actions_executed.push(actionId);
  this.metrics.actions_count += 1;
  return this.save();
};

AgentSessionSchema.methods.complete = function(summary, itemsCreated = []) {
  this.status = 'completed';
  this.ended_at = new Date();
  this.result.success = true;
  this.result.summary = summary;
  this.result.items_created = itemsCreated;
  
  const durationMs = this.ended_at - this.started_at;
  this.metrics.duration_seconds = Math.round(durationMs / 1000);
  
  return this.save();
};

AgentSessionSchema.methods.fail = function(errorMessage) {
  this.status = 'error';
  this.ended_at = new Date();
  this.result.success = false;
  this.result.error_message = errorMessage;
  
  const durationMs = this.ended_at - this.started_at;
  this.metrics.duration_seconds = Math.round(durationMs / 1000);
  
  return this.save();
};

AgentSessionSchema.methods.addFeedback = function(rating, comment = '') {
  this.feedback.rating = rating;
  this.feedback.comment = comment;
  this.feedback.submitted_at = new Date();
  return this.save();
};

AgentSessionSchema.methods.isExpired = function() {
  return new Date() > this.expires_at;
};

AgentSessionSchema.methods.getConversationHistory = function(limit = null) {
  const messages = this.messages
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp
    }));
  
  return limit ? messages.slice(-limit) : messages;
};

// Método estático para cleanup de sesiones expiradas
AgentSessionSchema.statics.cleanupExpiredSessions = async function() {
  const now = new Date();
  const result = await this.updateMany(
    { status: 'active', expires_at: { $lt: now } },
    { $set: { status: 'expired' } }
  );
  return result.modifiedCount;
};

// Método estático para obtener sesiones activas de un usuario
AgentSessionSchema.statics.getActiveSessionsForUser = function(userId) {
  return this.find({
    user_id: userId,
    status: 'active',
    expires_at: { $gt: new Date() }
  })
  .populate('agent_id', 'name display_name type')
  .sort({ started_at: -1 });
};

module.exports = mongoose.models.AgentSession || mongoose.model('AgentSession', AgentSessionSchema);
