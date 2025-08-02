const mongoose = require('mongoose');

const SprintSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  objetivo: {
    type: String,
    required: true,
    trim: true
  },
  fecha_inicio: {
    type: Date,
    required: true
  },
  fecha_fin: {
    type: Date,
    required: true
  },
  estado: {
    type: String,
    enum: ['planificado', 'activo', 'completado', 'cancelado'],
    default: 'planificado'
  },
  producto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  velocidad_planificada: {
    type: Number,
    default: 0
  },
  velocidad_real: {
    type: Number,
    default: 0
  },
  // NUEVOS CAMPOS - Mejoras Implementadas
  release_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Release',
    required: false // Opcional: sprints pueden ser independientes
  },
  prioridad: {
    type: String,
    enum: ['baja', 'media', 'alta', 'critica'],
    default: 'media'
  },
  capacidad_equipo: {
    type: Number,
    default: 0,
    min: 0 // Horas disponibles del equipo
  },
  progreso: {
    type: Number,
    default: 0,
    min: 0,
    max: 100 // Porcentaje de completitud
  },
  metricas: {
    burndown_data: [{
      fecha: Date,
      trabajo_restante: Number,
      trabajo_completado: Number
    }],
    velocity_history: [{
      sprint_numero: Number,
      velocity_achieved: Number,
      fecha: Date
    }]
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Índices
SprintSchema.index({ producto: 1, fecha_inicio: 1 });
SprintSchema.index({ estado: 1 });
SprintSchema.index({ release_id: 1 }); // NUEVO: Para filtrar sprints por release
SprintSchema.index({ prioridad: 1 }); // NUEVO: Para ordenar por prioridad

// Métodos del esquema
SprintSchema.methods.calcularProgreso = function() {
  // Lógica para calcular progreso basado en tareas completadas
  if (this.metricas && this.metricas.burndown_data.length > 0) {
    const ultimaEntry = this.metricas.burndown_data[this.metricas.burndown_data.length - 1];
    const total = ultimaEntry.trabajo_restante + ultimaEntry.trabajo_completado;
    return total > 0 ? Math.round((ultimaEntry.trabajo_completado / total) * 100) : 0;
  }
  return this.progreso || 0;
};

SprintSchema.methods.actualizarVelocity = function(nuevaVelocity) {
  if (!this.metricas) this.metricas = { velocity_history: [] };
  if (!this.metricas.velocity_history) this.metricas.velocity_history = [];
  
  this.metricas.velocity_history.push({
    sprint_numero: this.metricas.velocity_history.length + 1,
    velocity_achieved: nuevaVelocity,
    fecha: new Date()
  });
  
  this.velocidad_real = nuevaVelocity;
};

module.exports = mongoose.models.Sprint || mongoose.model('Sprint', SprintSchema);
