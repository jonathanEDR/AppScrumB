/**
 * ContextBuilder - Constructor de contexto para agentes AI
 * Carga dinámicamente la información necesaria según la intención
 */

const Product = require('../../models/Product');
const BacklogItem = require('../../models/BacklogItem');
const Sprint = require('../../models/Sprint');
const User = require('../../models/User');
const SystemConfig = require('../../models/SystemConfig');
const contextCache = require('./ContextCache');

class ContextBuilder {
  /**
   * Construye el contexto completo para el agente
   * @param {string} intent - Intención clasificada
   * @param {object} entities - Entidades extraídas
   * @param {object} user - Usuario que hace la petición
   * @returns {object} Contexto completo
   */
  static async build(intent, entities, user) {
    try {
      const context = {
        user: {
          id: user._id || user.id,
          name: user.name || user.nombre_negocio,
          email: user.email,
          role: user.role
        },
        timestamp: new Date().toISOString(),
        intent: intent,
        entities: entities
      };

      // Cargar producto si está especificado
      if (entities.product_ids?.length > 0) {
        context.products = await this.loadProducts(entities.product_ids);
        
        // Si solo hay un producto, cargarlo como principal
        if (context.products.length === 1) {
          context.primary_product = context.products[0];
        }
      }

      // Cargar backlog si es necesario
      if (this.needsBacklogContext(intent)) {
        context.backlog = await this.loadBacklog(entities.product_ids);
        context.backlog_stats = this.calculateBacklogStats(context.backlog);
      }

      // Cargar sprints si es necesario
      if (this.needsSprintContext(intent)) {
        context.sprints = await this.loadSprints(entities.product_ids);
        context.active_sprint = this.findActiveSprint(context.sprints);
      }

      // Cargar estándares del equipo
      if (this.needsStandards(intent)) {
        context.standards = await this.loadTeamStandards();
      }

      // Agregar información de capacidad si es planning
      if (intent === 'plan_sprint' || intent === 'estimate_story') {
        context.team_capacity = await this.loadTeamCapacity(entities.product_ids[0]);
      }

      return context;

    } catch (error) {
      console.error('ContextBuilder.build error:', error);
      return {
        error: error.message,
        user: { id: user._id },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Determina si la intención necesita contexto de backlog
   */
  static needsBacklogContext(intent) {
    return [
      'create_user_story',
      'refine_user_story',
      'prioritize_backlog',
      'analyze_backlog',
      'estimate_story',
      'analyze_business_value',
      'suggest_improvements'
    ].includes(intent);
  }

  /**
   * Determina si la intención necesita contexto de sprints
   */
  static needsSprintContext(intent) {
    return [
      'suggest_sprint_goal',
      'plan_sprint',
      'estimate_story',
      'generate_report'
    ].includes(intent);
  }

  /**
   * Determina si se necesitan los estándares del equipo
   */
  static needsStandards(intent) {
    return [
      'create_user_story',
      'refine_user_story',
      'generate_acceptance_criteria'
    ].includes(intent);
  }

  /**
   * Carga información de productos
   */
  static async loadProducts(productIds) {
    try {
      if (!productIds || productIds.length === 0) {
        return [];
      }

      // Intentar desde cache
      const productId = productIds[0]; // Por ahora solo cacheamos el primero
      const cached = await contextCache.getProductContext(productId);
      if (cached) {
        return [cached];
      }

      const products = await Product.find({ 
        _id: { $in: productIds } 
      })
        .populate('responsable', 'nombre_negocio email')
        .lean();

      // Cachear el primer producto
      if (products.length > 0) {
        await contextCache.setProductContext(productId, products[0]);
      }

      return products;
    } catch (error) {
      console.error('ContextBuilder.loadProducts error:', error);
      return [];
    }
  }

  /**
   * Carga el backlog de los productos especificados
   */
  static async loadBacklog(productIds, options = {}) {
    try {
      const limit = options.limit || 50;
      const includeArchived = options.includeArchived || false;

      // Intentar desde cache
      const productId = productIds && productIds.length > 0 ? productIds[0] : null;
      if (productId) {
        const cacheParams = { limit, includeArchived };
        const cached = await contextCache.getBacklogContext(productId, cacheParams);
        if (cached) {
          return cached;
        }
      }

      let filter = {};
      
      if (productIds && productIds.length > 0) {
        filter.producto = { $in: productIds };
      }

      if (!includeArchived) {
        filter.estado = { $ne: 'archivado' };
      }

      const backlogItems = await BacklogItem.find(filter)
        .populate('producto', 'nombre')
        .populate('asignado_a', 'nombre_negocio email')
        .populate('sprint', 'nombre estado')
        .sort({ orden: 1, prioridad: -1, createdAt: -1 })
        .limit(limit)
        .lean();

      // Cachear resultado
      if (productId) {
        const cacheParams = { limit, includeArchived };
        await contextCache.setBacklogContext(productId, backlogItems, cacheParams);
      }

      return backlogItems;
    } catch (error) {
      console.error('ContextBuilder.loadBacklog error:', error);
      return [];
    }
  }

  /**
   * Calcula estadísticas del backlog
   */
  static calculateBacklogStats(backlogItems) {
    if (!backlogItems || backlogItems.length === 0) {
      return {
        total: 0,
        por_tipo: {},
        por_estado: {},
        por_prioridad: {},
        puntos_totales: 0
      };
    }

    const stats = {
      total: backlogItems.length,
      por_tipo: {},
      por_estado: {},
      por_prioridad: {},
      puntos_totales: 0
    };

    backlogItems.forEach(item => {
      // Contar por tipo
      stats.por_tipo[item.tipo] = (stats.por_tipo[item.tipo] || 0) + 1;

      // Contar por estado
      stats.por_estado[item.estado] = (stats.por_estado[item.estado] || 0) + 1;

      // Contar por prioridad
      stats.por_prioridad[item.prioridad] = (stats.por_prioridad[item.prioridad] || 0) + 1;

      // Sumar puntos
      stats.puntos_totales += item.puntos_historia || 0;
    });

    return stats;
  }

  /**
   * Carga sprints de los productos especificados
   */
  static async loadSprints(productIds, options = {}) {
    try {
      const limit = options.limit || 10;
      const includeCompleted = options.includeCompleted !== false; // true por defecto

      // Intentar desde cache
      const productId = productIds && productIds.length > 0 ? productIds[0] : null;
      if (productId) {
        const cached = await contextCache.getSprintsContext(productId);
        if (cached) {
          return cached;
        }
      }

      let filter = {};
      
      if (productIds && productIds.length > 0) {
        filter.producto = { $in: productIds };
      }

      if (!includeCompleted) {
        filter.estado = { $in: ['planificacion', 'en_progreso'] };
      }

      const sprints = await Sprint.find(filter)
        .populate('producto', 'nombre')
        .sort({ fecha_inicio: -1 })
        .limit(limit)
        .lean();

      // Cachear resultado
      if (productId) {
        await contextCache.setSprintsContext(productId, sprints);
      }

      return sprints;
    } catch (error) {
      console.error('ContextBuilder.loadSprints error:', error);
      return [];
    }
  }

  /**
   * Encuentra el sprint activo
   */
  static findActiveSprint(sprints) {
    if (!sprints || sprints.length === 0) {
      return null;
    }

    return sprints.find(sprint => sprint.estado === 'en_progreso') || null;
  }

  /**
   * Carga estándares y configuraciones del equipo
   */
  static async loadTeamStandards() {
    try {
      // Intentar cargar desde SystemConfig
      const config = await SystemConfig.findOne({}).lean();

      if (config) {
        return {
          story_format: config.story_format || 'As a [user], I want [feature], so that [benefit]',
          acceptance_criteria_format: config.acceptance_criteria_format || 'Given [context], When [action], Then [outcome]',
          estimation_scale: config.estimation_scale || 'fibonacci',
          definition_of_done: config.definition_of_done || [],
          code_standards: config.code_standards || {}
        };
      }

      // Valores por defecto si no hay configuración
      return {
        story_format: 'Como [usuario], quiero [funcionalidad], para [beneficio]',
        acceptance_criteria_format: 'Dado [contexto], Cuando [acción], Entonces [resultado]',
        estimation_scale: 'fibonacci',
        fibonacci_values: [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89],
        definition_of_done: [
          'Código revisado por pares',
          'Tests unitarios pasando',
          'Documentación actualizada',
          'Criterios de aceptación cumplidos'
        ],
        story_best_practices: [
          'Usar lenguaje del usuario',
          'Incluir criterios de aceptación',
          'Mantener historias pequeñas (< 13 puntos)',
          'Definir valor de negocio claro'
        ]
      };
    } catch (error) {
      console.error('ContextBuilder.loadTeamStandards error:', error);
      return {
        story_format: 'Como [usuario], quiero [funcionalidad], para [beneficio]',
        estimation_scale: 'fibonacci'
      };
    }
  }

  /**
   * Carga capacidad del equipo para planning
   */
  static async loadTeamCapacity(productId) {
    try {
      if (!productId) {
        return null;
      }

      // Obtener desarrolladores del producto
      const developers = await User.find({
        role: 'developers',
        is_active: true
        // Aquí podrías filtrar por producto si tienes esa relación
      })
        .select('nombre_negocio email availability')
        .lean();

      // Calcular capacidad total (asumiendo 40 horas por desarrollador por sprint)
      const hoursPerDeveloper = 40;
      const totalCapacity = developers.length * hoursPerDeveloper;

      // Obtener velocidad promedio de sprints anteriores
      const previousSprints = await Sprint.find({
        producto: productId,
        estado: 'completado'
      })
        .sort({ fecha_fin: -1 })
        .limit(3)
        .lean();

      let averageVelocity = 0;
      if (previousSprints.length > 0) {
        const velocities = await Promise.all(
          previousSprints.map(async (sprint) => {
            const completedItems = await BacklogItem.find({
              sprint: sprint._id,
              estado: 'hecho'
            }).lean();

            return completedItems.reduce((sum, item) => sum + (item.puntos_historia || 0), 0);
          })
        );

        averageVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
      }

      return {
        team_size: developers.length,
        total_hours_available: totalCapacity,
        average_velocity: Math.round(averageVelocity),
        developers: developers.map(dev => ({
          id: dev._id,
          name: dev.nombre_negocio,
          availability: dev.availability || 100
        })),
        recommendation: `Basado en tu velocidad promedio de ${Math.round(averageVelocity)} puntos, puedes planificar entre ${Math.round(averageVelocity * 0.8)} y ${Math.round(averageVelocity * 1.2)} puntos para el próximo sprint.`
      };
    } catch (error) {
      console.error('ContextBuilder.loadTeamCapacity error:', error);
      return null;
    }
  }

  /**
   * Construye un resumen textual del contexto para el AI
   */
  static buildContextSummary(context) {
    const parts = [];

    if (context.primary_product) {
      parts.push(`Producto: ${context.primary_product.nombre}`);
    }

    if (context.backlog_stats) {
      parts.push(`Backlog: ${context.backlog_stats.total} items (${context.backlog_stats.puntos_totales} puntos)`);
    }

    if (context.active_sprint) {
      parts.push(`Sprint activo: ${context.active_sprint.nombre}`);
    }

    if (context.team_capacity) {
      parts.push(`Equipo: ${context.team_capacity.team_size} desarrolladores, velocidad promedio: ${context.team_capacity.average_velocity} puntos`);
    }

    return parts.join(' | ');
  }
}

module.exports = ContextBuilder;
