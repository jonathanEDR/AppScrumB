/**
 * BacklogService - Servicio para gestión del Product Backlog
 * Contiene toda la lógica de negocio relacionada con items del backlog
 * Puede ser usado tanto por rutas HTTP como por agentes AI
 */

const BacklogItem = require('../models/BacklogItem');
const Product = require('../models/Product');

class BacklogService {
  /**
   * Obtener items del backlog con filtros y paginación
   */
  static async getBacklogItems(filters = {}, pagination = {}) {
    try {
      const {
        producto,
        estado,
        prioridad,
        tipo,
        available_only,
        search,
        page = 1,
        limit = 20
      } = { ...filters, ...pagination };

      const skip = (page - 1) * limit;
      let filter = {};

      // Filtros básicos
      if (producto) filter.producto = producto;
      if (estado) filter.estado = estado;
      if (prioridad) filter.prioridad = prioridad;

      // Filtrar solo tareas disponibles (no asignadas y pendientes)
      if (available_only === true || available_only === 'true') {
        filter.$or = [
          { estado: 'pendiente' },
          { estado: { $exists: false } }
        ];
        filter.estado = { $in: ['pendiente', 'en_progreso'] };
      }

      // Filtro por tipo (puede ser múltiple)
      if (tipo) {
        if (Array.isArray(tipo)) {
          filter.tipo = { $in: tipo };
        } else if (typeof tipo === 'string') {
          const tipos = tipo.split(',').map(t => t.trim());
          filter.tipo = tipos.length === 1 ? tipos[0] : { $in: tipos };
        }
      }

      // Búsqueda por texto
      if (search) {
        filter.$or = [
          { titulo: { $regex: search, $options: 'i' } },
          { descripcion: { $regex: search, $options: 'i' } }
        ];
      }

      // Ejecutar consulta con población de relaciones
      const [items, total] = await Promise.all([
        BacklogItem.find(filter)
          .populate('producto', 'nombre')
          .populate('asignado_a', 'nombre_negocio email')
          .populate('sprint', 'nombre')
          .sort({ orden: 1, prioridad: -1, createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        BacklogItem.countDocuments(filter)
      ]);

      return {
        success: true,
        items,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / limit),
          total_items: total,
          per_page: parseInt(limit)
        }
      };
    } catch (error) {
      console.error('BacklogService.getBacklogItems error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Crear un nuevo item en el backlog
   */
  static async createBacklogItem(itemData, userId, options = {}) {
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
        historia_padre,
        criterios_aceptacion,
        etiquetas
      } = itemData;

      // Validaciones
      if (!titulo || !descripcion || !producto) {
        return {
          success: false,
          error: 'Título, descripción y producto son requeridos'
        };
      }

      // Validar tipo si se especifica restricción
      if (options.allowedTypes && !options.allowedTypes.includes(tipo)) {
        return {
          success: false,
          error: `Solo se pueden crear tipos: ${options.allowedTypes.join(', ')}`,
          allowed_types: options.allowedTypes,
          provided_type: tipo
        };
      }

      // Obtener el siguiente número de orden
      const lastItem = await BacklogItem.findOne({ producto })
        .sort({ orden: -1 })
        .select('orden');
      const orden = lastItem ? lastItem.orden + 1 : 1;

      // Limpiar campos ObjectId vacíos
      const cleanAsignado = asignado_a && asignado_a.trim() !== '' ? asignado_a : undefined;
      const cleanSprint = sprint && sprint.trim() !== '' ? sprint : undefined;
      const cleanHistoriaPadre = historia_padre && historia_padre.trim() !== '' ? historia_padre : undefined;

      // Crear el item
      const nuevoItem = new BacklogItem({
        titulo,
        descripcion,
        tipo,
        prioridad,
        producto,
        puntos_historia,
        asignado_a: cleanAsignado,
        sprint: cleanSprint,
        historia_padre: cleanHistoriaPadre,
        criterios_aceptacion,
        etiquetas,
        orden,
        created_by: userId,
        updated_by: userId
      });

      const savedItem = await nuevoItem.save();

      // Poblar relaciones
      await savedItem.populate([
        { path: 'producto', select: 'nombre' },
        { path: 'asignado_a', select: 'nombre_negocio email' },
        { path: 'sprint', select: 'nombre' },
        { path: 'historia_padre', select: 'titulo tipo' }
      ]);

      return {
        success: true,
        item: savedItem,
        message: 'Item creado exitosamente'
      };
    } catch (error) {
      console.error('BacklogService.createBacklogItem error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Crear un item técnico (tarea, bug, mejora) - Solo Scrum Master
   */
  static async createTechnicalItem(itemData, userId) {
    const allowedTypes = ['tarea', 'bug', 'mejora'];
    
    return await this.createBacklogItem(itemData, userId, {
      allowedTypes
    });
  }

  /**
   * Actualizar un item del backlog
   */
  static async updateBacklogItem(itemId, updates, userId) {
    try {
      // Agregar usuario que actualiza
      const finalUpdates = { ...updates, updated_by: userId };

      // Manejar auto-asignación
      if (finalUpdates.asignado_a === 'me') {
        finalUpdates.asignado_a = userId;
      }

      // Limpiar campos ObjectId vacíos
      if (finalUpdates.asignado_a === '' || finalUpdates.asignado_a === null) {
        delete finalUpdates.asignado_a;
      }
      if (finalUpdates.sprint === '' || finalUpdates.sprint === null) {
        delete finalUpdates.sprint;
      }

      const item = await BacklogItem.findByIdAndUpdate(
        itemId,
        finalUpdates,
        { new: true, runValidators: true }
      ).populate([
        { path: 'producto', select: 'nombre' },
        { path: 'asignado_a', select: 'nombre_negocio email' },
        { path: 'sprint', select: 'nombre' }
      ]);

      if (!item) {
        return {
          success: false,
          error: 'Item no encontrado'
        };
      }

      return {
        success: true,
        item,
        message: 'Item actualizado exitosamente'
      };
    } catch (error) {
      console.error('BacklogService.updateBacklogItem error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Reordenar items del backlog
   */
  static async reorderBacklog(items, userId) {
    try {
      if (!Array.isArray(items)) {
        return {
          success: false,
          error: 'Items debe ser un array de { id, orden }'
        };
      }

      const bulkOps = items.map(item => ({
        updateOne: {
          filter: { _id: item.id },
          update: { orden: item.orden, updated_by: userId }
        }
      }));

      await BacklogItem.bulkWrite(bulkOps);

      return {
        success: true,
        message: 'Backlog reordenado exitosamente',
        updated_count: items.length
      };
    } catch (error) {
      console.error('BacklogService.reorderBacklog error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Eliminar un item del backlog
   */
  static async deleteBacklogItem(itemId) {
    try {
      const item = await BacklogItem.findByIdAndDelete(itemId);
      
      if (!item) {
        return {
          success: false,
          error: 'Item no encontrado'
        };
      }

      return {
        success: true,
        message: 'Item eliminado exitosamente',
        deleted_item: {
          id: item._id,
          titulo: item.titulo
        }
      };
    } catch (error) {
      console.error('BacklogService.deleteBacklogItem error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Asignar item técnico a una historia
   */
  static async assignTechnicalItemToStory(itemId, historiaId) {
    try {
      // Verificar que el item técnico existe y es del tipo correcto
      const itemTecnico = await BacklogItem.findById(itemId);
      if (!itemTecnico) {
        return {
          success: false,
          error: 'Item técnico no encontrado'
        };
      }

      if (!['tarea', 'bug', 'mejora'].includes(itemTecnico.tipo)) {
        return {
          success: false,
          error: 'Solo se pueden asignar tareas, bugs y mejoras a historias',
          item_type: itemTecnico.tipo
        };
      }

      // Si se proporciona historia_id, verificar que existe y es una historia
      let historia = null;
      if (historiaId) {
        historia = await BacklogItem.findById(historiaId);
        if (!historia) {
          return {
            success: false,
            error: 'Historia no encontrada'
          };
        }

        if (historia.tipo !== 'historia') {
          return {
            success: false,
            error: 'Solo se puede asignar a items de tipo historia',
            target_type: historia.tipo
          };
        }

        // Verificar que pertenecen al mismo producto
        if (!itemTecnico.producto.equals(historia.producto)) {
          return {
            success: false,
            error: 'El item técnico y la historia deben pertenecer al mismo producto'
          };
        }
      }

      // Actualizar la relación
      itemTecnico.historia_padre = historiaId || null;
      await itemTecnico.save();

      await itemTecnico.populate([
        { path: 'producto', select: 'nombre' },
        { path: 'asignado_a', select: 'nombre_negocio email' },
        { path: 'sprint', select: 'nombre' },
        { path: 'historia_padre', select: 'titulo tipo' }
      ]);

      return {
        success: true,
        item: itemTecnico,
        message: historiaId 
          ? `Item técnico asignado a la historia "${historia.titulo}"` 
          : 'Relación con historia eliminada'
      };
    } catch (error) {
      console.error('BacklogService.assignTechnicalItemToStory error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener backlog jerárquico de un sprint (historias con sus tareas/bugs)
   */
  static async getSprintBacklogHierarchical(sprintId) {
    try {
      // Obtener todas las historias del sprint
      const historias = await BacklogItem.find({
        sprint: sprintId,
        tipo: 'historia'
      })
        .populate('producto', 'nombre')
        .populate('asignado_a', 'nombre_negocio email')
        .populate('sprint', 'nombre')
        .sort({ orden: 1, prioridad: -1 })
        .lean();

      // Para cada historia, obtener sus items técnicos asociados
      const historiasConItems = await Promise.all(
        historias.map(async (historia) => {
          const itemsTecnicos = await BacklogItem.find({
            historia_padre: historia._id,
            sprint: sprintId,
            tipo: { $in: ['tarea', 'bug', 'mejora'] }
          })
            .populate('producto', 'nombre')
            .populate('asignado_a', 'nombre_negocio email')
            .populate('sprint', 'nombre')
            .sort({ orden: 1, tipo: 1 })
            .lean();

          // 🆕 Para cada item técnico, obtener su Task relacionada para estado actualizado
          const Task = require('../models/Task');
          const itemsConEstadoActualizado = await Promise.all(
            itemsTecnicos.map(async (item) => {
              // Buscar la Task que tiene este backlogItem como referencia
              const task = await Task.findOne({ 
                backlogItem: item._id 
              }).select('status').lean();
              
              // Si existe una Task, sincronizar el estado
              if (task) {
                // Mapear status de Task a estado de BacklogItem
                const statusMapping = {
                  'todo': 'pendiente',
                  'in_progress': 'en_progreso',
                  'code_review': 'en_revision',
                  'testing': 'en_revision',
                  'done': 'completado'
                };
                
                item.estado = statusMapping[task.status] || item.estado;
                item.taskStatus = task.status; // Agregar status original para debug
              }
              
              return item;
            })
          );

          return {
            historia: historia,
            items_tecnicos: itemsConEstadoActualizado
          };
        })
      );

      // También obtener items técnicos sin historia padre del sprint
      const itemsSinHistoria = await BacklogItem.find({
        sprint: sprintId,
        tipo: { $in: ['tarea', 'bug', 'mejora'] },
        $or: [
          { historia_padre: null },
          { historia_padre: { $exists: false } }
        ]
      })
        .populate('producto', 'nombre')
        .populate('asignado_a', 'nombre_negocio email')
        .populate('sprint', 'nombre')
        .sort({ orden: 1, tipo: 1, prioridad: -1 })
        .lean();

      // 🆕 Sincronizar estado de items sin historia también
      const Task = require('../models/Task');
      const itemsSinHistoriaActualizados = await Promise.all(
        itemsSinHistoria.map(async (item) => {
          const task = await Task.findOne({ backlogItem: item._id }).select('status').lean();
          
          if (task) {
            const statusMapping = {
              'todo': 'pendiente',
              'in_progress': 'en_progreso',
              'code_review': 'en_revision',
              'testing': 'en_revision',
              'done': 'completado'
            };
            
            item.estado = statusMapping[task.status] || item.estado;
            item.taskStatus = task.status;
          }
          
          return item;
        })
      );

      return {
        success: true,
        historias: historiasConItems,
        items_sin_historia: itemsSinHistoriaActualizados,
        resumen: {
          total_historias: historiasConItems.length,
          total_items_tecnicos: itemsSinHistoriaActualizados.length,
          total_items: historiasConItems.length + itemsSinHistoriaActualizados.length
        }
      };
    } catch (error) {
      console.error('BacklogService.getSprintBacklogHierarchical error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener estadísticas del backlog
   */
  static async getBacklogStats(productoId) {
    try {
      const filter = productoId ? { producto: productoId } : {};

      const [
        totalItems,
        itemsPorTipo,
        itemsPorEstado,
        itemsPorPrioridad
      ] = await Promise.all([
        BacklogItem.countDocuments(filter),
        BacklogItem.aggregate([
          { $match: filter },
          { $group: { _id: '$tipo', count: { $sum: 1 } } }
        ]),
        BacklogItem.aggregate([
          { $match: filter },
          { $group: { _id: '$estado', count: { $sum: 1 } } }
        ]),
        BacklogItem.aggregate([
          { $match: filter },
          { $group: { _id: '$prioridad', count: { $sum: 1 } } }
        ])
      ]);

      return {
        success: true,
        stats: {
          total_items: totalItems,
          por_tipo: itemsPorTipo,
          por_estado: itemsPorEstado,
          por_prioridad: itemsPorPrioridad
        }
      };
    } catch (error) {
      console.error('BacklogService.getBacklogStats error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validar estructura de una historia de usuario
   */
  static validateUserStory(storyData) {
    const errors = [];

    // Validar formato de título (opcional pero recomendado)
    if (storyData.titulo && !storyData.titulo.toLowerCase().includes('como')) {
      errors.push('El título debería seguir el formato: "Como [usuario], quiero [funcionalidad], para [beneficio]"');
    }

    // Validar criterios de aceptación
    if (!storyData.criterios_aceptacion || storyData.criterios_aceptacion.length === 0) {
      errors.push('Se recomienda incluir al menos un criterio de aceptación');
    }

    // Validar puntos de historia
    const validPoints = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
    if (storyData.puntos_historia && !validPoints.includes(storyData.puntos_historia)) {
      errors.push(`Los puntos de historia deben seguir la escala de Fibonacci: ${validPoints.join(', ')}`);
    }

    return {
      is_valid: errors.length === 0,
      errors,
      warnings: errors.length > 0 ? errors : []
    };
  }
}

module.exports = BacklogService;
