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

// Ruta temporal sin autenticación para productos (para testing)
router.get('/productos-demo', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Obteniendo productos demo');
    
    // Crear productos simulados para testing
    const productos = [
      {
        _id: '507f1f77bcf86cd799439011',
        nombre: 'Producto Demo 1',
        descripcion: 'Sistema de gestión de inventario empresarial con módulos de compras, ventas y reportes avanzados',
        responsable: {
          _id: '507f1f77bcf86cd799439012',
          nombre_negocio: 'Juan Pérez',
          email: 'juan.perez@empresa.com'
        },
        estado: 'activo',
        prioridad: 'alta',
        fecha_inicio: '2024-01-15',
        fecha_fin: '2025-12-31',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date()
      },
      {
        _id: '507f1f77bcf86cd799439013',
        nombre: 'Producto Demo 2', 
        descripcion: 'Plataforma de e-commerce móvil con integración de pagos y gestión de inventario',
        responsable: {
          _id: '507f1f77bcf86cd799439014',
          nombre_negocio: 'María García',
          email: 'maria.garcia@empresa.com'
        },
        estado: 'activo',
        prioridad: 'media',
        fecha_inicio: '2024-03-01',
        fecha_fin: '2025-06-30',
        createdAt: new Date('2024-03-01'),
        updatedAt: new Date()
      },
      {
        _id: '507f1f77bcf86cd799439015',
        nombre: 'Producto Demo 3',
        descripcion: 'Sistema de recursos humanos integrado con nómina, evaluaciones y gestión de talento',
        responsable: {
          _id: '507f1f77bcf86cd799439016',
          nombre_negocio: 'Carlos López',
          email: 'carlos.lopez@empresa.com'
        },
        estado: 'completado',
        prioridad: 'baja',
        fecha_inicio: '2024-01-01',
        fecha_fin: '2024-12-15',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date()
      }
    ];
    
    console.log('✅ DEBUG: Enviando productos demo:', productos.length);
    
    res.json({
      products: productos,
      pagination: {
        current_page: 1,
        total_pages: 1,
        total_items: productos.length,
        per_page: 10
      }
    });
  } catch (error) {
    console.error('❌ DEBUG: Error en productos demo:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
});

// Obtener todos los productos
router.get('/productos', authenticate, async (req, res) => {
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
      productos,
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
router.post('/productos', authenticate, requireProductOwnerOrAbove, async (req, res) => {
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

// Actualizar producto
router.put('/productos/:id', authenticate, requireProductOwnerOrAbove, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body, updated_by: req.user._id };
    
    const producto = await Product.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate('responsable', 'nombre_negocio email');
    
    if (!producto) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    
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
router.delete('/productos/:id', authenticate, requireProductOwnerOrAbove, async (req, res) => {
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

// Obtener todos los productos (alias para compatibilidad)
router.get('/products', authenticate, async (req, res) => {
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
      products: productos, // Usar "products" para compatibilidad con frontend
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

module.exports = router;
