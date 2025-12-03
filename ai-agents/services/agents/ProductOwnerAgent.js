/**
 * ProductOwnerAgent - Agente AI especializado en gestión de producto
 * 
 * Capabilities:
 * - create_user_story: Crear historias de usuario bien estructuradas
 * - refine_user_story: Refinar y mejorar historias existentes
 * - generate_acceptance_criteria: Generar criterios de aceptación
 * - prioritize_backlog: Priorizar items del backlog
 * - analyze_backlog: Analizar estado y salud del backlog
 * - analyze_business_value: Analizar valor de negocio
 * - suggest_sprint_goal: Sugerir objetivos de sprint
 * - generate_stakeholder_report: Generar reportes para stakeholders
 */

const OpenAI = require('openai');
const BacklogService = require('../../../services/BacklogService');
const ProductService = require('../../../services/ProductService');
const SprintService = require('../../../services/SprintService');

class ProductOwnerAgent {
  constructor(agent, userId, specialty = null) {
    this.agent = agent;
    this.userId = userId;
    this.specialty = specialty; // Para sistema unificado SCRUM AI
    
    // Inicializar OpenAI
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Configuración del modelo
    this.model = agent.config?.model || agent.configuration?.model || 'gpt-4-turbo-preview';
    this.temperature = agent.config?.temperature || agent.configuration?.temperature || 0.7;
    
    // Max tokens: asegurar que no exceda 4096 para gpt-4-turbo
    const configMaxTokens = agent.config?.max_tokens || agent.configuration?.max_tokens || 2000;
    this.maxTokens = Math.min(configMaxTokens, 4096);
    
    // System prompt: usar specialty prompt si está disponible, sino el del agente
    this.systemPrompt = specialty?.system_prompt || agent.system_prompt || agent.master_prompt;
    
    console.log(`🎯 ProductOwnerAgent inicializado`);
    console.log(`   Modelo: ${this.model}`);
    console.log(`   Max tokens: ${this.maxTokens} (config: ${configMaxTokens})`);
    console.log(`   Especialidad: ${specialty ? `${specialty.icon} ${specialty.name}` : 'Ninguna (agente legacy)'}`);
  }

  /**
   * Ejecuta la capability solicitada
   */
  async execute(intent, context, entities) {
    console.log(`\n🤖 ProductOwnerAgent.execute()`);
    console.log(`Intent: ${intent}`);
    console.log(`Entities:`, entities);

    // 💬 PREGUNTA GENERAL: Responder conversacionalmente sin ejecutar acción
    if (intent === 'general_question' || intent === 'clarification_needed') {
      console.log('💬 Pregunta general - modo conversacional');
      return await this.answerGeneralQuestion(context, entities);
    }

    // VALIDACIÓN: ¿Tenemos suficiente contexto para ejecutar la acción?
    const validation = this.validateContextForIntent(intent, context, entities);
    
    if (!validation.canExecute) {
      console.log('⚠️ Contexto insuficiente - respondiendo conversacionalmente');
      return await this.respondConversationally(intent, context, entities, validation.missingData);
    }

    console.log('✅ Contexto suficiente - ejecutando acción');

    switch (intent) {
      case 'create_user_story':
        return await this.createUserStory(context, entities);
      
      case 'refine_user_story':
        return await this.refineUserStory(context, entities);
      
      case 'generate_acceptance_criteria':
        return await this.generateAcceptanceCriteria(context, entities);
      
      case 'prioritize_backlog':
        return await this.prioritizeBacklog(context, entities);
      
      case 'analyze_backlog':
        return await this.analyzeBacklog(context, entities);
      
      case 'analyze_business_value':
        return await this.analyzeBusinessValue(context, entities);
      
      case 'suggest_sprint_goal':
        return await this.suggestSprintGoal(context, entities);
      
      case 'generate_stakeholder_report':
        return await this.generateStakeholderReport(context, entities);
      
      default:
        throw new Error(`Intent no soportado: ${intent}`);
    }
  }

