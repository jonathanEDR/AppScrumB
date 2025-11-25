# 🎯 FASE 2 - ORQUESTADOR PRINCIPAL

## 📋 Objetivo

Crear un sistema inteligente que:
1. Analice la intención del usuario (NLP/clasificación)
2. Seleccione el agente más apropiado para la tarea
3. Coordine la ejecución y ensamble el contexto necesario
4. Unifique las respuestas cuando múltiples agentes participen

## 🏗️ Arquitectura del Orquestador

```
Usuario
  │
  ├─ "Necesito crear 5 historias para el módulo de reportes"
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│          ORCHESTRATOR SERVICE                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. analyzeIntent(userInput)                            │
│     ├─ Clasificar tipo de tarea                         │
│     ├─ Extraer entidades (productos, sprints, etc.)     │
│     └─ Determinar complejidad                           │
│                                                         │
│  2. selectAgent(intent)                                 │
│     ├─ Buscar agentes con capacidades necesarias        │
│     ├─ Verificar delegaciones activas del usuario       │
│     └─ Seleccionar el mejor agente disponible           │
│                                                         │
│  3. buildContext(intent, entities)                      │
│     ├─ Cargar información del producto                  │
│     ├─ Obtener backlog actual                           │
│     ├─ Recuperar sprints activos                        │
│     └─ Incluir estándares y guías del equipo            │
│                                                         │
│  4. executeAgent(agent, context, userInput)             │
│     ├─ Invocar capacidad específica del agente          │
│     ├─ Monitorear ejecución                             │
│     └─ Registrar en AgentAction                         │
│                                                         │
│  5. formatResponse(result)                              │
│     ├─ Unificar formato de respuesta                    │
│     ├─ Incluir insights del AI                          │
│     └─ Agregar metadata (tokens, costo, tiempo)         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 📁 Estructura de Archivos

```
ai-agents/
├── services/
│   ├── OrchestratorService.js       ← 🆕 NUEVO
│   ├── IntentClassifier.js          ← 🆕 NUEVO
│   ├── ContextBuilder.js            ← 🆕 NUEVO
│   └── AgentSelector.js             ← 🆕 NUEVO
├── routes/
│   └── orchestrator.js              ← 🆕 NUEVO
└── utils/
    └── intentPatterns.js            ← 🆕 NUEVO
```

## 🔧 Implementación

### 1. IntentClassifier.js

Clasifica la intención del usuario en categorías:

```javascript
class IntentClassifier {
  static INTENTS = {
    // Gestión de Backlog
    CREATE_USER_STORY: 'create_user_story',
    REFINE_USER_STORY: 'refine_user_story',
    PRIORITIZE_BACKLOG: 'prioritize_backlog',
    ANALYZE_BACKLOG: 'analyze_backlog',
    
    // Sprint Planning
    SUGGEST_SPRINT_GOAL: 'suggest_sprint_goal',
    PLAN_SPRINT: 'plan_sprint',
    ESTIMATE_STORY: 'estimate_story',
    
    // Análisis
    ANALYZE_BUSINESS_VALUE: 'analyze_business_value',
    GENERATE_ACCEPTANCE_CRITERIA: 'generate_acceptance_criteria',
    SUGGEST_IMPROVEMENTS: 'suggest_improvements',
    
    // Conversación General
    GENERAL_QUESTION: 'general_question'
  };

  /**
   * Analiza el input del usuario y determina la intención
   */
  static async classify(userInput, context = {}) {
    // Patrones de palabras clave
    const patterns = {
      CREATE_USER_STORY: [
        /crear.*historia/i,
        /nueva.*historia/i,
        /agregar.*historia/i,
        /necesito.*feature/i,
        /quiero.*funcionalidad/i
      ],
      REFINE_USER_STORY: [
        /refinar.*historia/i,
        /mejorar.*historia/i,
        /detallar.*historia/i,
        /completar.*historia/i
      ],
      PRIORITIZE_BACKLOG: [
        /priorizar/i,
        /ordenar.*backlog/i,
        /qué.*primero/i,
        /importancia/i
      ],
      ANALYZE_BACKLOG: [
        /analizar.*backlog/i,
        /revisar.*backlog/i,
        /estado.*backlog/i,
        /métricas/i
      ],
      SUGGEST_SPRINT_GOAL: [
        /objetivo.*sprint/i,
        /meta.*sprint/i,
        /sprint goal/i
      ]
    };

    // Buscar coincidencias
    for (const [intent, regexes] of Object.entries(patterns)) {
      if (regexes.some(regex => regex.test(userInput))) {
        return {
          intent: this.INTENTS[intent],
          confidence: 0.85,
          matched_pattern: intent
        };
      }
    }

    // Si no hay coincidencia clara, usar AI para clasificar
    // (Opcional: usar OpenAI para clasificación más precisa)
    return {
      intent: this.INTENTS.GENERAL_QUESTION,
      confidence: 0.5,
      requires_clarification: true
    };
  }

