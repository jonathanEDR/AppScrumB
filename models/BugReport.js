const mongoose = require('mongoose');

const bugReportSchema = new mongoose.Schema({
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
    maxlength: 2000
  },
  type: {
    type: String,
    enum: ['bug', 'feature', 'improvement', 'security'],
    default: 'bug'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed', 'rejected'],
    default: 'open'
  },
  severity: {
    type: String,
    enum: ['minor', 'major', 'critical', 'blocker'],
    default: 'major'
  },
  stepsToReproduce: {
    type: String,
    trim: true,
    maxlength: 1500
  },
  expectedBehavior: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  actualBehavior: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  environment: {
    os: {
      type: String,
      trim: true
    },
    browser: {
      type: String,
      trim: true
    },
    version: {
      type: String,
      trim: true
    },
    device: {
      type: String,
      trim: true
    }
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null
  },
  sprint: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sprint',
    default: null
  },
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    // Mantener path para compatibilidad pero ahora es URL de Cloudinary
    path: {
      type: String,
      required: true
    },
    // Nuevos campos para Cloudinary
    url: {
      type: String,
      default: function() { return this.path; } // URL completa de Cloudinary
    },
    publicId: {
      type: String // Public ID de Cloudinary para operaciones (delete, transform, etc)
    },
    cloudinaryData: {
      publicId: String,
      url: String,
      secureUrl: String,
      format: String,
      resourceType: {
        type: String,
        enum: ['image', 'raw', 'video'],
        default: 'raw'
      }
    },
    uploadedAt: {
      type: Date,
      default: Date.now
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
      trim: true,
      maxlength: 1000
    },
    isInternal: {
      type: Boolean,
      default: false
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
  relatedTasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  duplicateOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BugReport',
    default: null
  },
  resolution: {
    type: String,
    enum: ['fixed', 'duplicate', 'wont_fix', 'cannot_reproduce', 'invalid'],
    default: null
  },
  resolutionNote: {
    type: String,
    trim: true,
    maxlength: 1000
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
  dueDate: {
    type: Date,
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
bugReportSchema.index({ reportedBy: 1, createdAt: -1 });
bugReportSchema.index({ assignedTo: 1, status: 1 });
bugReportSchema.index({ priority: 1, status: 1 });
bugReportSchema.index({ project: 1 });
bugReportSchema.index({ status: 1 });

// Middleware para actualizar resolvedAt cuando se cambia el status
bugReportSchema.pre('save', function(next) {
  if (this.isModified('status') && (this.status === 'resolved' || this.status === 'closed')) {
    if (!this.resolvedAt) {
      this.resolvedAt = new Date();
    }
  }
  next();
});

// Método estático para obtener estadísticas de bugs por usuario
bugReportSchema.statics.getBugStatsByUser = function(userId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        reportedBy: mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

// Método estático para obtener bugs asignados a un usuario
bugReportSchema.statics.getAssignedBugs = function(userId) {
  return this.find({
    assignedTo: userId,
    status: { $in: ['open', 'in_progress'] }
  }).populate('reportedBy', 'firstName lastName email')
    .populate('project', 'nombre')
    .sort({ priority: 1, createdAt: -1 });
};

module.exports = mongoose.model('BugReport', bugReportSchema);
