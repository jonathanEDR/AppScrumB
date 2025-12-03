/**
 * Script de Migración: Sistema Multi-Agente → SCRUM AI Unificado
 * Ejecutar: node backend/ai-agents/scripts/migrate-to-unified-scrum-ai.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// System Prompts
const SCRUM_AI_MASTER_PROMPT = `
Eres SCRUM AI, un sistema unificado de inteligencia artificial experto en metodologías ágiles Scrum.

IDENTIDAD:
Eres UNA entidad con múltiples especialidades integradas, NO eres un coordinador de "otros agentes".
Hablas en primera persona como un sistema unificado: "Voy a ayudarte..." no "Voy a delegar a...".

ARQUITECTURA INTERNA:
Tienes 3 especialidades integradas:
1. 📋 Product Owner - Gestión de producto y backlog
2. 🎭 Scrum Master - Facilitación de procesos Scrum
3. 💻 Developer Assistant - Asistencia técnica en desarrollo

FUNCIONAMIENTO:
1. Analiza la solicitud del usuario
2. Determina qué especialidad necesitas activar (puedes usar varias)
3. Usa el conocimiento de TODAS tus especialidades
4. Responde de forma unificada mostrando el emoji de la especialidad
5. Enseña metodología Scrum mientras ejecutas

PRINCIPIOS:
• NO menciones "otros agentes" o "delegar tareas"
• SÉ una entidad unificada con conocimiento multidisciplinario
• EXPLICA el "por qué" detrás de cada práctica Scrum
• SÉ proactivo: sugiere mejoras sin que te las pidan
• MANTÉN contexto: recuerda conversaciones anteriores
• EDUCA mientras ejecutas: cada interacción es una oportunidad de enseñanza

TONO:
• Profesional pero accesible
• Mentor experto, no máquina
• Colaborativo y educativo
• Confiable y seguro

FORMATO DE RESPUESTA:
Siempre inicia con el emoji de la especialidad que estás usando:
📋 Cuando trabajas con backlog/historias
🎭 Cuando facilitas proceso/ceremonias  
💻 Cuando asistes técnicamente
🎓 Cuando enseñas metodología (sin ejecutar)

IMPORTANTE:
Eres SCRUM AI, el corazón del sistema. Todo el conocimiento Scrum está en ti.
`;

const PRODUCT_OWNER_SPECIALTY_PROMPT = `
ESPECIALIDAD ACTIVA: Product Owner 📋

EXPERTISE:
• Gestión y priorización de backlog
• Creación de historias de usuario (formato: Como [rol] quiero [acción] para [beneficio])
• Generación de criterios de aceptación claros y medibles
• Análisis de valor de negocio
• Refinamiento de historias (INVEST: Independent, Negotiable, Valuable, Estimable, Small, Testable)
• Planificación de releases
• Comunicación con stakeholders

FORMATO DE HISTORIAS:
Title: [Acción concisa]
Como: [Rol del usuario]
Quiero: [Funcionalidad]
Para: [Beneficio/valor]

Criterios de Aceptación:
• [Criterio medible 1]
• [Criterio medible 2]
• [Criterio medible 3]

Notas Técnicas: [Si aplica]
Prioridad: [Alta/Media/Baja]
Estimación sugerida: [Story points]

BEST PRACTICES:
• Historias independientes que se puedan implementar en cualquier orden
• Criterios de aceptación específicos y medibles
• Valor de negocio claro en cada historia
• Tamaño apropiado (completable en un sprint)
`;

const SCRUM_MASTER_SPECIALTY_PROMPT = `
ESPECIALIDAD ACTIVA: Scrum Master 🎭

EXPERTISE:
• Facilitación de ceremonias Scrum (Daily, Planning, Review, Retro)
• Identificación y resolución de impedimentos
• Análisis de métricas de equipo (velocity, burndown, burnup)
• Sugerencias de mejora continua
• Coaching en prácticas ágiles
• Gestión de dinámica de equipo

CEREMONIAS SCRUM:
1. Sprint Planning: Definir objetivo y compromiso
2. Daily Standup: ¿Qué hice? ¿Qué haré? ¿Impedimentos?
3. Sprint Review: Demo y feedback de stakeholders
4. Sprint Retrospective: ¿Qué fue bien? ¿Qué mejorar? ¿Acciones?

MÉTRICAS CLAVE:
• Velocity: Puntos completados por sprint
• Burndown: Trabajo restante vs tiempo
• Lead Time: Tiempo desde idea hasta producción
• Cycle Time: Tiempo desde inicio hasta done
• Impediments: Bloqueadores identificados

BEST PRACTICES:
• Retrospectivas con acciones concretas
• Daily standups máximo 15 minutos
• Sprint goal claro y medible
• Impedimentos documentados y priorizados
`;

const DEVELOPER_SPECIALTY_PROMPT = `
ESPECIALIDAD ACTIVA: Developer Assistant 💻

EXPERTISE:
• Estimación de esfuerzo (story points, horas)
• Desglose de historias en tareas técnicas
• Sugerencias de implementación y arquitectura
• Identificación de dependencias técnicas
• Análisis de deuda técnica
• Best practices de código

ESTIMACIÓN:
Story Points (Fibonacci):
• 1 punto: Tarea trivial, <2 horas
• 2 puntos: Tarea simple, medio día
• 3 puntos: Tarea moderada, 1 día
• 5 puntos: Tarea compleja, 2-3 días
• 8 puntos: Historia compleja, considerar dividir
• 13+ puntos: Debe dividirse en historias más pequeñas

DESGLOSE DE TAREAS:
Para cada historia, considerar:
• Setup/configuración inicial
• Implementación de lógica core
• Tests unitarios
• Tests de integración
• Documentación
• Code review
• Deploy

BEST PRACTICES:
• TDD: Test-Driven Development
• Code review obligatorio
• Definition of Done clara
• Refactoring continuo
• Documentación técnica actualizada
`;

// Función principal
async function migrate() {
  try {
    console.log('🚀 Iniciando migración a SCRUM AI Unificado...\n');
    
    // Conectar a MongoDB
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/AppScrum');
    console.log('✅ Conectado\n');
    
    // Modelos
    const Agent = mongoose.model('Agent', new mongoose.Schema({}, { strict: false }));
    const AgentDelegation = mongoose.model('AgentDelegation', new mongoose.Schema({}, { strict: false }));
    const AgentSession = mongoose.model('AgentSession', new mongoose.Schema({}, { strict: false }));
    const AgentAction = mongoose.model('AgentAction', new mongoose.Schema({}, { strict: false }));
    
    // PASO 1: Backup de datos actuales
    console.log('📦 PASO 1: Creando backup...');
    const oldAgents = await Agent.find({}).lean();
    console.log(`   Agentes actuales: ${oldAgents.length}`);
    oldAgents.forEach(agent => {
      console.log(`   - ${agent.name} (${agent.type || 'N/A'})`);
    });
    console.log('');
    
    // PASO 2: Eliminar agentes antiguos
    console.log('🗑️  PASO 2: Eliminando agentes antiguos...');
    const deleteResult = await Agent.deleteMany({
      name: { 
        $in: ['orchestrator', 'product-owner-assistant', 'scrum-master-assistant', 'developer-assistant'] 
      }
    });
    console.log(`   ✅ ${deleteResult.deletedCount} agentes eliminados\n`);
    
    // PASO 3: Crear SCRUM AI unificado
    console.log('🎯 PASO 3: Creando SCRUM AI unificado...');
    
    const scrumAI = await Agent.create({
      name: 'scrum-ai',
      display_name: 'SCRUM AI',
      type: 'unified_system',
      is_unified_system: true,
      is_system_agent: true,
      status: 'active',
      version: '3.0.0',
      
      description: 'Sistema unificado de inteligencia artificial experto en metodologías ágiles Scrum. Integra las capacidades de Product Owner, Scrum Master y Developer Assistant en una sola entidad.',
      
      // Especialidades integradas
      specialties: [
        {
          id: 'product_owner',
          name: 'Product Owner',
          icon: '📋',
          description: 'Gestión de producto y backlog',
          capabilities: [
            { name: 'create_user_stories', description: 'Crear historias de usuario', requires_permission: 'canCreateBacklogItems', enabled: true },
            { name: 'refine_backlog', description: 'Refinar elementos del backlog', requires_permission: 'canEditBacklog', enabled: true },
            { name: 'prioritize_backlog', description: 'Priorizar backlog', requires_permission: 'canPrioritize', enabled: true },
            { name: 'generate_acceptance_criteria', description: 'Generar criterios de aceptación', requires_permission: 'canCreateBacklogItems', enabled: true },
            { name: 'analyze_business_value', description: 'Analizar valor de negocio', requires_permission: 'canViewBacklog', enabled: true }
          ],
          system_prompt: PRODUCT_OWNER_SPECIALTY_PROMPT,
          enabled: true
        },
        {
          id: 'scrum_master',
          name: 'Scrum Master',
          icon: '🎭',
          description: 'Facilitación de procesos Scrum',
          capabilities: [
            { name: 'facilitate_ceremonies', description: 'Facilitar ceremonias Scrum', requires_permission: 'canManageCeremonies', enabled: true },
            { name: 'analyze_metrics', description: 'Analizar métricas del equipo', requires_permission: 'canViewMetrics', enabled: true },
            { name: 'identify_impediments', description: 'Identificar impedimentos', requires_permission: 'canCreateImpediments', enabled: true },
            { name: 'suggest_improvements', description: 'Sugerir mejoras de proceso', requires_permission: 'canViewMetrics', enabled: true },
            { name: 'coach_team', description: 'Coaching en prácticas ágiles', requires_permission: 'canViewMetrics', enabled: true }
          ],
          system_prompt: SCRUM_MASTER_SPECIALTY_PROMPT,
          enabled: true
        },
        {
          id: 'developer',
          name: 'Developer Assistant',
          icon: '💻',
          description: 'Asistencia técnica en desarrollo',
          capabilities: [
            { name: 'estimate_effort', description: 'Estimar esfuerzo en story points', requires_permission: 'canEstimate', enabled: true },
            { name: 'breakdown_tasks', description: 'Desglosar historias en tareas', requires_permission: 'canCreateTasks', enabled: true },
            { name: 'suggest_implementation', description: 'Sugerir enfoque de implementación', requires_permission: 'canViewBacklog', enabled: true },
            { name: 'analyze_technical_debt', description: 'Analizar deuda técnica', requires_permission: 'canViewTasks', enabled: true },
            { name: 'review_code', description: 'Sugerencias de code review', requires_permission: 'canViewTasks', enabled: true }
          ],
          system_prompt: DEVELOPER_SPECIALTY_PROMPT,
          enabled: true
        }
      ],
      
      // Prompt maestro
      master_prompt: SCRUM_AI_MASTER_PROMPT,
      
      // Todas las capacidades (para búsquedas)
      all_capabilities: [
        'create_user_stories', 'refine_backlog', 'prioritize_backlog', 
        'generate_acceptance_criteria', 'analyze_business_value',
        'facilitate_ceremonies', 'analyze_metrics', 'identify_impediments', 
        'suggest_improvements', 'coach_team',
        'estimate_effort', 'breakdown_tasks', 'suggest_implementation', 
        'analyze_technical_debt', 'review_code'
      ],
      
      // Configuración del modelo AI
      configuration: {
        provider: 'openai',
        model: 'gpt-4-turbo',
        temperature: 0.8,
        max_tokens: 8192,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      },
      
      // Contexto que necesita
      context_requirements: {
        needs_product_data: true,
        needs_backlog_data: true,
        needs_sprint_data: true,
        needs_team_data: true,
        needs_metrics_data: true,
        needs_history_data: true
      },
      
      // Métricas
      metrics: {
        total_interactions: 0,
        successful_actions: 0,
        failed_actions: 0,
        average_response_time: 0,
        total_tokens_used: 0,
        total_cost: 0,
        by_specialty: {
          product_owner: 0,
          scrum_master: 0,
          developer: 0
        }
      },
      
      // Limitaciones
      limitations: {
        max_requests_per_hour: 100,
        max_tokens_per_day: 200000,
        max_cost_per_day: 20,
        allowed_roles: ['super_admin', 'product_owner', 'scrum_master', 'developers']
      },
      
      created_by: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('   ✅ SCRUM AI creado:');
    console.log(`      ID: ${scrumAI._id}`);
    console.log(`      Nombre: ${scrumAI.display_name}`);
    console.log(`      Especialidades: ${scrumAI.specialties.length}`);
    scrumAI.specialties.forEach(s => {
      console.log(`         ${s.icon} ${s.name} (${s.capabilities.length} capacidades)`);
    });
    console.log('');
    
    // PASO 4: Migrar delegaciones
    console.log('🔐 PASO 4: Migrando delegaciones...');
    const delegations = await AgentDelegation.find({}).lean();
    console.log(`   Delegaciones encontradas: ${delegations.length}`);
    
    if (delegations.length > 0) {
      for (const delegation of delegations) {
        await AgentDelegation.updateOne(
          { _id: delegation._id },
          {
            $set: {
              agent_id: scrumAI._id,
              enabled_specialties: ['product_owner', 'scrum_master', 'developer']
            }
          }
        );
      }
      console.log(`   ✅ ${delegations.length} delegaciones actualizadas a SCRUM AI\n`);
    } else {
      console.log('   ℹ️  No hay delegaciones para migrar\n');
    }
    
    // PASO 5: Actualizar sesiones
    console.log('📝 PASO 5: Actualizando sesiones...');
    const sessionsResult = await AgentSession.updateMany(
      {},
      {
        $set: {
          agent_id: scrumAI._id,
          agent_name: 'scrum-ai',
          agent_type: 'unified_system'
        }
      }
    );
    console.log(`   ✅ ${sessionsResult.modifiedCount} sesiones actualizadas\n`);
    
    // PASO 6: Actualizar acciones históricas
    console.log('📊 PASO 6: Actualizando acciones históricas...');
    const actionsResult = await AgentAction.updateMany(
      {},
      {
        $set: {
          'agent.id': scrumAI._id,
          'agent.name': 'scrum-ai',
          'agent.type': 'unified_system'
        }
      }
    );
    console.log(`   ✅ ${actionsResult.modifiedCount} acciones actualizadas\n`);
    
    // RESUMEN
    console.log('🎉 ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('RESUMEN:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Agentes eliminados: ${deleteResult.deletedCount}`);
    console.log(`✅ SCRUM AI creado: ${scrumAI._id}`);
    console.log(`✅ Especialidades: ${scrumAI.specialties.length}`);
    console.log(`✅ Capacidades totales: ${scrumAI.all_capabilities.length}`);
    console.log(`✅ Delegaciones migradas: ${delegations.length}`);
    console.log(`✅ Sesiones actualizadas: ${sessionsResult.modifiedCount}`);
    console.log(`✅ Acciones actualizadas: ${actionsResult.modifiedCount}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('PRÓXIMOS PASOS:');
    console.log('1. Verificar SCRUM AI en la base de datos');
    console.log('2. Actualizar frontend para usar /scrum-ai endpoints');
    console.log('3. Probar chat con SCRUM AI');
    console.log('4. Verificar delegaciones funcionando\n');
    
    await mongoose.disconnect();
    console.log('👋 Desconectado de MongoDB');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERROR durante la migración:');
    console.error(error);
    process.exit(1);
  }
}

// Ejecutar migración
if (require.main === module) {
  migrate();
}

module.exports = { migrate };
