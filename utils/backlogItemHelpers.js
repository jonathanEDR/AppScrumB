const {
  mapTaskStatusToBacklogStatus,
  mapBacklogStatusToTaskStatus,
  mapBacklogPriorityToTaskPriority,
  mapBacklogTypeToTaskType
} = require('./taskMappings');
const logger = require('../config/logger');

/**
 * Helpers para conversión de BacklogItem a Task y viceversa
 * Centraliza lógica de mapeo y conversión
 */
class BacklogItemHelpers {
  /**
   * Convierte un BacklogItem al formato Task para frontend
   * 
   * @param {object} backlogItem - BacklogItem de MongoDB
   * @returns {object} Objeto en formato Task
   */
  static convertToTaskFormat(backlogItem) {
    if (!backlogItem) return null;

    try {
      const converted = {
        _id: backlogItem._id,
        title: backlogItem.titulo,
        description: backlogItem.descripcion,
        status: mapBacklogStatusToTaskStatus(backlogItem.estado),
        priority: mapBacklogPriorityToTaskPriority(backlogItem.prioridad),
        storyPoints: backlogItem.story_points || backlogItem.puntos_historia || 0,
        type: 'technical', // Marcar como item técnico
        isBacklogItem: true, // Flag para identificar que es un BacklogItem
        assignee: backlogItem.asignado_a,
        sprint: backlogItem.sprint,
        historia_padre: backlogItem.historia_padre,
        product: backlogItem.producto,
        createdAt: backlogItem.createdAt,
        updatedAt: backlogItem.updatedAt,
        originalStatus: backlogItem.estado, // Mantener el estado original
        originalPriority: backlogItem.prioridad,
        originalType: backlogItem.tipo,
        spentHours: 0 // BacklogItems no tienen time tracking directo
      };

      return converted;
    } catch (error) {
      logger.error('Error al convertir BacklogItem a Task format', {
        context: 'BacklogItemHelpers',
        itemId: backlogItem?._id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Convierte múltiples BacklogItems al formato Task
   * 
   * @param {Array} backlogItems - Array de BacklogItems
   * @returns {Array} Array de objetos en formato Task
   */
  static convertMultipleToTaskFormat(backlogItems) {
    if (!Array.isArray(backlogItems)) {
      logger.warn('convertMultipleToTaskFormat recibió dato no-array', {
        context: 'BacklogItemHelpers'
      });
      return [];
    }

    return backlogItems.map(item => this.convertToTaskFormat(item));
  }

  /**
   * Sincroniza el estado de un Task con su BacklogItem relacionado
   * 
   * @param {string} taskStatus - Estado de Task
   * @returns {string} Estado de BacklogItem correspondiente
   */
  static syncTaskStatusToBacklog(taskStatus) {
    return mapTaskStatusToBacklogStatus(taskStatus);
  }

  /**
   * Verifica si un BacklogItem es una tarea técnica (no historia/epic)
   * 
   * @param {object} backlogItem - BacklogItem
   * @returns {boolean} True si es tarea técnica
   */
  static isTechnicalItem(backlogItem) {
    if (!backlogItem || !backlogItem.tipo) return false;
    
    const technicalTypes = ['tarea', 'bug', 'mejora', 'spike'];
    return technicalTypes.includes(backlogItem.tipo.toLowerCase());
  }

  /**
   * Verifica si un BacklogItem está disponible para asignación
   * 
   * @param {object} backlogItem - BacklogItem
   * @returns {boolean} True si está disponible
   */
  static isAvailableForAssignment(backlogItem) {
    if (!backlogItem) return false;

    const isUnassigned = !backlogItem.asignado_a;
    const isPending = backlogItem.estado === 'pendiente' || !backlogItem.estado;
    const isTechnical = this.isTechnicalItem(backlogItem);

    return isUnassigned && isPending && isTechnical;
  }

  /**
   * Filtra BacklogItems que son tareas técnicas disponibles
   * 
   * @param {Array} backlogItems - Array de BacklogItems
   * @returns {Array} BacklogItems disponibles
   */
  static filterAvailableItems(backlogItems) {
    if (!Array.isArray(backlogItems)) return [];

    return backlogItems.filter(item => this.isAvailableForAssignment(item));
  }

  /**
   * Combina Tasks regulares y BacklogItems convertidos
   * Útil para endpoints que necesitan mostrar ambos tipos
   * 
   * @param {Array} tasks - Array de Tasks regulares
   * @param {Array} backlogItems - Array de BacklogItems
   * @returns {Array} Array combinado con Tasks y BacklogItems convertidos
   */
  static combineTasksAndBacklogItems(tasks, backlogItems) {
    try {
      // Convertir tasks a objetos planos si son documentos de Mongoose
      const plainTasks = tasks.map(task => {
        const plainTask = task.toObject ? task.toObject() : task;
        return { ...plainTask, type: 'task', isBacklogItem: false };
      });

      // Convertir BacklogItems a formato Task
      const convertedBacklogItems = this.convertMultipleToTaskFormat(backlogItems);

      // Combinar ambos arrays
      const combined = [...plainTasks, ...convertedBacklogItems];

      logger.debug('Tasks y BacklogItems combinados', {
        context: 'BacklogItemHelpers',
        tasksCount: plainTasks.length,
        backlogItemsCount: convertedBacklogItems.length,
        totalCount: combined.length
      });

      return combined;
    } catch (error) {
      logger.error('Error al combinar Tasks y BacklogItems', {
        context: 'BacklogItemHelpers',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Prepara query filters para BacklogItems basado en filtros de Task
   * 
   * @param {object} taskFilters - Filtros en formato Task
   * @returns {object} Filtros en formato BacklogItem
   */
  static mapTaskFiltersToBacklogFilters(taskFilters) {
    const backlogFilters = {};

    // Mapear assignee -> asignado_a
    if (taskFilters.assignee) {
      backlogFilters.asignado_a = taskFilters.assignee;
    }

    // Mapear sprint
    if (taskFilters.sprint) {
      backlogFilters.sprint = taskFilters.sprint;
    }

    // Mapear búsqueda de texto
    if (taskFilters.$or && Array.isArray(taskFilters.$or)) {
      backlogFilters.$or = [
        { titulo: taskFilters.$or[0]?.title?.$regex || taskFilters.$or[0]?.titulo?.$regex },
        { descripcion: taskFilters.$or[1]?.description?.$regex || taskFilters.$or[1]?.descripcion?.$regex }
      ].filter(filter => filter.titulo || filter.descripcion);
    }

    // Solo items técnicos
    backlogFilters.tipo = { $in: ['tarea', 'bug', 'mejora', 'spike'] };

    return backlogFilters;
  }

  /**
   * Agrupa tareas combinadas por estado para Sprint Board
   * 
   * @param {Array} combinedTasks - Array de Tasks y BacklogItems combinados
   * @returns {object} Tareas agrupadas por estado
   */
  static groupByStatus(combinedTasks) {
    if (!Array.isArray(combinedTasks)) return {};

    const grouped = {
      todo: [],
      in_progress: [],
      code_review: [],
      testing: [],
      done: []
    };

    combinedTasks.forEach(task => {
      const status = task.status || 'todo';
      if (grouped[status]) {
        grouped[status].push(task);
      }
    });

    return grouped;
  }

  /**
   * Calcula métricas de sprint basado en tareas combinadas
   * 
   * @param {Array} combinedTasks - Array de Tasks y BacklogItems combinados
   * @returns {object} Métricas calculadas
   */
  static calculateSprintMetrics(combinedTasks) {
    if (!Array.isArray(combinedTasks) || combinedTasks.length === 0) {
      return {
        totalPoints: 0,
        completedPoints: 0,
        sprintProgress: 0,
        todoTasks: 0,
        inProgressTasks: 0,
        codeReviewTasks: 0,
        testingTasks: 0,
        doneTasks: 0
      };
    }

    const totalPoints = combinedTasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0);
    const completedPoints = combinedTasks
      .filter(task => task.status === 'done' || task.originalStatus === 'completado')
      .reduce((sum, task) => sum + (task.storyPoints || 0), 0);
    
    const sprintProgress = totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0;

    return {
      totalPoints,
      completedPoints,
      sprintProgress: Math.round(sprintProgress),
      todoTasks: combinedTasks.filter(t => t.status === 'todo' || t.originalStatus === 'pendiente').length,
      inProgressTasks: combinedTasks.filter(t => t.status === 'in_progress' || t.originalStatus === 'en_progreso').length,
      codeReviewTasks: combinedTasks.filter(t => t.status === 'code_review' || t.originalStatus === 'revision').length,
      testingTasks: combinedTasks.filter(t => t.status === 'testing' || t.originalStatus === 'pruebas').length,
      doneTasks: combinedTasks.filter(t => t.status === 'done' || t.originalStatus === 'completado').length
    };
  }
}

module.exports = BacklogItemHelpers;
