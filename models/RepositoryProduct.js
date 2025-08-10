const mongoose = require('mongoose');

const repositoryProductSchema = new mongoose.Schema({
  repository: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  role: {
    type: String,
    enum: ['primary', 'secondary', 'dependency', 'tool'],
    default: 'primary'
  },
  permissions: {
    read: { type: Boolean, default: true },
    write: { type: Boolean, default: false },
    admin: { type: Boolean, default: false }
  },
  assigned_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assigned_at: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Índices
repositoryProductSchema.index({ repository: 1, product: 1 }, { unique: true });
repositoryProductSchema.index({ product: 1, status: 1 });
repositoryProductSchema.index({ repository: 1, status: 1 });

module.exports = mongoose.model('RepositoryProduct', repositoryProductSchema);
