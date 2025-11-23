// Importar tanto el SDK nuevo como el antiguo para transición gradual
const { clerkClient } = require('@clerk/clerk-sdk-node');
// const { clerkClient: newClerkClient } = require('@clerk/express'); // Descomentar cuando migremos
const authService = require('../services/authService');
const { RolePermissionsService, ROLES } = require('../services/rolePermissionsService');

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
    
    // Añadir objeto de usuario a la petición con permisos
    req.user = {
      _id: user._id,
      id: user._id,   // Mantener id por compatibilidad
      clerk_id: user.clerk_id,
      email: user.email,
      role: user.role,
      nombre_negocio: user.nombre_negocio,
      is_active: user.is_active,
      permissions: RolePermissionsService.getPermissions(user.role)
    };

    console.log('Usuario autenticado:', { 
      id: req.user._id, 
      email: req.user.email, 
      role: req.user.role 
    });

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
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        status: 'error',
        code: 'AUTH_REQUIRED',
        message: 'Usuario no autenticado' 
      });
    }

    // Normalizar roles permitidos
    const normalizedAllowedRoles = allowedRoles.map(role => 
      RolePermissionsService.normalizeRole(role)
    );

    if (!RolePermissionsService.hasAnyRole(req.user.role, normalizedAllowedRoles)) {
      return res.status(403).json({ 
        status: 'error',
        code: 'FORBIDDEN',
        message: 'No tienes permisos para realizar esta acción',
        required_roles: normalizedAllowedRoles,
        your_role: req.user.role
      });
    }

    next();
  };
};

// Middleware para verificar permisos específicos
const requirePermission = (permissionName) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        status: 'error',
        code: 'AUTH_REQUIRED',
        message: 'Usuario no autenticado' 
      });
    }

    if (!RolePermissionsService.hasPermission(req.user.role, permissionName)) {
      return res.status(403).json({ 
        status: 'error',
        code: 'FORBIDDEN',
        message: `No tienes el permiso necesario: ${permissionName}`,
        your_role: req.user.role,
        required_permission: permissionName
      });
    }

    next();
  };
};

// Middleware específicos por rol
const requireSuperAdmin = authorize(ROLES.SUPER_ADMIN);
const requireProductOwner = authorize(ROLES.SUPER_ADMIN, ROLES.PRODUCT_OWNER);
const requireScrumMaster = authorize(ROLES.SUPER_ADMIN, ROLES.PRODUCT_OWNER, ROLES.SCRUM_MASTER);
const requireDeveloper = authorize(ROLES.SUPER_ADMIN, ROLES.SCRUM_MASTER, ROLES.DEVELOPERS);
const requireUser = authorize(...Object.values(ROLES));

// Función de utilidad para verificar permisos
const hasPermission = (userRole, permissionName) => {
  return RolePermissionsService.hasPermission(userRole, permissionName);
};

// Función para verificar si puede modificar notas de otros usuarios
const canModifyAllNotes = (userRole) => {
  return RolePermissionsService.hasPermission(userRole, 'canEditAllTasks');
};

// Función para verificar si puede eliminar notas
const canDeleteNotes = (userRole) => {
  return RolePermissionsService.hasPermission(userRole, 'canDeleteTasks');
};

module.exports = {
  authenticate,
  authorize,
  requirePermission,
  requireSuperAdmin,
  requireProductOwner,
  requireScrumMaster,
  requireDeveloper,
  requireUser,
  hasPermission,
  canModifyAllNotes,
  canDeleteNotes,
  // Exportar también el servicio de roles para uso en rutas
  RolePermissionsService,
  ROLES
};