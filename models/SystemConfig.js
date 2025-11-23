const mongoose = require('mongoose');

/**
 * Modelo de configuración del sistema
 * Almacena la configuración global de la aplicación incluyendo:
 * - Logo del sistema
 * - Tema (claro/oscuro)
 * - Colores personalizados
 * - Nombre de la aplicación
 */
const systemConfigSchema = new mongoose.Schema({
  // Identificador único (siempre será 'main' - singleton)
  configId: {
    type: String,
    required: true,
    unique: true,
    default: 'main'
  },
  
  // Configuración de branding
  branding: {
    // Nombre de la aplicación
    appName: {
      type: String,
      default: 'AppScrum',
      trim: true
    },
    
    // Logo principal (URL de Cloudinary)
    logo: {
      type: String,
      default: null
    },
    
    // Public ID del logo en Cloudinary
    logoPublicId: {
      type: String,
      default: null
    },
    
    // Versiones optimizadas del logo (thumbnail, medium, large)
    logoVersions: {
      original: String,
      thumbnail: String,
      medium: String,
      large: String
    },
    
    // Logo pequeño para favicon (URL de Cloudinary)
    logoSmall: {
      type: String,
      default: null
    },
    
    // Public ID del logo pequeño en Cloudinary
    logoSmallPublicId: {
      type: String,
      default: null
    },
    
    // Versiones optimizadas del logo pequeño
    logoSmallVersions: {
      original: String,
      thumbnail: String,
      medium: String,
      large: String
    },
    
    // Descripción de la aplicación
    description: {
      type: String,
      default: 'Sistema de gestión ágil de proyectos',
      trim: true
    }
  },
  
  // Configuración de tema
  theme: {
    // Modo actual: 'light' o 'dark'
    mode: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    },
    
    // Tema por defecto para nuevos usuarios
    defaultMode: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    },
    
    // Permitir a usuarios cambiar el tema
    allowUserToggle: {
      type: Boolean,
      default: true
    },
    
    // Colores personalizados para modo claro
    lightColors: {
      primary: { type: String, default: '#64748b' },
      secondary: { type: String, default: '#a855f7' },
      accent: { type: String, default: '#22d3ee' },
      success: { type: String, default: '#10b981' },
      warning: { type: String, default: '#fbbf24' },
      error: { type: String, default: '#f87171' },
      background: { type: String, default: '#f8fafc' },
      surface: { type: String, default: '#ffffff' },
      text: { type: String, default: '#0f172a' }
    },
    
    // Colores personalizados para modo oscuro
    darkColors: {
      primary: { type: String, default: '#94a3b8' },
      secondary: { type: String, default: '#c084fc' },
      accent: { type: String, default: '#67e8f9' },
      success: { type: String, default: '#34d399' },
      warning: { type: String, default: '#fbbf24' },
      error: { type: String, default: '#f87171' },
      background: { type: String, default: '#0f172a' },
      surface: { type: String, default: '#1e293b' },
      text: { type: String, default: '#f8fafc' }
    }
  },
  
  // Configuración de características
  features: {
    // Habilitar modo oscuro
    enableDarkMode: {
      type: Boolean,
      default: true
    },
    
    // Habilitar personalización de colores
    enableCustomColors: {
      type: Boolean,
      default: false
    }
  },
  
  // Archivos subidos desde el panel de administración
  adminFiles: [{
    publicId: {
      type: String,
      required: true
    },
    url: {
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
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Metadatos
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// El índice ya está definido en el schema con unique: true, no necesitamos duplicarlo aquí
// systemConfigSchema.index({ configId: 1 }, { unique: true }); // REMOVIDO para evitar warning

// Método estático para obtener o crear la configuración principal
systemConfigSchema.statics.getMainConfig = async function() {
  let config = await this.findOne({ configId: 'main' });
  
  if (!config) {
    config = await this.create({ 
      configId: 'main',
      branding: {
        appName: 'AppScrum',
        description: 'Sistema de gestión ágil de proyectos'
      },
      theme: {
        mode: 'light',
        defaultMode: 'light',
        allowUserToggle: true
      },
      features: {
        enableDarkMode: true,
        enableCustomColors: false
      }
    });
  }
  
  return config;
};

// Método para actualizar configuración
systemConfigSchema.methods.updateConfig = async function(updates, userId) {
  // Actualizar campos
  Object.keys(updates).forEach(key => {
    if (this[key] !== undefined) {
      if (typeof updates[key] === 'object' && !Array.isArray(updates[key])) {
        // Para objetos anidados, hacer merge
        this[key] = { ...this[key], ...updates[key] };
      } else {
        this[key] = updates[key];
      }
    }
  });
  
  this.updatedBy = userId;
  this.lastUpdated = Date.now();
  
  return await this.save();
};

const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);

module.exports = SystemConfig;
