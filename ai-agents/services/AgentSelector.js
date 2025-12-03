/**
 * AgentSelector - Selector de agentes AI
 * Determina qué agente debe manejar una tarea específica
 */

const Agent = require('../models/Agent');
const AgentDelegation = require('../models/AgentDelegation');
const IntentClassifier = require('./IntentClassifier');

class AgentSelector {
  /**
   * Selecciona el mejor agente para la tarea
   * @param {string} intent - Intención clasificada
   * @param {string} userId - ID del usuario
   * @param {object} options - Opciones adicionales
   * @returns {object} { agent, delegation } o null
   */
  static async select(intent, userId, options = {}) {
    try {
      // Determinar qué tipo de agente se necesita
      const agentType = IntentClassifier.getAgentTypeForIntent(intent);
      const requiredPermissions = IntentClassifier.getRequiredPermissions(intent);

      console.log('AgentSelector: Buscando agente');
      console.log('- Intent:', intent);
      console.log('- Agent type needed:', agentType);
      console.log('- Required permissions:', requiredPermissions);

      // ✅ NUEVO: Verificar si es SCRUM AI unificado
      const User = require('../../models/User');
      const user = await User.findById(userId);
      const isSuperAdmin = user && user.role === 'super_admin';
      
      console.log('- User role:', user?.role);
      console.log('- Is Super Admin:', isSuperAdmin);

      // Buscar agentes activos del tipo necesario
      // IMPORTANTE: Ahora también busca unified_system (SCRUM AI)
      const agents = await Agent.find({
        $or: [
          { type: agentType, status: 'active' },
          { is_unified_system: true, status: 'active' }  // SCRUM AI
        ]
      }).lean();

      console.log(`- Found ${agents.length} active agents`);

      if (agents.length === 0) {
        console.warn(`No active agents found for type: ${agentType}`);
        return null;
      }

      // Priorizar SCRUM AI unificado si existe
      const scrumAI = agents.find(a => a.is_unified_system === true);
      const agentsToCheck = scrumAI ? [scrumAI, ...agents.filter(a => !a.is_unified_system)] : agents;

      // ✅ NUEVO: Si es Super Admin, bypass de delegación
      if (isSuperAdmin && agentsToCheck.length > 0) {
        const selectedAgent = agentsToCheck[0];
        console.log('✅ Super Admin detected - bypassing delegation check');
        console.log('✅ Agent selected:', selectedAgent.name);
        
        return {
          agent: selectedAgent,
          delegation: {
            _id: 'virtual-delegation',
            user_id: userId,
            agent_id: selectedAgent._id,
            delegated_permissions: requiredPermissions.map(p => ({
              permission_key: p,
              permission_name: p,
              granted_at: new Date()
            })),
            enabled_specialties: ['product_owner', 'scrum_master', 'developer'],
            scope: {
              all_products: true,
              can_create: true,
              can_edit: true,
              can_delete: true,
              requires_approval: false,
              max_actions_per_hour: 1000,
              max_actions_per_day: 10000,
              max_cost_per_day: 100
            },
            status: 'active',
            is_virtual: true
          }
        };
      }

      // Flujo normal para usuarios regulares
      for (const agent of agentsToCheck) {
        const delegation = await AgentDelegation.getActiveDelegation(userId, agent._id);
        
        if (delegation) {
          console.log(`- Found active delegation for agent: ${agent.name}`);
          
          // Verificar que la delegación tenga los permisos necesarios
          const hasPermissions = this.checkDelegationPermissions(
            delegation, 
            requiredPermissions
          );

          if (hasPermissions) {
            console.log('✅ Agent selected:', agent.name);
            return {
              agent,
              delegation
            };
          } else {
            console.log(`- Agent ${agent.name} delegation lacks permissions:`, requiredPermissions);
          }
        }
      }

      console.warn('No suitable agent found with active delegation and permissions');
      return null;

    } catch (error) {
      console.error('AgentSelector.select error:', error);
      return null;
    }
  }

  /**
   * Verifica si el agente puede ejecutar la intención
   * @param {object} agent - Agente a verificar
   * @param {string} intent - Intención a ejecutar
   * @returns {boolean}
   */
  static canExecuteIntent(agent, intent) {
    try {
      // Mapeo de intenciones a capacidades del agente
      const intentToCapability = {
        'create_user_story': 'create_user_stories',
        'refine_user_story': 'refine_user_stories',
        'prioritize_backlog': 'prioritize_backlog',
        'analyze_backlog': 'analyze_backlog',
        'suggest_sprint_goal': 'suggest_sprint_goal',
        'plan_sprint': 'plan_sprint',
        'estimate_story': 'estimate_stories',
        'analyze_business_value': 'analyze_business_value',
        'generate_acceptance_criteria': 'generate_acceptance_criteria',
        'suggest_improvements': 'suggest_improvements',
        'generate_report': 'generate_reports',
        // Architecture capabilities
        'define_architecture': 'define_architecture',
        'analyze_architecture': 'analyze_architecture',
        'suggest_tech_stack': 'suggest_tech_stack',
        'plan_modules': 'plan_modules',
        'link_architecture': 'link_architecture'
      };

      const requiredCapability = intentToCapability[intent];
      
      if (!requiredCapability) {
        console.warn(`No capability mapping found for intent: ${intent}`);
        return false;
      }

      // Verificar si el agente tiene la capacidad
      const hasCapability = agent.capabilities.some(cap => 
        cap.name === requiredCapability || cap.name === 'name'
      );

      return hasCapability;
    } catch (error) {
      console.error('AgentSelector.canExecuteIntent error:', error);
      return false;
    }
  }

