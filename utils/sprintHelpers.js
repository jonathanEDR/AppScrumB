const Sprint = require('../models/Sprint');
const logger = require('../config/logger');

/**
 * Helpers para manejo de Sprints
 * Centraliza lógica común de búsqueda de sprints
 */
class SprintHelpers {
  /**
   * Busca el sprint activo siguiendo la lógica:
   * 1. Buscar sprint con estado 'activo'
   * 2. Si no hay, buscar sprint en el rango de fechas actual
   * 3. Si no hay, devolver el más reciente
   * 
   * @returns {Promise<Sprint|null>} Sprint activo o null
   */
  static async getActiveSprint() {
    try {
      // 1. Intentar obtener el sprint con estado activo
      let sprint = await Sprint.findOne({ estado: 'activo' });
      
      if (sprint) {
        logger.debug('Sprint activo encontrado por estado', {
          context: 'SprintHelpers',
          sprintId: sprint._id,
          nombre: sprint.nombre
        });
        return sprint;
      }

      // 2. Si no hay sprint activo, buscar el sprint actual por fechas
      const now = new Date();
      sprint = await Sprint.findOne({
        fecha_inicio: { $lte: now },
        fecha_fin: { $gte: now }
      }).sort({ fecha_inicio: -1 });
      
      if (sprint) {
        logger.debug('Sprint encontrado por rango de fechas', {
          context: 'SprintHelpers',
          sprintId: sprint._id,
          nombre: sprint.nombre
        });
        return sprint;
      }

      // 3. Si aún no hay sprint, tomar el más reciente
      sprint = await Sprint.findOne().sort({ fecha_inicio: -1 });
      
      if (sprint) {
        logger.debug('Sprint más reciente encontrado', {
          context: 'SprintHelpers',
          sprintId: sprint._id,
          nombre: sprint.nombre
        });
      } else {
        logger.warn('No se encontró ningún sprint en el sistema', {
          context: 'SprintHelpers'
        });
      }

      return sprint;
    } catch (error) {
      logger.error('Error al buscar sprint activo', {
        context: 'SprintHelpers',
        error: error.message
      });
      throw new Error(`Error al buscar sprint activo: ${error.message}`);
    }
  }

  /**
   * Busca un sprint por ID o devuelve el activo si no se proporciona ID
   * 
   * @param {string|null} sprintId - ID del sprint (opcional)
   * @returns {Promise<Sprint|null>} Sprint encontrado o null
   */
  static async getSprintByIdOrActive(sprintId = null) {
    try {
      if (sprintId) {
        const sprint = await Sprint.findById(sprintId);
        
        if (!sprint) {
          logger.warn('Sprint no encontrado por ID', {
            context: 'SprintHelpers',
            sprintId
          });
          return null;
        }

        logger.debug('Sprint encontrado por ID', {
          context: 'SprintHelpers',
          sprintId: sprint._id,
          nombre: sprint.nombre
        });
        
        return sprint;
      }

      // Si no se proporciona ID, devolver el activo
      return await this.getActiveSprint();
    } catch (error) {
      logger.error('Error al buscar sprint', {
        context: 'SprintHelpers',
        sprintId,
        error: error.message
      });
      throw new Error(`Error al buscar sprint: ${error.message}`);
    }
  }

  /**
   * Verifica si un sprint está activo actualmente
   * 
   * @param {Sprint} sprint - Objeto sprint
   * @returns {boolean} True si el sprint está activo
   */
  static isSprintActive(sprint) {
    if (!sprint) return false;

    const now = new Date();
    const isInDateRange = sprint.fecha_inicio <= now && sprint.fecha_fin >= now;
    const hasActiveStatus = sprint.estado === 'activo';

    return isInDateRange || hasActiveStatus;
  }

  /**
   * Calcula días restantes de un sprint
   * 
   * @param {Sprint} sprint - Objeto sprint
   * @returns {number} Días restantes (puede ser negativo si ya terminó)
   */
  static getDaysRemaining(sprint) {
    if (!sprint || !sprint.fecha_fin) return 0;

    const now = new Date();
    const endDate = new Date(sprint.fecha_fin);
    const diffTime = endDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Formatea sprint data para respuesta de API
   * 
   * @param {Sprint} sprint - Objeto sprint
   * @returns {object} Sprint formateado
   */
  static formatSprintForAPI(sprint) {
    if (!sprint) return null;

    return {
      _id: sprint._id,
      name: sprint.nombre,
      nombre: sprint.nombre, // Mantener ambos para compatibilidad
      goal: sprint.objetivo,
      objetivo: sprint.objetivo,
      startDate: sprint.fecha_inicio,
      fecha_inicio: sprint.fecha_inicio,
      endDate: sprint.fecha_fin,
      fecha_fin: sprint.fecha_fin,
      status: sprint.estado,
      estado: sprint.estado,
      isActive: this.isSprintActive(sprint),
      daysRemaining: this.getDaysRemaining(sprint)
    };
  }
}

module.exports = SprintHelpers;
