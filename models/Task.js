const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  type: {
    type: String,
    enum: ['story', 'bug', 'task', 'epic', 'spike'],
    default: 'task'
  },
  status: {
    type: String,
    enum: ['todo', 'in_progress', 'code_review', 'testing', 'done'],
    default: 'todo'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  storyPoints: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  estimatedHours: {
    type: Number,
    min: 0,
    default: 0
  },
  actualHours: {
    type: Number,
    min: 0,
    default: 0
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sprint: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sprint',
    default: null
  },
  backlogItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BacklogItem',
    default: null
  },
  labels: [{
    type: String,
    trim: true
  }],
  acceptanceCriteria: [{
    description: {
      type: String,
      required: true,
      trim: true
    },
    completed: {
      type: Boolean,
      default: false
    }
  }],
  comments: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  blockedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  blocks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  dueDate: {
    type: Date,
    default: null
  },
  startDate: {
    type: Date,
    default: null
  },
  completedDate: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
taskSchema.index({ status: 1, assignee: 1 });
taskSchema.index({ sprint: 1, status: 1 });
taskSchema.index({ type: 1, priority: 1 });
taskSchema.index({ assignee: 1, status: 1 });
// Índices adicionales para módulo Developer (OPTIMIZACIÓN)
taskSchema.index({ assignee: 1, updatedAt: -1 }); // Para recent tasks y listas
taskSchema.index({ assignee: 1, sprint: 1 }); // Para filtros por sprint
taskSchema.index({ assignee: 1, sprint: 1, status: 1 }); // Query compuesta frecuente

// Virtuals
taskSchema.virtual('isOverdue').get(function() {
  return this.dueDate && this.dueDate < new Date() && this.status !== 'done';
});

taskSchema.virtual('progressPercentage').get(function() {
  if (!this.acceptanceCriteria || this.acceptanceCriteria.length === 0) {
    // Si no hay criterios de aceptación, basarse en el estado
    const statusProgress = {
      'todo': 0,
      'in_progress': 25,
      'code_review': 50,
      'testing': 75,
      'done': 100
    };
    return statusProgress[this.status] || 0;
  }
  
  const completed = this.acceptanceCriteria.filter(criteria => criteria.completed).length;
  return Math.round((completed / this.acceptanceCriteria.length) * 100);
});

taskSchema.virtual('daysInProgress').get(function() {
  if (!this.startDate) return 0;
  const endDate = this.completedDate || new Date();
  const diffTime = Math.abs(endDate - this.startDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

taskSchema.virtual('isBlocked').get(function() {
  return this.blockedBy && this.blockedBy.length > 0;
});

// Métodos de instancia
taskSchema.methods.assignTo = function(teamMemberId) {
  this.assignee = teamMemberId;
  if (this.status === 'todo') {
    this.status = 'in_progress';
    this.startDate = new Date();
  }
  return this.save();
};

taskSchema.methods.updateStatus = function(newStatus) {
  const oldStatus = this.status;
  this.status = newStatus;
  
  if (newStatus === 'in_progress' && !this.startDate) {
    this.startDate = new Date();
  }
  
  if (newStatus === 'done' && oldStatus !== 'done') {
    this.completedDate = new Date();
    // Marcar todos los criterios de aceptación como completados
    if (this.acceptanceCriteria && this.acceptanceCriteria.length > 0) {
      this.acceptanceCriteria.forEach(criteria => {
        criteria.completed = true;
      });
    }
  }
  
  return this.save();
};

taskSchema.methods.addComment = function(authorId, content) {
  this.comments.push({
    author: authorId,
    content: content
  });
  return this.save();
};

taskSchema.methods.logTime = function(hours) {
  this.actualHours += hours;
  return this.save();
};

// Métodos estáticos
taskSchema.statics.getSprintTasks = async function(sprintId) {
  return this.find({ sprint: sprintId })
    .populate('assignee')
    .populate('reporter', 'firstName lastName email')
    .sort({ priority: -1, createdAt: 1 });
};

taskSchema.statics.getTasksByStatus = async function(status, options = {}) {
  const query = { status };
  if (options.assignee) query.assignee = options.assignee;
  if (options.sprint) query.sprint = options.sprint;
  
  return this.find(query)
    .populate('assignee')
    .populate('reporter', 'firstName lastName email')
    .sort({ priority: -1, createdAt: 1 });
};

taskSchema.statics.getTeamVelocity = async function(teamMemberIds, sprintIds) {
  return this.aggregate([
    {
      $match: {
        assignee: { $in: teamMemberIds },
        sprint: { $in: sprintIds },
        status: 'done'
      }
    },
    {
      $group: {
        _id: '$sprint',
        totalStoryPoints: { $sum: '$storyPoints' },
        taskCount: { $sum: 1 },
        totalHours: { $sum: '$actualHours' }
      }
    },
    {
      $lookup: {
        from: 'sprints',
        localField: '_id',
        foreignField: '_id',
        as: 'sprintInfo'
      }
    },
    { $unwind: '$sprintInfo' },
    { $sort: { 'sprintInfo.startDate': 1 } }
  ]);
};

taskSchema.statics.getBurndownData = async function(sprintId) {
  const tasks = await this.find({ sprint: sprintId }).sort({ completedDate: 1 });
  
  const totalStoryPoints = tasks.reduce((sum, task) => sum + task.storyPoints, 0);
  const burndownData = [];
  let remainingPoints = totalStoryPoints;
  
  // Agregar punto inicial
  burndownData.push({
    date: tasks[0]?.createdAt || new Date(),
    remaining: totalStoryPoints,
    completed: 0
  });
  
  // Procesar tareas completadas
  tasks.filter(task => task.status === 'done' && task.completedDate).forEach(task => {
    remainingPoints -= task.storyPoints;
    burndownData.push({
      date: task.completedDate,
      remaining: remainingPoints,
      completed: totalStoryPoints - remainingPoints
    });
  });
  
  return burndownData;
};

// Middleware pre-save
taskSchema.pre('save', function(next) {
  // Actualizar fechas automáticamente
  if (this.isModified('status')) {
    if (this.status === 'in_progress' && !this.startDate) {
      this.startDate = new Date();
    }
    if (this.status === 'done' && !this.completedDate) {
      this.completedDate = new Date();
    }
  }
  next();
});

// Configurar virtuals en JSON
taskSchema.set('toJSON', { virtuals: true });
taskSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Task', taskSchema);
