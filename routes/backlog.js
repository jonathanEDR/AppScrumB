const express = require('express');
const BacklogItem = require('../models/BacklogItem');
const Product = require('../models/Product');
const { 
  authenticate, 
  authorize 
} = require('../middleware/authenticate');
const router = express.Router();

const requireProductOwnerOrAbove = authorize('product_owner', 'scrum_master', 'super_admin');

// ============= RUTAS DE PRODUCT BACKLOG =============

// Obtener items del backlog
router.get('/backlog', authenticate, async (req, res) => {
  try {
    const { 
      producto, 
      estado, 
      prioridad, 
      search = '', 
      page = 1, 
      limit = 20 
    } = req.query;
    
    const skip = (page - 1) * limit;
    let filter = {};
    
    if (producto) filter.producto = producto;
    if (estado) filter.estado = estado;
    if (prioridad) filter.prioridad = prioridad;
    
    if (search) {
      filter.$or = [
        { titulo: { $regex: search, $options: 'i' } },
        { descripcion: { $regex: search, $options: 'i' } }
      ];
    }
    
    const [items, total] = await Promise.all([
      BacklogItem.find(filter)
        .populate('producto', 'nombre')
        .populate('asignado_a', 'nombre_negocio email')
        .populate('sprint', 'nombre')
        .sort({ orden: 1, prioridad: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      BacklogItem.countDocuments(filter)
    ]);
    
    res.json({
      items,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_items: total,
        per_page: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error obteniendo backlog:', error);
    res.status(500).json({ message: 'Error al obtener backlog', error: error.message });
  }
});

// Crear nuevo item en el backlog
router.post('/backlog', authenticate, requireProductOwnerOrAbove, async (req, res) => {
  try {
    const { 
      titulo, 
      descripcion, 
      tipo, 
      prioridad, 
      producto, 
      puntos_historia,
      asignado_a,
      sprint,
      criterios_aceptacion,
      etiquetas 
    } = req.body;
    
    if (!titulo || !descripcion || !producto) {
      return res.status(400).json({ 
        message: 'Título, descripción y producto son requeridos' 
      });
    }
    
    // Obtener el siguiente número de orden
    const lastItem = await BacklogItem.findOne({ producto })
      .sort({ orden: -1 })
      .select('orden');
    const orden = lastItem ? lastItem.orden + 1 : 1;
    
    // Limpiar campos ObjectId vacíos para creación
    const cleanAsignado = asignado_a && asignado_a.trim() !== '' ? asignado_a : undefined;
    const cleanSprint = sprint && sprint.trim() !== '' ? sprint : undefined;
    
    const nuevoItem = new BacklogItem({
      titulo,
      descripcion,
      tipo,
      prioridad,
      producto,
      puntos_historia,
      asignado_a: cleanAsignado,
      sprint: cleanSprint,
      criterios_aceptacion,
      etiquetas,
      orden,
      created_by: req.user._id,
      updated_by: req.user._id
    });
    
    await nuevoItem.save();
    await nuevoItem.populate([
      { path: 'producto', select: 'nombre' },
      { path: 'asignado_a', select: 'nombre_negocio email' },
      { path: 'sprint', select: 'nombre' }
    ]);
    
    res.status(201).json({
      message: 'Item creado exitosamente',
      item: nuevoItem
    });
  } catch (error) {
    console.error('Error creando item:', error);
    res.status(500).json({ message: 'Error al crear item', error: error.message });
  }
});

// Actualizar item del backlog
router.put('/backlog/:id', authenticate, requireProductOwnerOrAbove, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Actualizando item:', id);
    console.log('Datos recibidos:', req.body);
    
    const updates = { ...req.body, updated_by: req.user._id };
    
    // Limpiar campos ObjectId vacíos
    if (updates.asignado_a === '' || updates.asignado_a === null) {
      delete updates.asignado_a;
    }
    if (updates.sprint === '' || updates.sprint === null) {
      delete updates.sprint;
    }
    
    console.log('Updates finales:', updates);
    
    const item = await BacklogItem.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate([
      { path: 'producto', select: 'nombre' },
      { path: 'asignado_a', select: 'nombre_negocio email' },
      { path: 'sprint', select: 'nombre' }
    ]);
    
    if (!item) {
      return res.status(404).json({ message: 'Item no encontrado' });
    }
    
    console.log('Item actualizado exitosamente:', item._id);
    res.json({
      message: 'Item actualizado exitosamente',
      item
    });
  } catch (error) {
    console.error('Error actualizando item:', error);
    res.status(500).json({ message: 'Error al actualizar item', error: error.message });
  }
});

// Reordenar items del backlog
router.put('/backlog/reorder', authenticate, requireProductOwnerOrAbove, async (req, res) => {
  try {
    const { items } = req.body; // Array de { id, orden }
    
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: 'Items debe ser un array' });
    }
    
    const bulkOps = items.map(item => ({
      updateOne: {
        filter: { _id: item.id },
        update: { orden: item.orden, updated_by: req.user._id }
      }
    }));
    
    await BacklogItem.bulkWrite(bulkOps);
    
    res.json({ message: 'Backlog reordenado exitosamente' });
  } catch (error) {
    console.error('Error reordenando backlog:', error);
    res.status(500).json({ message: 'Error al reordenar backlog', error: error.message });
  }
});

// Eliminar item del backlog
router.delete('/backlog/:id', authenticate, requireProductOwnerOrAbove, async (req, res) => {
  try {
    const { id } = req.params;
    
    const item = await BacklogItem.findByIdAndDelete(id);
    if (!item) {
      return res.status(404).json({ message: 'Item no encontrado' });
    }
    
    res.json({ message: 'Item eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando item:', error);
    res.status(500).json({ message: 'Error al eliminar item', error: error.message });
  }
});

module.exports = router;
