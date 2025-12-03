/**
 * DatabaseSchemaService
 * Servicio para gestión de esquemas de base de datos
 * 
 * Proporciona operaciones CRUD y funcionalidades de importación
 * 
 * @module services/DatabaseSchemaService
 */

const DatabaseSchema = require('../models/DatabaseSchema');
const Product = require('../models/Product');
const { parseSchema, validateCode } = require('./SchemaParserService');

class DatabaseSchemaService {
  
  // ============================================
  // CRUD BÁSICO
  // ============================================

  /**
   * Obtiene o crea el esquema de base de datos para un producto
   * @param {string} productId - ID del producto
   * @param {string} userId - ID del usuario
   * @returns {Object} Schema de base de datos
   */
  static async getOrCreate(productId, userId) {
    try {
      // Verificar que el producto existe
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Producto no encontrado');
      }

      let schema = await DatabaseSchema.findOne({ product: productId })
        .populate('product', 'nombre descripcion')
        .populate('created_by', 'nombre_negocio email')
        .populate('updated_by', 'nombre_negocio email');

      if (!schema) {
        schema = new DatabaseSchema({
          product: productId,
          name: `Database Schema - ${product.nombre}`,
          created_by: userId,
          entities: []
        });
        await schema.save();
        
        // Recargar con populates
        schema = await DatabaseSchema.findById(schema._id)
          .populate('product', 'nombre descripcion')
          .populate('created_by', 'nombre_negocio email');
      }

      return {
        success: true,
        data: schema,
        isNew: schema.entities.length === 0
      };
    } catch (error) {
      console.error('DatabaseSchemaService.getOrCreate error:', error);
      throw error;
    }
  }

  /**
   * Obtiene el esquema de base de datos de un producto
   * @param {string} productId - ID del producto
   * @returns {Object} Schema de base de datos
   */
  static async getByProduct(productId) {
    try {
      const schema = await DatabaseSchema.findOne({ product: productId })
        .populate('product', 'nombre descripcion')
        .populate('created_by', 'nombre_negocio email')
        .populate('updated_by', 'nombre_negocio email')
        .lean();

      if (!schema) {
        return {
          exists: false,
          message: 'Este producto no tiene un esquema de base de datos definido'
        };
      }

      return {
        exists: true,
        data: schema
      };
    } catch (error) {
      console.error('DatabaseSchemaService.getByProduct error:', error);
      throw error;
    }
  }

  /**
   * Actualiza información general del esquema
   * @param {string} productId - ID del producto
   * @param {string} userId - ID del usuario
   * @param {Object} data - Datos a actualizar
   * @returns {Object} Schema actualizado
   */
  static async update(productId, userId, data) {
    try {
      const schema = await DatabaseSchema.findOne({ product: productId });
      
      if (!schema) {
        throw new Error('Esquema de base de datos no encontrado');
      }

      // Actualizar campos permitidos
      const allowedFields = ['name', 'description', 'database_type', 'orm_type', 'version', 'status', 'tags', 'notes'];
      
      allowedFields.forEach(field => {
        if (data[field] !== undefined) {
          schema[field] = data[field];
        }
      });

      schema.updated_by = userId;
      await schema.save();

      return {
        success: true,
        data: schema,
        message: 'Esquema actualizado exitosamente'
      };
    } catch (error) {
      console.error('DatabaseSchemaService.update error:', error);
      throw error;
    }
  }

  // ============================================
  // IMPORTACIÓN DE CÓDIGO
  // ============================================

  /**
   * Importa una entidad desde código fuente
   * @param {string} productId - ID del producto
   * @param {string} userId - ID del usuario
   * @param {string} code - Código fuente del modelo
   * @param {Object} options - Opciones de importación
   * @returns {Object} Resultado de la importación
   */
  static async importFromCode(productId, userId, code, options = {}) {
    try {
      console.log('📥 [IMPORT] Starting import from code...');
      
      // Validar código
      const validation = validateCode(code);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // Obtener o crear schema
      const { data: schema } = await this.getOrCreate(productId, userId);
      
      // Parsear código
      const ormType = options.orm_type || schema.orm_type || 'mongoose';
      const parsedEntity = parseSchema(code, ormType);
      
      if (!parsedEntity || !parsedEntity.entity) {
        return {
          success: false,
          error: 'No se pudo extraer la entidad del código proporcionado'
        };
      }

      // Verificar si la entidad ya existe
      const existingIndex = schema.entities.findIndex(e => 
        e.entity.toLowerCase() === parsedEntity.entity.toLowerCase()
      );

      let action = 'created';
      
      if (existingIndex >= 0) {
        if (options.overwrite === false) {
          return {
            success: false,
            error: `La entidad '${parsedEntity.entity}' ya existe. Usa overwrite: true para actualizarla.`,
            existing_entity: schema.entities[existingIndex].entity
          };
        }
        
        // Actualizar entidad existente
        schema.entities[existingIndex] = {
          ...schema.entities[existingIndex].toObject(),
          ...parsedEntity,
          last_synced_at: new Date()
        };
        action = 'updated';
      } else {
        // Agregar nueva entidad
        parsedEntity.imported_at = new Date();
        schema.entities.push(parsedEntity);
      }

      schema.updated_by = userId;
      await schema.save();

      console.log(`✅ [IMPORT] Entity ${parsedEntity.entity} ${action}`);

      return {
        success: true,
        action,
        entity: parsedEntity,
        message: `Entidad '${parsedEntity.entity}' ${action === 'created' ? 'importada' : 'actualizada'} exitosamente`,
        stats: schema.stats
      };
    } catch (error) {
      console.error('DatabaseSchemaService.importFromCode error:', error);
      throw error;
    }
  }

  /**
   * Importa múltiples entidades desde código fuente
   * @param {string} productId - ID del producto
   * @param {string} userId - ID del usuario
   * @param {Array} codeArray - Array de códigos fuente
   * @param {Object} options - Opciones de importación
   * @returns {Object} Resultado de la importación
   */
  static async importMultipleFromCode(productId, userId, codeArray, options = {}) {
    try {
      console.log(`📥 [IMPORT] Starting bulk import of ${codeArray.length} entities...`);
      
      const results = {
        success: true,
        total: codeArray.length,
        created: 0,
        updated: 0,
        failed: 0,
        entities: [],
        errors: []
      };

      for (let i = 0; i < codeArray.length; i++) {
        const code = codeArray[i];
        
        try {
          const result = await this.importFromCode(productId, userId, code, {
            ...options,
            overwrite: options.overwrite !== false
          });
          
          if (result.success) {
            if (result.action === 'created') results.created++;
            else results.updated++;
            
            results.entities.push({
              entity: result.entity.entity,
              action: result.action,
              fields: result.entity.fields?.length || 0
            });
          } else {
            results.failed++;
            results.errors.push({
              index: i,
              error: result.error
            });
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            index: i,
            error: error.message
          });
        }
      }

      results.success = results.failed === 0;
      results.message = `Importación completada: ${results.created} creadas, ${results.updated} actualizadas, ${results.failed} fallidas`;

      console.log(`✅ [IMPORT] Bulk import completed: ${results.message}`);

      return results;
    } catch (error) {
      console.error('DatabaseSchemaService.importMultipleFromCode error:', error);
      throw error;
    }
  }

  // ============================================
  // GESTIÓN DE ENTIDADES
  // ============================================

  /**
   * Lista todas las entidades de un producto
   * @param {string} productId - ID del producto
   * @returns {Object} Lista de entidades
   */
  static async listEntities(productId) {
    try {
      const schema = await DatabaseSchema.findOne({ product: productId })
        .select('entities stats')
        .lean();

      if (!schema) {
        return {
          exists: false,
          entities: [],
          stats: { total_entities: 0 }
        };
      }

      // Resumen de cada entidad
      const entitySummaries = (schema.entities || []).map(e => ({
        entity: e.entity,
        description: e.description,
        fields_count: (e.fields || []).length,
        relationships_count: (e.relationships || []).length,
        module: e.module,
        source_type: e.source_type,
        imported_at: e.imported_at,
        last_synced_at: e.last_synced_at
      }));

      return {
        exists: true,
        entities: entitySummaries,
        stats: schema.stats
      };
    } catch (error) {
      console.error('DatabaseSchemaService.listEntities error:', error);
      throw error;
    }
  }

  /**
   * Obtiene una entidad específica
   * @param {string} productId - ID del producto
   * @param {string} entityName - Nombre de la entidad
   * @returns {Object} Entidad completa
   */
  static async getEntity(productId, entityName) {
    try {
      const schema = await DatabaseSchema.findOne({ product: productId }).lean();

      if (!schema) {
        throw new Error('Esquema de base de datos no encontrado');
      }

      const entity = schema.entities.find(e => 
        e.entity.toLowerCase() === entityName.toLowerCase()
      );

      if (!entity) {
        throw new Error(`Entidad '${entityName}' no encontrada`);
      }

      return {
        success: true,
        data: entity
      };
    } catch (error) {
      console.error('DatabaseSchemaService.getEntity error:', error);
      throw error;
    }
  }

  /**
   * Actualiza una entidad existente
   * @param {string} productId - ID del producto
   * @param {string} userId - ID del usuario
   * @param {string} entityName - Nombre de la entidad
   * @param {Object} data - Datos a actualizar
   * @returns {Object} Entidad actualizada
   */
  static async updateEntity(productId, userId, entityName, data) {
    try {
      const schema = await DatabaseSchema.findOne({ product: productId });

      if (!schema) {
        throw new Error('Esquema de base de datos no encontrado');
      }

      const entityIndex = schema.entities.findIndex(e => 
        e.entity.toLowerCase() === entityName.toLowerCase()
      );

      if (entityIndex === -1) {
        throw new Error(`Entidad '${entityName}' no encontrada`);
      }

      // Actualizar campos permitidos de la entidad
      const allowedFields = ['description', 'collection_name', 'fields', 'indexes', 
        'relationships', 'timestamps', 'soft_delete', 'module', 'hooks', 'notes'];
      
      allowedFields.forEach(field => {
        if (data[field] !== undefined) {
          schema.entities[entityIndex][field] = data[field];
        }
      });

      schema.entities[entityIndex].last_synced_at = new Date();
      schema.updated_by = userId;
      
      await schema.save();

      return {
        success: true,
        data: schema.entities[entityIndex],
        message: `Entidad '${entityName}' actualizada exitosamente`
      };
    } catch (error) {
      console.error('DatabaseSchemaService.updateEntity error:', error);
      throw error;
    }
  }

  /**
   * Elimina una entidad
   * @param {string} productId - ID del producto
   * @param {string} userId - ID del usuario
   * @param {string} entityName - Nombre de la entidad
   * @returns {Object} Resultado de la eliminación
   */
  static async deleteEntity(productId, userId, entityName) {
    try {
      const schema = await DatabaseSchema.findOne({ product: productId });

      if (!schema) {
        throw new Error('Esquema de base de datos no encontrado');
      }

      const initialLength = schema.entities.length;
      schema.entities = schema.entities.filter(e => 
        e.entity.toLowerCase() !== entityName.toLowerCase()
      );

      if (schema.entities.length === initialLength) {
        throw new Error(`Entidad '${entityName}' no encontrada`);
      }

      schema.updated_by = userId;
      await schema.save();

      return {
        success: true,
        message: `Entidad '${entityName}' eliminada exitosamente`,
        stats: schema.stats
      };
    } catch (error) {
      console.error('DatabaseSchemaService.deleteEntity error:', error);
      throw error;
    }
  }

  // ============================================
  // VISUALIZACIÓN Y EXPORTACIÓN
  // ============================================

  /**
   * Obtiene el mapa de relaciones para visualización
   * @param {string} productId - ID del producto
   * @returns {Object} Mapa de nodos y relaciones
   */
  static async getRelationshipMap(productId) {
    try {
      const schema = await DatabaseSchema.findOne({ product: productId });

      if (!schema) {
        return {
          exists: false,
          nodes: [],
          edges: []
        };
      }

      const map = schema.getRelationshipMap();

      return {
        exists: true,
        ...map,
        stats: {
          total_nodes: map.nodes.length,
          total_edges: map.edges.length
        }
      };
    } catch (error) {
      console.error('DatabaseSchemaService.getRelationshipMap error:', error);
      throw error;
    }
  }

  /**
   * Exporta el esquema completo a JSON
   * @param {string} productId - ID del producto
   * @returns {Object} Esquema exportado
   */
  static async exportToJSON(productId) {
    try {
      const schema = await DatabaseSchema.findOne({ product: productId })
        .populate('product', 'nombre descripcion')
        .lean();

      if (!schema) {
        throw new Error('Esquema de base de datos no encontrado');
      }

      // Limpiar datos internos de MongoDB
      const exportData = {
        name: schema.name,
        description: schema.description,
        database_type: schema.database_type,
        orm_type: schema.orm_type,
        version: schema.version,
        product: {
          id: schema.product._id,
          name: schema.product.nombre
        },
        entities: schema.entities.map(e => ({
          entity: e.entity,
          description: e.description,
          collection_name: e.collection_name,
          fields: e.fields,
          indexes: e.indexes,
          relationships: e.relationships,
          timestamps: e.timestamps,
          soft_delete: e.soft_delete,
          module: e.module
        })),
        stats: schema.stats,
        exported_at: new Date().toISOString()
      };

      return {
        success: true,
        data: exportData
      };
    } catch (error) {
      console.error('DatabaseSchemaService.exportToJSON error:', error);
      throw error;
    }
  }

  /**
   * Genera el código Mongoose a partir de una entidad
   * @param {string} productId - ID del producto
   * @param {string} entityName - Nombre de la entidad
   * @returns {Object} Código generado
   */
  static async generateCode(productId, entityName) {
    try {
      const { data: entity } = await this.getEntity(productId, entityName);
      
      let code = `const mongoose = require('mongoose');\n\n`;
      code += `const ${entity.entity}Schema = new mongoose.Schema({\n`;
      
      // Generar campos
      entity.fields.forEach((field, index) => {
        code += `  ${field.name}: {\n`;
        code += `    type: ${field.type === 'ObjectId' ? 'mongoose.Schema.Types.ObjectId' : field.type}`;
        
        if (field.required) code += `,\n    required: true`;
        if (field.unique) code += `,\n    unique: true`;
        if (field.index) code += `,\n    index: true`;
        if (field.reference) code += `,\n    ref: '${field.reference}'`;
        if (field.default_value !== undefined) code += `,\n    default: ${JSON.stringify(field.default_value)}`;
        if (field.enum_values?.length) code += `,\n    enum: ${JSON.stringify(field.enum_values)}`;
        if (field.trim) code += `,\n    trim: true`;
        if (field.lowercase) code += `,\n    lowercase: true`;
        if (field.minlength) code += `,\n    minlength: ${field.minlength}`;
        if (field.maxlength) code += `,\n    maxlength: ${field.maxlength}`;
        if (field.min !== undefined) code += `,\n    min: ${field.min}`;
        if (field.max !== undefined) code += `,\n    max: ${field.max}`;
        
        code += `\n  }`;
        if (index < entity.fields.length - 1) code += ',';
        code += '\n';
      });
      
      code += `}`;
      
      // Opciones del schema
      if (entity.timestamps?.enabled) {
        code += `, {\n  timestamps: true\n}`;
      }
      
      code += `);\n\n`;
      
      // Generar índices
      entity.indexes?.forEach(idx => {
        const indexFields = idx.fields.map(f => `${f}: 1`).join(', ');
        code += `${entity.entity}Schema.index({ ${indexFields} }`;
        if (idx.unique) code += `, { unique: true }`;
        code += `);\n`;
      });
      
      code += `\nmodule.exports = mongoose.model('${entity.entity}', ${entity.entity}Schema);\n`;

      return {
        success: true,
        entity: entity.entity,
        code,
        language: 'javascript'
      };
    } catch (error) {
      console.error('DatabaseSchemaService.generateCode error:', error);
      throw error;
    }
  }

  // ============================================
  // SINCRONIZACIÓN
  // ============================================

  /**
   * Re-sincroniza una entidad desde su código fuente almacenado
   * @param {string} productId - ID del producto
   * @param {string} userId - ID del usuario
   * @param {string} entityName - Nombre de la entidad
   * @returns {Object} Entidad re-sincronizada
   */
  static async resyncEntity(productId, userId, entityName) {
    try {
      const { data: entity } = await this.getEntity(productId, entityName);
      
      if (!entity.source_code) {
        throw new Error('Esta entidad no tiene código fuente almacenado para re-sincronizar');
      }

      // Re-parsear el código fuente
      const result = await this.importFromCode(productId, userId, entity.source_code, {
        overwrite: true,
        orm_type: entity.source_type
      });

      return result;
    } catch (error) {
      console.error('DatabaseSchemaService.resyncEntity error:', error);
      throw error;
    }
  }
}

module.exports = DatabaseSchemaService;
