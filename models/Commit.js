const mongoose = require('mongoose');

const commitSchema = new mongoose.Schema({
  hash: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  sha: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  author: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  committer: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  repository: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true
  },
  branch: {
    type: String,
    default: 'main',
    trim: true
  },
  parentCommits: [{
    type: String,
    trim: true
  }],
  // Alias para compatibilidad
  parent_hashes: [{
    type: String,
    trim: true
  }],
  changes: {
    additions: { type: Number, default: 0 },
    deletions: { type: Number, default: 0 },
    totalChanges: { type: Number, default: 0 }
  },
  // Alias para stats compatibilidad
  stats: {
    additions: { type: Number, default: 0 },
    deletions: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  files: [{
    path: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['added', 'modified', 'deleted', 'renamed', 'copied'],
      required: true
    },
    additions: { type: Number, default: 0 },
    deletions: { type: Number, default: 0 },
    changes: { type: Number, default: 0 }
  }],
  relatedTasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  relatedBugs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BugReport'
  }],
  pullRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PullRequest',
    default: null
  },
  tags: [{
    type: String,
    trim: true
  }],
  commitDate: {
    type: Date,
    required: true
  },
  // Alias para compatibilidad
  date: {
    type: Date
  },
  commit_date: {
    type: Date
  },
  url: {
    type: String,
    trim: true
  },
  html_url: {
    type: String,
    trim: true
  },
  tree_hash: {
    type: String,
    trim: true
  },
  // Campos adicionales para compatibilidad con GitHub
  author_name: {
    type: String,
    trim: true
  },
  author_email: {
    type: String,
    trim: true
  },
  author_username: {
    type: String,
    trim: true
  },
  tree_sha: {
    type: String,
    trim: true
  },
  verificationStatus: {
    verified: { type: Boolean, default: false },
    reason: { type: String, trim: true },
    signature: { type: String, trim: true }
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
commitSchema.index({ repository: 1, commitDate: -1 });
commitSchema.index({ 'author.user': 1, commitDate: -1 });
commitSchema.index({ branch: 1 });
commitSchema.index({ hash: 1 });

// Método estático para obtener commits por usuario
commitSchema.statics.getCommitsByUser = function(userId, startDate, endDate) {
  return this.find({
    'author.user': userId,
    commitDate: { $gte: startDate, $lte: endDate }
  }).populate('repository', 'name project')
    .populate('relatedTasks', 'title status')
    .sort({ commitDate: -1 });
};

// Método estático para obtener estadísticas de commits
commitSchema.statics.getCommitStats = function(userId, period = 'week') {
  const now = new Date();
  let startDate;
  
  switch (period) {
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      startDate = new Date(now.setDate(now.getDate() - 7));
  }

  return this.aggregate([
    {
      $match: {
        'author.user': mongoose.Types.ObjectId(userId),
        commitDate: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalCommits: { $sum: 1 },
        totalAdditions: { $sum: '$changes.additions' },
        totalDeletions: { $sum: '$changes.deletions' },
        totalChanges: { $sum: '$changes.totalChanges' }
      }
    }
  ]);
};

module.exports = mongoose.model('Commit', commitSchema);
