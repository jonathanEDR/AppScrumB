/**
 * Database Transformer
 * Transforma el schema de base de datos de la IA al formato del modelo
 * 
 * Soporta esquemas complejos estilo Mongoose:
 * - Campos con validaciones (required, unique, index, enum, min/max)
 * - Subdocumentos (nested_fields)
 * - Arrays tipados con límites (array_type, array_max)
 * - Timestamps y soft delete
 * - Índices compuestos
 * - Relaciones y hooks
 * 
 * @module ai-agents/transformers/databaseTransformer
 */

/**
 * Transforma un campo individual de la entidad
 * @param {Object|string} f - Campo a transformar
 * @returns {Object} Campo transformado
 */
function transformField(f) {
  // Si es un string simple, crear objeto básico
  if (typeof f === 'string') {
    return { name: f, type: 'String', required: false };
  }
  
  const field = {
    name: f.name || f.field_name || 'unknown',
    type: f.type || 'String',
    required: f.required || false,
    unique: f.unique || false,
    index: f.index || false,
    sparse: f.sparse || false,
    description: f.description || ''
  };
  
  // Valor por defecto
  if (f.default_value !== undefined || f.default !== undefined) {
    field.default_value = f.default_value !== undefined ? f.default_value : f.default;
  }
  
  // Referencia (FK)
  if (f.reference || f.ref) {
    field.reference = f.reference || f.ref;
    field.is_foreign_key = true;
  }
  if (f.ref_field) field.ref_field = f.ref_field;
  
  // Validaciones de String
  if (f.trim) field.trim = true;
  if (f.lowercase) field.lowercase = true;
  if (f.uppercase) field.uppercase = true;
  if (f.minlength !== undefined) field.minlength = f.minlength;
  if (f.maxlength !== undefined) field.maxlength = f.maxlength;
  if (f.match) field.match = f.match;
  
  // Validaciones de Number
  if (f.min !== undefined) field.min = f.min;
  if (f.max !== undefined) field.max = f.max;
  
  // Enum
  if (f.enum_values || f.enum) {
    field.enum_values = f.enum_values || f.enum;
  }
  
  // Arrays
  if (f.array_type) field.array_type = f.array_type;
  if (f.array_max !== undefined) field.array_max = f.array_max;
  if (f.array_min !== undefined) field.array_min = f.array_min;
  
  // Campos anidados (subdocumentos)
  if (f.nested_fields && Array.isArray(f.nested_fields)) {
    field.nested_fields = f.nested_fields.map(nf => ({
      name: nf.name || 'unknown',
      type: nf.type || 'String',
      required: nf.required || false,
      default_value: nf.default_value,
      enum_values: nf.enum_values || nf.enum,
      description: nf.description || ''
    }));
  }
  
  // Ejemplo
  if (f.example !== undefined) field.example = f.example;
  
  // Metadatos
  if (f.is_primary_key) field.is_primary_key = true;
  if (f.auto_generate) field.auto_generate = true;
  if (f.is_sensitive) field.is_sensitive = true;
  if (f.exclude_from_response) field.exclude_from_response = true;
  
  return field;
}

/**
 * Transforma una entidad de base de datos
 * @param {Object} entity - Entidad a transformar
 * @returns {Object} Entidad transformada
 */
function transformEntity(entity) {
  // Construir entidad base
  const transformedEntity = {
    entity: entity.table_name || entity.entity || entity.name || 'Unknown',
    description: entity.description || '',
    collection_name: entity.collection_name || entity.table_name || '',
    fields: (entity.fields || []).map(transformField),
    module: entity.module || ''
  };
  
  // Timestamps
  if (entity.timestamps) {
    transformedEntity.timestamps = {
      enabled: entity.timestamps.enabled !== false,
      created_at: entity.timestamps.created_at || 'createdAt',
      updated_at: entity.timestamps.updated_at || 'updatedAt'
    };
  }
  
  // Soft delete
  if (entity.soft_delete) {
    transformedEntity.soft_delete = {
      enabled: entity.soft_delete.enabled || false,
      field: entity.soft_delete.field || 'deleted_at'
    };
  }
  
  // Índices compuestos
  if (entity.indexes && Array.isArray(entity.indexes)) {
    transformedEntity.indexes = entity.indexes.map(idx => {
      if (typeof idx === 'string') {
        return { fields: [idx], unique: false };
      }
      return {
        fields: idx.fields || [idx.field],
        unique: idx.unique || false,
        sparse: idx.sparse || false,
        name: idx.name || ''
      };
    });
  }
  
  // Relaciones
  if (entity.relationships && Array.isArray(entity.relationships)) {
    transformedEntity.relationships = entity.relationships.map(r => {
      if (typeof r === 'string') {
        return { type: 'one-to-many', target_entity: r, field: r };
      }
      return {
        type: r.type || 'one-to-many',
        target_entity: r.target || r.target_entity || '',
        field: r.field || '',
        foreign_field: r.foreign_field || '',
        cascade_delete: r.cascade_delete || false,
        description: r.description || ''
      };
    });
  }
  
  // Hooks
  if (entity.hooks && Array.isArray(entity.hooks)) {
    transformedEntity.hooks = entity.hooks.map(h => ({
      event: h.event || 'pre-save',
      description: h.description || ''
    }));
  }
  
  // Notas
  if (entity.notes) transformedEntity.notes = entity.notes;
  
  return transformedEntity;
}

/**
 * Transforma el schema completo de base de datos
 * @param {Array} schema - Array de entidades de la IA
 * @returns {Array} Array de entidades transformadas
 */
function transformDatabaseSchema(schema) {
  if (!schema || !Array.isArray(schema)) return [];
  
  return schema.map(transformEntity);
}

module.exports = {
  transformDatabaseSchema,
  transformEntity,
  transformField
};
