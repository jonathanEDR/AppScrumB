const express = require('express');
const User = require('../models/User');
const { 
  authenticate, 
  requireSuperAdmin, 
  requireAdmin 
} = require('../middleware/authenticate');
const router = express.Router();

// ============= RUTAS SOLO PARA SUPER ADMIN =============

// Obtener todos los usuarios
router.get('/users', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    console.log('=== GET /users request ===');
    console.log('User making request:', req.user);
    console.log('Query params:', req.query);
    
    const { page = 1, limit = 10, search = '', role = 'all' } = req.query;
    const skip = (page - 1) * limit;
    
    let filter = {};
    
    // Filtrar por rol si se especifica
    if (role && role !== 'all') {
      filter.role = role;
    }
    
    // Buscar por nombre o email
    if (search) {
      filter.$or = [
        { nombre_negocio: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    console.log('Filter applied:', filter);
    
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filter)
    ]);
    
    console.log('Users found:', users.length);
    console.log('Total users:', total);
      
    const response = {
      users,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_users: total,
        per_page: parseInt(limit)
      }
    };
    
    console.log('Sending response:', response);
    res.status(200).json(response);
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ message: 'Error al obtener usuarios', error: error.message });
  }
});

// Asignar rol a un usuario
router.put('/users/:userId/role', authenticate, requireSuperAdmin, async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;
  
  try {
    // Validar que el rol sea válido
    // Solo permitir roles válidos definidos en el sistema
    const validRoles = ['user', 'developers', 'scrum_master', 'product_owner', 'super_admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        message: 'Rol inválido',
        valid_roles: validRoles
      });
    }
      // No permitir que se cambie el rol del propio super admin
    if (req.user._id.toString() === userId) {
      return res.status(403).json({ 
        message: 'No puedes cambiar tu propio rol como super admin' 
      });
    }
    
    // No permitir cambiar el rol de otros super admin
    const userToUpdate = await User.findById(userId);
    if (!userToUpdate) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    if (userToUpdate.role === 'super_admin' && req.user._id.toString() !== userId) {
      return res.status(403).json({ 
        message: 'No puedes modificar el rol de otro super admin' 
      });
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { role, updated_at: Date.now() },
      { new: true }
    ).select('-__v');
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.status(200).json({
      message: `Rol actualizado a ${role} exitosamente`,
      user: updatedUser
    });
  } catch (error) {
    console.error('Error actualizando rol:', error);
    res.status(500).json({ message: 'Error al actualizar rol', error: error.message });
  }
});

// Activar/Desactivar usuario
router.put('/users/:userId/status', authenticate, requireSuperAdmin, async (req, res) => {
  const { userId } = req.params;
  const { is_active } = req.body;
  
  try {
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ message: 'is_active debe ser true o false' });
    }
    
    // No permitir desactivar al propio super admin
    if (req.user._id.toString() === userId && !is_active) {
      return res.status(403).json({ 
        message: 'No puedes desactivar tu propia cuenta' 
      });
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { is_active, updated_at: Date.now() },
      { new: true }
    ).select('-__v');
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.status(200).json({
      message: `Usuario ${is_active ? 'activado' : 'desactivado'} exitosamente`,
      user: updatedUser
    });
  } catch (error) {
    console.error('Error actualizando status:', error);
    res.status(500).json({ message: 'Error al actualizar status', error: error.message });
  }
});



module.exports = router;