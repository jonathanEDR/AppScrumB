const express = require('express');
const BacklogItem = require('../models/BacklogItem');
const Product = require('../models/Product');
const { 
  authenticate, 
  authorize 
} = require('../middleware/authenticate');
const router = express.Router();

const requireProductOwnerOrAbove = authorize('product_owner', 'scrum_master', 'super_admin');
const requireScrumMasterOrAbove = authorize('scrum_master', 'product_owner', 'super_admin');

// ============= RUTAS DE PRODUCT BACKLOG =============

// Obtener items del backlog
router.get('/backlog', authenticate, async (req, res) => {
  try {
    const { 
      producto, 
      estado, 
      prioridad,
      tipo,
      available_only, // Nuevo parámetro para filtrar solo tareas disponibles
      search = '', 
      page = 1, 
      limit = 20 
    } = req.query;
    
    console.log('=== FETCHING BACKLOG ITEMS ===');
    console.log('Query params:', req.query);
    console.log('User role:', req.user?.role);
    
    const skip = (page - 1) * limit;
    let filter = {};
    
    if (producto) filter.producto = producto;
    if (estado) filter.estado = estado;
    if (prioridad) filter.prioridad = prioridad;
    
    // Si available_only=true, filtrar solo tareas no asignadas y pendientes
    if (available_only === 'true') {
      filter.asignado_a = { $exists: false }; // No asignadas
      filter.$or = [
        { estado: 'pendiente' },
        { estado: { $exists: false } }
      ];
      console.log('Filtrando solo tareas disponibles (no asignadas)');
    }
    
    // Soporte para filtrar por tipo (puede ser múltiple)
    if (tipo) {
      if (Array.isArray(tipo)) {
        filter.tipo = { $in: tipo };
      } else if (typeof tipo === 'string') {
        // Si viene como string separado por comas
        const tipos = tipo.split(',').map(t => t.trim());
        filter.tipo = tipos.length === 1 ? tipos[0] : { $in: tipos };
      }
    }
    
    if (search) {
      filter.$or = [
        { titulo: { $regex: search, $options: 'i' } },
        { descripcion: { $regex: search, $options: 'i' } }
      ];
    }
    
    console.log('Final filter:', JSON.stringify(filter, null, 2));
    
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
    
    console.log(`Found ${items.length} items out of ${total} total`);
    
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
    console.log('=== CREATING NEW BACKLOG ITEM ===');
    console.log('Request body:', req.body);
    console.log('User:', req.user?._id);
    
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
    
    console.log('Clean data for creation:');
    console.log('- título:', titulo);
    console.log('- prioridad:', prioridad);
    console.log('- producto:', producto);
    console.log('- sprint:', cleanSprint);
    console.log('- asignado_a:', cleanAsignado);
    console.log('- criterios_aceptacion:', criterios_aceptacion);
    
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
    
    const savedItem = await nuevoItem.save();
    console.log('✅ Item saved with ID:', savedItem._id);
    console.log('- Sprint field:', savedItem.sprint);
    console.log('- Producto field:', savedItem.producto);
    
    await savedItem.populate([
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

// Endpoint específico para Scrum Master - crear tareas técnicas (tareas, bugs, mejoras)
router.post('/backlog/technical', authenticate, requireScrumMasterOrAbove, async (req, res) => {
  try {
    console.log('=== SCRUM MASTER CREATING TECHNICAL ITEM ===');
    console.log('Request body:', req.body);
    console.log('User role:', req.user?.role);
    
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
    
    // Validar que solo puede crear tipos técnicos
    const allowedTypes = ['tarea', 'bug', 'mejora'];
    if (!allowedTypes.includes(tipo)) {
      return res.status(400).json({ 
        message: 'Scrum Master solo puede crear tareas, bugs y mejoras. Para historias de usuario contacte al Product Owner.',
        allowed_types: allowedTypes,
        provided_type: tipo
      });
    }
    
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
    
    console.log('Technical item data for Scrum Master:');
    console.log('- título:', titulo);
    console.log('- tipo:', tipo);
    console.log('- prioridad:', prioridad);
    console.log('- producto:', producto);
    console.log('- sprint:', cleanSprint);
    console.log('- asignado_a:', cleanAsignado);
    
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
    
    const savedItem = await nuevoItem.save();
    console.log('✅ Technical item saved by Scrum Master with ID:', savedItem._id);
    console.log('- Type:', savedItem.tipo);
    console.log('- Sprint field:', savedItem.sprint);
    console.log('- Producto field:', savedItem.producto);
    
    await savedItem.populate([
      { path: 'producto', select: 'nombre' },
      { path: 'asignado_a', select: 'nombre_negocio email' },
      { path: 'sprint', select: 'nombre' }
    ]);
    
    res.status(201).json({
      message: `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} creada exitosamente por Scrum Master`,
      item: savedItem
    });
  } catch (error) {
    console.error('Error creando item técnico:', error);
    res.status(500).json({ message: 'Error al crear item técnico', error: error.message });
  }
});

// Actualizar item del backlog
router.put('/backlog/:id', authenticate, requireProductOwnerOrAbove, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Actualizando item:', id);
    console.log('Datos recibidos:', req.body);
    
    const updates = { ...req.body, updated_by: req.user._id };
    
    // Manejar asignación especial 'me' para auto-asignarse
    if (updates.asignado_a === 'me') {
      updates.asignado_a = req.user._id;
      console.log('Auto-asignando tarea al usuario actual:', req.user._id);
    }
    
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

// Asignar item técnico a una historia
router.put('/backlog/:itemId/assign-to-story', authenticate, requireScrumMasterOrAbove, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { historia_id } = req.body;
    
    console.log('=== ASIGNANDO ITEM TÉCNICO A HISTORIA ===');
    console.log('Item ID:', itemId);
    console.log('Historia ID:', historia_id);
    console.log('User role:', req.user?.role);
    
    // Verificar que el item técnico existe y es del tipo correcto
    const itemTecnico = await BacklogItem.findById(itemId);
    if (!itemTecnico) {
      return res.status(404).json({ message: 'Item técnico no encontrado' });
    }
    
    if (!['tarea', 'bug', 'mejora'].includes(itemTecnico.tipo)) {
      return res.status(400).json({ 
        message: 'Solo se pueden asignar tareas, bugs y mejoras a historias',
        item_type: itemTecnico.tipo 
      });
    }
    
    // Si se proporciona historia_id, verificar que existe y es una historia
    let historia = null;
    if (historia_id) {
      historia = await BacklogItem.findById(historia_id);
      if (!historia) {
        return res.status(404).json({ message: 'Historia no encontrada' });
      }
      
      if (historia.tipo !== 'historia') {
        return res.status(400).json({ 
          message: 'Solo se puede asignar a items de tipo historia',
          target_type: historia.tipo 
        });
      }
      
      // Verificar que ambos items están en el mismo sprint (si tienen sprint)
      if (itemTecnico.sprint && historia.sprint && 
          itemTecnico.sprint.toString() !== historia.sprint.toString()) {
        return res.status(400).json({ 
          message: 'El item técnico y la historia deben estar en el mismo sprint' 
        });
      }
    }
    
    // Actualizar el item técnico
    const updatedItem = await BacklogItem.findByIdAndUpdate(
      itemId,
      { 
        historia_padre: historia_id || null,
        updated_by: req.user._id 
      },
      { new: true, runValidators: true }
    ).populate([
      { path: 'producto', select: 'nombre' },
      { path: 'asignado_a', select: 'nombre_negocio email' },
      { path: 'sprint', select: 'nombre' },
      { path: 'historia_padre', select: 'titulo tipo' }
    ]);
    
    console.log('✅ Item técnico asignado exitosamente');
    console.log('- Item:', updatedItem.titulo);
    console.log('- Historia padre:', historia?.titulo || 'Sin asignar');
    
    res.json({
      message: historia_id ? 
        `${itemTecnico.tipo} asignada a historia exitosamente` : 
        `${itemTecnico.tipo} desasignada de historia`,
      item: updatedItem,
      historia: historia ? {
        _id: historia._id,
        titulo: historia.titulo,
        tipo: historia.tipo
      } : null
    });
    
  } catch (error) {
    console.error('Error asignando item a historia:', error);
    res.status(500).json({ 
      message: 'Error al asignar item a historia', 
      error: error.message 
    });
  }
});

// Obtener historias con sus items técnicos asignados
router.get('/backlog/sprint/:sprintId/hierarchical', authenticate, async (req, res) => {
  try {
    const { sprintId } = req.params;
    
    console.log('=== OBTENIENDO VISTA JERÁRQUICA DEL SPRINT ===');
    console.log('Sprint ID:', sprintId);
    console.log('User role:', req.user?.role);
    
    // Obtener todas las historias del sprint
    const historias = await BacklogItem.find({
      sprint: sprintId,
      tipo: 'historia'
    }).populate([
      { path: 'producto', select: 'nombre' },
      { path: 'asignado_a', select: 'nombre_negocio email' },
      { path: 'sprint', select: 'nombre' }
    ]).sort({ orden: 1 });
    
    // Obtener todos los items técnicos del sprint
    const itemsTecnicos = await BacklogItem.find({
      sprint: sprintId,
      tipo: { $in: ['tarea', 'bug', 'mejora'] }
    }).populate([
      { path: 'producto', select: 'nombre' },
      { path: 'asignado_a', select: 'nombre_negocio email' },
      { path: 'sprint', select: 'nombre' },
      { path: 'historia_padre', select: 'titulo tipo' }
    ]).sort({ orden: 1 });
    
    // Agrupar items técnicos por historia padre
    const itemsAsignados = {};
    const itemsSinAsignar = [];
    
    itemsTecnicos.forEach(item => {
      if (item.historia_padre) {
        const historiaId = item.historia_padre._id.toString();
        if (!itemsAsignados[historiaId]) {
          itemsAsignados[historiaId] = [];
        }
        itemsAsignados[historiaId].push(item);
      } else {
        itemsSinAsignar.push(item);
      }
    });
    
    // Construir respuesta jerárquica
    const historiasConItems = historias.map(historia => ({
      historia,
      items_tecnicos: itemsAsignados[historia._id.toString()] || []
    }));
    
    console.log('✅ Vista jerárquica generada');
    console.log('- Historias:', historias.length);
    console.log('- Items técnicos asignados:', itemsTecnicos.length - itemsSinAsignar.length);
    console.log('- Items sin asignar:', itemsSinAsignar.length);
    
    res.json({
      historias: historiasConItems,
      items_sin_asignar: itemsSinAsignar,
      resumen: {
        total_historias: historias.length,
        total_items_tecnicos: itemsTecnicos.length,
        items_asignados: itemsTecnicos.length - itemsSinAsignar.length,
        items_sin_asignar: itemsSinAsignar.length
      }
    });
    
  } catch (error) {
    console.error('Error obteniendo vista jerárquica:', error);
    res.status(500).json({ 
      message: 'Error al obtener vista jerárquica del sprint', 
      error: error.message 
    });
  }
});

module.exports = router;