  /**
   * VALIDAR CONTEXTO
   * Determina si hay suficiente información para ejecutar una acción
   */
  validateContextForIntent(intent, context, entities) {
    const result = {
      canExecute: true,
      missingData: []
    };

    switch (intent) {
      case 'create_user_story':
        // Necesitamos: product_id (o producto seleccionado) y descripción básica
        if (!entities.product_ids?.length && !context.products?.length) {
          result.canExecute = false;
          result.missingData.push({
            field: 'product',
            message: '¿Para qué producto quieres crear la historia?'
          });
        }
        
        // Si no hay descripción en las keywords, necesitamos más info
        if (!entities.keywords || entities.keywords.length < 3) {
          result.canExecute = false;
          result.missingData.push({
            field: 'description',
            message: '¿De qué trata la historia que quieres crear?'
          });
        }
        break;

      case 'refine_user_story':
        // Necesitamos: story_id
        if (!entities.story_ids?.length) {
          result.canExecute = false;
          result.missingData.push({
            field: 'story',
            message: '¿Qué historia quieres refinar? (ID o título)'
          });
        }
        break;

      case 'prioritize_backlog':
        // Necesitamos: product_id o sprint_id
        if (!entities.product_ids?.length && !entities.sprint_ids?.length && !context.products?.length) {
          result.canExecute = false;
          result.missingData.push({
            field: 'scope',
            message: '¿Qué backlog quieres priorizar? (producto o sprint)'
          });
        }
        break;

      // Otros intents pueden ejecutarse conversacionalmente
      default:
        result.canExecute = true;
    }

    return result;
  }

