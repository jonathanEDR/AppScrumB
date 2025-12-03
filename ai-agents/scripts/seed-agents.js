/**
 * Script para inicializar agentes AI por defecto en la base de datos
 * Ejecutar: node backend/ai-agents/scripts/seed-agents.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Modelo de Agent
const agentSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['product-owner', 'scrum-master', 'developer', 'orchestrator']
  },
  name: String,
  display_name: String,
  description: String,
  capabilities: [String],
  requiredPermissions: [String],
  configuration: mongoose.Schema.Types.Mixed,
  usageExamples: [String],
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  }
}, { timestamps: true });

const Agent = mongoose.model('Agent', agentSchema);

// Agentes por defecto
const defaultAgents = [
  {
    type: 'product-owner',
    name: 'product-owner-assistant',
    display_name: 'Asistente de Product Owner',
    description: 'Agente especializado en ayudar al Product Owner con la gestión del backlog, creación de historias de usuario, criterios de aceptación y priorización.',
    capabilities: [
      'Crear historias de usuario completas con formato correcto',
      'Generar criterios de aceptación claros y medibles',
      'Analizar y refinar backlog items existentes',
      'Sugerir priorizaciones basadas en valor de negocio',
      'Desglosar épicas en historias de usuario',
      'Validar completitud de historias de usuario'
    ],
    requiredPermissions: [
      'backlog.read',
      'backlog.write',
      'backlog.update',
      'products.read',
      'sprints.read'
    ],
    configuration: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2000,
      systemPrompt: 'Eres un Product Owner experto en metodologías ágiles...'
    },
    usageExamples: [
      'Ayúdame a crear una historia de usuario para un sistema de login',
      'Genera criterios de aceptación para esta épica de reportes',
      'Analiza mi backlog y sugiere priorizaciones',
      'Refina esta historia de usuario para que sea más clara'
    ],
    status: 'active'
  },
  {
    type: 'scrum-master',
    name: 'scrum-master-assistant',
    display_name: 'Asistente de Scrum Master',
    description: 'Agente especializado en facilitar ceremonias Scrum, gestionar impedimentos y mejorar la dinámica del equipo.',
    capabilities: [
      'Facilitar reuniones de retrospectiva',
      'Sugerir acciones para resolver impedimentos',
      'Analizar métricas del equipo (velocity, burndown)',
      'Preparar agendas para ceremonias Scrum',
      'Identificar problemas de proceso',
      'Generar informes de sprint'
    ],
    requiredPermissions: [
      'sprints.read',
      'sprints.write',
      'ceremonies.read',
      'ceremonies.write',
      'impediments.read',
      'impediments.write',
      'team.read',
      'metrics.read'
    ],
    configuration: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2000,
      systemPrompt: 'Eres un Scrum Master certificado con experiencia en equipos ágiles...'
    },
    usageExamples: [
      'Ayúdame a preparar la retrospectiva del sprint',
      'Analiza estos impedimentos y sugiere soluciones',
      'Genera un informe del sprint actual',
      '¿Cómo podemos mejorar nuestra velocidad?'
    ],
    status: 'active'
  },
  {
    type: 'developer',
    name: 'developer-assistant',
    display_name: 'Asistente de Desarrollo',
    description: 'Agente especializado en ayudar a desarrolladores con tareas técnicas, estimaciones y resolución de bugs.',
    capabilities: [
      'Analizar detalles técnicos de historias de usuario',
      'Sugerir estimaciones de story points',
      'Ayudar en la descomposición de tareas técnicas',
      'Analizar reportes de bugs y sugerir soluciones',
      'Generar criterios técnicos de aceptación',
      'Sugerir mejores prácticas de código'
    ],
    requiredPermissions: [
      'backlog.read',
      'tasks.read',
      'tasks.write',
      'tasks.update',
      'bugs.read',
      'bugs.write',
      'sprints.read'
    ],
    configuration: {
      model: 'gpt-4',
      temperature: 0.6,
      maxTokens: 2000,
      systemPrompt: 'Eres un desarrollador senior con experiencia en múltiples tecnologías...'
    },
    usageExamples: [
      'Ayúdame a estimar estos story points',
      'Descompón esta historia en tareas técnicas',
      'Analiza este bug y sugiere una solución',
      'Genera criterios técnicos para esta historia'
    ],
    status: 'active'
  },
  {
    type: 'orchestrator',
    name: 'orchestrator',
    display_name: 'Orquestador Principal',
    description: 'Agente maestro que coordina y delega tareas a otros agentes especializados según el contexto y necesidades.',
    capabilities: [
      'Analizar solicitudes y determinar el agente apropiado',
      'Coordinar múltiples agentes para tareas complejas',
      'Mantener contexto entre conversaciones',
      'Ejecutar tareas de forma síncrona o asíncrona',
      'Combinar resultados de múltiples agentes',
      'Aprender de interacciones anteriores'
    ],
    requiredPermissions: [
      'orchestrator.execute',
      'orchestrator.delegate',
      'orchestrator.read_context'
    ],
    configuration: {
      model: 'gpt-4',
      temperature: 0.8,
      maxTokens: 3000,
      systemPrompt: 'Eres el orquestador principal del sistema de agentes AI...'
    },
    usageExamples: [
      'Ayúdame a preparar el próximo sprint completo',
      'Analiza mi backlog y sugiere mejoras generales',
      'Coordina la creación de historias y estimaciones',
      'Dame un resumen completo del estado del proyecto'
    ],
    status: 'active'
  }
];

// Función principal
async function seedAgents() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/AppScrum');
    console.log('✅ Conectado a MongoDB');

    // Limpiar agentes existentes (opcional, comentar si no quieres borrar)
    console.log('🗑️  Limpiando agentes existentes...');
    await Agent.deleteMany({});

    // Insertar agentes por defecto
    console.log('📝 Insertando agentes por defecto...');
    const result = await Agent.insertMany(defaultAgents);
    
    console.log(`✅ ${result.length} agentes creados exitosamente:`);
    result.forEach(agent => {
      console.log(`   - ${agent.display_name} (${agent.type})`);
    });

    console.log('🎉 Proceso completado');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Ejecutar
seedAgents();
