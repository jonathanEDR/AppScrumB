const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  clerk_id: { 
    type: String, 
    required: [true, 'clerk_id es requerido'],
    unique: true,
    index: true // Añadimos índice para búsquedas más rápidas
  },
  nombre_negocio: { 
    type: String, 
    required: false,
    trim: true // Elimina espacios en blanco
  },
  email: { 
    type: String, 
    required: [true, 'Email es requerido'],
    unique: true,
    trim: true,
    lowercase: true, // Convierte a minúsculas
    match: [/.+@.+\..+/, 'Por favor ingrese un email válido']
  },
  role: {
    type: String,
    enum: {
      values: ['super_admin', 'product_owner', 'scrum_master', 'developers', 'user'],
      message: '{VALUE} no es un rol válido. Roles válidos: super_admin, product_owner, scrum_master, developers, user'
    },
    default: 'user',
    set: function(value) {
      // Normalizar el rol antes de guardarlo
      if (!value) return 'user';
      const normalized = value.toLowerCase().trim();
      
      // Mapeo de variaciones comunes a roles válidos
      const roleMap = {
        'admin': 'super_admin',
        'developer': 'developers',
        'dev': 'developers'
      };
      
      return roleMap[normalized] || normalized;
    }
  },
  fecha_creacion: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  is_active: { type: Boolean, default: true },

  // ==================== CV / PERFIL PROFESIONAL ====================
  
  // Información Personal
  profile: {
    // Foto de perfil (URL de Cloudinary o avatar de Clerk)
    photo: {
      type: String,
      default: null
    },
    photoPublicId: {
      type: String,
      default: null
    },
    
    // Información de contacto
    phone: {
      type: String,
      trim: true,
      default: null
    },
    location: {
      city: { type: String, trim: true, default: null },
      country: { type: String, trim: true, default: null }
    },
    
    // Enlaces profesionales
    links: {
      linkedin: { type: String, trim: true, default: null },
      github: { type: String, trim: true, default: null },
      portfolio: { type: String, trim: true, default: null }
    },
    
    // Biografía corta
    bio: {
      type: String,
      maxlength: [500, 'La biografía no puede exceder 500 caracteres'],
      default: null
    },
    
    // Información profesional
    professional: {
      title: { 
        type: String, 
        trim: true,
        default: null,
        maxlength: [100, 'El título no puede exceder 100 caracteres']
      },
      specialty: { 
        type: String, 
        trim: true,
        default: null,
        maxlength: [200, 'La especialidad no puede exceder 200 caracteres']
      },
      yearsOfExperience: { 
        type: Number, 
        min: 0,
        max: 50,
        default: 0 
      },
      availability: { 
        type: String,
        enum: ['full_time', 'part_time', 'freelance', 'unavailable'],
        default: 'full_time'
      }
    }
  },

  // Habilidades técnicas (máximo 20 habilidades)
  skills: {
    type: [{
      name: { type: String, required: true, trim: true },
      category: { 
        type: String, 
        enum: ['language', 'framework', 'tool', 'methodology', 'other'],
        default: 'other'
      },
      level: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
        default: 'intermediate'
      }
    }],
    validate: {
      validator: function(skills) {
        return skills.length <= 20;
      },
      message: 'No se pueden agregar más de 20 habilidades'
    },
    default: []
  },

  // Experiencia laboral (máximo 3 experiencias)
  experience: {
    type: [{
      company: { type: String, required: true, trim: true },
      position: { type: String, required: true, trim: true },
      startDate: { type: Date, required: true },
      endDate: { type: Date, default: null }, // null = trabajo actual
      isCurrent: { type: Boolean, default: false },
      description: { 
        type: String, 
        maxlength: [1000, 'La descripción no puede exceder 1000 caracteres']
      },
      technologies: [{ type: String, trim: true }],
      achievements: [{ type: String, trim: true }]
    }],
    validate: {
      validator: function(exp) {
        return exp.length <= 3;
      },
      message: 'No se pueden agregar más de 3 experiencias laborales'
    },
    default: []
  },

  // Educación (máximo 3 títulos)
  education: {
    type: [{
      institution: { type: String, required: true, trim: true },
      degree: { type: String, required: true, trim: true },
      field: { type: String, trim: true },
      level: {
        type: String,
        enum: ['high_school', 'technical', 'bachelor', 'master', 'phd', 'other'],
        default: 'bachelor'
      },
      startDate: { type: Date, required: true },
      endDate: { type: Date, default: null },
      status: {
        type: String,
        enum: ['completed', 'in_progress', 'incomplete'],
        default: 'completed'
      },
      description: { 
        type: String, 
        maxlength: [500, 'La descripción no puede exceder 500 caracteres']
      }
    }],
    validate: {
      validator: function(edu) {
        return edu.length <= 3;
      },
      message: 'No se pueden agregar más de 3 títulos educativos'
    },
    default: []
  },

  // Proyectos destacados (máximo 3 proyectos)
  projects: {
    type: [{
      name: { type: String, required: true, trim: true },
      description: { 
        type: String, 
        required: true,
        maxlength: [500, 'La descripción no puede exceder 500 caracteres']
      },
      url: { type: String, trim: true },
      imageUrl: { type: String },
      imagePublicId: { type: String },
      technologies: [{ type: String, trim: true }],
      date: { type: Date, default: Date.now },
      role: { type: String, trim: true }
    }],
    validate: {
      validator: function(projects) {
        return projects.length <= 3;
      },
      message: 'No se pueden agregar más de 3 proyectos'
    },
    default: []
  },

  // Certificaciones (máximo 3 certificaciones)
  certifications: {
    type: [{
      name: { type: String, required: true, trim: true },
      issuer: { type: String, required: true, trim: true },
      issueDate: { type: Date, required: true },
      expirationDate: { type: Date, default: null },
      credentialId: { type: String, trim: true },
      credentialUrl: { type: String, trim: true }
    }],
    validate: {
      validator: function(certs) {
        return certs.length <= 3;
      },
      message: 'No se pueden agregar más de 3 certificaciones'
    },
    default: []
  }
});

// Middleware para actualizar updated_at antes de guardar
userSchema.pre('save', async function(next) {
  this.updated_at = Date.now();
  
  // Verificar si el usuario ya existe
  if (this.isNew) {
    const existingUser = await this.constructor.findOne({
      $or: [
        { clerk_id: this.clerk_id },
        { email: this.email }
      ]
    });

    if (existingUser) {
      const error = new Error('Usuario ya existe');
      error.code = 11000;
      return next(error);
    }
  }
  
  next();
});

// Manejo de errores de duplicados
userSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    if (error.code === 11000) {
      console.error('Error de duplicado:', error);
      next(new Error('Ya existe un usuario con ese email o clerk_id'));
    } else {
      next(error);
    }
  } else {
    next(error);
  }
});

// Evitamos el error de modelo duplicado
let UserModel;
try {
  UserModel = mongoose.model('User');
} catch (error) {
  UserModel = mongoose.model('User', userSchema);
}

module.exports = UserModel;