const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  // Referencia al recurso comentado (polimórfico)
  resourceType: {
    type: String,
    required: true,
    enum: ['BugReport', 'Task', 'BacklogItem', 'Sprint', 'Impediment'],
    index: true
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'resourceType',
    index: true
  },
  
  // Autor del comentario
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Contenido del comentario
  content: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 5000
  },
  
  // Tipo de comentario
  type: {
    type: String,
    enum: ['comment', 'status_change', 'system'],
    default: 'comment'
  },
  
  // Metadatos adicionales (para cambios de estado, etc.)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Comentario padre (para hilos/respuestas)
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  
  // Archivos adjuntos
  attachments: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Control de edición
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  editHistory: [{
    content: String,
    editedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Menciones a usuarios
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Reacciones
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Control de eliminación suave
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices compuestos para optimizar consultas
commentSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
commentSchema.index({ author: 1, createdAt: -1 });
commentSchema.index({ parentComment: 1 });

// Virtual para contar respuestas
commentSchema.virtual('repliesCount', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'parentComment',
  count: true
});

// Método para obtener comentarios con respuestas
commentSchema.statics.getCommentThread = async function(resourceType, resourceId, options = {}) {
  const { 
    page = 1, 
    limit = 20, 
    sortBy = '-createdAt' 
  } = options;

  const skip = (page - 1) * limit;

  const comments = await this.find({
    resourceType,
    resourceId,
    parentComment: null, // Solo comentarios de nivel superior
    isDeleted: false
  })
    .populate('author', 'name email avatar role')
    .populate({
      path: 'parentComment',
      select: 'author content createdAt',
      populate: { path: 'author', select: 'name' }
    })
    .sort(sortBy)
    .skip(skip)
    .limit(limit)
    .lean();

  // Obtener respuestas para cada comentario
  for (const comment of comments) {
    const replies = await this.find({
      parentComment: comment._id,
      isDeleted: false
    })
      .populate('author', 'name email avatar role')
      .sort('createdAt')
      .lean();
    
    comment.replies = replies;
  }

  const total = await this.countDocuments({
    resourceType,
    resourceId,
    parentComment: null,
    isDeleted: false
  });

  return {
    comments,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Método para editar comentario
commentSchema.methods.edit = function(newContent) {
  // Guardar versión anterior en historial
  if (this.content !== newContent) {
    this.editHistory.push({
      content: this.content,
      editedAt: new Date()
    });
    
    this.content = newContent;
    this.isEdited = true;
    this.editedAt = new Date();
  }
  
  return this.save();
};

// Método para eliminación suave
commentSchema.methods.softDelete = function(userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  return this.save();
};

// Middleware pre-save para extraer menciones
commentSchema.pre('save', function(next) {
  if (this.isModified('content')) {
    // Extraer menciones usando regex @[userId]
    const mentionRegex = /@\[([a-fA-F0-9]{24})\]/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(this.content)) !== null) {
      mentions.push(mongoose.Types.ObjectId(match[1]));
    }
    
    this.mentions = [...new Set(mentions)]; // Eliminar duplicados
  }
  
  next();
});

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;
