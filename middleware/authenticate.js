const User = require('../models/User');
const { clerkClient } = require('@clerk/clerk-sdk-node');

// Middleware principal de autenticación
const authenticate = async (req, res, next) => {
  console.log('Iniciando autenticación...');
  console.log('Headers:', req.headers);
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      console.log('No token provided in headers');
      return res.status(401).json({ message: 'Token no proporcionado' });
    }
    
    console.log('Verificando token con Clerk...');

    // Verificar token con Clerk
    const session = await clerkClient.verifyToken(token);
    
    if (!session) {
      console.log('Token inválido:', token);
      return res.status(401).json({ message: 'Token inválido' });
    }

    console.log('Session verificada:', session);

    // Obtener información del usuario de Clerk
    const clerkUser = await clerkClient.users.getUser(session.sub);
    
    if (!clerkUser) {
      console.log('Usuario no encontrado en Clerk:', session.sub);
      return res.status(401).json({ message: 'Usuario no encontrado en Clerk' });
    }

    console.log('Usuario Clerk encontrado:', clerkUser.id);

    // Buscar usuario en la base de datos
    let user = await User.findOne({ clerk_id: session.sub });
    
    // Si el usuario no existe en la base de datos, lo creamos
    if (!user) {
      console.log('Creando nuevo usuario en la base de datos para:', session.sub);
      const userData = {
        clerk_id: session.sub,
        email: clerkUser.emailAddresses[0].emailAddress,
        nombre_negocio: clerkUser.firstName || 'Usuario',
        role: clerkUser.publicMetadata?.role || 'user', // Usamos el rol de Clerk si existe
        is_active: true
      };
      console.log('Datos del usuario a crear:', userData);
      
      try {
        user = new User(userData);
        await user.save();
        console.log('Usuario creado exitosamente:', user._id);
        console.log('Nuevo usuario creado:', user);
      } catch (error) {
        console.error('Error al crear usuario:', error);
        return res.status(500).json({ message: 'Error al crear usuario en la base de datos' });
      }
    }

    // Verificar si el usuario está activo
    if (!user.is_active) {
      return res.status(401).json({ message: 'Usuario desactivado' });
    }
    
    // Añadir objeto de usuario a la petición
    req.user = {
      _id: user._id,
      id: user._id,   // Mantener id por compatibilidad
      clerk_id: user.clerk_id,
      email: user.email,
      role: user.role,
      nombre_negocio: user.nombre_negocio,
      is_active: user.is_active
    };

    console.log('Usuario autenticado:', req.user);
    next();
  } catch (error) {
    console.error('Error en autenticación:', error);
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: error.message 
    });
  }
};

// Middleware para verificar roles específicos
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'No tienes permisos para realizar esta acción',
        required_roles: roles,
        your_role: req.user.role
      });
    }

    next();
  };
};

// Middleware específicos por rol
const requireSuperAdmin = authorize('super_admin');
const requireAdmin = authorize('admin', 'super_admin');
const requireUser = authorize('user', 'admin', 'super_admin');

// Función de utilidad para verificar permisos
const hasPermission = (userRole, requiredRoles) => {
  return requiredRoles.includes(userRole);
};



// Función para verificar si puede modificar notas de otros usuarios
const canModifyAllNotes = (userRole) => {
  return ['admin', 'super_admin'].includes(userRole);
};

// Función para verificar si puede eliminar notas
const canDeleteNotes = (userRole) => {
  return ['admin', 'super_admin'].includes(userRole);
};

module.exports = {
  authenticate,
  authorize,
  requireSuperAdmin,
  requireAdmin,
  requireUser,
  hasPermission,
  canModifyAllNotes,
  canDeleteNotes
};