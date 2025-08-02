const express = require('express');
const Product = require('../models/Product');
const BacklogItem = require('../models/BacklogItem');
const User = require('../models/User');
const { Sprint, Release } = require('../models/Sprint');
const { 
  authenticate, 
  authorize 
} = require('../middleware/authenticate');
const router = express.Router();

// Middleware para Product Owner y roles superiores
const requireProductOwnerOrAbove = authorize('product_owner', 'super_admin');

// ============= RUTAS DE PRODUCTOS =============

// Obtener todos los productos
router.get('/', authenticate, async (req, res) => {
  try {
    const { search = '', page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    
    let filter = {};
    if (search) {
      filter.$or = [
        { nombre: { $regex: search, $options: 'i' } },
        { descripcion: { $regex: search, $options: 'i' } }
      ];
    }
    
    const [productos, total] = await Promise.all([
      Product.find(filter)
        .populate('responsable', 'nombre_negocio email')
        .populate('created_by', 'nombre_negocio email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Product.countDocuments(filter)
    ]);
    
    res.json({
      products: productos, // Cambiar a 'products' para coincidir con frontend
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_items: total,
        per_page: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    res.status(500).json({ message: 'Error al obtener productos', error: error.message });
  }
});

// Crear nuevo producto
router.post('/', authenticate, requireProductOwnerOrAbove, async (req, res) => {
  try {
    const { nombre, descripcion, responsable, fecha_fin } = req.body;
    
    // Validar datos requeridos
    if (!nombre || !descripcion || !responsable) {
      return res.status(400).json({ 
        message: 'Nombre, descripción y responsable son requeridos' 
      });
    }
    
    const nuevoProducto = new Product({
      nombre,
      descripcion,
      responsable,
      fecha_fin,
      created_by: req.user._id,
      updated_by: req.user._id
    });
    
    await nuevoProducto.save();
    await nuevoProducto.populate('responsable', 'nombre_negocio email');
    
    res.status(201).json({
      message: 'Producto creado exitosamente',
      producto: nuevoProducto
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Ya existe un producto con ese nombre' });
    }
    console.error('Error creando producto:', error);
    res.status(500).json({ message: 'Error al crear producto', error: error.message });
  }
});

// Actualizar producto - TEMPORAL: Sin restricción de rol para debugging
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body, updated_by: req.user._id };
    
    console.log('=== DEBUGGING PUT PRODUCTO ===');
    console.log('Product ID:', id);
    console.log('Updates:', updates);
    console.log('User:', req.user);
    
    const producto = await Product.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate('responsable', 'nombre_negocio email');
    
    if (!producto) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    
    console.log('Producto actualizado:', producto);
    
    res.json({
      message: 'Producto actualizado exitosamente',
      producto
    });
  } catch (error) {
    console.error('Error actualizando producto:', error);
    res.status(500).json({ message: 'Error al actualizar producto', error: error.message });
  }
});

// Eliminar producto
router.delete('/:id', authenticate, requireProductOwnerOrAbove, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si el producto tiene items en el backlog
    const backlogItems = await BacklogItem.countDocuments({ producto: id });
    if (backlogItems > 0) {
      return res.status(400).json({ 
        message: 'No se puede eliminar el producto porque tiene items en el backlog' 
      });
    }
    
    const producto = await Product.findByIdAndDelete(id);
    if (!producto) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    
    res.json({ message: 'Producto eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando producto:', error);
    res.status(500).json({ message: 'Error al eliminar producto', error: error.message });
  }
});

// Obtener usuarios disponibles para asignar como responsables
// Permitir que cualquier usuario autenticado vea la lista de colaboradores (más inclusivo)
router.get('/users-for-assignment', authenticate, async (req, res) => {
  try {
    // Puedes ajustar los roles aquí si quieres filtrar por roles específicos
    const users = await User.find({ 
      role: { $in: ['product_owner', 'scrum_master', 'developers', 'user'] },
      is_active: true
    })
      .select('_id nombre_negocio email role')
      .sort({ nombre_negocio: 1, email: 1 });
    res.json({
      users,
      total: users.length
    });
  } catch (error) {
    console.error('Error obteniendo usuarios para asignación:', error);
    res.status(500).json({ message: 'Error al obtener usuarios', error: error.message });
  }
});

module.exports = router;
