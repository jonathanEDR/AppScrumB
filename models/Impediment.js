const mongoose = require('mongoose');

const impedimentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  responsible: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['technical', 'requirements', 'external_dependency', 'resource', 'communication'],
    default: 'technical'
  },
  createdDate: {
    type: Date,
    default: Date.now
  },
  resolvedDate: {
    type: Date,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  sprint: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sprint',
    default: null
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null
  },
  estimatedResolutionTime: {
    type: Number, // en días
    default: null
  },
  actualResolutionTime: {
    type: Number, // en días
    default: null
  },
  comments: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [{
    type: String,
    trim: true
  }],
  blockedTasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BacklogItem'
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual para calcular el tiempo de resolución
impedimentSchema.virtual('resolutionTime').get(function() {
  if (this.resolvedDate && this.createdDate) {
    const diffTime = Math.abs(this.resolvedDate - this.createdDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // días
  }
  return null;
});

// Virtual para verificar si está vencido
impedimentSchema.virtual('isOverdue').get(function() {
  if (this.status === 'resolved' || !this.estimatedResolutionTime) {
    return false;
  }
  
  const daysSinceCreation = Math.ceil((Date.now() - this.createdDate) / (1000 * 60 * 60 * 24));
  return daysSinceCreation > this.estimatedResolutionTime;
});

// Middleware para actualizar actualResolutionTime cuando se resuelve
impedimentSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'resolved' && !this.resolvedDate) {
    this.resolvedDate = new Date();
  }
  
  if (this.resolvedDate && this.createdDate && !this.actualResolutionTime) {
    const diffTime = Math.abs(this.resolvedDate - this.createdDate);
    this.actualResolutionTime = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  next();
});

// Índices para mejorar rendimiento
impedimentSchema.index({ status: 1, priority: 1 });
impedimentSchema.index({ createdBy: 1, createdDate: -1 });
impedimentSchema.index({ sprint: 1, status: 1 });
impedimentSchema.index({ project: 1, status: 1 });
impedimentSchema.index({ responsible: 1, status: 1 });

// Métodos estáticos
impedimentSchema.statics.getStatsByStatus = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgResolutionTime: {
          $avg: {
            $cond: [
              { $eq: ['$status', 'resolved'] },
              '$actualResolutionTime',
              null
            ]
          }
        }
      }
    }
  ]);
};

impedimentSchema.statics.getStatsByPriority = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 }
      }
    }
  ]);
};

impedimentSchema.statics.getMonthlyTrends = function(months = 6) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  return this.aggregate([
    {
      $match: {
        createdDate: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdDate' },
          month: { $month: '$createdDate' }
        },
        created: { $sum: 1 },
        resolved: {
          $sum: {
            $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0]
          }
        }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    }
  ]);
};

const Impediment = mongoose.model('Impediment', impedimentSchema);

module.exports = Impediment;
