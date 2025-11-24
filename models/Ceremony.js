const mongoose = require('mongoose');

const ceremonySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['sprint_planning', 'daily_standup', 'sprint_review', 'retrospective'],
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
    maxlength: 1000
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String, // HH:MM format
    required: true
  },
  duration: {
    type: Number, // en minutos
    required: true,
    min: 5,
    max: 480 // 8 horas máximo
  },
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['facilitator', 'participant', 'observer'],
      default: 'participant'
    },
    attendance: {
      type: String,
      enum: ['confirmed', 'tentative', 'declined', 'no_response'],
      default: 'no_response'
    }
  }],
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
  facilitator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  location: {
    type: String,
    trim: true
  },
  meetingLink: {
    type: String,
    trim: true
  },
  agenda: [{
    item: {
      type: String,
      required: true,
      trim: true
    },
    duration: {
      type: Number, // en minutos
      default: 10
    },
    completed: {
      type: Boolean,
      default: false
    }
  }],
  goals: [{
    type: String,
    trim: true
  }],
  outcomes: [{
    type: String,
    trim: true
  }],
  actionItems: [{
    description: {
      type: String,
      required: true,
      trim: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    dueDate: {
      type: Date
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  blockers: [{
    description: {
      type: String,
      required: true,
      trim: true
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    impediment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Impediment'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: {
    type: String,
    trim: true,
    maxlength: 2000
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
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  actualStartTime: {
    type: Date
  },
  actualEndTime: {
    type: Date
  },
  completedDate: {
    type: Date
  },
  feedback: [{
    participant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comments: {
      type: String,
      trim: true,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  recurring: {
    isRecurring: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly'],
      default: null
    },
    endDate: {
      type: Date,
      default: null
    },
    parentSeries: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ceremony',
      default: null
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual para calcular duración real
ceremonySchema.virtual('actualDuration').get(function() {
  if (this.actualStartTime && this.actualEndTime) {
    const diffTime = Math.abs(this.actualEndTime - this.actualStartTime);
    return Math.ceil(diffTime / (1000 * 60)); // minutos
  }
  return null;
});

// Virtual para verificar si está en progreso
ceremonySchema.virtual('isInProgress').get(function() {
  return this.status === 'in_progress';
});

// Virtual para verificar si está retrasada
ceremonySchema.virtual('isOverdue').get(function() {
  if (this.status === 'completed' || this.status === 'cancelled') {
    return false;
  }
  
  const ceremonyDateTime = new Date(this.date);
  const [hours, minutes] = this.startTime.split(':');
  ceremonyDateTime.setHours(parseInt(hours), parseInt(minutes));
  
  return Date.now() > ceremonyDateTime.getTime();
});

// Virtual para obtener fecha y hora completa
ceremonySchema.virtual('fullDateTime').get(function() {
  const ceremonyDateTime = new Date(this.date);
  const [hours, minutes] = this.startTime.split(':');
  ceremonyDateTime.setHours(parseInt(hours), parseInt(minutes));
  return ceremonyDateTime;
});

// Middleware para validaciones
ceremonySchema.pre('save', function(next) {
  // Si se marca como completada, establecer fecha de completado
  if (this.isModified('status') && this.status === 'completed' && !this.completedDate) {
    this.completedDate = new Date();
    if (!this.actualEndTime) {
      this.actualEndTime = new Date();
    }
  }
  
  // Si se inicia, establecer hora de inicio real
  if (this.isModified('status') && this.status === 'in_progress' && !this.actualStartTime) {
    this.actualStartTime = new Date();
  }
  
  next();
});

// Índices para mejorar rendimiento
ceremonySchema.index({ type: 1, date: 1 });
ceremonySchema.index({ status: 1, date: 1 });
ceremonySchema.index({ facilitator: 1, date: -1 });
ceremonySchema.index({ sprint: 1, type: 1 });
ceremonySchema.index({ project: 1, date: -1 });
ceremonySchema.index({ 'participants.user': 1, date: -1 });

// Métodos estáticos
ceremonySchema.statics.getUpcoming = function(days = 7) {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);
  
  return this.find({
    date: {
      $gte: new Date(),
      $lte: endDate
    },
    status: { $in: ['scheduled', 'in_progress'] },
    isActive: true
  }).sort({ date: 1, startTime: 1 });
};

ceremonySchema.statics.getStatsByType = function(startDate, endDate) {
  const match = { isActive: true };
  
  if (startDate && endDate) {
    match.date = { $gte: startDate, $lte: endDate };
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        avgDuration: { $avg: '$actualDuration' },
        avgRating: { $avg: '$feedback.rating' }
      }
    }
  ]);
};

ceremonySchema.statics.getAttendanceStats = function(startDate, endDate) {
  const match = { 
    isActive: true,
    status: 'completed'
  };
  
  if (startDate && endDate) {
    match.date = { $gte: startDate, $lte: endDate };
  }
  
  return this.aggregate([
    { $match: match },
    { $unwind: '$participants' },
    {
      $group: {
        _id: '$participants.attendance',
        count: { $sum: 1 }
      }
    }
  ]);
};

const Ceremony = mongoose.model('Ceremony', ceremonySchema);

module.exports = Ceremony;
