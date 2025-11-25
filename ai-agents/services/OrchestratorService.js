/**
 * OrchestratorService - Servicio principal del orquestador
 * Coordina el flujo completo: analizar intención → seleccionar agente → construir contexto → ejecutar
 */

const IntentClassifier = require('./IntentClassifier');
const ContextBuilder = require('./ContextBuilder');
const AgentSelector = require('./AgentSelector');
const AgentAction = require('../models/AgentAction');
const AgentSession = require('../models/AgentSession');

class OrchestratorService {
  /**
   * Ejecuta una tarea completa desde el input del usuario hasta la respuesta
   * @param {string} userId - ID del usuario
   * @param {string} userInput - Input del usuario
   * @param {object} context - Contexto adicional (product_id, sprint_id, etc.)
   * @param {object} user - Objeto usuario completo
   * @returns {object} Resultado de la ejecución
   */
  static async execute(userId, userInput, context = {}, user = null) {
    const startTime = Date.now();

    try {
      console.log('\n=== ORCHESTRATOR: Starting execution ===');
      console.log('User ID:', userId);
      console.log('Input:', userInput);
      console.log('Context:', context);

      // PASO 1: Analizar intención
      console.log('\n📋 PASO 1: Analizando intención...');
      const classification = await IntentClassifier.classify(userInput, context);
      
      console.log('Intent:', classification.intent);
      console.log('Confidence:', classification.confidence);
      console.log('Entities:', classification.entities);

      // Si la confianza es baja, pedir clarificación
      if (classification.confidence < 0.6) {
        console.log('⚠️  Confianza baja, requiere clarificación');
        return {
          status: 'needs_clarification',
          message: '¿Podrías ser más específico sobre lo que necesitas?',
          suggestions: classification.suggestions || IntentClassifier.getSuggestions(userInput),
          classification,
          execution_time_ms: Date.now() - startTime
        };
      }

      // PASO 2: Seleccionar agente
      console.log('\n🤖 PASO 2: Seleccionando agente...');
      const agentData = await AgentSelector.select(
        classification.intent, 
        userId,
        { context }
      );

      if (!agentData) {
        console.log('❌ No hay agente disponible');
        
        // Sugerir agente y cómo delegarlo
        const suggestion = await AgentSelector.suggestAgent(classification.intent, userId);
        
        return {
          status: 'no_agent_available',
          message: 'No tienes un agente disponible para esta tarea.',
          suggestion,
          required_permissions: IntentClassifier.getRequiredPermissions(classification.intent),
          how_to_delegate: {
            step_1: 'Identifica el agente que necesitas',
            step_2: `Delega permisos usando: POST /api/ai-agents/delegate`,
            step_3: 'Intenta nuevamente tu solicitud'
          },
          execution_time_ms: Date.now() - startTime
        };
      }

      console.log('✅ Agent selected:', agentData.agent.display_name);

      // PASO 3: Construir contexto
      console.log('\n📦 PASO 3: Construyendo contexto...');
      const fullContext = await ContextBuilder.build(
        classification.intent,
        classification.entities,
        user || { _id: userId }
      );

      console.log('Context built:', {
        has_product: !!fullContext.primary_product,
        has_backlog: !!fullContext.backlog,
        has_sprints: !!fullContext.sprints,
        has_standards: !!fullContext.standards
      });

      const contextSummary = ContextBuilder.buildContextSummary(fullContext);
      console.log('Context summary:', contextSummary);

      // PASO 4: Ejecutar agente
      console.log('\n⚡ PASO 4: Ejecutando agente...');
      const result = await this.executeAgent(
        agentData.agent,
        agentData.delegation,
        userId,
        classification.intent,
        userInput,
        fullContext,
        classification.entities
      );

      console.log('Execution result:', result.status);

      const executionTime = Date.now() - startTime;

      return {
        status: 'success',
        intent: classification.intent,
        confidence: classification.confidence,
        agent: {
          id: agentData.agent._id,
          name: agentData.agent.display_name,
          type: agentData.agent.type
        },
        result: result.data,
        context_summary: contextSummary,
        metadata: {
          tokens_used: result.tokens_used || 0,
          cost: result.cost || 0,
          execution_time_ms: executionTime
        }
      };

    } catch (error) {
      console.error('OrchestratorService.execute error:', error);
      return {
        status: 'error',
        message: 'Ocurrió un error al procesar tu solicitud',
        error: error.message,
        execution_time_ms: Date.now() - startTime
      };
    }
  }

