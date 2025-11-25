const mongoose = require('mongoose');

const timeTrackingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  sprint: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sprint',
    default: null
  },
  date: {
    type: Date,
    default: () => new Date()
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    default: null
  },
  duration: {
    type: Number, // en segundos
    default: 0
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  isActive: {
    type: Boolean,
    default: false
  },
  category: {
    type: String,
    enum: ['development', 'testing', 'review', 'debugging', 'documentation', 'meeting', 'research'],
    default: 'development'
  },
  productivity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  tags: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
timeTrackingSchema.index({ user: 1, createdAt: -1 });
timeTrackingSchema.index({ task: 1 });
timeTrackingSchema.index({ sprint: 1 });
timeTrackingSchema.index({ isActive: 1 });
// Índices adicionales para módulo Developer (OPTIMIZACIÓN)
timeTrackingSchema.index({ user: 1, date: -1 }); // Para stats por fecha
timeTrackingSchema.index({ user: 1, endTime: 1 }); // Para filtrar timers activos/completados
timeTrackingSchema.index({ task: 1, endTime: 1 }); // Para aggregation de time por task

// Método para calcular duración automáticamente
timeTrackingSchema.pre('save', function(next) {
  if (this.startTime && this.endTime && !this.duration) {
    // Calcular duración en segundos
    const durationMs = this.endTime - this.startTime;
    this.duration = Math.max(1, Math.round(durationMs / 1000));
  }
  next();
});

// Virtual para obtener horas (además de duration en segundos)
timeTrackingSchema.virtual('hours').get(function() {
  return Math.round((this.duration / 3600) * 10) / 10; // Redondear a 1 decimal
});

// Asegurar que los virtuals se incluyan en JSON
timeTrackingSchema.set('toJSON', { virtuals: true });
timeTrackingSchema.set('toObject', { virtuals: true });

// Método estático para obtener tiempo total por usuario y periodo
timeTrackingSchema.statics.getTotalTimeByUser = function(userId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate, $lte: endDate },
        endTime: { $ne: null }
      }
    },
    {
      $group: {
        _id: null,
        totalMinutes: { $sum: '$duration' },
        totalSessions: { $sum: 1 }
      }
    }
  ]);
};

// Método estático para obtener tiempo por tarea
timeTrackingSchema.statics.getTimeByTask = function(taskId) {
  return this.aggregate([
    {
      $match: {
        task: mongoose.Types.ObjectId(taskId),
        endTime: { $ne: null }
      }
    },
    {
      $group: {
        _id: null,
        totalMinutes: { $sum: '$duration' },
        totalSessions: { $sum: 1 }
      }
    }
  ]);
};

module.exports = mongoose.model('TimeTracking', timeTrackingSchema);