  /**
   * Extrae entidades del input (productos, sprints, etc.)
   */
  static extractEntities(userInput, context = {}) {
    const entities = {
      product_ids: [],
      sprint_ids: [],
      story_ids: [],
      count: null,
      priorities: []
    };

    // Extraer números (ej: "crear 5 historias")
    const countMatch = userInput.match(/(\d+)\s*(historias|stories|items)/i);
    if (countMatch) {
      entities.count = parseInt(countMatch[1]);
    }

    // Extraer prioridades
    const priorityPatterns = ['alta', 'high', 'media', 'medium', 'baja', 'low'];
    priorityPatterns.forEach(priority => {
      if (userInput.toLowerCase().includes(priority)) {
        entities.priorities.push(priority);
      }
    });

    // Si el contexto incluye IDs, usarlos
    if (context.product_id) entities.product_ids.push(context.product_id);
    if (context.sprint_id) entities.sprint_ids.push(context.sprint_id);

    return entities;
  }
}

module.exports = IntentClassifier;
```

### 2. ContextBuilder.js

Construye el contexto necesario para el agente:

```javascript
class ContextBuilder {
  /**
   * Construye el contexto completo para el agente
   */
  static async build(intent, entities, user) {
    const context = {
      user: {
        id: user._id,
        name: user.name,
        role: user.role
      },
      timestamp: new Date().toISOString(),
      intent: intent
    };

    // Cargar producto si está especificado
    if (entities.product_ids?.length > 0) {
      context.products = await this.loadProducts(entities.product_ids);
    }

    // Cargar backlog si es necesario
    if (this.needsBacklogContext(intent)) {
      context.backlog = await this.loadBacklog(entities.product_ids);
    }

    // Cargar sprints si es necesario
    if (this.needsSprintContext(intent)) {
      context.sprints = await this.loadSprints(entities.product_ids);
    }

    // Cargar estándares del equipo
    context.standards = await this.loadTeamStandards(user.organization_id);

    return context;
  }

  static needsBacklogContext(intent) {
    return [
      'create_user_story',
      'prioritize_backlog',
      'analyze_backlog',
      'refine_user_story'
    ].includes(intent);
  }

  static needsSprintContext(intent) {
    return [
      'suggest_sprint_goal',
      'plan_sprint',
      'estimate_story'
    ].includes(intent);
  }

  static async loadProducts(productIds) {
    const Product = require('../../models/Product');
    return await Product.find({ _id: { $in: productIds } }).lean();
  }

  static async loadBacklog(productIds) {
    const BacklogItem = require('../../models/BacklogItem');
    return await BacklogItem.find({
      product_id: { $in: productIds },
      status: { $ne: 'archived' }
    })
    .sort({ priority: 1 })
    .limit(50)
    .lean();
  }

  static async loadSprints(productIds) {
    const Sprint = require('../../models/Sprint');
    return await Sprint.find({
      product_id: { $in: productIds },
      status: { $in: ['planning', 'active'] }
    })
    .sort({ start_date: -1 })
    .lean();
  }

  static async loadTeamStandards(organizationId) {
    // Cargar configuraciones del equipo (formato de historias, etc.)
    return {
      story_format: 'As a [user], I want [feature], so that [benefit]',
      acceptance_criteria_format: 'Given [context], When [action], Then [outcome]',
      estimation_scale: 'fibonacci'
    };
  }
}

