/**
 * ArchitectureService
 * Servicio para gestión de arquitectura de proyectos
 */

const ProjectArchitecture = require('../models/ProjectArchitecture');
const Product = require('../models/Product');
const mongoose = require('mongoose');

class ArchitectureService {
  
  // ============================================
  // CRUD BÁSICO
  // ============================================

  /**
   * Crear arquitectura para un producto
   */
  static async create(productId, userId, data = {}) {
    try {
      // Verificar que el producto existe
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Producto no encontrado');
      }

      // Verificar que no exista ya una arquitectura
      const existing = await ProjectArchitecture.findOne({ product: productId });
      if (existing) {
        throw new Error('Ya existe una arquitectura para este producto');
      }

      const architecture = new ProjectArchitecture({
        product: productId,
        project_name: data.project_name || product.nombre,
        created_by: userId,
        ...data
      });

      await architecture.save();
      
      return {
        success: true,
        data: architecture,
        message: 'Arquitectura creada exitosamente'
      };
    } catch (error) {
      console.error('ArchitectureService.create error:', error);
      throw error;
    }
  }

  /**
   * Obtener arquitectura por producto
   */
  static async getByProduct(productId) {
    try {
      const architecture = await ProjectArchitecture.findOne({ product: productId })
        .populate('product', 'nombre descripcion estado')
        .populate('modules.related_stories', 'titulo descripcion status')
        .populate('modules.assigned_sprint', 'nombre fechaInicio fechaFin')
        .populate('created_by', 'nombre_negocio email')
        .populate('updated_by', 'nombre_negocio email')
        .lean();

      if (!architecture) {
        return {
          exists: false,
          needs_definition: true,
          message: 'Este producto no tiene arquitectura definida'
        };
      }

      // Agregar estadísticas calculadas
      architecture.stats = this.calculateStats(architecture);
      
      return {
        exists: true,
        data: architecture
      };
    } catch (error) {
      console.error('ArchitectureService.getByProduct error:', error);
      throw error;
    }
  }

  /**
   * Obtener arquitectura por ID
   */
  static async getById(architectureId) {
    try {
      const architecture = await ProjectArchitecture.findById(architectureId)
        .populate('product', 'nombre descripcion estado')
        .populate('modules.related_stories', 'titulo descripcion status')
        .populate('created_by', 'nombre_negocio email')
        .lean();

      if (!architecture) {
        throw new Error('Arquitectura no encontrada');
      }

      architecture.stats = this.calculateStats(architecture);
      
      return architecture;
    } catch (error) {
      console.error('ArchitectureService.getById error:', error);
      throw error;
    }
  }

  /**
   * Actualizar arquitectura
   */
  static async update(productId, userId, updates) {
    try {
      const architecture = await ProjectArchitecture.findOneAndUpdate(
        { product: productId },
        { 
          ...updates, 
          updated_by: userId,
          $inc: { __v: 1 }
        },
        { new: true, runValidators: true }
      );

      if (!architecture) {
        throw new Error('Arquitectura no encontrada');
      }

      return {
        success: true,
        data: architecture,
        message: 'Arquitectura actualizada exitosamente'
      };
    } catch (error) {
      console.error('ArchitectureService.update error:', error);
      throw error;
    }
  }

  /**
   * Eliminar arquitectura
   */
  static async delete(productId, userId) {
    try {
      const architecture = await ProjectArchitecture.findOneAndDelete({ 
        product: productId 
      });

      if (!architecture) {
        throw new Error('Arquitectura no encontrada');
      }

      return {
        success: true,
        message: 'Arquitectura eliminada exitosamente'
      };
    } catch (error) {
      console.error('ArchitectureService.delete error:', error);
      throw error;
    }
  }

  /**
   * Crear o actualizar arquitectura de forma atómica (upsert)
   * Evita race conditions cuando múltiples requests intentan crear/actualizar
   * 
   * @param {string} productId - ID del producto
   * @param {string} userId - ID del usuario
   * @param {object} data - Datos de la arquitectura
   * @returns {object} { success, data, message, created }
   */
  static async createOrUpdate(productId, userId, data = {}) {
    try {
      // Verificar que el producto existe
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Producto no encontrado');
      }

      // Preparar datos para upsert
      const updateData = {
        ...data,
        updated_by: userId
      };

      // Datos que solo se establecen en la creación
      const setOnInsertData = {
        product: productId,
        created_by: userId,
        project_name: data.project_name || product.nombre
      };

      // Upsert atómico - evita race conditions
      const architecture = await ProjectArchitecture.findOneAndUpdate(
        { product: productId },
        { 
          $set: updateData,
          $setOnInsert: setOnInsertData
        },
        { 
          new: true,           // Retornar documento actualizado
          upsert: true,        // Crear si no existe
          runValidators: true, // Ejecutar validaciones del schema
          setDefaultsOnInsert: true // Aplicar defaults si es insert
        }
      );

      // Determinar si fue creación o actualización
      // Si __v es 0 y no hay updated_by diferente al creador, fue creación
      const wasCreated = architecture.__v === 0;

      // Recalcular completeness después del upsert
      if (architecture.calculateCompleteness) {
        architecture.calculateCompleteness();
        await architecture.save();
      }

      return {
        success: true,
        data: architecture,
        message: wasCreated ? 'Arquitectura creada exitosamente' : 'Arquitectura actualizada exitosamente',
        created: wasCreated
      };
    } catch (error) {
      console.error('ArchitectureService.createOrUpdate error:', error);
      throw error;
    }
  }

  // ============================================
  // GESTIÓN DE TECH STACK
  // ============================================

  /**
   * Actualizar stack tecnológico
   */
  static async updateTechStack(productId, userId, techStack) {
    try {
      const architecture = await ProjectArchitecture.findOne({ product: productId });
      
      if (!architecture) {
        throw new Error('Arquitectura no encontrada');
      }

      // Merge con el stack existente
      architecture.tech_stack = {
        ...architecture.tech_stack?.toObject?.() || {},
        ...techStack
      };
      architecture.updated_by = userId;
      
      await architecture.save();

      return {
        success: true,
        data: architecture.tech_stack,
        message: 'Stack tecnológico actualizado'
      };
    } catch (error) {
      console.error('ArchitectureService.updateTechStack error:', error);
      throw error;
    }
  }

  // ============================================
  // GESTIÓN DE MÓDULOS
  // ============================================

  /**
   * Helper para agregar una ruta al directory_structure
   * @param {Object} structure - El objeto directory_structure actual
   * @param {String} path - La ruta a agregar (ej: "backend/src/controllers/auth")
   * @param {String} description - Descripción opcional del archivo/carpeta final
   * @returns {Object} - El structure actualizado
   */
  static addPathToDirectoryStructure(structure, path, description = '') {
    if (!path || typeof path !== 'string') return structure;
    
    // Limpiar el path
    const cleanPath = path.replace(/^\/+|\/+$/g, '').trim();
    if (!cleanPath) return structure;
    
    const parts = cleanPath.split('/');
    if (parts.length === 0) return structure;
    
    // Determinar la sección raíz (frontend, backend, shared)
    let rootSection = 'backend'; // default
    const firstPart = parts[0].toLowerCase();
    
    if (firstPart === 'frontend' || firstPart === 'src' || firstPart === 'client') {
      rootSection = 'frontend';
    } else if (firstPart === 'backend' || firstPart === 'server' || firstPart === 'api') {
      rootSection = 'backend';
    } else if (firstPart === 'shared' || firstPart === 'common' || firstPart === 'lib') {
      rootSection = 'shared';
    }
    
    // Inicializar la sección si no existe
    if (!structure[rootSection]) {
      structure[rootSection] = {};
    }
    
    // Navegar/crear la estructura de carpetas
    let current = structure[rootSection];
    const pathParts = firstPart === rootSection ? parts.slice(1) : parts;
    
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (!part) continue;
      
      const isLast = i === pathParts.length - 1;
      
      if (isLast) {
        // Último elemento: puede ser archivo o carpeta
        if (!current[part]) {
          current[part] = description || `Módulo: ${part}`;
        }
      } else {
        // Elemento intermedio: debe ser carpeta (objeto)
        if (!current[part] || typeof current[part] !== 'object') {
          current[part] = {};
        }
        current = current[part];
      }
    }
    
    return structure;
  }

  /**
   * Agregar módulo
   */
  static async addModule(productId, userId, moduleData) {
    try {
      const architecture = await ProjectArchitecture.findOne({ product: productId });
      
      if (!architecture) {
        throw new Error('Arquitectura no encontrada');
      }

      architecture.modules.push(moduleData);
      architecture.updated_by = userId;
      
      // Si el módulo tiene path, agregarlo al directory_structure
      if (moduleData.path) {
        const currentStructure = architecture.directory_structure || { frontend: {}, backend: {}, shared: {} };
        const description = moduleData.description || `Módulo: ${moduleData.name}`;
        architecture.directory_structure = this.addPathToDirectoryStructure(
          currentStructure, 
          moduleData.path, 
          description
        );
        // Marcar como modificado para que Mongoose lo guarde
        architecture.markModified('directory_structure');
      }
      
      await architecture.save();

      const newModule = architecture.modules[architecture.modules.length - 1];

      return {
        success: true,
        data: newModule,
        message: `Módulo "${moduleData.name}" agregado exitosamente`
      };
    } catch (error) {
      console.error('ArchitectureService.addModule error:', error);
      throw error;
    }
  }

  /**
   * Actualizar módulo
   */
  static async updateModule(productId, moduleId, userId, updates) {
    try {
      const architecture = await ProjectArchitecture.findOne({ product: productId });
      
      if (!architecture) {
        throw new Error('Arquitectura no encontrada');
      }

      const moduleIndex = architecture.modules.findIndex(
        m => m._id.toString() === moduleId
      );

      if (moduleIndex === -1) {
        throw new Error('Módulo no encontrado');
      }

      // Actualizar campos del módulo
      Object.assign(architecture.modules[moduleIndex], updates);
      architecture.updated_by = userId;
      
      // Si se actualizó el path, agregarlo al directory_structure
      if (updates.path) {
        const currentStructure = architecture.directory_structure || { frontend: {}, backend: {}, shared: {} };
        const description = updates.description || architecture.modules[moduleIndex].description || `Módulo: ${architecture.modules[moduleIndex].name}`;
        architecture.directory_structure = this.addPathToDirectoryStructure(
          currentStructure, 
          updates.path, 
          description
        );
        architecture.markModified('directory_structure');
      }
      
      await architecture.save();

      return {
        success: true,
        data: architecture.modules[moduleIndex],
        message: 'Módulo actualizado exitosamente'
      };
    } catch (error) {
      console.error('ArchitectureService.updateModule error:', error);
      throw error;
    }
  }

  /**
   * Eliminar módulo
   */
  static async deleteModule(productId, moduleId, userId) {
    try {
      const architecture = await ProjectArchitecture.findOne({ product: productId });
      
      if (!architecture) {
        throw new Error('Arquitectura no encontrada');
      }

      const moduleIndex = architecture.modules.findIndex(
        m => m._id.toString() === moduleId
      );

      if (moduleIndex === -1) {
        throw new Error('Módulo no encontrado');
      }

      const deletedModule = architecture.modules.splice(moduleIndex, 1)[0];
      architecture.updated_by = userId;
      
      await architecture.save();

      return {
        success: true,
        message: `Módulo "${deletedModule.name}" eliminado exitosamente`
      };
    } catch (error) {
      console.error('ArchitectureService.deleteModule error:', error);
      throw error;
    }
  }

  /**
   * Vincular historia a módulo
   */
  static async linkStoryToModule(productId, moduleId, storyId, userId) {
    try {
      const architecture = await ProjectArchitecture.findOne({ product: productId });
      
      if (!architecture) {
        throw new Error('Arquitectura no encontrada');
      }

      const module = architecture.modules.id(moduleId);
      
      if (!module) {
        throw new Error('Módulo no encontrado');
      }

      // Evitar duplicados
      if (!module.related_stories.includes(storyId)) {
        module.related_stories.push(storyId);
        architecture.updated_by = userId;
        await architecture.save();
      }

      return {
        success: true,
        message: 'Historia vinculada al módulo exitosamente'
      };
    } catch (error) {
      console.error('ArchitectureService.linkStoryToModule error:', error);
      throw error;
    }
  }

  // ============================================
  // GESTIÓN DE API ENDPOINTS
  // ============================================

  /**
   * Agregar endpoint
   */
  static async addEndpoint(productId, userId, endpointData) {
    try {
      const architecture = await ProjectArchitecture.findOne({ product: productId });
      
      if (!architecture) {
        throw new Error('Arquitectura no encontrada');
      }

      architecture.api_endpoints.push(endpointData);
      architecture.updated_by = userId;
      
      await architecture.save();

      return {
        success: true,
        data: architecture.api_endpoints[architecture.api_endpoints.length - 1],
        message: 'Endpoint agregado exitosamente'
      };
    } catch (error) {
      console.error('ArchitectureService.addEndpoint error:', error);
      throw error;
    }
  }

  /**
   * Actualizar múltiples endpoints
   */
  static async updateEndpoints(productId, userId, endpoints) {
    try {
      const architecture = await ProjectArchitecture.findOne({ product: productId });
      
      if (!architecture) {
        throw new Error('Arquitectura no encontrada');
      }

      architecture.api_endpoints = endpoints;
      architecture.updated_by = userId;
      
      await architecture.save();

      return {
        success: true,
        data: architecture.api_endpoints,
        message: 'Endpoints actualizados exitosamente'
      };
    } catch (error) {
      console.error('ArchitectureService.updateEndpoints error:', error);
      throw error;
    }
  }

  // ============================================
  // GESTIÓN DE INTEGRACIONES
  // ============================================

  /**
   * Agregar integración
   */
  static async addIntegration(productId, userId, integrationData) {
    try {
      const architecture = await ProjectArchitecture.findOne({ product: productId });
      
      if (!architecture) {
        throw new Error('Arquitectura no encontrada');
      }

      architecture.integrations.push(integrationData);
      architecture.updated_by = userId;
      
      await architecture.save();

      const savedIntegration = architecture.integrations[architecture.integrations.length - 1];

      return {
        success: true,
        data: savedIntegration,
        message: `Integración "${integrationData.name}" agregada exitosamente`
      };
    } catch (error) {
      console.error('ArchitectureService.addIntegration error:', error);
      throw error;
    }
  }

  // ============================================
  // DECISIONES DE ARQUITECTURA (ADRs)
  // ============================================

  /**
   * Agregar decisión de arquitectura
   */
  static async addDecision(productId, userId, decisionData) {
    try {
      const architecture = await ProjectArchitecture.findOne({ product: productId });
      
      if (!architecture) {
        throw new Error('Arquitectura no encontrada');
      }

      architecture.architecture_decisions.push({
        ...decisionData,
        decided_by: userId,
        date: new Date()
      });
      architecture.updated_by = userId;
      
      await architecture.save();

      return {
        success: true,
        data: architecture.architecture_decisions[architecture.architecture_decisions.length - 1],
        message: 'Decisión de arquitectura registrada'
      };
    } catch (error) {
      console.error('ArchitectureService.addDecision error:', error);
      throw error;
    }
  }

  // ============================================
  // ROADMAP TÉCNICO
  // ============================================

  /**
   * Actualizar roadmap
   */
  static async updateRoadmap(productId, userId, roadmapPhases) {
    try {
      const architecture = await ProjectArchitecture.findOne({ product: productId });
      
      if (!architecture) {
        throw new Error('Arquitectura no encontrada');
      }

      architecture.technical_roadmap = roadmapPhases;
      architecture.updated_by = userId;
      
      await architecture.save();

      return {
        success: true,
        data: architecture.technical_roadmap,
        message: 'Roadmap técnico actualizado'
      };
    } catch (error) {
      console.error('ArchitectureService.updateRoadmap error:', error);
      throw error;
    }
  }

  /**
   * Actualizar fase del roadmap
   */
  static async updateRoadmapPhase(productId, phaseId, userId, updates) {
    try {
      const architecture = await ProjectArchitecture.findOne({ product: productId });
      
      if (!architecture) {
        throw new Error('Arquitectura no encontrada');
      }

      const phaseIndex = architecture.technical_roadmap.findIndex(
        p => p._id.toString() === phaseId
      );

      if (phaseIndex === -1) {
        throw new Error('Fase no encontrada');
      }

      Object.assign(architecture.technical_roadmap[phaseIndex], updates);
      architecture.updated_by = userId;
      
      await architecture.save();

      return {
        success: true,
        data: architecture.technical_roadmap[phaseIndex],
        message: 'Fase del roadmap actualizada'
      };
    } catch (error) {
      console.error('ArchitectureService.updateRoadmapPhase error:', error);
      throw error;
    }
  }

  // NOTA: La gestión de database_schema se ha movido al módulo independiente DatabaseSchemaService
  // Ver services/DatabaseSchemaService.js

  // ============================================
  // UTILIDADES Y ESTADÍSTICAS
  // ============================================

  /**
   * Calcular estadísticas de la arquitectura
   */
  static calculateStats(architecture) {
    const modules = architecture.modules || [];
    const endpoints = architecture.api_endpoints || [];
    const integrations = architecture.integrations || [];
    const roadmap = architecture.technical_roadmap || [];

    return {
      modules: {
        total: modules.length,
        by_status: {
          planned: modules.filter(m => m.status === 'planned').length,
          in_development: modules.filter(m => m.status === 'in_development').length,
          completed: modules.filter(m => m.status === 'completed').length,
          deprecated: modules.filter(m => m.status === 'deprecated').length
        },
        by_type: {
          frontend: modules.filter(m => m.type === 'frontend').length,
          backend: modules.filter(m => m.type === 'backend').length,
          shared: modules.filter(m => m.type === 'shared').length,
          infrastructure: modules.filter(m => m.type === 'infrastructure').length
        },
        total_estimated_hours: modules.reduce((sum, m) => sum + (m.estimated_hours || 0), 0)
      },
      endpoints: {
        total: endpoints.length,
        by_method: {
          GET: endpoints.filter(e => e.method === 'GET').length,
          POST: endpoints.filter(e => e.method === 'POST').length,
          PUT: endpoints.filter(e => e.method === 'PUT').length,
          PATCH: endpoints.filter(e => e.method === 'PATCH').length,
          DELETE: endpoints.filter(e => e.method === 'DELETE').length
        },
        implemented: endpoints.filter(e => e.status === 'implemented').length
      },
      integrations: {
        total: integrations.length,
        active: integrations.filter(i => i.status === 'active').length
      },
      roadmap: {
        total_phases: roadmap.length,
        current_phase: roadmap.find(p => p.status === 'in_progress')?.phase || null,
        completed_phases: roadmap.filter(p => p.status === 'completed').length
      },
      completeness: architecture.completeness_score || 0
    };
  }

  /**
   * Generar resumen para AI
   */
  static async generateAISummary(productId) {
    try {
      const result = await this.getByProduct(productId);
      
      if (!result.exists) {
        return {
          exists: false,
          needs_definition: true,
          message: 'Este producto no tiene arquitectura definida. Se recomienda definir la arquitectura antes de crear sprints o historias.'
        };
      }

      const arch = result.data;
      const stack = arch.tech_stack || {};

      return {
        exists: true,
        summary: {
          project_name: arch.project_name,
          project_type: arch.project_type,
          scale: arch.scale,
          status: arch.status,
          completeness: arch.completeness_score,
          
          tech_stack: {
            frontend: stack.frontend?.framework ? 
              `${stack.frontend.framework}${stack.frontend.language ? ' + ' + stack.frontend.language : ''}` : 
              null,
            backend: stack.backend?.framework ? 
              `${stack.backend.framework}${stack.backend.language ? ' + ' + stack.backend.language : ''}` : 
              null,
            database: stack.database?.primary || null,
            hosting: stack.infrastructure?.hosting_frontend || stack.infrastructure?.hosting_backend || null
          },
          
          modules: {
            list: arch.modules?.map(m => ({
              name: m.name,
              type: m.type,
              status: m.status,
              complexity: m.estimated_complexity
            })) || [],
            stats: result.data.stats?.modules
          },
          
          current_phase: arch.technical_roadmap?.find(p => p.status === 'in_progress') || null,
          
          integrations: arch.integrations?.map(i => ({
            name: i.name,
            type: i.type,
            status: i.status
          })) || [],
          
          decisions_count: arch.architecture_decisions?.length || 0,
          
          ai_suggestions: arch.ai_suggestions || []
        }
      };
    } catch (error) {
      console.error('ArchitectureService.generateAISummary error:', error);
      throw error;
    }
  }

  /**
   * Listar todas las arquitecturas
   */
  static async list(filters = {}) {
    try {
      const query = {};
      
      if (filters.status) query.status = filters.status;
      if (filters.project_type) query.project_type = filters.project_type;
      if (filters.created_by) query.created_by = filters.created_by;

      const architectures = await ProjectArchitecture.find(query)
        .populate('product', 'nombre descripcion estado')
        .populate('created_by', 'nombre_negocio email')
        .sort({ updatedAt: -1 })
        .lean();

      // Agregar stats a cada arquitectura
      return architectures.map(arch => ({
        ...arch,
        stats: this.calculateStats(arch)
      }));
    } catch (error) {
      console.error('ArchitectureService.list error:', error);
      throw error;
    }
  }

  /**
   * Verificar si un producto tiene arquitectura
   */
  static async hasArchitecture(productId) {
    try {
      const count = await ProjectArchitecture.countDocuments({ product: productId });
      return count > 0;
    } catch (error) {
      console.error('ArchitectureService.hasArchitecture error:', error);
      return false;
    }
  }

  /**
   * Obtener productos sin arquitectura
   */
  static async getProductsWithoutArchitecture() {
    try {
      // Obtener IDs de productos que ya tienen arquitectura
      const architectures = await ProjectArchitecture.find({}, 'product').lean();
      const productIdsWithArch = architectures.map(a => a.product);

      // Buscar productos sin arquitectura
      const products = await Product.find({
        _id: { $nin: productIdsWithArch },
        estado: 'activo'
      }).lean();

      return products;
    } catch (error) {
      console.error('ArchitectureService.getProductsWithoutArchitecture error:', error);
      throw error;
    }
  }
}

module.exports = ArchitectureService;
