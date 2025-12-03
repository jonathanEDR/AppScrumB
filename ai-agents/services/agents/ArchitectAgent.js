/**
 * ArchitectAgent - Agente AI especializado en arquitectura de software
 * 
 * Capabilities:
 * - define_architecture: Definir arquitectura para proyecto nuevo
 * - analyze_architecture: Analizar arquitectura existente
 * - suggest_tech_stack: Sugerir stack tecnológico
 * - create_module: Crear/definir un módulo del sistema
 * - update_module: Actualizar estado de un módulo
 * - generate_roadmap: Generar roadmap técnico
 * - document_decision: Documentar decisión de arquitectura (ADR)
 * - link_story_to_module: Vincular historia a componente técnico
 * - estimate_complexity: Estimar complejidad técnica
 */

const OpenAI = require('openai');
const ArchitectureService = require('../../../services/ArchitectureService');
const ProductService = require('../../../services/ProductService');
const {
  ARCHITECT_SYSTEM_PROMPT,
  QUESTIONS_FOR_NEW_PROJECT,
  TECH_STACK_RECOMMENDATIONS,
  COMMON_MODULES
} = require('../prompts/architect');

class ArchitectAgent {
  constructor(agent, userId, specialty = null) {
    this.agent = agent;
    this.userId = userId;
    this.specialty = specialty;
    
    // Inicializar OpenAI
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Configuración del modelo
    this.model = agent.config?.model || 'gpt-4o';
    this.temperature = agent.config?.temperature || 0.7;
    this.maxTokens = Math.min(agent.config?.max_tokens || 3000, 4096);
    
    // System prompt
    this.systemPrompt = specialty?.system_prompt || ARCHITECT_SYSTEM_PROMPT;
    
    console.log(`🏗️ ArchitectAgent inicializado`);
    console.log(`   Modelo: ${this.model}`);
    console.log(`   Max tokens: ${this.maxTokens}`);
  }

  /**
   * Ejecuta la capability solicitada
   */
  async execute(intent, context, entities) {
    console.log(`\n🏗️ ArchitectAgent.execute()`);
    console.log(`Intent: ${intent}`);
    console.log(`Entities:`, JSON.stringify(entities, null, 2));

    // Pregunta general sobre arquitectura
    if (intent === 'general_question' || intent === 'architecture_question') {
      return await this.answerArchitectureQuestion(context, entities);
    }

    // Validar contexto
    const validation = this.validateContextForIntent(intent, context, entities);
    
    if (!validation.canExecute) {
      console.log('⚠️ Contexto insuficiente - solicitando información');
      return await this.requestMoreInfo(intent, context, entities, validation.missingData);
    }

    // Ejecutar capability
    switch (intent) {
      case 'define_architecture':
        return await this.defineArchitecture(context, entities);
      
      case 'analyze_architecture':
        return await this.analyzeArchitecture(context, entities);
      
      case 'suggest_tech_stack':
        return await this.suggestTechStack(context, entities);
      
      case 'create_module':
        return await this.createModule(context, entities);
      
      case 'update_module':
        return await this.updateModule(context, entities);
      
      case 'generate_roadmap':
        return await this.generateRoadmap(context, entities);
      
      case 'document_decision':
        return await this.documentDecision(context, entities);
      
      case 'link_story_to_module':
        return await this.linkStoryToModule(context, entities);
      
      case 'estimate_complexity':
        return await this.estimateComplexity(context, entities);

      case 'list_modules':
        return await this.listModules(context, entities);
      
      default:
        return await this.answerArchitectureQuestion(context, entities);
    }
  }

