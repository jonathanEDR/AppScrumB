const express = require('express');
const Product = require('../models/Product');
const BacklogItem = require('../models/BacklogItem');
const User = require('../models/User');
const { Sprint, Release } = require('../models/Sprint');
const ProductService = require('../services/ProductService');
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
    const result = await ProductService.getProducts(req.query, req.query);
    
    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    res.status(500).json({ message: 'Error al obtener productos', error: error.message });
  }
});

// Crear nuevo producto
router.post('/', authenticate, requireProductOwnerOrAbove, async (req, res) => {
  try {
    const result = await ProductService.createProduct(req.body, req.user._id);
    
    if (!result.success) {
      const status = result.error.includes('Ya existe') ? 400 : 400;
      return res.status(status).json({ message: result.error });
    }
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creando producto:', error);
    res.status(500).json({ message: 'Error al crear producto', error: error.message });
  }
});

// Actualizar producto - TEMPORAL: Sin restricción de rol para debugging
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('=== DEBUGGING PUT PRODUCTO ===');
    console.log('Product ID:', id);
    console.log('Updates:', req.body);
    console.log('User:', req.user);
    
    const result = await ProductService.updateProduct(id, req.body, req.user._id);
    
    if (!result.success) {
      const status = result.error === 'Producto no encontrado' ? 404 : 400;
      return res.status(status).json({ message: result.error });
    }
    
    console.log('Producto actualizado:', result.producto);
    res.json(result);
  } catch (error) {
    console.error('Error actualizando producto:', error);
    res.status(500).json({ message: 'Error al actualizar producto', error: error.message });
  }
});

// Eliminar producto
router.delete('/:id', authenticate, requireProductOwnerOrAbove, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await ProductService.deleteProduct(id);
    
    if (!result.success) {
      const status = result.error === 'Producto no encontrado' ? 404 : 400;
      return res.status(status).json({ message: result.error, ...result });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error eliminando producto:', error);
    res.status(500).json({ message: 'Error al eliminar producto', error: error.message });
  }
});

// Obtener usuarios disponibles para asignar como responsables
// Permitir que cualquier usuario autenticado vea la lista de colaboradores (más inclusivo)
router.get('/users-for-assignment', authenticate, async (req, res) => {
  try {
    const result = await ProductService.getUsersForAssignment();
    
    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error obteniendo usuarios para asignación:', error);
    res.status(500).json({ message: 'Error al obtener usuarios', error: error.message });
  }
});

module.exports = router;