  /**
   * Ejecuta el agente específico
   * @param {object} agent - Agente a ejecutar
   * @param {object} delegation - Delegación activa
   * @param {string} userId - ID del usuario
   * @param {string} intent - Intención clasificada
   * @param {string} userInput - Input original del usuario
   * @param {object} context - Contexto construido
   * @param {object} entities - Entidades extraídas
   * @returns {object} Resultado de la ejecución
   */
  static async executeAgent(agent, delegation, userId, intent, userInput, context, entities) {
    try {
      // Mapear intent a action_type y category válidos
      const actionMapping = {
        'create_user_story': { action_type: 'create_backlog_item', category: 'creation' },
        'refine_user_story': { action_type: 'refine_user_story', category: 'modification' },
        'generate_acceptance_criteria': { action_type: 'generate_acceptance_criteria', category: 'creation' },
        'prioritize_backlog': { action_type: 'prioritize_backlog', category: 'modification' },
        'analyze_backlog': { action_type: 'analyze_backlog', category: 'analysis' },
        'analyze_business_value': { action_type: 'analyze_business_value', category: 'analysis' },
        'suggest_sprint_goal': { action_type: 'generate_sprint_goal', category: 'consultation' },
        'generate_stakeholder_report': { action_type: 'generate_report', category: 'analysis' },
        'plan_sprint': { action_type: 'plan_sprint', category: 'creation' }
      };

      const mappedAction = actionMapping[intent] || { action_type: 'consultation', category: 'consultation' };

      // Crear registro de acción
      const action = await AgentAction.create({
        agent_id: agent._id,
        user_id: userId,
        delegation_id: delegation._id,
        action_type: mappedAction.action_type,
        category: mappedAction.category,
        input: {
          user_prompt: userInput,
          context: {
            product_id: context.primary_product?._id,
            sprint_id: context.active_sprint?._id,
            entities: entities
          },
          full_context_summary: ContextBuilder.buildContextSummary(context)
        },
        status: 'pending'
      });

      console.log('AgentAction created:', action._id);

      try {
        // FASE 3: Ejecutar agente real
        const response = await this.executeRealAgent(
          agent,
          intent,
          context,
          entities,
          userId
        );

        // Actualizar acción con resultado exitoso
        action.ai_response = {
          raw_response: JSON.stringify(response),
          parsed_response: response,
          reasoning: response.ai_analysis || 'Ejecución completada'
        };
        action.result = {
          status: 'success',
          message: response.message,
          data: response
        };
        action.status = 'completed';
        action.completed_at = new Date();
        await action.save();

        return {
          status: 'success',
          data: response,
          tokens_used: response.tokens_used?.total_tokens || 0,
          cost: this.calculateCost(response.tokens_used),
          execution_time_ms: Date.now() - action.created_at.getTime()
        };

      } catch (executionError) {
        console.error('❌ Error en ejecución del agente:', executionError);

        // Si estamos en desarrollo, hacer fallback a simulación
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Fallback a simulación por error en agente real');
          
          const simulatedResponse = this.simulateAgentResponse(intent, entities, context);

          action.ai_response = {
            raw_response: simulatedResponse,
            parsed_response: simulatedResponse,
            reasoning: `Error en agente real: ${executionError.message}. Usando simulación.`
          };
          action.result = {
            status: 'simulated',
            message: simulatedResponse.message,
            data: simulatedResponse.data
          };
          action.status = 'completed';
          action.completed_at = new Date();
          await action.save();

          return {
            status: 'success',
            data: {
              message: simulatedResponse.message,
              details: simulatedResponse.data,
              action_id: action._id,
              note: `⚠️ Error en agente real. Fallback a simulación: ${executionError.message}`
            },
            tokens_used: 0,
            cost: 0,
            execution_time_ms: 0
          };
        }

        // En producción, propagar el error
        throw executionError;
      }

    } catch (error) {
      console.error('OrchestratorService.executeAgent error:', error);
      return {
        status: 'error',
        data: {
          message: 'Error al ejecutar el agente',
          error: error.message
        },
        tokens_used: 0,
        cost: 0,
        execution_time_ms: 0
      };
    }
  }

  /**
   * Simula respuesta del agente (temporal para FASE 2)
   * En FASE 3, esto será reemplazado por llamadas reales a AI
   */
  static simulateAgentResponse(intent, entities, context) {
    const responses = {
      'create_user_story': {
        message: `Puedo ayudarte a crear ${entities.count || 'una'} historia(s) de usuario.`,
        data: {
          intent: 'create_user_story',
          would_create: entities.count || 1,
          product: context.primary_product?.nombre || 'producto',
          modules: entities.modules,
          next_steps: [
            'En FASE 3, el AI generará automáticamente las historias',
            'Analizará el backlog actual para evitar duplicados',
            'Aplicará los estándares del equipo',
            'Creará los items usando BacklogService'
          ]
        }
      },
      'refine_user_story': {
        message: 'Puedo ayudarte a refinar historias de usuario.',
        data: {
          intent: 'refine_user_story',
          backlog_items: context.backlog?.length || 0,
          next_steps: [
            'Identificar historias que necesitan refinamiento',
            'Generar criterios de aceptación detallados',
            'Sugerir descomposición si son muy grandes',
            'Actualizar usando BacklogService'
          ]
        }
      },
      'prioritize_backlog': {
        message: 'Puedo ayudarte a priorizar el backlog.',
        data: {
          intent: 'prioritize_backlog',
          current_backlog_size: context.backlog?.length || 0,
          total_points: context.backlog_stats?.puntos_totales || 0,
          next_steps: [
            'Analizar valor de negocio de cada item',
            'Considerar dependencias técnicas',
            'Aplicar framework RICE (Reach, Impact, Confidence, Effort)',
            'Reordenar usando BacklogService'
          ]
        }
      },
      'analyze_backlog': {
        message: 'Análisis del backlog actual.',
        data: {
          intent: 'analyze_backlog',
          statistics: context.backlog_stats || {},
          insights: [
            `Tienes ${context.backlog?.length || 0} items en el backlog`,
            `Total de ${context.backlog_stats?.puntos_totales || 0} puntos de historia`,
            'En FASE 3, el AI proporcionará insights detallados'
          ]
        }
      },
      'suggest_sprint_goal': {
        message: 'Puedo sugerirte un objetivo de sprint.',
        data: {
          intent: 'suggest_sprint_goal',
          active_sprint: context.active_sprint?.nombre || 'Ninguno activo',
          team_capacity: context.team_capacity?.average_velocity || 'Desconocida',
          next_steps: [
            'Analizar historias de mayor prioridad',
            'Considerar capacidad del equipo',
            'Generar objetivo SMART',
            'Proponer historias para el sprint'
          ]
        }
      }
    };

    return responses[intent] || {
      message: `Intención detectada: ${intent}`,
      data: {
        intent,
        entities,
        note: 'Funcionalidad en desarrollo'
      }
    };
  }

  /**
   * Maneja conversaciones continuas (chat)
   * @param {string} userId - ID del usuario
   * @param {string} message - Mensaje del usuario
   * @param {string} sessionId - ID de sesión (opcional)
   * @param {object} context - Contexto adicional
   * @param {object} user - Usuario completo
   * @returns {object} Respuesta del chat
   */
  static async chat(userId, message, sessionId = null, context = {}, user = null) {
    try {
      let session = null;

      // Si hay sessionId, cargar sesión existente
      if (sessionId) {
        session = await AgentSession.findById(sessionId);
        
        if (session && session.user_id.toString() !== userId) {
          return {
            status: 'error',
            message: 'Sesión no válida para este usuario'
          };
        }
      }

      // Ejecutar el orquestador con el mensaje
      const result = await this.execute(userId, message, context, user);

      // Si hay sesión, agregar mensaje
      if (session) {
        await session.addMessage('user', message);
        
        if (result.status === 'success') {
          await session.addMessage('assistant', result.result.message, {
            tokens: result.metadata?.tokens_used || 0,
            cost: result.metadata?.cost || 0
          });
        }
      }

      // Retornar resultado con session_id
      return {
        ...result,
        session_id: session?._id || null,
        conversation_length: session?.messages?.length || 0
      };

    } catch (error) {
      console.error('OrchestratorService.chat error:', error);
      return {
        status: 'error',
        message: 'Error en la conversación',
        error: error.message
      };
    }
  }

  /**
   * Obtiene sugerencias de acciones disponibles
   * @param {string} userId - ID del usuario
   * @param {object} context - Contexto actual
   * @returns {object} Sugerencias
   */
  static async getSuggestions(userId, context = {}) {
    try {
      // Obtener agentes disponibles
      const user = await require('../../models/User').findById(userId);
      const availableAgents = await AgentSelector.getAvailableAgents(userId, user.role);

      // Generar sugerencias basadas en contexto
      const suggestions = [];

      if (context.product_id) {
        suggestions.push({
          action: 'create_user_story',
          label: 'Crear historia de usuario',
          example: 'Crea una historia para exportar reportes a PDF'
        });

        suggestions.push({
          action: 'analyze_backlog',
          label: 'Analizar backlog',
          example: '¿Cómo está mi backlog?'
        });

        suggestions.push({
          action: 'prioritize_backlog',
          label: 'Priorizar backlog',
          example: 'Ayúdame a priorizar el backlog'
        });
      }

      if (context.sprint_id) {
        suggestions.push({
          action: 'suggest_sprint_goal',
          label: 'Sugerir objetivo de sprint',
          example: '¿Qué objetivo debería tener mi sprint?'
        });
      }

      return {
        status: 'success',
        available_agents: availableAgents,
        suggestions,
        quick_actions: [
          'Crear historia de usuario',
          'Analizar backlog',
          'Priorizar items',
          'Sugerir objetivo de sprint'
        ]
      };

    } catch (error) {
      console.error('OrchestratorService.getSuggestions error:', error);
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Ejecuta el agente real según su tipo (FASE 3)
   */
  static async executeRealAgent(agent, intent, context, entities, userId) {
    console.log(`\n🤖 Ejecutando agente real: ${agent.type}`);

    // Cargar clase del agente según tipo
    let AgentClass;
    
    try {
      switch (agent.type) {
        case 'product_owner':
          AgentClass = require('./agents/ProductOwnerAgent');
          break;
        
        case 'scrum_master':
          // TODO: Implementar ScrumMasterAgent en futuro
          console.warn('⚠️ ScrumMasterAgent no implementado, usando simulación');
          return await this.simulateAgentResponse(intent, entities, context);
        
        case 'tech_lead':
          // TODO: Implementar TechLeadAgent en futuro
          console.warn('⚠️ TechLeadAgent no implementado, usando simulación');
          return await this.simulateAgentResponse(intent, entities, context);
        
        default:
          throw new Error(`Tipo de agente no soportado: ${agent.type}`);
      }

      // Crear instancia y ejecutar
      console.log(`✅ Agente ${agent.type} cargado, ejecutando...`);
      const agentInstance = new AgentClass(agent, userId);
      const result = await agentInstance.execute(intent, context, entities);

      console.log(`✅ Agente ${agent.type} ejecutado exitosamente`);
      return result;

    } catch (error) {
      console.error(`❌ Error ejecutando agente ${agent.type}:`, error);
      throw error;
    }
  }

  /**
   * Calcula el costo de la ejecución basado en tokens
   */
  static calculateCost(usage) {
    if (!usage) return 0;

    // Precios de OpenAI GPT-4 Turbo (por 1K tokens)
    const PROMPT_PRICE = 0.01;  // $0.01 per 1K tokens
    const COMPLETION_PRICE = 0.03;  // $0.03 per 1K tokens

    const promptCost = (usage.prompt_tokens / 1000) * PROMPT_PRICE;
    const completionCost = (usage.completion_tokens / 1000) * COMPLETION_PRICE;

    return promptCost + completionCost;
  }
}

module.exports = OrchestratorService;
