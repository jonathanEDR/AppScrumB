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
      message: '{VALUE} no es un rol válido'
    },
    default: 'user'
  },
  fecha_creacion: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  is_active: { type: Boolean, default: true }
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