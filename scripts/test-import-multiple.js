/**
 * Script de prueba: Importar múltiples entidades y ver mapa de relaciones
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const DatabaseSchemaService = require('../services/DatabaseSchemaService');
  const Product = require('../models/Product');
  const User = require('../models/User');
  
  const product = await Product.findOne();
  const user = await User.findOne();
  
  console.log('📦 Producto:', product.nombre);
  console.log('');
  
  // Importar entidad Sprint
  const sprintCode = `
const mongoose = require('mongoose');

const SprintSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  objetivo: { type: String },
  fechaInicio: { type: Date, required: true },
  fechaFin: { type: Date, required: true },
  estado: {
    type: String,
    enum: ['planificado', 'activo', 'completado', 'cancelado'],
    default: 'planificado'
  },
  producto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  capacidad: { type: Number, default: 0 },
  velocidad: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Sprint', SprintSchema);
`;

  console.log('📥 Importando Sprint...');
  const result1 = await DatabaseSchemaService.importFromCode(product._id, user._id, sprintCode, { overwrite: true });
  console.log('   ✅ Sprint:', result1.success ? 'OK' : 'FAIL', `(${result1.entity?.fields?.length} campos)`);
  
  // Importar entidad BacklogItem
  const backlogCode = `
const mongoose = require('mongoose');

const BacklogItemSchema = new mongoose.Schema({
  titulo: { type: String, required: true },
  descripcion: { type: String },
  tipo: { type: String, enum: ['historia', 'tarea', 'bug'], default: 'historia' },
  prioridad: { type: String, enum: ['alta', 'media', 'baja'], default: 'media' },
  estado: { type: String, enum: ['pendiente', 'en_progreso', 'completado'], default: 'pendiente' },
  puntos_historia: { type: Number, min: 1, max: 100 },
  producto: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  sprint: { type: mongoose.Schema.Types.ObjectId, ref: 'Sprint' },
  asignado_a: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('BacklogItem', BacklogItemSchema);
`;

  console.log('📥 Importando BacklogItem...');
  const result2 = await DatabaseSchemaService.importFromCode(product._id, user._id, backlogCode, { overwrite: true });
  console.log('   ✅ BacklogItem:', result2.success ? 'OK' : 'FAIL', `(${result2.entity?.fields?.length} campos)`);
  
  // Importar entidad User simplificada
  const userCode = `
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  clerk_id: { type: String, required: true, unique: true },
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['admin', 'developer', 'scrum_master', 'product_owner'], default: 'developer' },
  is_active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
`;

  console.log('📥 Importando User...');
  const result3 = await DatabaseSchemaService.importFromCode(product._id, user._id, userCode, { overwrite: true });
  console.log('   ✅ User:', result3.success ? 'OK' : 'FAIL', `(${result3.entity?.fields?.length} campos)`);
  
  // Ver mapa de relaciones
  console.log('\n═══════════════════════════════════════');
  console.log('🗺️  MAPA DE RELACIONES (Para Visualización)');
  console.log('═══════════════════════════════════════');
  
  const map = await DatabaseSchemaService.getRelationshipMap(product._id);
  
  console.log('\n📦 NODOS (Entidades):');
  map.nodes.forEach(n => {
    console.log(`   • ${n.id.padEnd(15)} - ${n.fields} campos`);
  });
  
  console.log('\n🔗 EDGES (Relaciones):');
  map.edges.forEach(e => {
    const implicit = e.implicit ? ' (implícita)' : '';
    console.log(`   • ${e.source.padEnd(15)} ──[${e.label}]──> ${e.target} (${e.type})${implicit}`);
  });
  
  // Estadísticas
  const schema = await DatabaseSchemaService.getByProduct(product._id);
  console.log('\n═══════════════════════════════════════');
  console.log('📊 ESTADÍSTICAS DEL SCHEMA');
  console.log('═══════════════════════════════════════');
  console.log('   Total entidades:', schema.data.stats.total_entities);
  console.log('   Total campos:', schema.data.stats.total_fields);
  console.log('   Total relaciones:', schema.data.stats.total_relationships);
  console.log('   Total índices:', schema.data.stats.total_indexes);
  
  console.log('\n✅ Prueba completada!');
  
  await mongoose.disconnect();
}

test().catch(console.error);
