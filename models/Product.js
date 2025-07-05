const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  descripcion: {
    type: String,
    required: true,
    trim: true
  },
  responsable: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  estado: {
    type: String,
    enum: ['activo', 'inactivo', 'completado'],
    default: 'activo'
  },
  fecha_inicio: {
    type: Date,
    default: Date.now
  },
  fecha_fin: {
    type: Date
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

// Índices para búsquedas optimizadas
ProductSchema.index({ nombre: 'text', descripcion: 'text' });
ProductSchema.index({ responsable: 1 });
ProductSchema.index({ estado: 1 });

module.exports = mongoose.models.Product || mongoose.model('Product', ProductSchema);
