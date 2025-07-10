const mongoose = require('mongoose');

const pullRequestSchema = new mongoose.Schema({
  number: {
    type: Number,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  status: {
    type: String,
    enum: ['open', 'closed', 'merged', 'draft'],
    default: 'open'
  },
  repository: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CodeRepository',
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  reviewers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'changes_requested', 'dismissed'],
      default: 'pending'
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    comments: [{
      content: String,
      createdAt: { type: Date, default: Date.now }
    }]
  }],
  sourceBranch: {
    type: String,
    required: true,
    trim: true
  },
  targetBranch: {
    type: String,
    required: true,
    trim: true
  },
  commits: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Commit'
  }],
  changes: {
    additions: { type: Number, default: 0 },
    deletions: { type: Number, default: 0 },
    changedFiles: { type: Number, default: 0 }
  },
  labels: [{
    name: String,
    color: String,
    description: String
  }],
  milestone: {
    type: String,
    trim: true
  },
  relatedTasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  relatedBugs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BugReport'
  }],
  conflictResolution: {
    hasConflicts: { type: Boolean, default: false },
    conflictFiles: [String],
    resolvedAt: { type: Date, default: null }
  },
  checksStatus: {
    passing: { type: Number, default: 0 },
    failing: { type: Number, default: 0 },
    pending: { type: Number, default: 0 }
  },
  mergeable: {
    type: Boolean,
    default: true
  },
  mergedAt: {
    type: Date,
    default: null
  },
  mergedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  closedAt: {
    type: Date,
    default: null
  },
  draft: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
pullRequestSchema.index({ repository: 1, status: 1 });
pullRequestSchema.index({ author: 1, createdAt: -1 });
pullRequestSchema.index({ 'reviewers.user': 1, status: 1 });
pullRequestSchema.index({ number: 1, repository: 1 }, { unique: true });

// Middleware para actualizar fechas de estado
pullRequestSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    if (this.status === 'merged' && !this.mergedAt) {
      this.mergedAt = new Date();
    } else if (this.status === 'closed' && !this.closedAt) {
      this.closedAt = new Date();
    }
  }
  next();
});

// Método para verificar si un usuario puede revisar
pullRequestSchema.methods.canReview = function(userId) {
  return this.author.toString() !== userId.toString() && 
         this.status === 'open' && 
         !this.draft;
};

// Método para obtener el estado de revisión
pullRequestSchema.methods.getReviewStatus = function() {
  const reviews = this.reviewers;
  const approved = reviews.filter(r => r.status === 'approved').length;
  const changesRequested = reviews.filter(r => r.status === 'changes_requested').length;
  const pending = reviews.filter(r => r.status === 'pending').length;

  if (changesRequested > 0) return 'changes_requested';
  if (approved >= 1 && pending === 0) return 'approved';
  if (approved > 0) return 'partial_approval';
  return 'pending';
};

// Método estático para obtener PRs por usuario
pullRequestSchema.statics.getPRsByUser = function(userId, role = 'author') {
  const query = role === 'author' 
    ? { author: userId }
    : { 'reviewers.user': userId };
    
  return this.find(query)
    .populate('author', 'firstName lastName email')
    .populate('repository', 'name')
    .populate('reviewers.user', 'firstName lastName')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('PullRequest', pullRequestSchema);
