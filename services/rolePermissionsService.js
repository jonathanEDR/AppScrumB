/**
 * Servicio centralizado para manejo de roles y permisos
 * Fuente única de verdad para todo el sistema
 */

// Definición centralizada de roles
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  PRODUCT_OWNER: 'product_owner',
  SCRUM_MASTER: 'scrum_master',
  DEVELOPERS: 'developers',
  USER: 'user'
};

// Jerarquía de roles (de mayor a menor privilegio)
const ROLE_HIERARCHY = [
  ROLES.SUPER_ADMIN,
  ROLES.PRODUCT_OWNER,
  ROLES.SCRUM_MASTER,
  ROLES.DEVELOPERS,
  ROLES.USER
];

// Permisos detallados por rol
const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: {
    // Gestión de usuarios
    canManageUsers: true,
    canManageRoles: true,
    canViewAllUsers: true,
    canDeleteUsers: false, // Por seguridad
    canActivateDeactivateUsers: true,

    // Gestión de proyectos
    canCreateProjects: true,
    canEditAllProjects: true,
    canDeleteProjects: true,
    canViewAllProjects: true,

    // Gestión de backlog
    canManageBacklog: true,
    canEditBacklog: true,
    canDeleteBacklogItems: true,

    // Gestión de sprints
    canManageSprints: true,
    canEditSprints: true,
    canCloseSprints: true,

    // Gestión de tareas
    canViewAllTasks: true,
    canEditAllTasks: true,
    canAssignTasks: true,
    canDeleteTasks: true,

    // Reportes y métricas
    canViewMetrics: true,
    canExportData: true,

    // Configuración del sistema
    canAccessAdminPanel: true,
    canManageSystemSettings: true
  },

  [ROLES.PRODUCT_OWNER]: {
    // Gestión de usuarios
    canManageUsers: false,
    canManageRoles: false,
    canViewAllUsers: true,
    canDeleteUsers: false,
    canActivateDeactivateUsers: false,

    // Gestión de proyectos
    canCreateProjects: true,
    canEditAllProjects: true,
    canDeleteProjects: true,
    canViewAllProjects: true,

    // Gestión de backlog
    canManageBacklog: true,
    canEditBacklog: true,
    canDeleteBacklogItems: true,

    // Gestión de sprints
    canManageSprints: true,
    canEditSprints: true,
    canCloseSprints: false, // Solo Scrum Master

    // Gestión de tareas
    canViewAllTasks: true,
    canEditAllTasks: false,
    canAssignTasks: false,
    canDeleteTasks: false,

    // Reportes y métricas
    canViewMetrics: true,
    canExportData: true,

    // Configuración del sistema
    canAccessAdminPanel: false,
    canManageSystemSettings: false
  },

  [ROLES.SCRUM_MASTER]: {
    // Gestión de usuarios
    canManageUsers: false,
    canManageRoles: false,
    canViewAllUsers: true,
    canDeleteUsers: false,
    canActivateDeactivateUsers: false,

    // Gestión de proyectos
    canCreateProjects: false,
    canEditAllProjects: false,
    canDeleteProjects: false,
    canViewAllProjects: true,

    // Gestión de backlog
    canManageBacklog: true,
    canEditBacklog: true,
    canDeleteBacklogItems: false,

    // Gestión de sprints
    canManageSprints: true,
    canEditSprints: true,
    canCloseSprints: true,

    // Gestión de tareas
    canViewAllTasks: true,
    canEditAllTasks: true,
    canAssignTasks: true,
    canDeleteTasks: false,

    // Reportes y métricas
    canViewMetrics: true,
    canExportData: true,

    // Configuración del sistema
    canAccessAdminPanel: false,
    canManageSystemSettings: false
  },

  [ROLES.DEVELOPERS]: {
    // Gestión de usuarios
    canManageUsers: false,
    canManageRoles: false,
    canViewAllUsers: false,
    canDeleteUsers: false,
    canActivateDeactivateUsers: false,

    // Gestión de proyectos
    canCreateProjects: false,
    canEditAllProjects: false,
    canDeleteProjects: false,
    canViewAllProjects: false, // Solo proyectos asignados

    // Gestión de backlog
    canManageBacklog: false,
    canEditBacklog: false,
    canDeleteBacklogItems: false,

    // Gestión de sprints
    canManageSprints: false,
    canEditSprints: false,
    canCloseSprints: false,

    // Gestión de tareas
    canViewAllTasks: false, // Solo tareas asignadas
    canEditAllTasks: false, // Solo tareas propias
    canAssignTasks: false,
    canDeleteTasks: false,

    // Tareas propias
    canViewOwnTasks: true,
    canEditOwnTasks: true,
    canUpdateTaskStatus: true,

    // Reportes y métricas
    canViewMetrics: false, // Solo métricas propias
    canExportData: false,

    // Time tracking
    canTrackTime: true,
    canViewOwnTimeTracking: true,

    // Bug reports
    canReportBugs: true,
    canViewBugs: true,

    // Repositorios
    canViewRepositories: true,
    canManageRepositories: false,

    // Configuración del sistema
    canAccessAdminPanel: false,
    canManageSystemSettings: false
  },

  [ROLES.USER]: {
    // Gestión de usuarios
    canManageUsers: false,
    canManageRoles: false,
    canViewAllUsers: false,
    canDeleteUsers: false,
    canActivateDeactivateUsers: false,

    // Gestión de proyectos
    canCreateProjects: false,
    canEditAllProjects: false,
    canDeleteProjects: false,
    canViewAllProjects: false,

    // Gestión de backlog
    canManageBacklog: false,
    canEditBacklog: false,
    canDeleteBacklogItems: false,

    // Gestión de sprints
    canManageSprints: false,
    canEditSprints: false,
    canCloseSprints: false,

    // Gestión de tareas
    canViewAllTasks: false,
    canEditAllTasks: false,
    canAssignTasks: false,
    canDeleteTasks: false,

    // Dashboard básico
    canViewOwnDashboard: true,
    canViewOwnProfile: true,

    // Reportes y métricas
    canViewMetrics: false,
    canExportData: false,

    // Configuración del sistema
    canAccessAdminPanel: false,
    canManageSystemSettings: false
  }
};

