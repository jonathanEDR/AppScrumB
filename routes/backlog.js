const express = require('express');
const BacklogItem = require('../models/BacklogItem');
const Product = require('../models/Product');
const BacklogService = require('../services/BacklogService');
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
    console.log('=== FETCHING BACKLOG ITEMS ===');
    console.log('Query params:', req.query);
    console.log('User role:', req.user?.role);
    
    const result = await BacklogService.getBacklogItems(req.query, req.query);
    
    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }
    
    console.log(`Found ${result.items.length} items out of ${result.pagination.total_items} total`);
    
    res.json(result);
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
    
    const result = await BacklogService.createBacklogItem(req.body, req.user._id);
    
    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creando item:', error);
    res.status(500).json({ message: 'Error al crear item', error: error.message });
  }
});

// Endpoint específico para Scrum Master - crear tareas técnicas (tareas, bugs, mejoras)
router.post('/backlog/technical', authenticate, requireScrumMasterOrAbove, async (req, res) => {
  try {
    const result = await BacklogService.createTechnicalItem(req.body, req.user._id);
    
    if (!result.success) {
      return res.status(400).json({ message: result.error, ...result });
    }
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creando item técnico:', error);
    res.status(500).json({ message: 'Error al crear item técnico', error: error.message });
  }
});

// Actualizar item del backlog
router.put('/backlog/:id', authenticate, requireProductOwnerOrAbove, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await BacklogService.updateBacklogItem(id, req.body, req.user._id);
    
    if (!result.success) {
      const status = result.error === 'Item no encontrado' ? 404 : 400;
      return res.status(status).json({ message: result.error });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error actualizando item:', error);
    res.status(500).json({ message: 'Error al actualizar item', error: error.message });
  }
});

// Reordenar items del backlog
router.put('/backlog/reorder', authenticate, requireProductOwnerOrAbove, async (req, res) => {
  try {
    const { items } = req.body; // Array de { id, orden }
    
    const result = await BacklogService.reorderBacklog(items, req.user._id);
    
    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error reordenando backlog:', error);
    res.status(500).json({ message: 'Error al reordenar backlog', error: error.message });
  }
});

// Eliminar item del backlog
router.delete('/backlog/:id', authenticate, requireProductOwnerOrAbove, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await BacklogService.deleteBacklogItem(id);
    
    if (!result.success) {
      const status = result.error === 'Item no encontrado' ? 404 : 400;
      return res.status(status).json({ message: result.error });
    }
    
    res.json(result);
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
    
    const result = await BacklogService.assignTechnicalItemToStory(itemId, historia_id);
    
    if (!result.success) {
      const status = result.error.includes('no encontrad') ? 404 : 400;
      return res.status(status).json({ message: result.error, ...result });
    }
    
    console.log('✅ Item técnico asignado exitosamente');
    console.log('- Item:', result.item.titulo);
    console.log('- Historia padre:', result.item.historia_padre?.titulo || 'Sin asignar');
    
    res.json(result);
  } catch (error) {
    console.error('Error asignando item a historia:', error);
    res.status(500).json({ 
      message: 'Error al asignar item a historia', 
      error: error.message 
    });
  }
});

