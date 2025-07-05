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

module.exports = mongoose.models.Sprint || mongoose.model('Sprint', SprintSchema);