module.exports = ContextBuilder;
```

### 3. AgentSelector.js

Selecciona el agente más apropiado:

```javascript
class AgentSelector {
  /**
   * Selecciona el mejor agente para la tarea
   */
  static async select(intent, userId) {
    const Agent = require('../models/Agent');
    const AgentDelegation = require('../models/AgentDelegation');

    // Mapeo de intenciones a tipos de agentes
    const intentToAgentType = {
      create_user_story: 'product_owner',
      refine_user_story: 'product_owner',
      prioritize_backlog: 'product_owner',
      analyze_backlog: 'product_owner',
      suggest_sprint_goal: 'product_owner',
      plan_sprint: 'scrum_master',
      estimate_story: 'developer'
    };

    const agentType = intentToAgentType[intent] || 'product_owner';

    // Buscar agentes activos del tipo necesario
    const agents = await Agent.find({
      type: agentType,
      status: 'active'
    });

    // Filtrar por delegaciones activas del usuario
    for (const agent of agents) {
      const delegation = await AgentDelegation.getActiveDelegation(userId, agent._id);
      if (delegation) {
        return {
          agent,
          delegation
        };
      }
    }

    return null; // No hay agente disponible con delegación activa
  }

  /**
   * Verifica si el agente puede ejecutar la intención
   */
  static canExecuteIntent(agent, intent) {
    const intentToCapability = {
      create_user_story: 'create_user_stories',
      refine_user_story: 'refine_user_stories',
      prioritize_backlog: 'prioritize_backlog',
      analyze_backlog: 'analyze_backlog',
      suggest_sprint_goal: 'suggest_sprint_goal'
    };

    const requiredCapability = intentToCapability[intent];
    return agent.capabilities.some(cap => cap.name === requiredCapability);
  }
}

module.exports = AgentSelector;
```

### 4. OrchestratorService.js

Servicio principal que coordina todo:

```javascript
class OrchestratorService {
  /**
   * Ejecuta una tarea completa desde el input del usuario hasta la respuesta
   */
  static async execute(userId, userInput, context = {}) {
    try {
      // 1. Analizar intención
      const { intent, confidence } = await IntentClassifier.classify(userInput, context);
      
      if (confidence < 0.6) {
        return {
          status: 'needs_clarification',
          message: '¿Podrías ser más específico sobre lo que necesitas?',
          suggestions: this.getSuggestions(userInput)
        };
      }

      // 2. Extraer entidades
      const entities = IntentClassifier.extractEntities(userInput, context);

      // 3. Seleccionar agente
      const agentData = await AgentSelector.select(intent, userId);
      if (!agentData) {
        return {
          status: 'no_agent_available',
          message: 'No tienes un agente disponible para esta tarea. Por favor, delega permisos primero.'
        };
      }

      // 4. Construir contexto
      const fullContext = await ContextBuilder.build(intent, entities, { _id: userId });

      // 5. Ejecutar agente
      const result = await this.executeAgent(
        agentData.agent,
        agentData.delegation,
        userId,
        intent,
        userInput,
        fullContext
      );

      return {
        status: 'success',
        result: result.data,
        agent: agentData.agent.display_name,
        metadata: {
          intent,
          confidence,
          tokens_used: result.tokens_used,
          cost: result.cost,
          execution_time_ms: result.execution_time_ms
        }
      };

    } catch (error) {
      console.error('OrchestratorService.execute error:', error);
      return {
        status: 'error',
        message: 'Ocurrió un error al procesar tu solicitud',
        error: error.message
      };
    }
  }

  /**
   * Ejecuta el agente específico
   */
  static async executeAgent(agent, delegation, userId, intent, userInput, context) {
    // Aquí conectaremos con los agentes específicos en FASE 3
    // Por ahora, solo registramos la intención

    const AgentAction = require('../models/AgentAction');
    
    const action = await AgentAction.create({
      agent_id: agent._id,
      user_id: userId,
      delegation_id: delegation._id,
      action_type: intent,
      input: {
        user_prompt: userInput,
        context: context
      },
      status: 'pending'
    });

    // En FASE 3, aquí llamaremos al ProductOwnerAgent, ScrumMasterAgent, etc.
    // Por ahora, solo simulamos
    return {
      data: {
        message: 'Funcionalidad en desarrollo (FASE 3)',
        intent: intent,
        action_id: action._id
      },
      tokens_used: 0,
      cost: 0,
      execution_time_ms: 0
    };
  }

  static getSuggestions(userInput) {
    return [
      'Crear una nueva historia de usuario',
      'Priorizar el backlog',
      'Analizar el backlog actual',
      'Sugerir objetivo de sprint',
      'Refinar historia existente'
    ];
  }
}

module.exports = OrchestratorService;
```

### 5. routes/orchestrator.js

Endpoints para el orquestador:

```javascript
const express = require('express');
const router = express.Router();
const OrchestratorService = require('../services/OrchestratorService');
const { authenticate } = require('../../middleware/authenticate');

/**
 * POST /api/ai-agents/orchestrator/execute
 * Ejecuta una tarea coordinada por el orquestador
 */
