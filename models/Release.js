const mongoose = require('mongoose');

const ReleaseSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  version: {
    type: String,
    required: true,
    trim: true
  },
  descripcion: {
    type: String,
    trim: true
  },
  fecha_objetivo: {
    type: Date,
    required: true
  },
  fecha_lanzamiento: {
    type: Date
  },
  estado: {
    type: String,
    enum: ['planificado', 'en_desarrollo', 'lanzado', 'cancelado'],
    default: 'planificado'
  },
  producto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  sprints: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sprint'
  }],
  backlog_items: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BacklogItem'
  }],
  prioridad: {
    type: String,
    enum: ['baja', 'media', 'alta', 'critica'],
    default: 'media'
  },
  progreso: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  historial: [{
    fecha: {
      type: Date,
      default: Date.now
    },
    accion: {
      type: String,
      enum: ['creacion', 'cambio_estado', 'actualizacion', 'sprint_completado'],
      required: true
    },
    estado_anterior: String,
    estado_nuevo: String,
    progreso_anterior: Number,
    progreso_nuevo: Number,
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notas: String
  }],
  notas: {
    type: String,
    trim: true
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

// Índices para optimizar consultas
ReleaseSchema.index({ producto: 1, estado: 1 });
ReleaseSchema.index({ fecha_objetivo: 1 });
ReleaseSchema.index({ created_by: 1 });

// Método virtual para calcular días restantes
ReleaseSchema.virtual('dias_restantes').get(function() {
  if (!this.fecha_objetivo) return null;
  const ahora = new Date();
  const diferencia = this.fecha_objetivo - ahora;
  return Math.ceil(diferencia / (1000 * 60 * 60 * 24));
});

// Método virtual para verificar si está retrasado
ReleaseSchema.virtual('esta_retrasado').get(function() {
  if (!this.fecha_objetivo || this.estado === 'lanzado') return false;
  return new Date() > this.fecha_objetivo;
});

// Método para actualizar progreso basado en sprints
ReleaseSchema.methods.calcularProgreso = async function() {
  await this.populate('sprints');
  if (this.sprints.length === 0) {
    this.progreso = 0;
    return this.progreso;
  }

  const sprintsCompletados = this.sprints.filter(sprint => sprint.estado === 'completado').length;
  this.progreso = Math.round((sprintsCompletados / this.sprints.length) * 100);
  
  return this.progreso;
};

// Método para cambiar estado con historial
ReleaseSchema.methods.cambiarEstado = async function(nuevoEstado, usuario, notas = '') {
  const estadoAnterior = this.estado;
  const progresoAnterior = this.progreso;
  
  // Actualizar estado
  this.estado = nuevoEstado;
  
  // Recalcular progreso basado en el nuevo estado
  const nuevoProgreso = await this.calcularProgreso();
  
  // Agregar al historial
  this.historial.push({
    accion: 'cambio_estado',
    estado_anterior: estadoAnterior,
    estado_nuevo: nuevoEstado,
    progreso_anterior: progresoAnterior,
    progreso_nuevo: nuevoProgreso,
    usuario: usuario,
    notas: notas
  });
  
  return this;
};

// Método para actualizar progreso cuando se completa un sprint
ReleaseSchema.methods.actualizarProgresoSprint = function(sprintId, usuario) {
  const progresoAnterior = this.progreso;
  
  this.historial.push({
    accion: 'sprint_completado',
    progreso_anterior: progresoAnterior,
    progreso_nuevo: this.progreso,
    usuario: usuario,
    notas: `Sprint completado: ${sprintId}`
  });
  
  return this;
};

// Middleware para actualizar timestamp de modificación
ReleaseSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updated_at = new Date();
  }
  next();
});

// Configuración de JSON output
ReleaseSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.models.Release || mongoose.model('Release', ReleaseSchema);