  /**
   * Validar contexto para el intent
   */
  validateContextForIntent(intent, context, entities) {
    const result = { canExecute: true, missingData: [] };

    switch (intent) {
      case 'define_architecture':
        if (!entities.product_ids?.length && !context.products?.length) {
          result.canExecute = false;
          result.missingData.push({
            field: 'product',
            message: '¿Para qué producto quieres definir la arquitectura?'
          });
        }
        break;

      case 'analyze_architecture':
        if (!entities.product_ids?.length && !context.products?.length) {
          result.canExecute = false;
          result.missingData.push({
            field: 'product',
            message: '¿Qué proyecto quieres analizar?'
          });
        }
        break;

      case 'create_module':
        if (!entities.product_ids?.length && !context.products?.length) {
          result.canExecute = false;
          result.missingData.push({
            field: 'product',
            message: '¿A qué proyecto pertenece este módulo?'
          });
        }
        if (!entities.module_name && !entities.keywords?.length) {
          result.canExecute = false;
          result.missingData.push({
            field: 'module',
            message: '¿Cómo se llama el módulo y qué funcionalidad tiene?'
          });
        }
        break;

      case 'link_story_to_module':
        if (!entities.story_ids?.length) {
          result.canExecute = false;
          result.missingData.push({
            field: 'story',
            message: '¿Qué historia quieres vincular?'
          });
        }
        if (!entities.module_id && !entities.module_name) {
          result.canExecute = false;
          result.missingData.push({
            field: 'module',
            message: '¿A qué módulo quieres vincularla?'
          });
        }
        break;
    }

    return result;
  }

  /**
   * Solicitar más información al usuario
   */
  async requestMoreInfo(intent, context, entities, missingData) {
    const questions = missingData.map(d => d.message).join('\n\n');
    
    let intro = '';
    switch (intent) {
      case 'define_architecture':
        intro = '🏗️ Para definir la arquitectura necesito más información:\n\n';
        break;
      case 'create_module':
        intro = '📦 Para crear el módulo necesito saber:\n\n';
        break;
      default:
        intro = 'Necesito algunos datos adicionales:\n\n';
    }

    return {
      success: true,
      response: intro + questions,
      needs_input: true,
      missing_data: missingData.map(d => d.field)
    };
  }

