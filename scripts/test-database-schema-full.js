/**
 * Script de prueba completa del módulo DatabaseSchema
 * Prueba el flujo: Parsear código → Guardar en BD → Recuperar
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function runTest() {
  console.log('🚀 Iniciando prueba completa del módulo DatabaseSchema...\n');
  
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');
    
    // Importar servicios
    const DatabaseSchemaService = require('../services/DatabaseSchemaService');
    const Product = require('../models/Product');
    const User = require('../models/User');
    
    // Obtener un producto y usuario para prueba
    const product = await Product.findOne();
    const user = await User.findOne();
    
    if (!product || !user) {
      throw new Error('Se necesita al menos un producto y un usuario en la BD');
    }
    
    console.log(`📦 Producto de prueba: ${product.nombre} (${product._id})`);
    console.log(`👤 Usuario de prueba: ${user.email}\n`);
    
    // ============================================
    // TEST 1: Obtener o crear schema
    // ============================================
    console.log('═══════════════════════════════════════');
    console.log('📝 TEST 1: Obtener o crear schema');
    console.log('═══════════════════════════════════════');
    
    const schemaResult = await DatabaseSchemaService.getOrCreate(product._id, user._id);
    console.log(`  ✅ Schema ${schemaResult.isNew ? 'creado' : 'obtenido'}`);
    console.log(`  📊 Entidades existentes: ${schemaResult.data.entities?.length || 0}`);
    
    // ============================================
    // TEST 2: Importar entidad desde código
    // ============================================
    console.log('\n═══════════════════════════════════════');
    console.log('📝 TEST 2: Importar entidad desde código');
    console.log('═══════════════════════════════════════');
    
    const testCode = `
const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  descripcion: {
    type: String,
    trim: true
  },
  estado: {
    type: String,
    enum: ['pendiente', 'en_progreso', 'completada', 'bloqueada'],
    default: 'pendiente'
  },
  prioridad: {
    type: String,
    enum: ['baja', 'media', 'alta', 'urgente'],
    default: 'media'
  },
  asignado_a: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  sprint: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sprint',
    required: true
  },
  horas_estimadas: {
    type: Number,
    min: 0,
    max: 100
  },
  horas_reales: {
    type: Number,
    min: 0,
    default: 0
  },
  etiquetas: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

TaskSchema.index({ sprint: 1, estado: 1 });
TaskSchema.index({ asignado_a: 1 });

module.exports = mongoose.model('Task', TaskSchema);
`;
    
    const importResult = await DatabaseSchemaService.importFromCode(
      product._id,
      user._id,
      testCode,
      { overwrite: true }
    );
    
    console.log(`  ✅ Importación: ${importResult.success ? 'exitosa' : 'fallida'}`);
    console.log(`  📌 Acción: ${importResult.action}`);
    console.log(`  📦 Entidad: ${importResult.entity?.entity}`);
    console.log(`  📋 Campos: ${importResult.entity?.fields?.length}`);
    console.log(`  🔗 Relaciones: ${importResult.entity?.relationships?.length}`);
    
    // ============================================
    // TEST 3: Listar entidades
    // ============================================
    console.log('\n═══════════════════════════════════════');
    console.log('📝 TEST 3: Listar entidades');
    console.log('═══════════════════════════════════════');
    
    const listResult = await DatabaseSchemaService.listEntities(product._id);
    console.log(`  ✅ Entidades encontradas: ${listResult.entities?.length}`);
    listResult.entities?.forEach(e => {
      console.log(`    • ${e.entity} (${e.fields_count} campos, ${e.relationships_count} relaciones)`);
    });
    
    // ============================================
    // TEST 4: Obtener entidad específica
    // ============================================
    console.log('\n═══════════════════════════════════════');
    console.log('📝 TEST 4: Obtener entidad específica');
    console.log('═══════════════════════════════════════');
    
    const entityResult = await DatabaseSchemaService.getEntity(product._id, 'Task');
    console.log(`  ✅ Entidad obtenida: ${entityResult.data?.entity}`);
    console.log(`  📋 Campos:`);
    entityResult.data?.fields?.forEach(f => {
      let info = `    • ${f.name}: ${f.type}`;
      if (f.required) info += ' [required]';
      if (f.reference) info += ` → ${f.reference}`;
      console.log(info);
    });
    
    // ============================================
    // TEST 5: Mapa de relaciones
    // ============================================
    console.log('\n═══════════════════════════════════════');
    console.log('📝 TEST 5: Mapa de relaciones');
    console.log('═══════════════════════════════════════');
    
    const mapResult = await DatabaseSchemaService.getRelationshipMap(product._id);
    console.log(`  ✅ Nodos: ${mapResult.nodes?.length}`);
    console.log(`  🔗 Edges: ${mapResult.edges?.length}`);
    mapResult.edges?.forEach(e => {
      console.log(`    • ${e.source} → ${e.target} (${e.type})`);
    });
    
    // ============================================
    // TEST 6: Generar código
    // ============================================
    console.log('\n═══════════════════════════════════════');
    console.log('📝 TEST 6: Generar código desde entidad');
    console.log('═══════════════════════════════════════');
    
    const codeResult = await DatabaseSchemaService.generateCode(product._id, 'Task');
    console.log(`  ✅ Código generado para: ${codeResult.entity}`);
    console.log(`  📄 Preview (primeras 5 líneas):`);
    const lines = codeResult.code.split('\n').slice(0, 5);
    lines.forEach(l => console.log(`    ${l}`));
    console.log('    ...');
    
    // ============================================
    // RESUMEN
    // ============================================
    console.log('\n═══════════════════════════════════════');
    console.log('🎉 TODAS LAS PRUEBAS PASARON');
    console.log('═══════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ Error durante las pruebas:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('📴 Desconectado de MongoDB');
  }
}

runTest();
