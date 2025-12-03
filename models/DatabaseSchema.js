/**
 * DatabaseSchema Model
 * Modelo independiente para gestionar esquemas de base de datos por producto
 * 
 * Permite importar estructuras de datos desde código fuente (Mongoose, Prisma, etc.)
 * y visualizar/graficar las relaciones entre entidades
 * 
 * @module models/DatabaseSchema
 */

const mongoose = require('mongoose');

// ============================================
// SUB-SCHEMAS
// ============================================

/**
 * Schema para campos anidados (subdocumentos)
 */
const NestedFieldSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  required: { type: Boolean, default: false },
  default_value: { type: mongoose.Schema.Types.Mixed },
  enum_values: [{ type: mongoose.Schema.Types.Mixed }],
  description: { type: String },
  nested_fields: { type: mongoose.Schema.Types.Mixed } // Para anidación recursiva
}, { _id: false });

/**
 * Schema para campos de entidad
 * Soporta esquemas complejos estilo Mongoose con todas las validaciones
 */
const EntityFieldSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { 
    type: String, 
    required: true,
    enum: [
      // Tipos básicos
      'String', 'Number', 'Boolean', 'Date', 'ObjectId', 'Buffer',
      // Tipos compuestos
      'Array', 'Object', 'Subdocument', 'Mixed', 'Map',
      // Tipos especiales
      'Decimal128', 'UUID'
    ]
  },
  
  // Configuración básica
  required: { type: Boolean, default: false },
  unique: { type: Boolean, default: false },
  index: { type: Boolean, default: false },
  sparse: { type: Boolean, default: false },
  
  // Valor por defecto
  default_value: { type: mongoose.Schema.Types.Mixed },
  
  // Referencia a otra entidad (para ObjectId - Foreign Key)
  reference: { type: String },
  ref_field: { type: String },
  
  // Validaciones de String
  trim: { type: Boolean, default: false },
  lowercase: { type: Boolean, default: false },
  uppercase: { type: Boolean, default: false },
  minlength: { type: Number },
  maxlength: { type: Number },
  match: { type: String },
  
  // Validaciones de Number
  min: { type: Number },
  max: { type: Number },
  
  // Enum (valores permitidos)
  enum_values: [{ type: mongoose.Schema.Types.Mixed }],
  
  // Para Arrays
  array_type: { type: String },
  array_max: { type: Number },
  array_min: { type: Number },
  
  // Para subdocumentos/objetos anidados
  nested_fields: [NestedFieldSchema],
  
  // Documentación
  description: { type: String },
  example: { type: mongoose.Schema.Types.Mixed },
  
  // Metadatos
  is_primary_key: { type: Boolean, default: false },
  is_foreign_key: { type: Boolean, default: false },
  auto_generate: { type: Boolean, default: false },
  
  // Seguridad
  is_sensitive: { type: Boolean, default: false },
  exclude_from_response: { type: Boolean, default: false }
}, { _id: false });

/**
 * Schema para índices compuestos
 */
const IndexSchema = new mongoose.Schema({
  fields: [{ type: String }],
  unique: { type: Boolean, default: false },
  sparse: { type: Boolean, default: false },
  name: { type: String }
}, { _id: false });

/**
 * Schema para relaciones entre entidades
 */
const RelationshipSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['one-to-one', 'one-to-many', 'many-to-many'],
    required: true 
  },
  target_entity: { type: String, required: true },
  field: { type: String },
  foreign_field: { type: String },
  cascade_delete: { type: Boolean, default: false },
  description: { type: String }
}, { _id: false });

/**
 * Schema para hooks/middleware (solo documentación)
 */
const HookSchema = new mongoose.Schema({
  event: { 
    type: String, 
    enum: ['pre-save', 'post-save', 'pre-remove', 'post-remove', 'pre-find', 'pre-validate', 'post-validate']
  },
  description: { type: String }
}, { _id: false });

/**
 * Schema para una entidad de base de datos
 */
const DatabaseEntitySchema = new mongoose.Schema({
  entity: { type: String, required: true },
  description: { type: String },
  collection_name: { type: String },
  
  // Campos de la entidad
  fields: [EntityFieldSchema],
  
  // Índices compuestos
  indexes: [IndexSchema],
  
  // Relaciones con otras entidades
  relationships: [RelationshipSchema],
  
  // Timestamps automáticos
  timestamps: {
    enabled: { type: Boolean, default: true },
    created_at: { type: String, default: 'createdAt' },
    updated_at: { type: String, default: 'updatedAt' }
  },
  
  // Soft delete
  soft_delete: {
    enabled: { type: Boolean, default: false },
    field: { type: String, default: 'deleted_at' }
  },
  
  // Módulo al que pertenece
  module: { type: String },
  
  // Hooks (solo documentación)
  hooks: [HookSchema],
  
  // Código fuente original (para referencia)
  source_code: { type: String },
  source_type: { 
    type: String, 
    enum: ['mongoose', 'prisma', 'sequelize', 'typeorm', 'sql', 'manual'],
    default: 'mongoose'
  },
  
  // Metadatos de importación
  imported_at: { type: Date },
  last_synced_at: { type: Date },
  
  // Notas adicionales
  notes: { type: String }
}, { _id: true, timestamps: true });

// ============================================
// SCHEMA PRINCIPAL: DatabaseSchema
// ============================================