class RolePermissionsService {
  /**
   * Valida si un rol es válido
   */
  static isValidRole(role) {
    return Object.values(ROLES).includes(role);
  }

  /**
   * Obtiene todos los roles válidos
   */
  static getValidRoles() {
    return Object.values(ROLES);
  }

  /**
   * Obtiene los permisos de un rol específico
   */
  static getPermissions(role) {
    if (!this.isValidRole(role)) {
      console.warn(`Rol inválido: ${role}, usando permisos de USER por defecto`);
      return ROLE_PERMISSIONS[ROLES.USER];
    }
    return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS[ROLES.USER];
  }

  /**
   * Verifica si un usuario tiene un permiso específico
   */
  static hasPermission(userRole, permissionName) {
    const permissions = this.getPermissions(userRole);
    return permissions[permissionName] === true;
  }

  /**
   * Verifica si el usuario tiene alguno de los roles especificados
   */
  static hasAnyRole(userRole, allowedRoles) {
    return allowedRoles.includes(userRole);
  }

  /**
   * Verifica si el usuario tiene un rol específico
   */
  static hasRole(userRole, requiredRole) {
    return userRole === requiredRole;
  }

  /**
   * Verifica si el rol tiene nivel de administrador
   */
  static isAdmin(role) {
    return role === ROLES.SUPER_ADMIN;
  }

  /**
   * Verifica si el rol tiene nivel de gestión (Product Owner o superior)
   */
  static isManager(role) {
    return [ROLES.SUPER_ADMIN, ROLES.PRODUCT_OWNER].includes(role);
  }

  /**
   * Verifica si el rol tiene nivel de facilitador (Scrum Master o superior)
   */
  static isFacilitator(role) {
    return [ROLES.SUPER_ADMIN, ROLES.PRODUCT_OWNER, ROLES.SCRUM_MASTER].includes(role);
  }

  /**
   * Obtiene el nivel jerárquico de un rol (menor número = mayor privilegio)
   */
  static getRoleLevel(role) {
    const index = ROLE_HIERARCHY.indexOf(role);
    return index === -1 ? ROLE_HIERARCHY.length : index;
  }

  /**
   * Compara dos roles (true si role1 tiene más privilegios que role2)
   */
  static hasHigherPrivilege(role1, role2) {
    return this.getRoleLevel(role1) < this.getRoleLevel(role2);
  }

  /**
   * Normaliza el nombre del rol (maneja variaciones)
   */
  static normalizeRole(role) {
    if (!role) return ROLES.USER;
    
    const normalized = role.toLowerCase().trim();
    
    // Mapeo de variaciones comunes
    const roleMap = {
      'developer': ROLES.DEVELOPERS,
      'developers': ROLES.DEVELOPERS,
      'dev': ROLES.DEVELOPERS,
      'admin': ROLES.SUPER_ADMIN, // Mapeo de admin a super_admin
      'super_admin': ROLES.SUPER_ADMIN,
      'superadmin': ROLES.SUPER_ADMIN,
      'product_owner': ROLES.PRODUCT_OWNER,
      'productowner': ROLES.PRODUCT_OWNER,
      'po': ROLES.PRODUCT_OWNER,
      'scrum_master': ROLES.SCRUM_MASTER,
      'scrummaster': ROLES.SCRUM_MASTER,
      'sm': ROLES.SCRUM_MASTER,
      'user': ROLES.USER
    };

    return roleMap[normalized] || ROLES.USER;
  }

  /**
   * Obtiene información legible del rol
   */
  static getRoleInfo(role) {
    const roleNames = {
      [ROLES.SUPER_ADMIN]: {
        name: 'Super Administrador',
        description: 'Acceso completo al sistema',
        color: 'purple'
      },
      [ROLES.PRODUCT_OWNER]: {
        name: 'Product Owner',
        description: 'Gestión de productos y backlog',
        color: 'blue'
      },
      [ROLES.SCRUM_MASTER]: {
        name: 'Scrum Master',
        description: 'Facilitador del equipo Scrum',
        color: 'green'
      },
      [ROLES.DEVELOPERS]: {
        name: 'Desarrollador',
        description: 'Miembro del equipo de desarrollo',
        color: 'orange'
      },
      [ROLES.USER]: {
        name: 'Usuario',
        description: 'Acceso básico al sistema',
        color: 'gray'
      }
    };

    return roleNames[role] || roleNames[ROLES.USER];
  }

  /**
   * Valida si se puede cambiar de un rol a otro
   */
  static canChangeRole(currentUserRole, targetUserRole, newRole) {
    // Solo super_admin puede cambiar roles
    if (!this.isAdmin(currentUserRole)) {
      return { allowed: false, reason: 'Solo Super Admin puede cambiar roles' };
    }

    // No se puede cambiar el rol de otro super_admin
    if (this.isAdmin(targetUserRole)) {
      return { allowed: false, reason: 'No se puede modificar el rol de otro Super Admin' };
    }

    // No se puede asignar un rol inválido
    if (!this.isValidRole(newRole)) {
      return { allowed: false, reason: 'Rol inválido' };
    }

    return { allowed: true };
  }
}

// Exportar constantes y servicio
module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS,
  RolePermissionsService
};