router.post('/execute', authenticate, async (req, res) => {
  try {
    const { input, context } = req.body;
    
    if (!input) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere el campo "input"'
      });
    }

    const result = await OrchestratorService.execute(
      req.user._id,
      input,
      context || {}
    );

    res.json(result);

  } catch (error) {
    console.error('Orchestrator execute error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al ejecutar la tarea',
      error: error.message
    });
  }
});

/**
 * POST /api/ai-agents/orchestrator/chat
 * Conversación natural con el orquestador
 */
router.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, session_id, context } = req.body;
    
    if (!message) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere el campo "message"'
      });
    }

    // Si hay session_id, cargar historial de conversación
    let conversationContext = context || {};
    if (session_id) {
      const AgentSession = require('../models/AgentSession');
      const session = await AgentSession.findById(session_id);
      if (session) {
        conversationContext.history = session.messages;
      }
    }

    const result = await OrchestratorService.execute(
      req.user._id,
      message,
      conversationContext
    );

    res.json(result);

  } catch (error) {
    console.error('Orchestrator chat error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error en la conversación',
      error: error.message
    });
  }
});

module.exports = router;
```

## 🧪 Ejemplos de Uso

### Ejemplo 1: Crear Historia de Usuario

```bash
POST /api/ai-agents/orchestrator/execute
Authorization: Bearer YOUR_TOKEN

{
  "input": "Necesito crear una historia para exportar reportes a PDF",
  "context": {
    "product_id": "67890"
  }
}
```

**Respuesta:**
```json
{
  "status": "success",
  "result": {
    "message": "Funcionalidad en desarrollo (FASE 3)",
    "intent": "create_user_story",
    "action_id": "action123"
  },
  "agent": "Product Owner AI",
  "metadata": {
    "intent": "create_user_story",
    "confidence": 0.95,
    "tokens_used": 0,
    "cost": 0,
    "execution_time_ms": 0
  }
}
```

### Ejemplo 2: Priorizar Backlog

```bash
POST /api/ai-agents/orchestrator/execute

{
  "input": "¿Qué historias debería priorizar para el próximo sprint?",
  "context": {
    "product_id": "67890"
  }
}
```

### Ejemplo 3: Conversación Natural

```bash
POST /api/ai-agents/orchestrator/chat

{
  "message": "Hola, necesito ayuda con mi backlog",
  "session_id": "session123"
}
```

## 📊 Flujo Completo

```
Usuario: "Necesito crear 3 historias para el módulo de reportes"
   │
   ▼
IntentClassifier
   ├─ Intent: create_user_story
   ├─ Confidence: 0.95
   └─ Entities: { count: 3, module: "reportes" }
   │
   ▼
AgentSelector
   ├─ Busca agentes tipo: product_owner
   ├─ Verifica delegaciones activas
   └─ Selecciona: Product Owner AI
   │
   ▼
ContextBuilder
   ├─ Carga producto
   ├─ Carga backlog actual (50 items)
   ├─ Carga estándares del equipo
   └─ Context completo construido
   │
   ▼
ProductOwnerAgent (FASE 3)
   ├─ Genera prompt especializado
   ├─ Llama a OpenAI GPT-4
   ├─ Parsea respuesta JSON
   └─ Crea 3 BacklogItems en DB
   │
   ▼
Respuesta al Usuario
   ├─ 3 historias creadas
   ├─ Insights del AI
   └─ Metadata (tokens, costo, tiempo)
```

## ✅ Checklist de Implementación

- [ ] Crear IntentClassifier.js
- [ ] Crear ContextBuilder.js
- [ ] Crear AgentSelector.js
- [ ] Crear OrchestratorService.js
- [ ] Crear routes/orchestrator.js
- [ ] Integrar rutas en server.js
- [ ] Crear utils/intentPatterns.js
- [ ] Escribir tests unitarios
- [ ] Documentar API en API_TESTING.md
- [ ] Probar flujo completo end-to-end

## 🎯 Resultado Esperado

Al completar FASE 2, tendremos:

✅ Sistema inteligente que comprende intenciones del usuario  
✅ Selección automática del agente apropiado  
✅ Construcción dinámica de contexto  
✅ Base lista para implementar agentes funcionales en FASE 3  
✅ API unificada: `/orchestrator/execute` y `/orchestrator/chat`

---

**Estado:** 📝 Documentado  
**Siguiente:** ⏳ Implementación