const DatabaseSchemaSchema = new mongoose.Schema({
  // Relación con producto
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  
  // Información general
  name: { type: String, default: 'Database Schema' },
  description: { type: String },
  
  // Tipo de base de datos
  database_type: {
    type: String,
    enum: ['mongodb', 'postgresql', 'mysql', 'sqlite', 'mssql', 'oracle', 'other'],
    default: 'mongodb'
  },
  
  // ORM/ODM utilizado
  orm_type: {
    type: String,
    enum: ['mongoose', 'prisma', 'sequelize', 'typeorm', 'drizzle', 'knex', 'raw', 'other'],
    default: 'mongoose'
  },
  
  // Entidades del esquema
  entities: [DatabaseEntitySchema],
  
  // Estadísticas calculadas
  stats: {
    total_entities: { type: Number, default: 0 },
    total_fields: { type: Number, default: 0 },
    total_relationships: { type: Number, default: 0 },
    total_indexes: { type: Number, default: 0 }
  },
  
  // Versión del esquema
  version: { type: String, default: '1.0.0' },
  
  // Estado
  status: {
    type: String,
    enum: ['draft', 'review', 'approved', 'active', 'archived'],
    default: 'draft'
  },
  
  // Metadatos de creación
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Tags para organización
  tags: [{ type: String }],
  
  // Notas generales
  notes: { type: String }
  
}, {
  timestamps: true
});

// ============================================
// ÍNDICES
// ============================================

// Nota: product ya tiene index: true en su definición
DatabaseSchemaSchema.index({ 'entities.entity': 'text', 'entities.description': 'text' });
DatabaseSchemaSchema.index({ status: 1 });
DatabaseSchemaSchema.index({ created_by: 1 });

// ============================================
// METHODS
// ============================================

/**
 * Recalcula las estadísticas del esquema
 */
DatabaseSchemaSchema.methods.recalculateStats = function() {
  const entities = this.entities || [];
  
  let totalFields = 0;
  let totalRelationships = 0;
  let totalIndexes = 0;
  
  entities.forEach(entity => {
    totalFields += (entity.fields || []).length;
    totalRelationships += (entity.relationships || []).length;
    totalIndexes += (entity.indexes || []).length;
  });
  
  this.stats = {
    total_entities: entities.length,
    total_fields: totalFields,
    total_relationships: totalRelationships,
    total_indexes: totalIndexes
  };
  
  return this.stats;
};

/**
 * Encuentra una entidad por nombre
 */
DatabaseSchemaSchema.methods.findEntity = function(entityName) {
  return this.entities.find(e => 
    e.entity.toLowerCase() === entityName.toLowerCase()
  );
};

/**
 * Agrega o actualiza una entidad
 */
DatabaseSchemaSchema.methods.upsertEntity = function(entityData) {
  const existingIndex = this.entities.findIndex(e => 
    e.entity.toLowerCase() === entityData.entity.toLowerCase()
  );
  
  if (existingIndex >= 0) {
    // Actualizar entidad existente
    this.entities[existingIndex] = {
      ...this.entities[existingIndex].toObject(),
      ...entityData,
      last_synced_at: new Date()
    };
  } else {
    // Agregar nueva entidad
    this.entities.push({
      ...entityData,
      imported_at: new Date()
    });
  }
  
  this.recalculateStats();
  return this.entities[existingIndex >= 0 ? existingIndex : this.entities.length - 1];
};

/**
 * Elimina una entidad por nombre
 */
DatabaseSchemaSchema.methods.removeEntity = function(entityName) {
  const initialLength = this.entities.length;
  this.entities = this.entities.filter(e => 
    e.entity.toLowerCase() !== entityName.toLowerCase()
  );
  
  if (this.entities.length < initialLength) {
    this.recalculateStats();
    return true;
  }
  return false;
};

/**
 * Obtiene el mapa de relaciones para visualización
 */
DatabaseSchemaSchema.methods.getRelationshipMap = function() {
  const map = {
    nodes: [],
    edges: []
  };
  
  // Crear nodos
  this.entities.forEach(entity => {
    map.nodes.push({
      id: entity.entity,
      label: entity.entity,
      fields: (entity.fields || []).length,
      description: entity.description || ''
    });
  });
  
  // Crear edges (relaciones)
  this.entities.forEach(entity => {
    // Relaciones explícitas
    (entity.relationships || []).forEach(rel => {
      map.edges.push({
        source: entity.entity,
        target: rel.target_entity,
        type: rel.type,
        label: rel.field || ''
      });
    });
    
    // Relaciones implícitas (por referencias en campos)
    (entity.fields || []).forEach(field => {
      if (field.reference && field.is_foreign_key) {
        // Verificar si ya existe esta relación
        const exists = map.edges.some(e => 
          e.source === entity.entity && 
          e.target === field.reference &&
          e.label === field.name
        );
        
        if (!exists) {
          map.edges.push({
            source: entity.entity,
            target: field.reference,
            type: 'one-to-many',
            label: field.name,
            implicit: true
          });
        }
      }
    });
  });
  
  return map;
};

// ============================================
// STATICS
// ============================================

/**
 * Obtiene o crea el esquema de base de datos para un producto
 */
DatabaseSchemaSchema.statics.getOrCreate = async function(productId, userId) {
  let schema = await this.findOne({ product: productId });
  
  if (!schema) {
    schema = new this({
      product: productId,
      created_by: userId,
      entities: []
    });
    await schema.save();
  }
  
  return schema;
};

// ============================================
// HOOKS
// ============================================

// Recalcular stats antes de guardar
DatabaseSchemaSchema.pre('save', function(next) {
  this.recalculateStats();
  next();
});

// ============================================
// EXPORT
// ============================================

module.exports = mongoose.model('DatabaseSchema', DatabaseSchemaSchema);