// Asignar item técnico a un usuario (developer)
router.put('/backlog/:itemId/assign-user', authenticate, requireScrumMasterOrAbove, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { user_id } = req.body;
    
    // Buscar el item
    const item = await BacklogItem.findById(itemId);
    
    if (!item) {
      return res.status(404).json({ 
        success: false,
        message: 'Item técnico no encontrado' 
      });
    }
    
    console.log('=== VERIFICACIÓN COMPLETA DEL ITEM ===');
    console.log('Item encontrado:', {
      _id: item._id,
      titulo: item.titulo,
      tipo: item.tipo,
      asignado_a: item.asignado_a,
      estado: item.estado
    });

    // Si se proporciona user_id, validar que el usuario existe
    if (user_id) {
      const User = require('../models/User');
      const TeamMember = require('../models/TeamMember');
      
      const targetUser = await User.findById(user_id);
      
      if (!targetUser) {
        console.log('❌ Usuario no encontrado:', user_id);
        return res.status(404).json({ 
          success: false,
          message: 'Usuario no encontrado' 
        });
      }
      
      console.log('✅ Usuario encontrado:', {
        id: targetUser._id,
        email: targetUser.email,
        role: targetUser.role
      });
      
      // Buscar si el usuario es un TeamMember con rol developer
      const teamMember = await TeamMember.findOne({ 'user': user_id });
      console.log('TeamMember encontrado:', teamMember ? {
        id: teamMember._id,
        role: teamMember.role,
        user: teamMember.user
      } : 'null');
      
      // Validar que el usuario tenga rol developer en User O en TeamMember
      const isValidDeveloper = (
        targetUser.role === 'developer' || 
        targetUser.role === 'developers' ||
        (teamMember && (teamMember.role === 'developer' || teamMember.role === 'developers'))
      );
      
      console.log('Validación de desarrollador:', {
        userRole: targetUser.role,
        teamMemberRole: teamMember?.role,
        isValidDeveloper
      });
      
      if (!isValidDeveloper) {
        console.log('❌ Usuario no es desarrollador válido');
        return res.status(400).json({ 
          success: false,
          message: 'Solo se pueden asignar items técnicos a usuarios con rol Developer' 
        });
      }
    }
    
    // Actualizar el item
    console.log('📝 Estado actual del item antes de actualizar:', {
      _id: item._id,
      asignado_a: item.asignado_a,
      estado: item.estado,
      titulo: item.titulo
    });
    
    item.asignado_a = user_id || null;
    item.updated_by = req.user._id;
    
    // Si se está asignando, cambiar estado a en_progreso (si está pendiente)
    if (user_id && item.estado === 'pendiente') {
      item.estado = 'en_progreso';
      console.log('🔄 Cambiando estado: pendiente → en_progreso');
    }
    
    // Si se está des-asignando, volver a pendiente (si está en_progreso)
    if (!user_id && item.estado === 'en_progreso') {
      item.estado = 'pendiente';
      console.log('🔄 Cambiando estado: en_progreso → pendiente');
    }
    
    const updatedItem = await item.save();
    
    console.log('✅ Item actualizado exitosamente:', {
      _id: updatedItem._id,
      asignado_a: updatedItem.asignado_a,
      estado: updatedItem.estado,
      titulo: updatedItem.titulo,
      tipo: updatedItem.tipo
    });

    console.log('🔍 Verificando condiciones para crear Task:', {
      user_id: user_id,
      item_tipo: item.tipo,
      condicion_cumplida: !!(user_id && item.tipo === 'tecnico')
    });

    // Si se está asignando a un usuario, crear también una Task para mantener consistencia
    if (user_id && item.tipo === 'tecnico') {
      console.log('🔨 Creando Task para item técnico asignado...');
      
      const Task = require('../models/Task');
      
      // Mapear prioridad de BacklogItem a Task
      const mapPriority = (priority) => {
        switch(priority) {
          case 'alta': return 'high';
          case 'media': return 'medium';
          case 'baja': return 'low';
          default: return 'medium';
        }
      };

      // Mapear estado de BacklogItem a Task  
      const mapStatus = (status) => {
        switch(status) {
          case 'pendiente': return 'todo';
          case 'en_progreso': return 'in_progress';
          case 'revision': return 'code_review';
          case 'pruebas': return 'testing';
          case 'completado': return 'done';
          default: return 'todo';
        }
      };

      // Verificar si ya existe una Task para este item
      const existingTask = await Task.findOne({ backlogItem: item._id });
      
      if (!existingTask) {
        const newTask = new Task({
          title: item.titulo,
          description: item.descripcion,
          status: mapStatus(item.estado),
          priority: mapPriority(item.prioridad),
          storyPoints: item.story_points || 0,
          assignee: user_id,
          reporter: req.user._id,
          sprint: item.sprint,
          backlogItem: item._id,
          type: 'feature'
        });

        const savedTask = await newTask.save();
        console.log('✅ Task creada automáticamente:', savedTask._id);
      } else {
        // Si ya existe, actualizar la asignación
        existingTask.assignee = user_id;
        existingTask.status = mapStatus(item.estado);
        await existingTask.save();
        console.log('🔄 Task existente actualizada:', existingTask._id);
      }
    }

    // Si se está des-asignando, también actualizar/eliminar la Task
    if (!user_id && item.tipo === 'tecnico') {
      console.log('🗑️ Des-asignando Task relacionada...');
      
      const Task = require('../models/Task');
      const relatedTask = await Task.findOne({ backlogItem: item._id });
      
      if (relatedTask) {
        relatedTask.assignee = null;
        relatedTask.status = 'todo';
        await relatedTask.save();
        console.log('🔄 Task des-asignada:', relatedTask._id);
      }
    }
    
    // Poblar datos para respuesta
    await item.populate([
      { path: 'producto', select: 'nombre' },
      { path: 'asignado_a', select: 'nombre_negocio email role' },
      { path: 'sprint', select: 'nombre' },
      { path: 'historia_padre', select: 'titulo' }
    ]);
    
    res.json({
      success: true,
      message: user_id ? 'Item asignado al usuario exitosamente' : 'Item des-asignado exitosamente',
      item: item
    });
    
  } catch (error) {
    console.error('Error asignando item a usuario:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al asignar item a usuario', 
      error: error.message 
    });
  }
});

