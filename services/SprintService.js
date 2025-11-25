/**
 * SprintService - Servicio para gestión de Sprints
 * Contiene toda la lógica de negocio relacionada con sprints
 * Puede ser usado tanto por rutas HTTP como por agentes AI
 */

const Sprint = require('../models/Sprint');
const BacklogItem = require('../models/BacklogItem');
const mongoose = require('mongoose');

class SprintService {
  /**
   * Obtener todos los sprints con filtros y paginación
   */
  static async getSprints(filters = {}, pagination = {}) {
    try {
      const {
        producto,
        estado,
        page = 1,
        limit = 10
      } = { ...filters, ...pagination };

      const filtros = {};
      if (producto) filtros.producto = producto;
      
      if (estado) {
        // Manejar múltiples estados separados por coma
        const estados = typeof estado === 'string' 
          ? estado.split(',').map(e => e.trim()) 
          : [estado];
        filtros.estado = estados.length > 1 ? { $in: estados } : estados[0];
      }

      const [sprints, total] = await Promise.all([
        Sprint.find(filtros)
          .populate('producto', 'nombre')
          .populate('created_by', 'firstName lastName')
          .sort({ fecha_inicio: -1 })
          .limit(parseInt(limit))
          .skip((parseInt(page) - 1) * parseInt(limit))
          .lean(),
        Sprint.countDocuments(filtros)
      ]);

      return {
        success: true,
        sprints,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      };
    } catch (error) {
      console.error('SprintService.getSprints error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener un sprint por ID con sus métricas
   */
  static async getSprintById(sprintId) {
    try {
      // Validar ObjectId
      if (!mongoose.Types.ObjectId.isValid(sprintId)) {
        return {
          success: false,
          error: 'ID de sprint inválido'
        };
      }

      const sprint = await Sprint.findById(sprintId)
        .populate('producto', 'nombre descripcion')
        .populate('created_by', 'firstName lastName')
        .populate('updated_by', 'firstName lastName')
        .lean();

      if (!sprint) {
        return {
          success: false,
          error: 'Sprint no encontrado'
        };
      }

      // Obtener historias del sprint
      const historias = await BacklogItem.find({ sprint: sprintId })
        .select('titulo estado puntos_historia prioridad tipo')
        .lean();

      // Calcular métricas
      const metricas = {
        total_historias: historias.length,
        historias_completadas: historias.filter(h => h.estado === 'hecho').length,
        puntos_totales: historias.reduce((sum, h) => sum + (h.puntos_historia || 0), 0),
        puntos_completados: historias.filter(h => h.estado === 'hecho')
          .reduce((sum, h) => sum + (h.puntos_historia || 0), 0)
      };

      return {
        success: true,
        sprint: {
          ...sprint,
          historias,
          metricas
        }
      };
    } catch (error) {
      console.error('SprintService.getSprintById error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Crear un nuevo sprint
   */
  static async createSprint(sprintData, userId) {
    try {
      const {
        nombre,
        objetivo,
        fecha_inicio,
        fecha_fin,
        producto,
        capacidad_equipo
      } = sprintData;

      // Validaciones
      if (!nombre || !fecha_inicio || !fecha_fin || !producto) {
        return {
          success: false,
          error: 'Nombre, fechas y producto son requeridos'
        };
      }

      // Validar que fecha_fin sea posterior a fecha_inicio
      if (new Date(fecha_fin) <= new Date(fecha_inicio)) {
        return {
          success: false,
          error: 'La fecha de fin debe ser posterior a la fecha de inicio'
        };
      }

      // Crear el sprint
      const nuevoSprint = new Sprint({
        nombre,
        objetivo,
        fecha_inicio,
        fecha_fin,
        producto,
        capacidad_equipo: capacidad_equipo || 0,
        estado: 'planificacion',
        created_by: userId,
        updated_by: userId
      });

      await nuevoSprint.save();
      await nuevoSprint.populate('producto', 'nombre');

      return {
        success: true,
        sprint: nuevoSprint,
        message: 'Sprint creado exitosamente'
      };
    } catch (error) {
      console.error('SprintService.createSprint error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Actualizar un sprint
   */
  static async updateSprint(sprintId, updates, userId) {
    try {
      const finalUpdates = { ...updates, updated_by: userId };

      // Validar fechas si se actualizan
      if (finalUpdates.fecha_inicio && finalUpdates.fecha_fin) {
        if (new Date(finalUpdates.fecha_fin) <= new Date(finalUpdates.fecha_inicio)) {
          return {
            success: false,
            error: 'La fecha de fin debe ser posterior a la fecha de inicio'
          };
        }
      }

      const sprint = await Sprint.findByIdAndUpdate(
        sprintId,
        finalUpdates,
        { new: true, runValidators: true }
      ).populate('producto', 'nombre');

      if (!sprint) {
        return {
          success: false,
          error: 'Sprint no encontrado'
        };
      }

      return {
        success: true,
        sprint,
        message: 'Sprint actualizado exitosamente'
      };
    } catch (error) {
      console.error('SprintService.updateSprint error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Eliminar un sprint
   */
  static async deleteSprint(sprintId) {
    try {
      // Verificar si el sprint tiene historias asignadas
      const historiasCount = await BacklogItem.countDocuments({ sprint: sprintId });
      if (historiasCount > 0) {
        return {
          success: false,
          error: 'No se puede eliminar el sprint porque tiene historias asignadas',
          historias_count: historiasCount
        };
      }

      const sprint = await Sprint.findByIdAndDelete(sprintId);
      if (!sprint) {
        return {
          success: false,
          error: 'Sprint no encontrado'
        };
      }

      return {
        success: true,
        message: 'Sprint eliminado exitosamente',
        deleted_sprint: {
          id: sprint._id,
          nombre: sprint.nombre
        }
      };
    } catch (error) {
      console.error('SprintService.deleteSprint error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Asignar historia a un sprint
   */
  static async assignStoryToSprint(sprintId, storyId, userId) {
    try {
      // Validar que el sprint existe
      const sprint = await Sprint.findById(sprintId);
      if (!sprint) {
        return {
          success: false,
          error: 'Sprint no encontrado'
        };
      }

      // Validar que la historia existe
      const historia = await BacklogItem.findById(storyId);
      if (!historia) {
        return {
          success: false,
          error: 'Historia no encontrada'
        };
      }

      // Verificar que la historia pertenece al mismo producto
      if (!historia.producto.equals(sprint.producto)) {
        return {
          success: false,
          error: 'La historia debe pertenecer al mismo producto que el sprint'
        };
      }

      // Asignar la historia al sprint
      historia.sprint = sprintId;
      historia.updated_by = userId;
      await historia.save();

      await historia.populate([
        { path: 'producto', select: 'nombre' },
        { path: 'sprint', select: 'nombre' }
      ]);

      return {
        success: true,
        historia,
        message: `Historia "${historia.titulo}" asignada al sprint "${sprint.nombre}"`
      };
    } catch (error) {
      console.error('SprintService.assignStoryToSprint error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Asignar múltiples historias a un sprint
   */
  static async assignMultipleStoriesToSprint(sprintId, storyIds, userId) {
    try {
      // Validar que el sprint existe
      const sprint = await Sprint.findById(sprintId);
      if (!sprint) {
        return {
          success: false,
          error: 'Sprint no encontrado'
        };
      }

      // Actualizar todas las historias
      const result = await BacklogItem.updateMany(
        { 
          _id: { $in: storyIds },
          producto: sprint.producto // Solo del mismo producto
        },
        { 
          sprint: sprintId,
          updated_by: userId
        }
      );

      return {
        success: true,
        assigned_count: result.modifiedCount,
        message: `${result.modifiedCount} historias asignadas al sprint "${sprint.nombre}"`
      };
    } catch (error) {
      console.error('SprintService.assignMultipleStoriesToSprint error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Remover historia de un sprint
   */
  static async removeStoryFromSprint(sprintId, storyId, userId) {
    try {
      const historia = await BacklogItem.findOne({
        _id: storyId,
        sprint: sprintId
      });

      if (!historia) {
        return {
          success: false,
          error: 'Historia no encontrada en este sprint'
        };
      }

      historia.sprint = null;
      historia.updated_by = userId;
      await historia.save();

      return {
        success: true,
        message: `Historia "${historia.titulo}" removida del sprint`
      };
    } catch (error) {
      console.error('SprintService.removeStoryFromSprint error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Iniciar un sprint
   */
  static async startSprint(sprintId, userId) {
    try {
      const sprint = await Sprint.findById(sprintId);
      if (!sprint) {
        return {
          success: false,
          error: 'Sprint no encontrado'
        };
      }

      if (sprint.estado !== 'planificacion') {
        return {
          success: false,
          error: `El sprint ya está en estado "${sprint.estado}"`
        };
      }

      sprint.estado = 'en_progreso';
      sprint.updated_by = userId;
      await sprint.save();

      return {
        success: true,
        sprint,
        message: `Sprint "${sprint.nombre}" iniciado`
      };
    } catch (error) {
      console.error('SprintService.startSprint error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Completar un sprint
   */
  static async completeSprint(sprintId, userId) {
    try {
      const sprint = await Sprint.findById(sprintId);
      if (!sprint) {
        return {
          success: false,
          error: 'Sprint no encontrado'
        };
      }

      if (sprint.estado !== 'en_progreso') {
        return {
          success: false,
          error: `El sprint debe estar en progreso para completarse (actual: "${sprint.estado}")`
        };
      }

      sprint.estado = 'completado';
      sprint.updated_by = userId;
      await sprint.save();

      // Obtener métricas finales
      const historias = await BacklogItem.find({ sprint: sprintId });
      const metricas = {
        total_historias: historias.length,
        historias_completadas: historias.filter(h => h.estado === 'hecho').length,
        puntos_totales: historias.reduce((sum, h) => sum + (h.puntos_historia || 0), 0),
        puntos_completados: historias.filter(h => h.estado === 'hecho')
          .reduce((sum, h) => sum + (h.puntos_historia || 0), 0)
      };

      return {
        success: true,
        sprint,
        metricas,
        message: `Sprint "${sprint.nombre}" completado`
      };
    } catch (error) {
      console.error('SprintService.completeSprint error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener historias disponibles para asignar a un sprint
   */
  static async getAvailableStories(productoId, options = {}) {
    try {
      const {
        exclude_sprint_id,
        only_pending = true
      } = options;

      const filtros = {
        producto: productoId,
        tipo: 'historia'
      };

      // Excluir historias ya asignadas a sprints
      if (only_pending) {
        filtros.$or = [
          { sprint: null },
          { sprint: { $exists: false } }
        ];
      }

      const historias = await BacklogItem.find(filtros)
        .select('titulo descripcion puntos_historia prioridad estado')
        .sort({ prioridad: -1, orden: 1 })
        .lean();

      return {
        success: true,
        historias,
        total: historias.length
      };
    } catch (error) {
      console.error('SprintService.getAvailableStories error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validar capacidad del sprint
   */
  static async validateSprintCapacity(sprintId, storyIds) {
    try {
      const sprint = await Sprint.findById(sprintId);
      if (!sprint) {
        return {
          success: false,
          error: 'Sprint no encontrado'
        };
      }

      // Obtener puntos actuales en el sprint
      const currentStories = await BacklogItem.find({ sprint: sprintId });
      const currentPoints = currentStories.reduce((sum, s) => sum + (s.puntos_historia || 0), 0);

      // Obtener puntos de las nuevas historias
      const newStories = await BacklogItem.find({ _id: { $in: storyIds } });
      const newPoints = newStories.reduce((sum, s) => sum + (s.puntos_historia || 0), 0);

      const totalPoints = currentPoints + newPoints;
      const isOverCapacity = totalPoints > sprint.capacidad_equipo;

      return {
        success: true,
        validation: {
          current_points: currentPoints,
          new_points: newPoints,
          total_points: totalPoints,
          capacity: sprint.capacidad_equipo,
          is_over_capacity: isOverCapacity,
          remaining_capacity: sprint.capacidad_equipo - totalPoints
        }
      };
    } catch (error) {
      console.error('SprintService.validateSprintCapacity error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener métricas de un sprint (para burndown chart)
   */
  static async getSprintMetrics(sprintId) {
    try {
      const sprint = await Sprint.findById(sprintId);
      if (!sprint) {
        return {
          success: false,
          error: 'Sprint no encontrado'
        };
      }

      const historias = await BacklogItem.find({ sprint: sprintId });

      const metricas = {
        total_historias: historias.length,
        por_estado: {
          pendiente: historias.filter(h => h.estado === 'pendiente').length,
          en_progreso: historias.filter(h => h.estado === 'en_progreso').length,
          hecho: historias.filter(h => h.estado === 'hecho').length
        },
        puntos: {
          totales: historias.reduce((sum, h) => sum + (h.puntos_historia || 0), 0),
          completados: historias.filter(h => h.estado === 'hecho')
            .reduce((sum, h) => sum + (h.puntos_historia || 0), 0),
          en_progreso: historias.filter(h => h.estado === 'en_progreso')
            .reduce((sum, h) => sum + (h.puntos_historia || 0), 0),
          pendientes: historias.filter(h => h.estado === 'pendiente')
            .reduce((sum, h) => sum + (h.puntos_historia || 0), 0)
        },
        capacidad_equipo: sprint.capacidad_equipo,
        utilizacion: sprint.capacidad_equipo > 0 
          ? (historias.reduce((sum, h) => sum + (h.puntos_historia || 0), 0) / sprint.capacidad_equipo) * 100 
          : 0
      };

      return {
        success: true,
        sprint,
        metricas
      };
    } catch (error) {
      console.error('SprintService.getSprintMetrics error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = SprintService;
