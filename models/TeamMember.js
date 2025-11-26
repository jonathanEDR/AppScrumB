const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  team: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['scrum_master', 'product_owner', 'developers', 'tester', 'designer', 'analyst', 'super_admin'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'on_leave', 'busy'],
    default: 'active'
  },
  availability: {
    type: Number, // Porcentaje de disponibilidad (0-100)
    min: 0,
    max: 100,
    default: 100
  },
  skills: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      default: 'intermediate'
    }
  }],
  currentSprint: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sprint',
    default: null
  },
  workload: {
    currentStoryPoints: {
      type: Number,
      default: 0
    },
    maxStoryPoints: {
      type: Number,
      default: 40
    },
    hoursWorked: {
      type: Number,
      default: 0
    },
    maxHours: {
      type: Number,
      default: 40
    }
  },
  performance: {
    velocityAverage: {
      type: Number,
      default: 0
    },
    completionRate: {
      type: Number,
      default: 0
    },
    qualityScore: {
      type: Number,
      default: 0
    }
  },
  joinedDate: {
    type: Date,
    default: Date.now
  },
  lastActiveDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices
teamMemberSchema.index({ user: 1, team: 1 }, { unique: true });
teamMemberSchema.index({ team: 1, status: 1 });
teamMemberSchema.index({ role: 1 });

// Virtuals
teamMemberSchema.virtual('workloadPercentage').get(function() {
  if (this.workload.maxStoryPoints === 0) return 0;
  return Math.round((this.workload.currentStoryPoints / this.workload.maxStoryPoints) * 100);
});

teamMemberSchema.virtual('isOverloaded').get(function() {
  return this.workloadPercentage > 100;
});

teamMemberSchema.virtual('capacityRemaining').get(function() {
  return Math.max(0, this.workload.maxStoryPoints - this.workload.currentStoryPoints);
});

// Métodos de instancia
teamMemberSchema.methods.updateWorkload = function(storyPoints, hours) {
  this.workload.currentStoryPoints += storyPoints;
  this.workload.hoursWorked += hours;
  this.lastActiveDate = new Date();
  return this.save();
};

teamMemberSchema.methods.resetSprintWorkload = function() {
  this.workload.currentStoryPoints = 0;
  this.workload.hoursWorked = 0;
  return this.save();
};

teamMemberSchema.methods.addSkill = function(skillName, level = 'intermediate') {
  const existingSkill = this.skills.find(skill => skill.name === skillName);
  if (existingSkill) {
    existingSkill.level = level;
  } else {
    this.skills.push({ name: skillName, level });
  }
  return this.save();
};

// Métodos estáticos
teamMemberSchema.statics.getTeamOverview = async function(teamName) {
  return this.aggregate([
    { $match: { team: teamName } },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    { $unwind: '$userInfo' },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        members: {
          $push: {
            _id: '$_id',
            user: '$userInfo',
            role: '$role',
            availability: '$availability',
            workload: '$workload',
            performance: '$performance'
          }
        }
      }
    }
  ]);
};

teamMemberSchema.statics.getTeamCapacity = async function(teamName) {
  return this.aggregate([
    { $match: { team: teamName, status: 'active' } },
    {
      $group: {
        _id: null,
        totalMembers: { $sum: 1 },
        totalCapacity: { $sum: '$workload.maxStoryPoints' },
        currentWorkload: { $sum: '$workload.currentStoryPoints' },
        averageAvailability: { $avg: '$availability' }
      }
    }
  ]);
};

teamMemberSchema.statics.getSkillsMatrix = async function(teamName) {
  return this.aggregate([
    { $match: { team: teamName, status: 'active' } },
    { $unwind: '$skills' },
    {
      $group: {
        _id: '$skills.name',
        levels: {
          $push: {
            memberId: '$_id',
            level: '$skills.level'
          }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

// Middleware pre-save
teamMemberSchema.pre('save', function(next) {
  this.lastActiveDate = new Date();
  next();
});

// Configurar virtuals en JSON
teamMemberSchema.set('toJSON', { virtuals: true });
teamMemberSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('TeamMember', teamMemberSchema);
