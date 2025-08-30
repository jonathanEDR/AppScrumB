const { clerkClient } = require('@clerk/clerk-sdk-node');
const authService = require('../services/authService');

// Middleware principal de autenticación
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      console.log('No token provided in headers');
      return res.status(401).json({ 
        status: 'error',
        code: 'AUTH_NO_TOKEN',
        message: 'Token no proporcionado' 
      });
    }

    // Verificar token con Clerk y obtener sesión
    const session = await authService.verifyToken(token);
    console.log('Session verificada:', session);

    // Obtener información del usuario de Clerk
    const clerkUser = await clerkClient.users.getUser(session.sub);
    console.log('Usuario Clerk encontrado:', clerkUser.id);

    // Obtener o crear usuario en nuestra base de datos
    const user = await authService.getOrCreateUser(
      session.sub,
      clerkUser.emailAddresses[0].emailAddress,
      clerkUser.firstName
    );
    
    // Verificar si el usuario está activo
    if (!user.is_active) {
      return res.status(401).json({ 
        status: 'error',
        code: 'USER_INACTIVE',
        message: 'Usuario desactivado' 
      });
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
    
    // Manejar diferentes tipos de errores
    if (error.message === 'Token inválido') {
      return res.status(401).json({ 
        status: 'error',
        code: 'INVALID_TOKEN',
        message: 'Token inválido o expirado'
      });
    }
    
    if (error.message === 'Usuario no encontrado') {
      return res.status(404).json({
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: 'Usuario no encontrado'
      });
    }
    
    // Error genérico del servidor
    res.status(500).json({ 
      status: 'error',
      code: 'SERVER_ERROR',
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