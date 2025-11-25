const mongoose = require('mongoose');

const BacklogItemSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: true,
    trim: true
  },
  descripcion: {
    type: String,
    required: true,
    trim: true
  },
  tipo: {
    type: String,
    enum: ['historia', 'tarea', 'bug', 'mejora'],
    default: 'historia'
  },
  prioridad: {
    type: String,
    enum: ['muy_alta', 'alta', 'media', 'baja'],
    default: 'media'
  },
  estado: {
    type: String,
    enum: ['pendiente', 'en_progreso', 'en_revision', 'en_pruebas', 'completado'],
    default: 'pendiente'
  },
  puntos_historia: {
    type: Number,
    min: 1,
    max: 100
  },
  orden: {
    type: Number,
    default: 0
  },
  producto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  asignado_a: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  sprint: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sprint'
  },
  historia_padre: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BacklogItem',
    default: null,
    validate: {
      validator: function(value) {
        // Solo items técnicos pueden tener historia padre
        if (value && !['tarea', 'bug', 'mejora'].includes(this.tipo)) {
          return false;
        }
        // Si tiene historia padre, debe ser del mismo sprint
        return true;
      },
      message: 'Solo tareas, bugs y mejoras pueden tener historia padre'
    }
  },
  etiquetas: [{
    type: String,
    trim: true
  }],
  criterios_aceptacion: [{
    descripcion: {
      type: String,
      required: true
    },
    completado: {
      type: Boolean,
      default: false
    }
  }],
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

// Índices para búsquedas y ordenamiento
BacklogItemSchema.index({ producto: 1, orden: 1 });
BacklogItemSchema.index({ titulo: 'text', descripcion: 'text' });
BacklogItemSchema.index({ estado: 1 });
BacklogItemSchema.index({ prioridad: 1 });
BacklogItemSchema.index({ sprint: 1 });
BacklogItemSchema.index({ historia_padre: 1 });
// Índices adicionales para módulo Developer (OPTIMIZACIÓN)
BacklogItemSchema.index({ asignado_a: 1, estado: 1 }); // Para tareas asignadas
BacklogItemSchema.index({ asignado_a: 1, sprint: 1 }); // Para sprint board

module.exports = mongoose.models.BacklogItem || mongoose.model('BacklogItem', BacklogItemSchema);