  /**
   * DEFINE ARCHITECTURE
   * Definir arquitectura para un proyecto nuevo
   */
  async defineArchitecture(context, entities) {
    try {
      const productId = entities.product_ids?.[0] || context.products?.[0]?._id;
      
      if (!productId) {
        throw new Error('No se identificó el producto');
      }

      // Verificar si ya existe arquitectura
      const existing = await ArchitectureService.getByProduct(productId);
      
      if (existing.exists) {
        return {
          success: true,
          response: `⚠️ Este producto ya tiene arquitectura definida.\n\n` +
                   `**Tipo**: ${existing.data.project_type}\n` +
                   `**Completitud**: ${existing.data.completeness_score}%\n` +
                   `**Módulos**: ${existing.data.modules?.length || 0}\n\n` +
                   `¿Quieres que la actualice o que te muestre los detalles?`,
          data: existing.data,
          canvas: {
            type: 'architecture',
            data: existing.data
          }
        };
      }

      // Obtener información del producto
      const product = context.products?.[0] || await ProductService.getById(productId);
      
      // Extraer información de la conversación
      const projectInfo = this.extractProjectInfo(entities, context);
      
      // Si no hay suficiente info, hacer preguntas
      if (!projectInfo.hasEnoughInfo) {
        return {
          success: true,
          response: this.generateProjectQuestions(product, projectInfo),
          needs_input: true,
          step: 'gathering_info'
        };
      }

      // Generar arquitectura con AI
      const architectureData = await this.generateArchitectureWithAI(product, projectInfo, context);
      
      // Guardar en base de datos
      const result = await ArchitectureService.create(productId, this.userId, architectureData);

      return {
        success: true,
        response: this.formatArchitectureResponse(result.data),
        data: result.data,
        canvas: {
          type: 'architecture',
          data: result.data
        },
        actions_taken: [{
          action: 'create_architecture',
          product_id: productId,
          architecture_id: result.data._id
        }]
      };

    } catch (error) {
      console.error('ArchitectAgent.defineArchitecture error:', error);
      return {
        success: false,
        response: `❌ Error al definir arquitectura: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Extraer información del proyecto de la conversación
   */
  extractProjectInfo(entities, context) {
    const info = {
      project_type: null,
      scale: null,
      tech_preferences: [],
      expected_users: null,
      integrations: [],
      hasEnoughInfo: false
    };

    // Detectar tipo de proyecto
    const keywords = entities.keywords || [];
    const message = context.original_message?.toLowerCase() || '';

    if (message.includes('web') || message.includes('sitio') || message.includes('página')) {
      info.project_type = 'web_app';
    } else if (message.includes('móvil') || message.includes('mobile') || message.includes('app')) {
      info.project_type = 'mobile_app';
    } else if (message.includes('api') || message.includes('backend') || message.includes('servicio')) {
      info.project_type = 'api_only';
    }

    // Detectar escala
    if (message.includes('pequeño') || message.includes('mvp') || message.includes('prototipo')) {
      info.scale = 'mvp';
    } else if (message.includes('mediano') || message.includes('startup')) {
      info.scale = 'medium';
    } else if (message.includes('grande') || message.includes('enterprise') || message.includes('empresa')) {
      info.scale = 'large';
    }

    // Detectar preferencias tecnológicas
    const techs = ['react', 'vue', 'angular', 'node', 'python', 'django', 'express', 
                   'mongodb', 'postgresql', 'mysql', 'typescript', 'javascript'];
    techs.forEach(tech => {
      if (message.includes(tech)) {
        info.tech_preferences.push(tech);
      }
    });

    // Detectar integraciones
    const integrations = ['stripe', 'paypal', 'firebase', 'aws', 'google', 'facebook', 
                          'sendgrid', 'twilio', 'clerk', 'auth0'];
    integrations.forEach(int => {
      if (message.includes(int)) {
        info.integrations.push(int);
      }
    });

    // Determinar si hay suficiente info
    info.hasEnoughInfo = info.project_type !== null && info.scale !== null;

    return info;
  }

  /**
   * Generar preguntas para obtener más información
   */
  generateProjectQuestions(product, currentInfo) {
    let response = `🏗️ ¡Perfecto! Vamos a definir la arquitectura de **${product.nombre}**.\n\n`;
    response += `Para crear la mejor arquitectura, necesito conocer algunos detalles:\n\n`;

    const questions = [];

    if (!currentInfo.project_type) {
      questions.push(`1. **Tipo de aplicación**: ¿Será una app web, móvil, API, o combinación?`);
    }

    if (!currentInfo.scale) {
      questions.push(`2. **Escala**: ¿Es un MVP/prototipo, proyecto mediano, o sistema enterprise?`);
    }

    if (currentInfo.tech_preferences.length === 0) {
      questions.push(`3. **Tecnologías**: ¿Tienen preferencia por algún stack? (React, Node, Python, etc.)`);
    }

    if (!currentInfo.expected_users) {
      questions.push(`4. **Usuarios**: ¿Cuántos usuarios esperan inicialmente y en 1 año?`);
    }

    response += questions.join('\n\n');
    response += `\n\n💡 Puedes responder todo junto o ir paso a paso.`;

    return response;
  }

  /**
   * Generar arquitectura usando AI
   */
  async generateArchitectureWithAI(product, projectInfo, context) {
    const prompt = `Genera una arquitectura técnica para el siguiente proyecto:

## Proyecto
- **Nombre**: ${product.nombre}
- **Descripción**: ${product.descripcion}
- **Tipo**: ${projectInfo.project_type || 'web_app'}
- **Escala**: ${projectInfo.scale || 'mvp'}
- **Preferencias tecnológicas**: ${projectInfo.tech_preferences.join(', ') || 'Ninguna específica'}
- **Integraciones necesarias**: ${projectInfo.integrations.join(', ') || 'Por definir'}

## Instrucciones
Genera un JSON con la siguiente estructura:
{
  "project_type": "tipo de proyecto",
  "scale": "escala del proyecto",
  "tech_stack": {
    "frontend": { "framework": "", "language": "", "ui_library": "" },
    "backend": { "framework": "", "language": "", "orm": "" },
    "database": { "primary": "" },
    "infrastructure": { "hosting_frontend": "", "hosting_backend": "" }
  },
  "modules": [
    { "name": "", "description": "", "type": "frontend|backend|shared", "status": "planned", "estimated_complexity": "low|medium|high", "features": [] }
  ],
  "architecture_patterns": [
    { "pattern": "", "applied_to": "frontend|backend|all", "description": "" }
  ],
  "integrations": [
    { "name": "", "type": "", "status": "planned" }
  ],
  "technical_roadmap": [
    { "phase": "MVP", "description": "", "modules_included": [], "sprint_count": 0 }
  ],
  "security": {
    "authentication_method": "",
    "authorization_model": ""
  }
}

Responde SOLO con el JSON, sin texto adicional.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'Eres un arquitecto de software experto. Responde solo con JSON válido.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const content = response.choices[0].message.content.trim();
      
      // Limpiar el contenido si tiene markdown
      let jsonContent = content;
      if (content.includes('```')) {
        jsonContent = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }

      const architectureData = JSON.parse(jsonContent);
      
      // Agregar metadatos
      architectureData.project_name = product.nombre;
      architectureData.ai_generated = true;
      architectureData.ai_confidence = 85;
      architectureData.status = 'draft';

      return architectureData;

    } catch (error) {
      console.error('Error generando arquitectura con AI:', error);
      
      // Fallback: usar template predeterminado
      return this.getDefaultArchitecture(product, projectInfo);
    }
  }

  /**
   * Obtener arquitectura por defecto
   */
  getDefaultArchitecture(product, projectInfo) {
    const stackKey = `${projectInfo.project_type || 'web_app'}_${projectInfo.scale === 'large' ? 'large' : projectInfo.scale === 'medium' ? 'medium' : 'small'}`;
    const defaultStack = TECH_STACK_RECOMMENDATIONS[stackKey] || TECH_STACK_RECOMMENDATIONS.web_app_small;

    return {
      project_name: product.nombre,
      project_type: projectInfo.project_type || 'web_app',
      scale: projectInfo.scale || 'mvp',
      tech_stack: {
        frontend: {
          framework: defaultStack.frontend?.framework || 'React',
          language: defaultStack.frontend?.language || 'JavaScript',
          ui_library: defaultStack.frontend?.ui || 'Tailwind CSS'
        },
        backend: {
          framework: defaultStack.backend?.framework || 'Express.js',
          language: defaultStack.backend?.language || 'Node.js',
          orm: defaultStack.backend?.orm || 'Mongoose'
        },
        database: {
          primary: defaultStack.database?.primary || 'MongoDB'
        },
        infrastructure: {
          hosting_frontend: defaultStack.hosting?.frontend || 'Vercel',
          hosting_backend: defaultStack.hosting?.backend || 'Render'
        }
      },
      modules: [
        { ...COMMON_MODULES.auth, status: 'planned' },
        { ...COMMON_MODULES.users, status: 'planned' },
        { ...COMMON_MODULES.dashboard, status: 'planned' }
      ],
      architecture_patterns: [
        { pattern: 'MVC', applied_to: 'backend', description: 'Model-View-Controller para el backend' },
        { pattern: 'Component-Based', applied_to: 'frontend', description: 'Arquitectura basada en componentes React' }
      ],
      technical_roadmap: [
        { 
          phase: 'MVP', 
          description: 'Funcionalidades core del sistema', 
          modules_included: ['Autenticación', 'Gestión de Usuarios', 'Dashboard'],
          status: 'planned',
          sprint_count: 3
        }
      ],
      security: {
        authentication_method: 'JWT',
        authorization_model: 'RBAC'
      },
      ai_generated: true,
      ai_confidence: 70,
      status: 'draft'
    };
  }

  /**
   * Formatear respuesta de arquitectura
   */
  formatArchitectureResponse(architecture) {
    const stack = architecture.tech_stack || {};
    const modules = architecture.modules || [];

    let response = `✅ **Arquitectura definida para ${architecture.project_name}**\n\n`;

    // Stack tecnológico
    response += `## 📦 Stack Tecnológico\n`;
    response += `\`\`\`\n`;
    response += `├── Frontend: ${stack.frontend?.framework || 'Por definir'} + ${stack.frontend?.language || ''}\n`;
    response += `├── Backend: ${stack.backend?.framework || 'Por definir'} + ${stack.backend?.language || ''}\n`;
    response += `├── Database: ${stack.database?.primary || 'Por definir'}\n`;
    response += `└── Hosting: ${stack.infrastructure?.hosting_frontend || 'Por definir'}\n`;
    response += `\`\`\`\n\n`;

    // Módulos
    response += `## 📁 Módulos (${modules.length})\n`;
    modules.forEach((mod, i) => {
      const icon = mod.type === 'frontend' ? '🎨' : mod.type === 'backend' ? '⚙️' : '🔗';
      response += `${icon} **${mod.name}** - ${mod.description || 'Sin descripción'}\n`;
    });
    response += `\n`;

    // Roadmap
    if (architecture.technical_roadmap?.length > 0) {
      response += `## 🗺️ Roadmap\n`;
      architecture.technical_roadmap.forEach(phase => {
        response += `- **${phase.phase}**: ${phase.description} (${phase.sprint_count || '?'} sprints)\n`;
      });
      response += `\n`;
    }

    // Estado
    response += `---\n`;
    response += `📊 **Completitud**: ${architecture.completeness_score || 0}%\n`;
    response += `📝 **Estado**: ${architecture.status}\n`;

    if (architecture.ai_generated) {
      response += `🤖 *Generado por IA con ${architecture.ai_confidence}% de confianza*\n`;
    }

    response += `\n¿Quieres que detalle algún módulo o ajuste la arquitectura?`;

    return response;
  }

  /**
   * ANALYZE ARCHITECTURE
   * Analizar arquitectura existente
   */
  async analyzeArchitecture(context, entities) {
    try {
      const productId = entities.product_ids?.[0] || context.products?.[0]?._id;
      
      if (!productId) {
        throw new Error('No se identificó el producto');
      }

      const result = await ArchitectureService.getByProduct(productId);
      
      if (!result.exists) {
        return {
          success: true,
          response: `⚠️ Este producto no tiene arquitectura definida.\n\n` +
                   `¿Quieres que te ayude a crear una?`,
          needs_architecture: true
        };
      }

      const analysis = await this.generateAnalysisWithAI(result.data);

      return {
        success: true,
        response: analysis,
        data: result.data,
        canvas: {
          type: 'architecture',
          data: result.data
        }
      };

    } catch (error) {
      console.error('ArchitectAgent.analyzeArchitecture error:', error);
      return {
        success: false,
        response: `❌ Error al analizar arquitectura: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Generar análisis con AI
   */
  async generateAnalysisWithAI(architecture) {
    const stats = architecture.stats || ArchitectureService.calculateStats(architecture);

    let response = `## 📊 Análisis de Arquitectura: ${architecture.project_name}\n\n`;

    // Resumen general
    response += `### Resumen\n`;
    response += `- **Tipo**: ${architecture.project_type}\n`;
    response += `- **Escala**: ${architecture.scale}\n`;
    response += `- **Estado**: ${architecture.status}\n`;
    response += `- **Completitud**: ${architecture.completeness_score}%\n\n`;

    // Módulos
    response += `### Módulos (${stats.modules?.total || 0})\n`;
    response += `- ✅ Completados: ${stats.modules?.by_status?.completed || 0}\n`;
    response += `- 🔄 En desarrollo: ${stats.modules?.by_status?.in_development || 0}\n`;
    response += `- 📋 Planificados: ${stats.modules?.by_status?.planned || 0}\n`;
    response += `- ⏱️ Horas estimadas: ${stats.modules?.total_estimated_hours || 0}h\n\n`;

    // Endpoints
    if (stats.endpoints?.total > 0) {
      response += `### API Endpoints (${stats.endpoints.total})\n`;
      response += `- Implementados: ${stats.endpoints.implemented}\n`;
      response += `- Métodos: GET(${stats.endpoints.by_method?.GET || 0}), POST(${stats.endpoints.by_method?.POST || 0}), PUT(${stats.endpoints.by_method?.PUT || 0}), DELETE(${stats.endpoints.by_method?.DELETE || 0})\n\n`;
    }

    // Roadmap
    if (stats.roadmap?.total_phases > 0) {
      response += `### Roadmap\n`;
      response += `- Fases totales: ${stats.roadmap.total_phases}\n`;
      response += `- Fase actual: ${stats.roadmap.current_phase || 'Ninguna activa'}\n`;
      response += `- Completadas: ${stats.roadmap.completed_phases}\n\n`;
    }

    // Recomendaciones
    response += `### 💡 Recomendaciones\n`;
    
    if (architecture.completeness_score < 50) {
      response += `- ⚠️ La arquitectura está incompleta. Considera definir más módulos y endpoints.\n`;
    }
    if (!architecture.security?.authentication_method) {
      response += `- 🔐 Falta definir el método de autenticación.\n`;
    }
    if ((stats.modules?.by_status?.planned || 0) > (stats.modules?.by_status?.completed || 0)) {
      response += `- 📋 Hay más módulos planificados que completados. Prioriza el desarrollo.\n`;
    }

    return response;
  }

  /**
   * SUGGEST TECH STACK
   */
  async suggestTechStack(context, entities) {
    const requirements = entities.keywords?.join(', ') || context.original_message || '';
    
    const prompt = `Basándome en estos requerimientos: "${requirements}"
    
Sugiere el stack tecnológico más apropiado. Considera:
1. Experiencia del equipo
2. Escalabilidad
3. Comunidad y soporte
4. Facilidad de despliegue

Responde con recomendaciones claras y justificadas.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });

      return {
        success: true,
        response: response.choices[0].message.content
      };

    } catch (error) {
      console.error('ArchitectAgent.suggestTechStack error:', error);
      return {
        success: false,
        response: `❌ Error al sugerir stack: ${error.message}`
      };
    }
  }

  /**
   * CREATE MODULE
   */
  async createModule(context, entities) {
    try {
      const productId = entities.product_ids?.[0] || context.products?.[0]?._id;
      
      if (!productId) {
        throw new Error('No se identificó el producto');
      }

      // Verificar que existe arquitectura
      const archResult = await ArchitectureService.getByProduct(productId);
      
      if (!archResult.exists) {
        return {
          success: false,
          response: `⚠️ Este producto no tiene arquitectura definida.\n\nPrimero necesitas definir la arquitectura. ¿Quieres que lo hagamos?`,
          needs_architecture: true
        };
      }

      // Extraer datos del módulo
      const moduleName = entities.module_name || entities.keywords?.[0] || 'Nuevo Módulo';
      const moduleData = await this.generateModuleWithAI(moduleName, context, archResult.data);

      // Guardar módulo
      const result = await ArchitectureService.addModule(productId, this.userId, moduleData);

      return {
        success: true,
        response: `✅ **Módulo creado**: ${moduleData.name}\n\n` +
                 `- **Tipo**: ${moduleData.type}\n` +
                 `- **Complejidad**: ${moduleData.estimated_complexity}\n` +
                 `- **Descripción**: ${moduleData.description}\n\n` +
                 `El módulo ha sido agregado a la arquitectura del proyecto.`,
        data: result.data,
        actions_taken: [{
          action: 'create_module',
          module: result.data
        }]
      };

    } catch (error) {
      console.error('ArchitectAgent.createModule error:', error);
      return {
        success: false,
        response: `❌ Error al crear módulo: ${error.message}`
      };
    }
  }

  /**
   * Generar módulo con AI
   */
  async generateModuleWithAI(moduleName, context, architecture) {
    const prompt = `Genera los detalles para un módulo de software:

Nombre del módulo: ${moduleName}
Contexto: ${context.original_message || ''}
Stack del proyecto: ${architecture.tech_stack?.frontend?.framework || 'React'} + ${architecture.tech_stack?.backend?.framework || 'Express'}

Responde en JSON:
{
  "name": "nombre del módulo",
  "description": "descripción detallada",
  "type": "frontend|backend|shared",
  "status": "planned",
  "estimated_complexity": "low|medium|high",
  "estimated_hours": número,
  "features": ["feature1", "feature2"],
  "dependencies": ["otros módulos si aplica"]
}

Solo responde con el JSON.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'Responde solo con JSON válido.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      let content = response.choices[0].message.content.trim();
      if (content.includes('```')) {
        content = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }

      return JSON.parse(content);

    } catch (error) {
      // Fallback
      return {
        name: moduleName,
        description: `Módulo para ${moduleName}`,
        type: 'backend',
        status: 'planned',
        estimated_complexity: 'medium',
        estimated_hours: 16,
        features: [],
        dependencies: []
      };
    }
  }

  /**
   * LIST MODULES
   */
  async listModules(context, entities) {
    try {
      const productId = entities.product_ids?.[0] || context.products?.[0]?._id;
      
      if (!productId) {
        throw new Error('No se identificó el producto');
      }

      const result = await ArchitectureService.getByProduct(productId);
      
      if (!result.exists) {
        return {
          success: true,
          response: `⚠️ Este producto no tiene arquitectura definida.`
        };
      }

      const modules = result.data.modules || [];

      if (modules.length === 0) {
        return {
          success: true,
          response: `📦 La arquitectura no tiene módulos definidos aún.\n\n¿Quieres que sugiera algunos módulos para el proyecto?`
        };
      }

      return {
        success: true,
        response: `📦 **Módulos de ${result.data.project_name}** (${modules.length})`,
        data: modules,
        canvas: {
          type: 'modules',
          data: modules
        }
      };

    } catch (error) {
      console.error('ArchitectAgent.listModules error:', error);
      return {
        success: false,
        response: `❌ Error al listar módulos: ${error.message}`
      };
    }
  }

  /**
   * GENERATE ROADMAP
   */
  async generateRoadmap(context, entities) {
    try {
      const productId = entities.product_ids?.[0] || context.products?.[0]?._id;
      
      if (!productId) {
        throw new Error('No se identificó el producto');
      }

      const archResult = await ArchitectureService.getByProduct(productId);
      
      if (!archResult.exists) {
        return {
          success: false,
          response: `⚠️ Este producto no tiene arquitectura definida.`
        };
      }

      const roadmap = await this.generateRoadmapWithAI(archResult.data);
      
      // Guardar roadmap
      await ArchitectureService.updateRoadmap(productId, this.userId, roadmap);

      return {
        success: true,
        response: this.formatRoadmapResponse(archResult.data.project_name, roadmap),
        data: roadmap,
        actions_taken: [{
          action: 'update_roadmap',
          phases: roadmap.length
        }]
      };

    } catch (error) {
      console.error('ArchitectAgent.generateRoadmap error:', error);
      return {
        success: false,
        response: `❌ Error al generar roadmap: ${error.message}`
      };
    }
  }

  /**
   * Generar roadmap con AI
   */
  async generateRoadmapWithAI(architecture) {
    const modules = architecture.modules || [];
    
    const prompt = `Genera un roadmap técnico para un proyecto con estos módulos:
${modules.map(m => `- ${m.name}: ${m.description || 'Sin descripción'}`).join('\n')}

El proyecto es de tipo: ${architecture.project_type}
Escala: ${architecture.scale}

Genera 3-4 fases (MVP, v1.0, v2.0, etc.) distribuyendo los módulos lógicamente.

Responde en JSON array:
[
  {
    "phase": "nombre de la fase",
    "name": "nombre descriptivo",
    "description": "descripción de la fase",
    "modules_included": ["módulo1", "módulo2"],
    "features": ["feature1", "feature2"],
    "sprint_count": número estimado de sprints,
    "status": "planned"
  }
]

Solo responde con el JSON.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'Responde solo con JSON válido.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      let content = response.choices[0].message.content.trim();
      if (content.includes('```')) {
        content = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }

      return JSON.parse(content);

    } catch (error) {
      // Fallback
      return [
        {
          phase: 'MVP',
          name: 'Minimum Viable Product',
          description: 'Funcionalidades core del sistema',
          modules_included: modules.slice(0, 3).map(m => m.name),
          sprint_count: 3,
          status: 'planned'
        },
        {
          phase: 'v1.0',
          name: 'Primera versión estable',
          description: 'Funcionalidades completas',
          modules_included: modules.slice(3, 6).map(m => m.name),
          sprint_count: 4,
          status: 'planned'
        }
      ];
    }
  }