// Obtener progreso real de items técnicos de una historia
router.get('/backlog/story/:storyId/technical-progress', authenticate, async (req, res) => {
  try {
    const storyId = req.params.storyId;
    
    console.log('🔍 Calculando progreso para historia:', storyId);
    
    // Buscar items técnicos de la historia con los tipos correctos
    const technicalItems = await BacklogItem.find({
      historia_padre: storyId,  // Campo correcto
      tipo: { $in: ['tarea', 'bug', 'mejora'] }  // Tipos correctos
    });
    
    console.log(`📊 Items técnicos encontrados para la historia: ${technicalItems.length}`);
    
    let totalItems = 0;
    let completedItems = 0;
    let inProgressItems = 0;
    let pendingItems = 0;
    
    // Para cada item técnico, verificar su estado real
    for (const item of technicalItems) {
      totalItems++;
      
      // Buscar si existe una Task asociada
      const Task = require('../models/Task');
      const relatedTask = await Task.findOne({ backlogItem: item._id });
      
      let realStatus = item.estado; // Estado por defecto del BacklogItem
      
      if (relatedTask) {
        // Si hay Task, usar su estado como el real
        const taskStatusMap = {
          'todo': 'pendiente',
          'in_progress': 'en_progreso', 
          'code_review': 'en_revision',
          'testing': 'en_pruebas',
          'done': 'completado'
        };
        realStatus = taskStatusMap[relatedTask.status] || item.estado;
      }
      
      // Contar según el estado real
      if (realStatus === 'completado' || realStatus === 'done') {
        completedItems++;
      } else if (realStatus === 'en_progreso' || realStatus === 'en_revision' || realStatus === 'en_pruebas') {
        inProgressItems++;
      } else {
        pendingItems++;
      }
      
      console.log(`📋 Item "${item.titulo}":`, {
        backlogStatus: item.estado,
        taskStatus: relatedTask?.status,
        realStatus,
        hasTask: !!relatedTask
      });
    }
    
    const progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    
    const result = {
      total: totalItems,
      completed: completedItems,
      inProgress: inProgressItems,
      pending: pendingItems,
      percentage: progressPercentage
    };
    
    console.log('✅ Progreso calculado:', result);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Error calculando progreso de items técnicos:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al calcular progreso de items técnicos', 
      error: error.message 
    });
  }
});

// Obtener historias con sus items técnicos asignados
router.get('/backlog/sprint/:sprintId/hierarchical', authenticate, async (req, res) => {
  try {
    const { sprintId } = req.params;
    
    const result = await BacklogService.getSprintBacklogHierarchical(sprintId);
    
    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error obteniendo vista jerárquica:', error);
    res.status(500).json({ 
      message: 'Error al obtener vista jerárquica del sprint', 
      error: error.message 
    });
  }
});

module.exports = router;
