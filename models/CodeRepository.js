const mongoose = require('mongoose');

const codeRepositorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  gitUrl: {
    type: String,
    trim: true
  },
  platform: {
    type: String,
    enum: ['github', 'gitlab', 'bitbucket', 'azure_devops', 'other'],
    default: 'github'
  },
  language: {
    type: String,
    required: true,
    trim: true
  },
  framework: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'maintenance', 'archived', 'deprecated'],
    default: 'active'
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'internal'],
    default: 'private'
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  maintainers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  contributors: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['owner', 'maintainer', 'contributor', 'viewer'],
      default: 'contributor'
    },
    permissions: {
      read: { type: Boolean, default: true },
      write: { type: Boolean, default: false },
      admin: { type: Boolean, default: false }
    }
  }],
  branches: [{
    name: {
      type: String,
      required: true
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    lastCommit: {
      hash: String,
      message: String,
      author: String,
      date: Date
    },
    protection: {
      enabled: { type: Boolean, default: false },
      requirePullRequest: { type: Boolean, default: false },
      requireReviews: { type: Number, default: 1 }
    }
  }],
  tags: [{
    name: {
      type: String,
      required: true
    },
    version: {
      type: String,
      required: true
    },
    description: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  statistics: {
    totalCommits: { type: Number, default: 0 },
    totalBranches: { type: Number, default: 0 },
    totalTags: { type: Number, default: 0 },
    totalContributors: { type: Number, default: 0 },
    linesOfCode: { type: Number, default: 0 },
    lastActivity: { type: Date, default: Date.now }
  },
  settings: {
    enableIssues: { type: Boolean, default: true },
    enableWiki: { type: Boolean, default: true },
    enableProjects: { type: Boolean, default: true },
    defaultBranch: { type: String, default: 'main' },
    autoDeleteBranches: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
codeRepositorySchema.index({ project: 1 });
codeRepositorySchema.index({ status: 1 });
codeRepositorySchema.index({ 'contributors.user': 1 });
codeRepositorySchema.index({ name: 1 });

// Método para verificar permisos de usuario
codeRepositorySchema.methods.hasPermission = function(userId, permission) {
  const contributor = this.contributors.find(c => c.user.toString() === userId.toString());
  return contributor && contributor.permissions[permission];
};

// Método estático para obtener repositorios de un usuario
codeRepositorySchema.statics.getRepositoriesByUser = function(userId) {
  return this.find({
    'contributors.user': userId,
    status: 'active'
  }).populate('project', 'nombre')
    .populate('contributors.user', 'firstName lastName email')
    .sort({ 'statistics.lastActivity': -1 });
};

// Método para actualizar estadísticas
codeRepositorySchema.methods.updateStatistics = function(stats) {
  this.statistics = {
    ...this.statistics,
    ...stats,
    lastActivity: new Date()
  };
  return this.save();
};

module.exports = mongoose.model('CodeRepository', codeRepositorySchema);
