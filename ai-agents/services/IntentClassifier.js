/**
 * IntentClassifier - Clasificador de intenciones del usuario
 * Analiza el input del usuario y determina qué acción quiere realizar
 */

class IntentClassifier {
  // Definición de todas las intenciones posibles
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
    
    // Análisis y Reportes
    ANALYZE_BUSINESS_VALUE: 'analyze_business_value',
    GENERATE_ACCEPTANCE_CRITERIA: 'generate_acceptance_criteria',
    SUGGEST_IMPROVEMENTS: 'suggest_improvements',
    GENERATE_REPORT: 'generate_report',
    
    // 🏗️ Arquitectura de Proyectos
    DEFINE_ARCHITECTURE: 'define_architecture',
    ANALYZE_ARCHITECTURE: 'analyze_architecture',
    SUGGEST_TECH_STACK: 'suggest_tech_stack',
    CREATE_MODULE: 'create_module',
    UPDATE_MODULE: 'update_module',
    LIST_MODULES: 'list_modules',
    GENERATE_ROADMAP: 'generate_roadmap',
    DOCUMENT_DECISION: 'document_decision',
    ESTIMATE_COMPLEXITY: 'estimate_complexity',
    ARCHITECTURE_QUESTION: 'architecture_question',
    
    // Conversación General
    GENERAL_QUESTION: 'general_question',
    CLARIFICATION_NEEDED: 'clarification_needed'
  };

  /**
   * Analiza el input del usuario y determina la intención
   * @param {string} userInput - Texto del usuario
   * @param {object} context - Contexto adicional (producto_id, sprint_id, etc.)
   * @returns {object} { intent, confidence, matched_pattern, entities }
   */
  static async classify(userInput, context = {}) {
    try {
      if (!userInput || typeof userInput !== 'string') {
        return {
          intent: this.INTENTS.CLARIFICATION_NEEDED,
          confidence: 0,
          error: 'Input inválido'
        };
      }

      const inputLower = userInput.toLowerCase().trim();

      // 🔍 DETECCIÓN TEMPRANA: Preguntas conversacionales/educativas
      const conversationalPatterns = [
        /^(qué es|que es|explica|explicame|cuéntame|dime sobre|háblame de|cómo funciona|para qué sirve|cuál es|cuales son)/i,
        /\?(.*)(scrum|agile|sprint|backlog|historia|metodología|framework|práctica)/i,
        /^(ayuda|ayúdame|necesito (ayuda|información|entender|aprender|saber))/i,
        /^(cuándo|dónde|por qué|cómo|quién)/i,
        /diferencia entre/i,
        /^(consejos|tips|recomendaciones|mejores prácticas|buenas prácticas)/i,
        /^hola|hi|buenos días|buenas tardes/i
      ];

      for (const pattern of conversationalPatterns) {
        if (pattern.test(inputLower)) {
          return {
            intent: this.INTENTS.GENERAL_QUESTION,
            confidence: 0.9,
            matched_pattern: 'conversational',
            entities: this.extractEntities(userInput, context)
          };
        }
      }

      // Patrones de palabras clave para cada intención
      const patterns = {
        CREATE_USER_STORY: [
          /crear.*historia/i,
          /nueva.*historia/i,
          /agregar.*historia/i,
          /necesito.*historia/i,
          /quiero.*historia/i,
          /genera.*historia/i,
          /hacer.*historia/i,
          /necesito.*feature/i,
          /nueva.*funcionalidad/i,
          /implementar.*funcionalidad/i
        ],
        REFINE_USER_STORY: [
          /refinar.*historia/i,
          /mejorar.*historia/i,
          /detallar.*historia/i,
          /completar.*historia/i,
          /ampliar.*historia/i,
          /expandir.*historia/i
        ],
        PRIORITIZE_BACKLOG: [
          /priorizar/i,
          /ordenar.*backlog/i,
          /organizar.*backlog/i,
          /qué.*primero/i,
          /qué.*importante/i,
          /importancia/i,
          /urgente/i,
          /orden.*prioridad/i
        ],
        ANALYZE_BACKLOG: [
          /analizar.*backlog/i,
          /revisar.*backlog/i,
          /estado.*backlog/i,
          /métricas.*backlog/i,
          /cómo.*está.*backlog/i,
          /resumen.*backlog/i
        ],
        SUGGEST_SPRINT_GOAL: [
          /objetivo.*sprint/i,
          /meta.*sprint/i,
          /sprint goal/i,
          /proponer.*objetivo/i,
          /sugerir.*objetivo/i,
          /qué.*objetivo.*sprint/i
        ],
        PLAN_SPRINT: [
          /planificar.*sprint/i,
          /planear.*sprint/i,
          /plan.*sprint/i,
          /preparar.*sprint/i,
          /organizar.*sprint/i
        ],
        ESTIMATE_STORY: [
          /estimar/i,
          /puntos.*historia/i,
          /cuánto.*tiempo/i,
          /esfuerzo/i,
          /complejidad/i
        ],
        ANALYZE_BUSINESS_VALUE: [
          /valor.*negocio/i,
          /business value/i,
          /retorno.*inversión/i,
          /roi/i,
          /impacto.*negocio/i,
          /beneficio/i
        ],
        GENERATE_ACCEPTANCE_CRITERIA: [
          /criterios.*aceptación/i,
          /acceptance criteria/i,
          /condiciones.*aceptación/i,
          /definir.*criterios/i,
          /generar.*criterios/i
        ],
        SUGGEST_IMPROVEMENTS: [
          /mejorar/i,
          /sugerencias/i,
          /recomendaciones/i,
          /optimizar/i,
          /cómo.*mejor/i
        ],
        GENERATE_REPORT: [
          /reporte/i,
          /informe/i,
          /resumen/i,
          /dashboard/i,
          /estadísticas/i,
          /métricas/i
        ],
        // 🏗️ Patrones de Arquitectura
        DEFINE_ARCHITECTURE: [
          /definir.*arquitectura/i,
          /crear.*arquitectura/i,
          /estructura.*proyecto/i,
          /arquitectura.*proyecto/i,
          /diseñar.*sistema/i,
          /setup.*proyecto/i,
          /configurar.*proyecto/i,
          /iniciar.*proyecto/i,
          /nuevo.*proyecto.*estructura/i
        ],
        ANALYZE_ARCHITECTURE: [
          /analizar.*arquitectura/i,
          /revisar.*arquitectura/i,
          /estado.*arquitectura/i,
          /cómo.*está.*arquitectura/i,
          /ver.*arquitectura/i,
          /mostrar.*arquitectura/i,
          /evaluar.*arquitectura/i
        ],
        SUGGEST_TECH_STACK: [
          /qué.*tecnolog/i,
          /recomendar.*stack/i,
          /sugerir.*stack/i,
          /tecnologías.*usar/i,
          /framework.*recomiend/i,
          /lenguaje.*usar/i,
          /base.*datos.*usar/i,
          /tech.*stack/i
        ],
        CREATE_MODULE: [
          /crear.*módulo/i,
          /nuevo.*módulo/i,
          /agregar.*módulo/i,
          /añadir.*componente/i,
          /crear.*componente/i,
          /definir.*módulo/i
        ],
        LIST_MODULES: [
          /listar.*módulos/i,
          /mostrar.*módulos/i,
          /ver.*módulos/i,
          /qué.*módulos/i,
          /cuáles.*módulos/i,
          /componentes.*sistema/i
        ],
        GENERATE_ROADMAP: [
          /roadmap/i,
          /hoja.*ruta/i,
          /plan.*técnico/i,
          /fases.*proyecto/i,
          /planificación.*técnica/i,
          /timeline.*proyecto/i
        ],
        DOCUMENT_DECISION: [
          /documentar.*decisión/i,
          /registrar.*decisión/i,
          /adr/i,
          /decisión.*arquitectura/i,
          /por.*qué.*elegimos/i
        ],
        ESTIMATE_COMPLEXITY: [
          /complejidad.*técnica/i,
          /qué.*tan.*difícil/i,
          /cuánto.*tiempo.*llevaría/i,
          /esfuerzo.*técnico/i,
          /estimar.*desarrollo/i
        ],
        ARCHITECTURE_QUESTION: [
          /patrón.*arquitectura/i,
          /microservicios/i,
          /monolito/i,
          /clean.*architecture/i,
          /mvc|mvp|mvvm/i,
          /escalabilidad/i,
          /infraestructura/i,
          /deployment/i,
          /ci.*cd/i,
          /devops/i
        ]
      };

      // Buscar coincidencias
      let bestMatch = null;
      let highestScore = 0;

      for (const [intent, regexes] of Object.entries(patterns)) {
        let matchCount = 0;
        let matchedPattern = null;

        for (const regex of regexes) {
          if (regex.test(inputLower)) {
            matchCount++;
            matchedPattern = regex.toString();
          }
        }

        // Calcular score (más coincidencias = mayor confianza)
        const score = matchCount / regexes.length;
        
        if (matchCount > 0 && score > highestScore) {
          highestScore = score;
          bestMatch = {
            intent: this.INTENTS[intent],
            confidence: Math.min(0.7 + (score * 0.3), 0.95), // 0.7 - 0.95
            matched_pattern: matchedPattern
          };
        }
      }

      // Si no hay coincidencia clara
      if (!bestMatch || bestMatch.confidence < 0.6) {
        return {
          intent: this.INTENTS.GENERAL_QUESTION,
          confidence: bestMatch ? bestMatch.confidence : 0.5,
          requires_clarification: true,
          suggestions: this.getSuggestions(inputLower)
        };
      }

      // Extraer entidades del input
      const entities = this.extractEntities(userInput, context);

      return {
        ...bestMatch,
        entities
      };

    } catch (error) {
      console.error('IntentClassifier.classify error:', error);
      return {
        intent: this.INTENTS.GENERAL_QUESTION,
        confidence: 0.3,
        error: error.message
      };
    }
  }

  /**
   * Extrae entidades del input (números, productos, prioridades, etc.)
   * @param {string} userInput - Texto del usuario
   * @param {object} context - Contexto adicional
   * @returns {object} Entidades extraídas
   */
  static extractEntities(userInput, context = {}) {
    const entities = {
      originalMessage: userInput, // ✅ AGREGAR: Mensaje original para contexto conversacional
      product_ids: [],
      sprint_ids: [],
      story_ids: [],
      count: null,
      priorities: [],
      modules: [],
      keywords: []
    };

    // Extraer números (ej: "crear 5 historias")
    const countMatch = userInput.match(/(\d+)\s*(historias|stories|items|tareas|features|funcionalidades)/i);
    if (countMatch) {
      entities.count = parseInt(countMatch[1]);
    }

    // Extraer prioridades
    const priorityPatterns = {
      'alta': ['alta', 'high', 'crítica', 'urgente', 'importante'],
      'media': ['media', 'medium', 'normal'],
      'baja': ['baja', 'low', 'menor']
    };

    for (const [priority, keywords] of Object.entries(priorityPatterns)) {
      if (keywords.some(kw => userInput.toLowerCase().includes(kw))) {
        entities.priorities.push(priority);
      }
    }

    // Extraer módulos o features mencionados
    const moduleMatch = userInput.match(/para\s+(?:el\s+)?(?:módulo|feature|funcionalidad|componente)\s+(?:de\s+)?(\w+)/i);
    if (moduleMatch) {
      entities.modules.push(moduleMatch[1]);
    }

    // 🏗️ Extraer entidades de arquitectura
    // Tipos de proyecto
    const projectTypes = ['web', 'móvil', 'mobile', 'api', 'desktop', 'microservicios', 'monolito'];
    entities.project_type = projectTypes.find(type => userInput.toLowerCase().includes(type)) || null;

    // Tecnologías mencionadas
    const techKeywords = [
      'react', 'vue', 'angular', 'svelte', 'next', 'nuxt',
      'node', 'express', 'nestjs', 'fastify', 'django', 'flask', 'fastapi',
      'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch',
      'typescript', 'javascript', 'python', 'java', 'go',
      'docker', 'kubernetes', 'aws', 'vercel', 'render', 'railway',
      'tailwind', 'material', 'bootstrap', 'chakra'
    ];
    entities.tech_preferences = techKeywords.filter(tech => 
      userInput.toLowerCase().includes(tech)
    );

    // Escala del proyecto
    const scaleKeywords = {
      'mvp': ['mvp', 'prototipo', 'pequeño', 'simple'],
      'medium': ['mediano', 'startup', 'intermedio'],
      'large': ['grande', 'enterprise', 'empresa', 'complejo']
    };
    for (const [scale, keywords] of Object.entries(scaleKeywords)) {
      if (keywords.some(kw => userInput.toLowerCase().includes(kw))) {
        entities.scale = scale;
        break;
      }
    }

    // Nombre del módulo específico
    const moduleNameMatch = userInput.match(/módulo\s+(?:llamado\s+)?["']?(\w+)["']?/i);
    if (moduleNameMatch) {
      entities.module_name = moduleNameMatch[1];
    }

    // Extraer keywords importantes
    const words = userInput.toLowerCase().split(/\s+/);
    const importantWords = words.filter(word => 
      word.length > 4 && 
      !['para', 'crear', 'nueva', 'necesito', 'quiero', 'hacer', 'tiene', 'sobre', 'como'].includes(word)
    );
    entities.keywords = importantWords.slice(0, 5); // Primeras 5 palabras importantes

    // Si el contexto incluye IDs, agregarlos
    if (context.product_id) {
      entities.product_ids.push(context.product_id);
    }
    if (context.sprint_id) {
      entities.sprint_ids.push(context.sprint_id);
    }

    return entities;
  }

  /**
   * Genera sugerencias cuando la intención no es clara
   * @param {string} userInput - Input del usuario
   * @returns {array} Lista de sugerencias
   */
  static getSuggestions(userInput) {
    const suggestions = [
      'Crear una nueva historia de usuario',
      'Priorizar el backlog actual',
      'Analizar el estado del backlog',
      'Sugerir objetivo para el próximo sprint',
      'Refinar una historia existente',
      'Definir arquitectura del proyecto',
      'Ver módulos del sistema'
    ];

    // Si menciona ciertas palabras, priorizar sugerencias relacionadas
    if (userInput.includes('historia') || userInput.includes('story')) {
      return [
        'Crear una nueva historia de usuario',
        'Refinar una historia existente',
        'Generar criterios de aceptación',
        ...suggestions.slice(3)
      ];
    }

    if (userInput.includes('sprint')) {
      return [
        'Sugerir objetivo para el próximo sprint',
        'Planificar sprint',
        'Estimar historias',
        ...suggestions.slice(3)
      ];
    }

    // 🏗️ Sugerencias de arquitectura
    if (userInput.includes('arquitectura') || userInput.includes('proyecto') || userInput.includes('módulo')) {
      return [
        'Definir arquitectura del proyecto',
        'Analizar arquitectura actual',
        'Crear un nuevo módulo',
        'Ver módulos del sistema',
        'Generar roadmap técnico',
        'Sugerir stack tecnológico'
      ];
    }

    if (userInput.includes('tecnología') || userInput.includes('stack') || userInput.includes('framework')) {
      return [
        'Sugerir stack tecnológico',
        'Definir arquitectura del proyecto',
        'Analizar decisiones técnicas',
        ...suggestions.slice(3)
      ];
    }

    return suggestions;
  }

  /**
   * Determina qué permisos necesita una intención
   * @param {string} intent - Intención clasificada
   * @returns {array} Lista de permisos necesarios
   */
  static getRequiredPermissions(intent) {
    const permissionMap = {
      [this.INTENTS.CREATE_USER_STORY]: ['canCreateBacklogItems'],
      [this.INTENTS.REFINE_USER_STORY]: ['canEditBacklogItems'],
      [this.INTENTS.PRIORITIZE_BACKLOG]: ['canPrioritizeBacklog'],
      [this.INTENTS.ANALYZE_BACKLOG]: ['canViewBacklog'],
      [this.INTENTS.SUGGEST_SPRINT_GOAL]: ['canViewSprints'],
      [this.INTENTS.PLAN_SPRINT]: ['canManageSprints'],
      [this.INTENTS.ESTIMATE_STORY]: ['canEditBacklogItems'],
      [this.INTENTS.ANALYZE_BUSINESS_VALUE]: ['canViewBacklog'],
      [this.INTENTS.GENERATE_ACCEPTANCE_CRITERIA]: ['canEditBacklogItems'],
      [this.INTENTS.SUGGEST_IMPROVEMENTS]: ['canViewBacklog'],
      [this.INTENTS.GENERATE_REPORT]: ['canViewBacklog', 'canViewSprints']
    };

    return permissionMap[intent] || ['canViewBacklog'];
  }

  /**
   * Determina qué tipo de agente puede manejar esta intención
   * @param {string} intent - Intención clasificada
   * @returns {string} Tipo de agente
   */
  static getAgentTypeForIntent(intent) {
    const agentMap = {
      [this.INTENTS.CREATE_USER_STORY]: 'product_owner',
      [this.INTENTS.REFINE_USER_STORY]: 'product_owner',
      [this.INTENTS.PRIORITIZE_BACKLOG]: 'product_owner',
      [this.INTENTS.ANALYZE_BACKLOG]: 'product_owner',
      [this.INTENTS.SUGGEST_SPRINT_GOAL]: 'product_owner',
      [this.INTENTS.PLAN_SPRINT]: 'scrum_master',
      [this.INTENTS.ESTIMATE_STORY]: 'developer',
      [this.INTENTS.ANALYZE_BUSINESS_VALUE]: 'product_owner',
      [this.INTENTS.GENERATE_ACCEPTANCE_CRITERIA]: 'product_owner',
      [this.INTENTS.SUGGEST_IMPROVEMENTS]: 'product_owner',
      [this.INTENTS.GENERATE_REPORT]: 'product_owner',
      // Architecture intents
      [this.INTENTS.DEFINE_ARCHITECTURE]: 'architect',
      [this.INTENTS.ANALYZE_ARCHITECTURE]: 'architect',
      [this.INTENTS.SUGGEST_TECH_STACK]: 'architect',
      [this.INTENTS.PLAN_MODULES]: 'architect',
      [this.INTENTS.LINK_ARCHITECTURE]: 'architect'
    };

    return agentMap[intent] || 'product_owner';
  }
}

module.exports = IntentClassifier;