  /**
   * Formatear respuesta del roadmap
   */
  formatRoadmapResponse(projectName, roadmap) {
    let response = `## 🗺️ Roadmap Técnico: ${projectName}\n\n`;

    roadmap.forEach((phase, i) => {
      response += `### ${phase.phase}: ${phase.name || ''}\n`;
      response += `${phase.description || ''}\n\n`;
      response += `**Módulos incluidos**:\n`;
      (phase.modules_included || []).forEach(mod => {
        response += `- ${mod}\n`;
      });
      response += `\n**Sprints estimados**: ${phase.sprint_count || '?'}\n\n`;
    });

    response += `---\n`;
    response += `💡 Este roadmap es una guía inicial. Puedes ajustarlo según las prioridades del negocio.`;

    return response;
  }

  /**
   * DOCUMENT DECISION (ADR)
   */
  async documentDecision(context, entities) {
    try {
      const productId = entities.product_ids?.[0] || context.products?.[0]?._id;
      
      if (!productId) {
        throw new Error('No se identificó el producto');
      }

      const decision = {
        title: entities.keywords?.join(' ') || 'Decisión de arquitectura',
        context: context.original_message,
        decision: 'Por definir',
        consequences: 'Por definir',
        status: 'accepted'
      };

      const result = await ArchitectureService.addDecision(productId, this.userId, decision);

      return {
        success: true,
        response: `✅ **Decisión registrada**: ${decision.title}\n\n` +
                 `Esta decisión ha sido documentada en la arquitectura del proyecto.`,
        data: result.data
      };

    } catch (error) {
      console.error('ArchitectAgent.documentDecision error:', error);
      return {
        success: false,
        response: `❌ Error al documentar decisión: ${error.message}`
      };
    }
  }

