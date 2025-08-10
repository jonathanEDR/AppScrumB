const mongoose = require('mongoose');

const repositorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  provider: {
    type: String,
    enum: ['github', 'gitlab', 'bitbucket'],
    default: 'github'
  },
  owner: {
    type: String,
    required: true
  },
  repo_id: {
    type: String,
    required: true,
    unique: true
  },
  language: {
    type: String,
    default: 'JavaScript'
  },
  status: {
    type: String,
    enum: ['active', 'maintenance', 'archived'],
    default: 'active'
  },
  default_branch: {
    type: String,
    default: 'main'
  },
  is_private: {
    type: Boolean,
    default: false
  },
  // Campos adicionales para GitHub
  clone_url: String,
  ssh_url: String,
  full_name: String,
  github_data: {
    id: Number,
    node_id: String,
    html_url: String,
    size: Number,
    stargazers_count: Number,
    watchers_count: Number,
    forks_count: Number,
    open_issues_count: Number,
    has_issues: Boolean,
    has_projects: Boolean,
    has_wiki: Boolean,
    archived: Boolean,
    disabled: Boolean,
    pushed_at: Date,
    created_at: Date,
    updated_at: Date
  },
  // Usuario que agregó el repositorio
  added_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false // Ya no es obligatorio
  },
  settings: {
    webhook_url: String,
    auto_deploy: {
      type: Boolean,
      default: false
    },
    notifications: {
      commits: { type: Boolean, default: true },
      prs: { type: Boolean, default: true },
      issues: { type: Boolean, default: false }
    }
  },
  metrics: {
    total_commits: { type: Number, default: 0 },
    total_branches: { type: Number, default: 0 },
    total_contributors: { type: Number, default: 0 },
    last_commit_date: Date,
    created_at: Date,
    updated_at: Date
  }
}, {
  timestamps: true
});

// Índices para optimización
repositorySchema.index({ project: 1, status: 1 });
repositorySchema.index({ owner: 1, name: 1 });
repositorySchema.index({ repo_id: 1 }, { unique: true });

module.exports = mongoose.model('Repository', repositorySchema);
