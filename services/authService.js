const User = require('../models/User');
const { clerkClient } = require('@clerk/clerk-sdk-node');
const mongoose = require('mongoose');
const { RolePermissionsService, ROLES } = require('./rolePermissionsService');

class AuthService {
  // Verifica y obtiene la información del usuario de Clerk
  async verifyToken(token) {
    try {
      // Agregar tolerancia para clock skew (10 segundos)
      const session = await clerkClient.verifyToken(token, {
        clockSkewInMs: 10000 // Tolerar 10 segundos de diferencia de reloj
      });
      if (!session) {
        throw new Error('Token inválido');
      }
      return session;
    } catch (error) {
      console.error('Error verificando token:', error);
      throw error;
    }
  }

  // Obtiene o crea un usuario en nuestra base de datos
  async getOrCreateUser(clerkId, userEmail, firstName) {
    try {
      // Verificar que la conexión a MongoDB esté lista (1 = conectado)
      if (mongoose.connection.readyState !== 1) {
        const err = new Error('MongoDB no está conectado');
        err.code = 'DB_NOT_CONNECTED';
        throw err;
      }

      // Buscar usuario existente
      let user = await User.findOne({ clerk_id: clerkId });

      if (!user) {
        // Obtener rol de metadata de Clerk si existe
        let clerkUser;
        try {
          clerkUser = await clerkClient.users.getUser(clerkId);
        } catch (clerkError) {
          console.warn('No se pudo obtener usuario de Clerk:', clerkError.message);
        }

        // Determinar el rol inicial
        let initialRole = ROLES.USER; // Rol por defecto
        
        if (clerkUser?.publicMetadata?.role) {
          // Normalizar el rol usando el servicio
          initialRole = RolePermissionsService.normalizeRole(clerkUser.publicMetadata.role);
        }

        // Crear nuevo usuario si no existe
        user = new User({
          clerk_id: clerkId,
          email: userEmail,
          nombre_negocio: firstName || 'Usuario',
          role: initialRole,
          is_active: true
        });

        await user.save();
        console.log('Usuario creado con rol:', user.role);

        // Sincronizar rol en Clerk
        try {
          await clerkClient.users.updateUser(clerkId, {
            publicMetadata: { 
              role: user.role,
              synced: true,
              syncedAt: new Date().toISOString()
            }
          });
        } catch (syncError) {
          console.warn('No se pudo sincronizar rol en Clerk:', syncError.message);
        }
      } else {
        // Usuario existe, verificar sincronización de rol con Clerk
        try {
          const clerkUser = await clerkClient.users.getUser(clerkId);
          const clerkRole = clerkUser?.publicMetadata?.role;
          
          // Si el rol en Clerk es diferente al de la BD, usar el de la BD como fuente de verdad
          if (clerkRole && clerkRole !== user.role) {
            console.log(`Sincronizando rol en Clerk: ${clerkRole} -> ${user.role}`);
            await clerkClient.users.updateUser(clerkId, {
              publicMetadata: { 
                role: user.role,
                synced: true,
                syncedAt: new Date().toISOString()
              }
            });
          }
        } catch (syncError) {
          console.warn('No se pudo verificar sincronización con Clerk:', syncError.message);
        }
      }

      return user;
    } catch (error) {
      console.error('Error en getOrCreateUser:', error);
      throw error;
    }
  }

  // Obtiene el perfil completo del usuario
  async getUserProfile(clerkId) {
    try {
      const [user, clerkUser] = await Promise.all([
        User.findOne({ clerk_id: clerkId }),
        clerkClient.users.getUser(clerkId)
      ]);

      if (!user || !clerkUser) {
        throw new Error('Usuario no encontrado');
      }

      return {
        ...user.toObject(),
        clerkData: {
          email: clerkUser.emailAddresses[0].emailAddress,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          metadata: clerkUser.publicMetadata
        }
      };
    } catch (error) {
      console.error('Error obteniendo perfil de usuario:', error);
      throw error;
    }
  }

  // Actualiza el rol del usuario
  async updateUserRole(clerkId, newRole) {
    try {
      // Normalizar el rol
      const normalizedRole = RolePermissionsService.normalizeRole(newRole);
      
      // Validar que el rol sea válido
      if (!RolePermissionsService.isValidRole(normalizedRole)) {
        throw new Error(`Rol inválido: ${newRole}`);
      }

      const user = await User.findOneAndUpdate(
        { clerk_id: clerkId },
        { role: normalizedRole, updated_at: Date.now() },
        { new: true }
      );

      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      // Sincronizar con Clerk
      try {
        await clerkClient.users.updateUser(clerkId, {
          publicMetadata: { 
            role: normalizedRole,
            synced: true,
            syncedAt: new Date().toISOString()
          }
        });
      } catch (clerkError) {
        console.warn('No se pudo actualizar rol en Clerk:', clerkError.message);
      }

      return user;
    } catch (error) {
      console.error('Error actualizando rol:', error);
      throw error;
    }
  }

  /**
   * Obtiene los permisos de un usuario
   */
  async getUserPermissions(clerkId) {
    try {
      const user = await User.findOne({ clerk_id: clerkId });
      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      return RolePermissionsService.getPermissions(user.role);
    } catch (error) {
      console.error('Error obteniendo permisos:', error);
      throw error;
    }
  }
}

module.exports = new AuthService();