  /**
   * Verifica que la delegación tenga los permisos necesarios
   * @param {object} delegation - Delegación a verificar
   * @param {array} requiredPermissions - Permisos requeridos
   * @returns {boolean}
   */
  static checkDelegationPermissions(delegation, requiredPermissions) {
    if (!delegation || !delegation.delegated_permissions) {
      return false;
    }

    if (!Array.isArray(requiredPermissions) || requiredPermissions.length === 0) {
      return true; // No se requieren permisos específicos
    }

    // Verificar que la delegación tenga TODOS los permisos requeridos
    return requiredPermissions.every(permission => 
      delegation.delegated_permissions.some(dp => 
        dp.permission_key === permission || dp.permission === permission
      )
    );
  }

  /**
   * Obtiene todos los agentes disponibles para un usuario
   * @param {string} userId - ID del usuario
   * @param {string} userRole - Rol del usuario
   * @returns {array} Lista de agentes disponibles
   */
  static async getAvailableAgents(userId, userRole) {
    try {
      // Buscar agentes activos que el usuario puede usar
      const agents = await Agent.find({
        status: 'active',
        allowed_roles: userRole
      })
        .select('name display_name type description capabilities')
        .lean();

      // Para cada agente, verificar si hay delegación activa
      const agentsWithDelegation = await Promise.all(
        agents.map(async (agent) => {
          const delegation = await AgentDelegation.getActiveDelegation(userId, agent._id);
          
          return {
            ...agent,
            has_delegation: !!delegation,
            delegation_status: delegation?.status || null,
            delegated_permissions: delegation?.delegated_permissions || []
          };
        })
      );

      return agentsWithDelegation;
    } catch (error) {
      console.error('AgentSelector.getAvailableAgents error:', error);
      return [];
    }
  }

  /**
   * Sugiere qué agente debería usar el usuario
   * @param {string} intent - Intención del usuario
   * @param {string} userId - ID del usuario
   * @returns {object} Sugerencia de agente
   */
  static async suggestAgent(intent, userId) {
    try {
      const agentType = IntentClassifier.getAgentTypeForIntent(intent);
      const requiredPermissions = IntentClassifier.getRequiredPermissions(intent);

      // Buscar agentes del tipo correcto
      const agents = await Agent.find({
        type: agentType,
        status: 'active'
      })
        .select('name display_name description capabilities')
        .lean();

      if (agents.length === 0) {
        return {
          suggested: null,
          reason: `No hay agentes de tipo '${agentType}' disponibles`,
          agent_type: agentType,
          required_permissions: requiredPermissions
        };
      }

      const suggestedAgent = agents[0]; // Tomar el primero disponible

      // Verificar si ya tiene delegación
      const existingDelegation = await AgentDelegation.getActiveDelegation(userId, suggestedAgent._id);

      if (existingDelegation) {
        return {
          suggested: suggestedAgent,
          has_delegation: true,
          reason: 'Ya tienes una delegación activa con este agente',
          delegation: existingDelegation
        };
      }

      return {
        suggested: suggestedAgent,
        has_delegation: false,
        reason: 'Necesitas delegar permisos a este agente primero',
        agent_type: agentType,
        required_permissions: requiredPermissions,
        delegation_instructions: {
          endpoint: 'POST /api/ai-agents/delegate',
          body: {
            agent_id: suggestedAgent._id,
            permissions: requiredPermissions,
            scope: {
              products: ['YOUR_PRODUCT_ID']
            }
          }
        }
      };
    } catch (error) {
      console.error('AgentSelector.suggestAgent error:', error);
      return {
        suggested: null,
        error: error.message
      };
    }
  }

  /**
   * Verifica la compatibilidad entre intención y agente
   * @param {string} intent - Intención
   * @param {object} agent - Agente
   * @returns {object} Resultado de compatibilidad
   */
  static checkCompatibility(intent, agent) {
    const agentType = IntentClassifier.getAgentTypeForIntent(intent);
    const requiredPermissions = IntentClassifier.getRequiredPermissions(intent);
    const canExecute = this.canExecuteIntent(agent, intent);

    return {
      is_compatible: agent.type === agentType && canExecute,
      agent_type_match: agent.type === agentType,
      has_capability: canExecute,
      required_agent_type: agentType,
      actual_agent_type: agent.type,
      required_permissions: requiredPermissions
    };
  }
}

module.exports = AgentSelector;
