/**
 * Script de prueba para el SchemaParserService
 */

const { parseSchema, validateCode } = require('../services/SchemaParserService');

const testCode = `
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  clerk_id: { 
    type: String, 
    required: true,
    unique: true,
    index: true
  },
  nombre_negocio: { 
    type: String, 
    required: false,
    trim: true
  },
  email: { 
    type: String, 
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  role: {
    type: String,
    enum: ['super_admin', 'product_owner', 'scrum_master', 'developers', 'user'],
    default: 'user'
  },
  fecha_creacion: { type: Date, default: Date.now },
  is_active: { type: Boolean, default: true },
  producto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  profile: {
    photo: { type: String, default: null },
    phone: { type: String, trim: true }
  }
}, {
  timestamps: true
});

userSchema.index({ email: 1 });
userSchema.index({ role: 1, is_active: 1 });

module.exports = mongoose.model('User', userSchema);
`;

console.log('🔍 Probando SchemaParserService...\n');

// Validar
const validation = validateCode(testCode);
console.log('✅ Validación:', validation);

// Parsear
const result = parseSchema(testCode);

console.log('\n═══════════════════════════════════════');
console.log('📊 RESULTADO DEL PARSING');
console.log('═══════════════════════════════════════');
console.log('📌 Entidad:', result.entity);
console.log('📌 Collection:', result.collection_name || '(auto-generado)');
console.log('📌 Source Type:', result.source_type);
console.log('📌 Timestamps:', JSON.stringify(result.timestamps));

console.log('\n📋 CAMPOS ENCONTRADOS:', result.fields.length);
console.log('───────────────────────────────────────');
result.fields.forEach(f => {
  let info = `  • ${f.name}: ${f.type}`;
  if (f.required) info += ' [required]';
  if (f.unique) info += ' [unique]';
  if (f.index) info += ' [indexed]';
  if (f.reference) info += ` → ${f.reference}`;
  if (f.trim) info += ' [trim]';
  if (f.lowercase) info += ' [lowercase]';
  console.log(info);
  
  if (f.enum_values && f.enum_values.length > 0) {
    console.log(`      enum: [${f.enum_values.join(', ')}]`);
  }
  if (f.default_value !== undefined) {
    console.log(`      default: ${f.default_value}`);
  }
  if (f.nested_fields && f.nested_fields.length > 0) {
    console.log('      nested fields:');
    f.nested_fields.forEach(nf => {
      console.log(`        - ${nf.name}: ${nf.type}`);
    });
  }
});

console.log('\n🔗 RELACIONES:', result.relationships.length);
console.log('───────────────────────────────────────');
result.relationships.forEach(r => {
  console.log(`  • ${r.field} → ${r.target_entity} (${r.type})`);
});

console.log('\n📑 ÍNDICES:', result.indexes.length);
console.log('───────────────────────────────────────');
result.indexes.forEach(idx => {
  console.log(`  • [${idx.fields.join(', ')}]${idx.unique ? ' UNIQUE' : ''}`);
});

console.log('\n✅ Parsing completado exitosamente!');
