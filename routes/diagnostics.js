/**
 * Endpoint de diagnóstico del sistema de roles
 * GET /api/admin/diagnostics/roles
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate, requireSuperAdmin, RolePermissionsService, ROLES } = require('../middleware/authenticate');

// Diagnóstico completo del sistema de roles
router.get('/roles', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    console.log('🔍 Ejecutando diagnóstico del sistema de roles...');

    // 1. Estadísticas de usuarios por rol
    const roleDistribution = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          users: { 
            $push: { 
              email: '$email', 
              clerk_id: '$clerk_id',
              is_active: '$is_active',
              fecha_creacion: '$fecha_creacion'
            } 
          }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // 2. Usuarios con roles inválidos
    const validRoles = Object.values(ROLES);
    const invalidRoleUsers = await User.find({
      role: { $nin: validRoles }
    }).select('email clerk_id role is_active');

    // 3. Usuarios inactivos
    const inactiveUsers = await User.countDocuments({ is_active: false });

    // 4. Total de usuarios
    const totalUsers = await User.countDocuments();

    // 5. Verificar sincronización con Clerk (solo primeros 5 usuarios)
    const recentUsers = await User.find().limit(5).sort({ fecha_creacion: -1 });
    
    // 6. Información de permisos por rol
    const permissionsMatrix = {};
    validRoles.forEach(role => {
      permissionsMatrix[role] = {
        roleInfo: RolePermissionsService.getRoleInfo(role),
        permissions: RolePermissionsService.getPermissions(role)
      };
    });

    // Construir respuesta
    const diagnostics = {
      status: 'success',
      timestamp: new Date().toISOString(),
      summary: {
        total_users: totalUsers,
        active_users: totalUsers - inactiveUsers,
        inactive_users: inactiveUsers,
        roles_in_use: roleDistribution.length,
        invalid_roles_found: invalidRoleUsers.length
      },
      role_distribution: roleDistribution.map(({ _id, count, users }) => ({
        role: _id,
        role_name: RolePermissionsService.getRoleInfo(_id).name,
        count: count,
        percentage: ((count / totalUsers) * 100).toFixed(2) + '%',
        sample_users: users.slice(0, 3).map(u => ({ email: u.email, is_active: u.is_active }))
      })),
      issues: {
        invalid_roles: invalidRoleUsers.map(u => ({
          email: u.email,
          clerk_id: u.clerk_id,
          current_role: u.role,
          suggested_fix: 'Ejecutar script de migración o actualizar manualmente'
        }))
      },
      system_config: {
        valid_roles: validRoles,
        role_hierarchy: RolePermissionsService.getRoleLevel ? 
          validRoles.map(role => ({
            role,
            level: RolePermissionsService.getRoleLevel(role)
          })) : 'No disponible',
        normalization_enabled: true
      },
      permissions_matrix: permissionsMatrix,
      recent_users: recentUsers.map(u => ({
        email: u.email,
        role: u.role,
        role_name: RolePermissionsService.getRoleInfo(u.role).name,
        is_active: u.is_active,
        created: u.fecha_creacion
      })),
      recommendations: generateRecommendations({
        invalidRoleUsers,
        inactiveUsers,
        totalUsers,
        roleDistribution
      })
    };

    res.json(diagnostics);

  } catch (error) {
    console.error('❌ Error en diagnóstico de roles:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al ejecutar diagnóstico',
      error: error.message
    });
  }
});

// Generar recomendaciones basadas en el diagnóstico
function generateRecommendations({ invalidRoleUsers, inactiveUsers, totalUsers, roleDistribution }) {
  const recommendations = [];

  // Usuarios con roles inválidos
  if (invalidRoleUsers.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      type: 'INVALID_ROLES',
      message: `Se encontraron ${invalidRoleUsers.length} usuarios con roles inválidos`,
      action: 'Ejecutar: node scripts/migrate-user-roles.js',
      affected_users: invalidRoleUsers.length
    });
  }

  // Demasiados usuarios inactivos
  if (inactiveUsers > totalUsers * 0.3) {
    recommendations.push({
      priority: 'MEDIUM',
      type: 'INACTIVE_USERS',
      message: `Más del 30% de usuarios están inactivos (${inactiveUsers}/${totalUsers})`,
      action: 'Revisar y limpiar usuarios inactivos',
      affected_users: inactiveUsers
    });
  }

  // Solo un Super Admin
  const superAdmins = roleDistribution.find(r => r._id === 'super_admin');
  if (superAdmins && superAdmins.count === 1) {
    recommendations.push({
      priority: 'MEDIUM',
      type: 'SINGLE_ADMIN',
      message: 'Solo hay 1 Super Admin en el sistema',
      action: 'Considerar agregar un segundo Super Admin como respaldo',
      affected_users: 1
    });
  }

  // Sin Super Admins
  if (!superAdmins || superAdmins.count === 0) {
    recommendations.push({
      priority: 'CRITICAL',
      type: 'NO_ADMIN',
      message: '⚠️ No hay Super Admins en el sistema',
      action: 'Asignar rol super_admin a al menos un usuario',
      affected_users: 0
    });
  }

  // Muchos usuarios con rol genérico
  const genericUsers = roleDistribution.find(r => r._id === 'user');
  if (genericUsers && genericUsers.count > totalUsers * 0.5) {
    recommendations.push({
      priority: 'LOW',
      type: 'GENERIC_ROLES',
      message: `Más del 50% de usuarios tienen rol genérico 'user'`,
      action: 'Revisar y asignar roles específicos según función',
      affected_users: genericUsers.count
    });
  }

  // Todo OK
  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'INFO',
      type: 'HEALTHY',
      message: '✅ Sistema de roles funcionando correctamente',
      action: 'Ninguna acción requerida'
    });
  }

  return recommendations;
}

module.exports = router;