  /**
   * LINK STORY TO MODULE
   */
  async linkStoryToModule(context, entities) {
    try {
      const productId = entities.product_ids?.[0] || context.products?.[0]?._id;
      const storyId = entities.story_ids?.[0];
      const moduleId = entities.module_id;

      if (!productId || !storyId || !moduleId) {
        throw new Error('Faltan datos: productId, storyId o moduleId');
      }

      const result = await ArchitectureService.linkStoryToModule(
        productId, moduleId, storyId, this.userId
      );

      return {
        success: true,
        response: `✅ Historia vinculada al módulo exitosamente.`,
        data: result
      };

    } catch (error) {
      console.error('ArchitectAgent.linkStoryToModule error:', error);
      return {
        success: false,
        response: `❌ Error al vincular historia: ${error.message}`
      };
    }
  }

  /**
   * UPDATE MODULE
   */
  async updateModule(context, entities) {
    try {
      const productId = entities.product_ids?.[0] || context.products?.[0]?._id;
      const moduleId = entities.module_id;
      const updates = entities.updates || {};

      if (!productId || !moduleId) {
        throw new Error('Faltan datos: productId o moduleId');
      }

      const result = await ArchitectureService.updateModule(
        productId, moduleId, this.userId, updates
      );

      return {
        success: true,
        response: `✅ Módulo actualizado exitosamente.`,
        data: result.data
      };

    } catch (error) {
      console.error('ArchitectAgent.updateModule error:', error);
      return {
        success: false,
        response: `❌ Error al actualizar módulo: ${error.message}`
      };
    }
  }

