const User = require('../models/User');
const { clerkClient } = require('@clerk/clerk-sdk-node');

class AuthService {
  // Verifica y obtiene la información del usuario de Clerk
  async verifyToken(token) {
    try {
      const session = await clerkClient.verifyToken(token);
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
      // Buscar usuario existente
      let user = await User.findOne({ clerk_id: clerkId });
      
      if (!user) {
        // Crear nuevo usuario si no existe
        user = new User({
          clerk_id: clerkId,
          email: userEmail,
          nombre_negocio: firstName || 'Usuario',
          role: 'user',
          is_active: true
        });
        
        await user.save();
        console.log('Usuario creado:', user._id);
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
  async updateUserRole(clerkId, role) {
    try {
      const user = await User.findOneAndUpdate(
        { clerk_id: clerkId },
        { role },
        { new: true }
      );

      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      // Actualizar también en Clerk
      await clerkClient.users.updateUser(clerkId, {
        publicMetadata: { role }
      });

      return user;
    } catch (error) {
      console.error('Error actualizando rol:', error);
      throw error;
    }
  }
}

module.exports = new AuthService();