  /**
   * RESPUESTA CONVERSACIONAL
   * Cuando falta contexto, SCRUM AI guía naturalmente al usuario
   */
  async respondConversationally(intent, context, entities, missingData) {
    console.log('💬 Generando respuesta conversacional...');
    
    // Construir prompt para respuesta guiada
    const userMessage = entities.originalMessage || 'El usuario quiere realizar una acción';
    
    const guidancePrompt = `
El usuario dice: "${userMessage}"

Detecté que quiere: ${this.getIntentDescription(intent)}

DATOS FALTANTES:
${missingData.map(d => `- ${d.field}: ${d.message}`).join('\n')}

CONTEXTO ACTUAL:
- Productos disponibles: ${context.products?.length || 0}
- Items en backlog: ${context.backlog_items?.length || 0}
- Sprints activos: ${context.active_sprints?.length || 0}

TU TAREA:
1. Responde de manera natural y amigable
2. Explica brevemente qué necesitas saber
3. Haz preguntas específicas para cada dato faltante
4. Ofrece opciones si hay datos disponibles (ej: "Tienes 3 productos: A, B, C")
5. Mantén un tono profesional pero cercano
6. NO uses formato JSON, responde en texto natural
7. Al final, indica que cuando tengas los datos, podrás ayudar con la acción

EJEMPLO DE BUENA RESPUESTA:
"¡Perfecto! Veo que quieres crear una historia de usuario. Para ayudarte de la mejor manera, necesito saber:

1. **¿Para qué producto?** - Tienes 3 productos activos: Sistema de Ventas, CRM, Portal Web
2. **¿De qué trata la historia?** - Describe brevemente la funcionalidad que necesitas

Una vez que me des estos datos, podré crear una historia completa con título, descripción y criterios de aceptación. 📋✨"

Genera una respuesta similar adaptada a la situación actual.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt() + '\n\nMODO: Conversacional y guiado. NO ejecutes acciones, solo guía al usuario.'
          },
          {
            role: 'user',
            content: guidancePrompt
          }
        ],
        temperature: 0.8, // Más creatividad para respuestas naturales
        max_tokens: 500
      });

      const conversationalResponse = response.choices[0].message.content.trim();

      return {
        success: true,
        response: conversationalResponse,
        needs_more_context: true,
        missing_data: missingData,
        suggested_action: intent
      };

    } catch (error) {
      console.error('❌ Error generando respuesta conversacional:', error);
      
      // Fallback: respuesta predeterminada
      return {
        success: true,
        response: `Entiendo que quieres ${this.getIntentDescription(intent)}. Para ayudarte mejor, necesito:\n\n${missingData.map(d => `• ${d.message}`).join('\n')}\n\nCuando me proporciones estos datos, podré ayudarte con eso. 😊`,
        needs_more_context: true,
        missing_data: missingData,
        suggested_action: intent
      };
    }
  }

  /**
   * Obtiene descripción legible de un intent
   */
  getIntentDescription(intent) {
    const descriptions = {
      'create_user_story': 'crear una historia de usuario',
      'refine_user_story': 'refinar una historia existente',
      'prioritize_backlog': 'priorizar el backlog',
      'analyze_backlog': 'analizar el backlog',
      'generate_acceptance_criteria': 'generar criterios de aceptación',
      'analyze_business_value': 'analizar el valor de negocio',
      'suggest_sprint_goal': 'sugerir un objetivo de sprint',
      'generate_stakeholder_report': 'generar un reporte para stakeholders'
    };
    return descriptions[intent] || intent;
  }

  /**
   * RESPONDER PREGUNTA GENERAL
   * Conversación natural sobre Scrum, metodologías, mejores prácticas
   */
  async answerGeneralQuestion(context, entities) {
    console.log('💬 Respondiendo pregunta general sobre Scrum/Agile...');

    const userQuestion = entities.originalMessage || 'Pregunta general sobre Scrum';

    // Construir contexto del proyecto si está disponible
    let projectContext = '';
    if (context.backlog_stats) {
      projectContext = `\n\nCONTEXTO DE TU PROYECTO:
- Items en backlog: ${context.backlog_stats.total || 0}
- Story points totales: ${context.backlog_stats.total_story_points || 0}
- Productos activos: ${context.products?.length || 0}`;
    }

    const conversationalPrompt = `
El usuario pregunta: "${userQuestion}"

TU ROL: Eres SCRUM AI, un experto en Scrum y Agile con años de experiencia ayudando a equipos.

INSTRUCCIONES:
1. Responde de manera clara, educativa y práctica
2. Usa ejemplos concretos cuando sea posible
3. Si es una pregunta sobre Scrum, explica los conceptos fundamentales
4. Si es sobre mejores prácticas, da consejos accionables
5. Mantén un tono profesional pero amigable
6. Si es relevante, menciona cómo se aplica en su proyecto actual
7. Termina ofreciendo ayuda adicional si la necesitan
8. NO uses formato JSON, responde en texto natural con markdown
9. Usa emojis ocasionalmente para hacer la respuesta más amigable

ESTRUCTURA SUGERIDA:
- Respuesta directa a la pregunta
- Explicación o contexto adicional
- Ejemplo práctico (si aplica)
- Consejo o recomendación
- Oferta de ayuda adicional
${projectContext}

Genera una respuesta educativa y útil.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt() + '\n\nMODO: Conversacional educativo. NO ejecutes acciones, solo enseña y asesora.'
          },
          {
            role: 'user',
            content: conversationalPrompt
          }
        ],
        temperature: 0.8,
        max_tokens: 800 // Más espacio para respuestas educativas
      });

      const answer = response.choices[0].message.content.trim();

      return {
        success: true,
        response: answer,
        type: 'conversational',
        is_educational: true
      };

    } catch (error) {
      console.error('❌ Error respondiendo pregunta general:', error);
      
      // Fallback
      return {
        success: true,
        response: `Como experto en Scrum, puedo ayudarte con esa pregunta. Sin embargo, necesito que me des más detalles o reformules tu pregunta para poder darte una respuesta más precisa. 

¿Podrías ser más específico sobre qué aspecto de Scrum te interesa conocer? 🤔`,
        type: 'conversational',
        is_educational: true
      };
    }
  }

  /**
   * CREATE USER STORY
   * Genera historias de usuario bien estructuradas usando GPT-4
   */
  async createUserStory(context, entities) {
    console.log('\n📝 createUserStory()');
    console.log(`Crear ${entities.count || 1} historias para módulo: ${entities.modules?.join(', ')}`);

    try {
      // 1. Construir prompt con contexto
      const prompt = this.buildCreateStoryPrompt(context, entities);
      
      // 2. Llamar a OpenAI
      console.log('🤖 Llamando a OpenAI GPT-4...');
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        response_format: { type: "json_object" }
      });

      console.log('✅ Respuesta recibida de OpenAI');
      
      // 3. Parsear respuesta
      const aiResponse = JSON.parse(response.choices[0].message.content);
      console.log('📊 Historias generadas:', aiResponse.stories?.length);

      // 4. Guardar historias en DB usando BacklogService
      const savedStories = [];
      const product_id = this.extractProductId(context, entities);

      if (!product_id) {
        throw new Error('No se pudo determinar el product_id');
      }

      for (const story of aiResponse.stories) {
        const storyData = {
          product_id,
          title: story.title,
          description: story.description,
          user_story: story.user_story || story.description,
          acceptance_criteria: story.acceptance_criteria || [],
          priority: story.priority || 'medium',
          story_points: story.story_points || null,
          type: 'user_story',
          state: 'todo',
          tags: entities.modules || [],
          technical_notes: story.technical_notes || ''
        };

        console.log(`💾 Guardando historia: ${story.title}`);
        const saved = await BacklogService.createBacklogItem(this.userId, storyData);
        savedStories.push(saved);
      }

      console.log(`✅ ${savedStories.length} historias guardadas exitosamente`);

      // 5. Retornar resultado
      return {
        success: true,
        message: `He creado ${savedStories.length} historias de usuario para ${entities.modules?.join(', ') || 'el producto'}`,
        stories_created: savedStories.length,
        stories: savedStories.map(s => ({
          id: s._id,
          title: s.title,
          description: s.description,
          priority: s.priority,
          story_points: s.story_points,
          acceptance_criteria_count: s.acceptance_criteria?.length || 0
        })),
        ai_analysis: aiResponse.analysis || null,
        next_steps: [
          'Revisar las historias creadas',
          'Asignar prioridades definitivas',
          'Refinar criterios de aceptación si es necesario',
          'Planificar para próximo sprint'
        ],
        tokens_used: response.usage
      };

    } catch (error) {
      console.error('❌ Error en createUserStory:', error);
      throw new Error(`Error al crear historias: ${error.message}`);
    }
  }

  /**
   * REFINE USER STORY
   * Mejora una historia existente
   */
  async refineUserStory(context, entities) {
    console.log('\n✨ refineUserStory()');

    try {
      // 1. Obtener story_id de entities
      const storyIds = entities.story_ids || [];
      if (storyIds.length === 0) {
        throw new Error('No se especificó qué historia refinar');
      }

      const storyId = storyIds[0];
      console.log(`Refinando historia: ${storyId}`);

      // 2. Cargar historia actual del backlog
      const currentStory = context.backlog?.find(item => 
        item._id.toString() === storyId || item.title.includes(storyId)
      );

      if (!currentStory) {
        throw new Error(`No se encontró la historia ${storyId}`);
      }

      // 3. Construir prompt
      const prompt = `
Refina y mejora la siguiente historia de usuario:

**Historia Actual:**
Título: ${currentStory.title}
Descripción: ${currentStory.description}
Criterios de Aceptación: ${JSON.stringify(currentStory.acceptance_criteria || [])}
Prioridad: ${currentStory.priority}
Story Points: ${currentStory.story_points || 'No estimado'}

**Contexto del Producto:**
${context.context_summary || 'No disponible'}

**Mejoras solicitadas:**
- Asegurar que siga el formato "Como [usuario], quiero [acción], para [beneficio]"
- Mejorar claridad y concisión
- Completar/mejorar criterios de aceptación
- Identificar dependencias o riesgos
- Sugerir story points si no tiene

Retorna JSON:
{
  "refined_story": {
    "title": "Título mejorado",
    "description": "Descripción refinada",
    "user_story": "Como... quiero... para...",
    "acceptance_criteria": ["AC1", "AC2", "AC3"],
    "story_points": 5,
    "technical_notes": "Notas técnicas o dependencias"
  },
  "improvements_made": ["Mejora 1", "Mejora 2"],
  "suggestions": ["Sugerencia 1", "Sugerencia 2"]
}
      `;

      // 4. Llamar a OpenAI
      console.log('🤖 Llamando a OpenAI para refinamiento...');
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: "json_object" }
      });

      const aiResponse = JSON.parse(response.choices[0].message.content);
      console.log('✅ Refinamiento completado');

      // 5. Actualizar historia en DB
      const updates = {
        title: aiResponse.refined_story.title,
        description: aiResponse.refined_story.description,
        user_story: aiResponse.refined_story.user_story,
        acceptance_criteria: aiResponse.refined_story.acceptance_criteria,
        story_points: aiResponse.refined_story.story_points,
        technical_notes: aiResponse.refined_story.technical_notes
      };

      console.log(`💾 Actualizando historia ${storyId}...`);
      const updated = await BacklogService.updateBacklogItem(
        this.userId,
        currentStory._id,
        updates
      );

      console.log('✅ Historia actualizada exitosamente');

      return {
        success: true,
        message: `He refinado la historia "${currentStory.title}"`,
        story_id: updated._id,
        improvements_made: aiResponse.improvements_made,
        suggestions: aiResponse.suggestions,
        updated_story: {
          id: updated._id,
          title: updated.title,
          description: updated.description,
          story_points: updated.story_points,
          acceptance_criteria_count: updated.acceptance_criteria?.length || 0
        },
        tokens_used: response.usage
      };

    } catch (error) {
      console.error('❌ Error en refineUserStory:', error);
      throw new Error(`Error al refinar historia: ${error.message}`);
    }
  }

  /**
   * GENERATE ACCEPTANCE CRITERIA
   * Genera criterios de aceptación en formato Gherkin
   */
  async generateAcceptanceCriteria(context, entities) {
    console.log('\n📋 generateAcceptanceCriteria()');

    try {
      const storyIds = entities.story_ids || [];
      if (storyIds.length === 0) {
        throw new Error('No se especificó para qué historia generar criterios');
      }

      const storyId = storyIds[0];
      const currentStory = context.backlog?.find(item => 
        item._id.toString() === storyId || item.title.includes(storyId)
      );

      if (!currentStory) {
        throw new Error(`No se encontró la historia ${storyId}`);
      }

      // Construir prompt
      const prompt = `
Genera criterios de aceptación detallados en formato Gherkin para:

**Historia:**
${currentStory.title}
${currentStory.description}

**Formato requerido:**
Dado que [contexto inicial]
Cuando [acción del usuario]
Entonces [resultado esperado]

Genera entre 3-5 criterios que cubran:
- Flujo principal (happy path)
- Casos límite (edge cases)
- Validaciones de datos
- Manejo de errores

Retorna JSON:
{
  "acceptance_criteria": [
    "Dado que... Cuando... Entonces...",
    "Dado que... Cuando... Entonces..."
  ],
  "coverage": {
    "happy_path": true,
    "edge_cases": true,
    "validations": true,
    "error_handling": true
  }
}
      `;

      console.log('🤖 Generando criterios con OpenAI...');
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: prompt }
        ],
        temperature: 0.6,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      const aiResponse = JSON.parse(response.choices[0].message.content);

      // Actualizar historia con nuevos criterios
      const updated = await BacklogService.updateBacklogItem(
        this.userId,
        currentStory._id,
        { acceptance_criteria: aiResponse.acceptance_criteria }
      );

      return {
        success: true,
        message: `He generado ${aiResponse.acceptance_criteria.length} criterios de aceptación`,
        story_id: updated._id,
        acceptance_criteria: aiResponse.acceptance_criteria,
        coverage: aiResponse.coverage,
        tokens_used: response.usage
      };

    } catch (error) {
      console.error('❌ Error en generateAcceptanceCriteria:', error);
      throw new Error(`Error al generar criterios: ${error.message}`);
    }
  }

  /**
   * PRIORITIZE BACKLOG
   * Re-prioriza todo el backlog basándose en valor de negocio
   */
  async prioritizeBacklog(context, entities) {
    console.log('\n🎯 prioritizeBacklog()');

    try {
      // Obtener backlog actual
      const backlog = context.backlog || [];
      
      if (backlog.length === 0) {
        return {
          success: true,
          message: 'No hay items en el backlog para priorizar',
          changes_made: 0
        };
      }

      // Construir prompt con contexto
      const prompt = `
Analiza y prioriza el siguiente backlog basándote en:
- Valor de negocio
- Dependencias técnicas
- Riesgo
- Esfuerzo estimado

**Backlog Actual (${backlog.length} items):**
${backlog.map((item, idx) => `
${idx + 1}. ${item.title}
   Prioridad actual: ${item.priority}
   Story points: ${item.story_points || 'No estimado'}
   Estado: ${item.state}
   Descripción: ${item.description?.substring(0, 100)}...
`).join('\n')}

**Estadísticas:**
${JSON.stringify(context.backlog_stats, null, 2)}

**Capacidad del Equipo:**
Velocidad promedio: ${context.team_capacity?.velocity_avg || 'Desconocida'}
Tamaño del equipo: ${context.team_capacity?.team_size || 'Desconocido'}

Retorna JSON con análisis y prioridades sugeridas:
{
  "analysis": "Análisis general del backlog",
  "prioritization": [
    {
      "story_id": "id_de_la_historia",
      "suggested_priority": "high|medium|low",
      "reason": "Razón de la prioridad",
      "recommended_order": 1
    }
  ],
  "insights": ["Insight 1", "Insight 2"]
}
      `;

      console.log('🤖 Analizando backlog con OpenAI...');
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      });

      const aiResponse = JSON.parse(response.choices[0].message.content);

      // Aplicar cambios de prioridad
      let changesCount = 0;
      const updates = [];

      for (const prioritization of aiResponse.prioritization) {
        const story = backlog.find(item => 
          item._id.toString() === prioritization.story_id ||
          item.title.includes(prioritization.story_id)
        );

        if (story && story.priority !== prioritization.suggested_priority) {
          await BacklogService.updateBacklogItem(
            this.userId,
            story._id,
            { 
              priority: prioritization.suggested_priority,
              order: prioritization.recommended_order
            }
          );
          
          changesCount++;
          updates.push({
            story: story.title,
            old_priority: story.priority,
            new_priority: prioritization.suggested_priority,
            reason: prioritization.reason
          });
        }
      }

      console.log(`✅ ${changesCount} historias re-priorizadas`);

      return {
        success: true,
        message: `He re-priorizado tu backlog. ${changesCount} cambios realizados`,
        changes_made: changesCount,
        updates,
        analysis: aiResponse.analysis,
        insights: aiResponse.insights,
        tokens_used: response.usage
      };

    } catch (error) {
      console.error('❌ Error en prioritizeBacklog:', error);
      throw new Error(`Error al priorizar backlog: ${error.message}`);
    }
  }

  /**
   * ANALYZE BACKLOG
   * Analiza la salud y estado del backlog
   */
  async analyzeBacklog(context, entities) {
    console.log('\n📊 analyzeBacklog()');

    try {
      const prompt = `
Analiza la salud del siguiente backlog:

**Estadísticas:**
${JSON.stringify(context.backlog_stats, null, 2)}

**Capacidad del Equipo:**
${JSON.stringify(context.team_capacity, null, 2)}

**Items Recientes:**
${context.backlog?.slice(0, 10).map(item => `
- ${item.title} (${item.priority}, ${item.story_points || '?'} pts, ${item.state})
`).join('\n')}

Evalúa:
1. Balance de prioridades
2. Cobertura de estimaciones
3. Distribución por tipo
4. Riesgo de bottlenecks
5. Alineación con capacidad del equipo

Retorna JSON:
{
  "health_score": 85,
  "strengths": ["Fortaleza 1", "Fortaleza 2"],
  "concerns": ["Preocupación 1", "Preocupación 2"],
  "recommendations": ["Recomendación 1", "Recomendación 2"],
  "metrics": {
    "priority_balance": "good|warning|poor",
    "estimation_coverage": 0.75,
    "type_distribution": "balanced|unbalanced"
  }
}
      `;

      console.log('🤖 Analizando con OpenAI...');
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 1500,
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(response.choices[0].message.content);

      return {
        success: true,
        message: `Análisis de backlog completado. Health Score: ${analysis.health_score}/100`,
        health_score: analysis.health_score,
        strengths: analysis.strengths,
        concerns: analysis.concerns,
        recommendations: analysis.recommendations,
        metrics: analysis.metrics,
        tokens_used: response.usage
      };

    } catch (error) {
      console.error('❌ Error en analyzeBacklog:', error);
      throw new Error(`Error al analizar backlog: ${error.message}`);
    }
  }

  /**
   * Otros métodos auxiliares
   */

  async analyzeBusinessValue(context, entities) {
    // TODO: Implementar análisis de valor de negocio
    return {
      success: true,
      message: 'Análisis de valor de negocio (próximamente)',
      note: 'Esta capability será implementada en siguiente iteración'
    };
  }

  async suggestSprintGoal(context, entities) {
    // TODO: Implementar sugerencia de objetivo de sprint
    return {
      success: true,
      message: 'Sugerencia de objetivo de sprint (próximamente)',
      note: 'Esta capability será implementada en siguiente iteración'
    };
  }

  async generateStakeholderReport(context, entities) {
    // TODO: Implementar generación de reportes
    return {
      success: true,
      message: 'Generación de reportes (próximamente)',
      note: 'Esta capability será implementada en siguiente iteración'
    };
  }

  /**
   * System prompt para OpenAI
   * Si es sistema unificado (SCRUM AI), usa el prompt de la especialidad
   */
  getSystemPrompt() {
    // Si hay especialidad (sistema unificado), usar su prompt
    if (this.systemPrompt) {
      return this.systemPrompt;
    }
    
    // Fallback: prompt legacy de Product Owner
    return `Eres un Product Owner experto en metodologías ágiles y gestión de producto.

Tu rol es ayudar a equipos de desarrollo a:
- Crear historias de usuario claras y bien estructuradas
- Priorizar el backlog basándote en valor de negocio
- Generar criterios de aceptación específicos y testeables
- Analizar la salud del backlog
- Optimizar el flujo de trabajo del equipo

Principios:
1. Historias en formato: "Como [usuario], quiero [acción], para [beneficio]"
2. Criterios de aceptación en formato Gherkin: Dado/Cuando/Entonces
3. Priorización basada en: valor, riesgo, dependencias, esfuerzo
4. Estimaciones en escala Fibonacci (1, 2, 3, 5, 8, 13, 21)
5. Foco en entregar valor incremental

Siempre retorna respuestas en formato JSON válido y estructurado.`;
  }

  /**
   * Construye el prompt para crear historias
   */
  buildCreateStoryPrompt(context, entities) {
    const count = entities.count || 1;
    const modules = entities.modules?.join(', ') || 'el producto';
    const keywords = entities.keywords?.join(', ') || '';

    return `
Crea ${count} historias de usuario para el módulo: ${modules}

**Contexto del Producto:**
${context.context_summary || 'No disponible'}

**Backlog Actual:**
${context.backlog_stats ? JSON.stringify(context.backlog_stats, null, 2) : 'Sin items previos'}

**Estándares del Equipo:**
- Formato: ${context.team_standards?.story_format || 'Como [usuario], quiero [acción], para [beneficio]'}
- Escala de estimación: ${context.team_standards?.estimation_scale || 'Fibonacci'}
- DoD: ${context.team_standards?.definition_of_done?.join(', ') || 'Estándar'}

**Capacidad del Equipo:**
- Velocidad promedio: ${context.team_capacity?.velocity_avg || 'Desconocida'} pts/sprint
- Tendencia: ${context.team_capacity?.velocity_trend || 'stable'}

${keywords ? `**Keywords relevantes:** ${keywords}` : ''}

Genera historias que:
1. Sigan el formato del equipo
2. Tengan títulos descriptivos y concisos
3. Incluyan 3-5 criterios de aceptación cada una
4. Estén estimadas con story points
5. Consideren dependencias técnicas

Retorna JSON:
{
  "stories": [
    {
      "title": "Título corto y descriptivo",
      "description": "Como [usuario], quiero [acción], para [beneficio]",
      "user_story": "Descripción detallada de la historia",
      "acceptance_criteria": [
        "Dado que... Cuando... Entonces...",
        "Dado que... Cuando... Entonces..."
      ],
      "story_points": 5,
      "priority": "high|medium|low",
      "technical_notes": "Notas técnicas o dependencias si aplican"
    }
  ],
  "analysis": "Breve análisis de las historias generadas y cómo se alinean con el producto"
}
    `;
  }

  /**
   * Extrae product_id del contexto o entities
   */
  extractProductId(context, entities) {
    // Prioridad 1: product_id en entities
    if (entities.product_ids && entities.product_ids.length > 0) {
      return entities.product_ids[0];
    }

    // Prioridad 2: product_id en context
    if (context.product_id) {
      return context.product_id;
    }

    // Prioridad 3: Primer producto en context.products
    if (context.products && context.products.length > 0) {
      return context.products[0]._id;
    }

    return null;
  }
}

module.exports = ProductOwnerAgent;