  /**
   * ESTIMATE COMPLEXITY
   */
  async estimateComplexity(context, entities) {
    const description = entities.keywords?.join(' ') || context.original_message || '';

    const prompt = `Estima la complejidad técnica de implementar lo siguiente:

"${description}"

Considera:
1. Tiempo de desarrollo
2. Riesgos técnicos
3. Dependencias
4. Conocimiento requerido

Responde con:
- Complejidad: Baja/Media/Alta/Muy Alta
- Horas estimadas: X-Y horas
- Justificación breve`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      return {
        success: true,
        response: response.choices[0].message.content
      };

    } catch (error) {
      console.error('ArchitectAgent.estimateComplexity error:', error);
      return {
        success: false,
        response: `❌ Error al estimar complejidad: ${error.message}`
      };
    }
  }

  /**
   * ANSWER ARCHITECTURE QUESTION
   * Responder preguntas generales sobre arquitectura
   */
  async answerArchitectureQuestion(context, entities) {
    const question = context.original_message || entities.keywords?.join(' ') || '';

    // Cargar arquitectura si hay producto
    let architectureContext = '';
    if (entities.product_ids?.length || context.products?.length) {
      const productId = entities.product_ids?.[0] || context.products?.[0]?._id;
      try {
        const result = await ArchitectureService.getByProduct(productId);
        if (result.exists) {
          architectureContext = `\n\nContexto del proyecto actual:
- Tipo: ${result.data.project_type}
- Stack: ${result.data.tech_stack?.frontend?.framework || 'No definido'} + ${result.data.tech_stack?.backend?.framework || 'No definido'}
- Módulos: ${result.data.modules?.length || 0}`;
        }
      } catch (e) {
        // Ignorar errores de carga
      }
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { 
            role: 'system', 
            content: this.systemPrompt.replace('{context}', architectureContext)
          },
          { role: 'user', content: question }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });

      return {
        success: true,
        response: response.choices[0].message.content
      };

    } catch (error) {
      console.error('ArchitectAgent.answerArchitectureQuestion error:', error);
      return {
        success: false,
        response: `❌ Error al responder: ${error.message}`
      };
    }
  }
}

module.exports = ArchitectAgent;
