/**
 * Rutas SCRUM AI - Chat directo con soporte para Canvas
 * 
 * REFACTORIZADO: Este archivo ahora importa la lógica de módulos separados:
 * - prompts/scrumAI: Configuración y system prompt
 * - transformers: Funciones de transformación AI -> Mongoose
 * - handlers: Canvas y Architecture handlers
 * 
 * @module ai-agents/routes/scrumAI
 * @version 2.0 - Refactorizado Diciembre 2025
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');

// Middleware
const { authenticate } = require('../../middleware/authenticate');
const { chatRateLimiter } = require('../../middleware/aiRateLimiter');

// Models
const AgentSession = require('../models/AgentSession');
const ProjectArchitecture = require('../../models/ProjectArchitecture');

// ═══════════════════════════════════════════════════════════════════════════
// 📦 MÓDULOS REFACTORIZADOS
// ═══════════════════════════════════════════════════════════════════════════

// Configuración y prompts
const { SCRUM_AI_CONFIG } = require('../prompts/scrumAI');

// Transformadores de datos
const { transformAIArchitectureToModel } = require('../transformers');

// Handlers
const {
  detectCanvasIntent,
  getCanvasData,
  formatDataForAI,
  checkExistingArchitecture,
  getArchitectureSection,
  smartMergeSectionData
} = require('../handlers');

// Servicios
const ArchitectureService = require('../../services/ArchitectureService');

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 CONFIGURACIÓN DE OPENAI
// ═══════════════════════════════════════════════════════════════════════════

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ═══════════════════════════════════════════════════════════════════════════
// 💬 POST /chat - Chat directo con SCRUM AI
// ═══════════════════════════════════════════════════════════════════════════

router.post('/chat', authenticate, chatRateLimiter, async (req, res) => {
  try {
    console.log('📨 [SCRUM AI CHAT] Request received');
    console.log('User:', req.user?.email, '| Role:', req.user?.role);
    console.log('Message:', req.body.message?.substring(0, 100));
    
    const { message, session_id, context } = req.body;
    
    // Validación básica de mensaje
    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.log('❌ [SCRUM AI CHAT] Invalid message');
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere el campo "message" con un texto válido'
      });
    }

    // Validación: Detectar si solicita crear arquitectura sin producto
    const isArchitectureCreateRequest = /cre[aá]r?\s+(una?\s+)?(la\s+)?arquitec|defin[ei]r?\s+(la\s+)?arquitec|arquitec.*cre[aá]|nueva\s+arquitec/i.test(message);
    
    if (isArchitectureCreateRequest && !context?.product_id) {
      console.log('⚠️ [SCRUM AI CHAT] Architecture request without product_id');
      return res.status(400).json({
        status: 'error',
        code: 'PRODUCT_REQUIRED',
        message: 'Para crear una arquitectura, primero debes seleccionar un producto.',
        needs_product_selection: true
      });
    }

    // 1. Cargar o crear sesión
    let session = null;
    let isNewSession = false;

    if (session_id) {
      session = await AgentSession.findOne({
        session_id: session_id,
        user_id: req.user._id
      });
    }

    if (!session) {
      const newSessionId = uuidv4();
      
      session = new AgentSession({
        session_id: newSessionId,
        user_id: req.user._id,
        context: {
          product_id: context?.product_id || null,
          sprint_id: context?.sprint_id || null,
          workspace: 'scrum-ai-chat',
          initial_intent: message.substring(0, 100)
        },
        messages: [],
        status: 'active',
        started_at: new Date()
      });
      
      await session.save({ validateBeforeSave: false });
      isNewSession = true;
    }

    // 2. Detectar intent de canvas
    const canvasIntent = detectCanvasIntent(message);
    console.log('🔍 Canvas intent detected:', canvasIntent);
    
    let canvasData = null;
    let dataContextMessage = '';

    // Si hay intent de canvas, obtener datos reales
    if (canvasIntent) {
      console.log(`📊 Fetching canvas data for type: ${canvasIntent.type}, action: ${canvasIntent.action}`);
      
      if (canvasIntent.type === 'architecture' && canvasIntent.action === 'create') {
        if (!context?.product_id) {
          dataContextMessage = '\n[CONTEXTO]: Usuario quiere crear arquitectura pero no hay producto seleccionado.';
        } else {
          dataContextMessage = `\n[CONTEXTO]: Usuario quiere CREAR la arquitectura para "${context.product_name}".`;
        }
      } else {
        canvasData = await getCanvasData(canvasIntent.type, req.user._id, context || {});
        
        if (canvasData?.data?.length > 0) {
          dataContextMessage = formatDataForAI(canvasIntent.type, canvasData.data);
        } else if (canvasIntent.type === 'architecture' && canvasData) {
          if (!context?.product_id) {
            dataContextMessage = '\n[CONTEXTO]: No hay producto seleccionado.';
          } else {
            dataContextMessage = `\n[CONTEXTO]: El producto NO tiene arquitectura definida. Ofrece crearla.`;
          }
        }
      }
    }
    
    // Agregar contexto del producto
    let contextInfo = '';
    if (context?.product_id && context?.product_name) {
      contextInfo = `\n[PRODUCTO SELECCIONADO]: ${context.product_name} (ID: ${context.product_id})`;
      
      // Si es intent de edición de arquitectura
      if (canvasIntent?.action === 'edit') {
        const existingArch = await checkExistingArchitecture(context.product_id);
        
        if (existingArch.exists) {
          contextInfo += `\n[ARQUITECTURA EXISTENTE]: Sí`;
          contextInfo += `\n[RESUMEN]: ${existingArch.summary.modules} módulos, ${existingArch.summary.tables} tablas, ${existingArch.summary.endpoints} endpoints`;
          
          if (canvasIntent.section) {
            const sectionData = await getArchitectureSection(context.product_id, canvasIntent.section);
            if (sectionData?.data) {
              contextInfo += `\n[SECCIÓN A EDITAR]: ${sectionData.title}`;
              const charLimit = ['database', 'endpoints'].includes(canvasIntent.section) ? 4000 : 2500;
              contextInfo += `\n[DATOS ACTUALES]:\n${JSON.stringify(sectionData.data, null, 2).substring(0, charLimit)}`;
              contextInfo += `\n\n[INSTRUCCIÓN]: Cuando generes JSON usa: {"section": "${sectionData.section}", "data": [...]}`;
            }
          }
        } else {
          contextInfo += `\n[ARQUITECTURA EXISTENTE]: No`;
        }
      }
    }

    // 3. Preparar mensajes para OpenAI
    const userMessageWithContext = `${message}${contextInfo}${dataContextMessage ? `\n\n[DATOS DEL SISTEMA]:\n${dataContextMessage}` : ''}`;

    const messagesForOpenAI = [
      { role: 'system', content: SCRUM_AI_CONFIG.system_prompt },
      ...session.messages.slice(-10).map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content || ''
      })),
      { role: 'user', content: userMessageWithContext }
    ];

    // 4. Llamar a OpenAI
    console.log('🤖 Calling OpenAI...');
    const startTime = Date.now();
    
    const completion = await openai.chat.completions.create({
      model: SCRUM_AI_CONFIG.model,
      messages: messagesForOpenAI,
      temperature: SCRUM_AI_CONFIG.temperature,
      max_tokens: SCRUM_AI_CONFIG.max_tokens
    });

    const executionTime = Date.now() - startTime;
    let response = completion.choices[0].message.content;
    const tokensUsed = completion.usage.total_tokens;
    console.log(`✅ OpenAI response received (${executionTime}ms, ${tokensUsed} tokens)`);

    // 5. Verificar marcadores de canvas
    const canvasMarkerMatch = response.match(/\[CANVAS:(\w+):(\w+)\]/);
    
    if (canvasMarkerMatch) {
      response = response.replace(/\[CANVAS:\w+:\w+\]/g, '').trim();
      
      if (!canvasData) {
        const canvasType = canvasMarkerMatch[1];
        if (canvasType) {
          canvasData = await getCanvasData(canvasType, req.user._id, context || {});
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🏗️ PROCESAMIENTO DE ARQUITECTURA
    // ═══════════════════════════════════════════════════════════════════════
    
    let architectureSaveResult = null;
    
    // Detectar si es actualización de sección
    const isArchitectureUpdateMarker = canvasMarkerMatch && 
      canvasMarkerMatch[1] === 'architecture' && 
      canvasMarkerMatch[2] === 'update';
    const hasUpdateJson = response.includes('```json') && response.includes('"section"');
    const shouldUpdateArchitectureSection = (isArchitectureUpdateMarker || hasUpdateJson) && context?.product_id;
    
    if (shouldUpdateArchitectureSection) {
      architectureSaveResult = await processArchitectureUpdate(response, context, req.user._id);
      if (architectureSaveResult?.saved) {
        canvasData = await getCanvasData('architecture', req.user._id, context || {});
      }
    }

    // Detectar si es creación de arquitectura completa
    const hasArchitectureMarker = canvasMarkerMatch && 
      canvasMarkerMatch[1] === 'architecture' && 
      canvasMarkerMatch[2] === 'create';
    const hasArchitectureJson = response.includes('```json') && 
      response.includes('"tech_stack"') && 
      response.includes('"modules"') &&
      !response.includes('"section"');
    
    const shouldSaveArchitecture = !architectureSaveResult?.saved && 
      canvasIntent?.action !== 'edit' &&
      (hasArchitectureMarker || hasArchitectureJson) && 
      context?.product_id;
    
    if (shouldSaveArchitecture) {
      architectureSaveResult = await processArchitectureCreate(response, context, req.user._id);
      if (architectureSaveResult?.saved) {
        canvasData = await getCanvasData('architecture', req.user._id, context || {});
      }
    }

    // 6. Guardar sesión
    session.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });
    
    session.messages.push({
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      metadata: canvasData ? { has_canvas: true, canvas_type: canvasData.type } : null
    });
    
    session.metrics = session.metrics || {};
    session.metrics.total_tokens = (session.metrics.total_tokens || 0) + tokensUsed;
    session.metrics.total_messages = session.messages.length;
    
    await session.save({ validateBeforeSave: false });

    // 7. Construir respuesta
    const responsePayload = {
      status: 'success',
      response: response,
      session_id: session.session_id,
      conversation_length: session.messages.length,
      is_new_session: isNewSession,
      canvas: canvasData,
      metadata: {
        tokens_used: tokensUsed,
        execution_time_ms: executionTime,
        model: SCRUM_AI_CONFIG.model
      }
    };
    
    if (architectureSaveResult) {
      responsePayload.architecture = architectureSaveResult;
    }
    
    res.json(responsePayload);

  } catch (error) {
    console.error('SCRUM AI chat error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Error en la conversación con SCRUM AI',
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 FUNCIONES AUXILIARES DE ARQUITECTURA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Procesa actualización de sección de arquitectura
 */
async function processArchitectureUpdate(response, context, userId) {
  console.log('✏️ [UPDATE ARCHITECTURE SECTION] Processing...');
  
  try {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) return { saved: false, reason: 'no_json' };
    
    const updateData = JSON.parse(jsonMatch[1].trim());
    const section = updateData.section;
    const sectionData = updateData.data;
    
    if (!section || !sectionData) return { saved: false, reason: 'invalid_data' };
    
    console.log(`   📍 Updating section: ${section}`);
    
    // NOTA: 'database' ahora se maneja en el módulo independiente DatabaseSchema
    // Solo se procesan structure, endpoints y modules en arquitectura
    const sectionFieldMap = {
      'structure': 'directory_structure',
      'endpoints': 'api_endpoints',
      'modules': 'modules'
    };
    
    const dbField = sectionFieldMap[section];
    if (!dbField) {
      if (section === 'database') {
        return { saved: false, reason: 'database_moved_to_independent_module' };
      }
      return { saved: false, reason: 'unknown_section' };
    }
    
    // Obtener datos existentes para merge
    const existingArch = await ProjectArchitecture.findOne({ product: context.product_id }).lean();
    const existingData = existingArch?.[dbField];
    const mergedData = smartMergeSectionData(section, existingData, sectionData);
    
    const updateObj = { [dbField]: mergedData, updated_by: userId };
    
    const updated = await ProjectArchitecture.findOneAndUpdate(
      { product: context.product_id },
      { $set: updateObj },
      { new: true }
    );
    
    if (updated) {
      console.log(`✅ [UPDATE] Section '${section}' updated`);
      return {
        saved: true,
        updated_section: section,
        architecture_id: updated._id,
        message: `Sección '${section}' actualizada exitosamente`
      };
    }
    
    return { saved: false, reason: 'not_found' };
    
  } catch (error) {
    console.error('❌ [UPDATE] Error:', error.message);
    return { saved: false, reason: 'error', error: error.message };
  }
}

/**
 * Procesa creación de arquitectura completa
 */
async function processArchitectureCreate(response, context, userId) {
  console.log('🏗️ [CREATE ARCHITECTURE] Processing...');
  
  try {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      return { saved: false, reason: 'no_json_in_response' };
    }
    
    const architectureData = JSON.parse(jsonMatch[1].trim());
    
    // Validar que es arquitectura completa (no update de sección)
    if (architectureData.section) {
      return { saved: false, reason: 'is_section_update' };
    }
    
    if (!architectureData.name && context.product_name) {
      architectureData.name = `Arquitectura de ${context.product_name}`;
    }
    
    // Transformar datos
    const transformedData = transformAIArchitectureToModel(architectureData, context);
    
    // Guardar
    const existing = await ProjectArchitecture.findOne({ product: context.product_id });
    let savedArchitecture;
    
    if (existing) {
      savedArchitecture = await ArchitectureService.update(
        context.product_id,
        userId,
        transformedData
      );
    } else {
      savedArchitecture = await ArchitectureService.create(
        context.product_id,
        userId,
        transformedData
      );
    }
    
    const savedId = savedArchitecture.data?._id || savedArchitecture._id;
    console.log('✅ [CREATE] Architecture saved:', savedId);
    
    return {
      saved: true,
      architecture_id: savedId,
      message: existing ? 'Arquitectura actualizada' : 'Arquitectura creada'
    };
    
  } catch (error) {
    console.error('❌ [CREATE] Error:', error.message);
    return { saved: false, reason: 'error', error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 📜 GET /conversations - Lista de conversaciones
// ═══════════════════════════════════════════════════════════════════════════

router.get('/conversations', authenticate, async (req, res) => {
  try {
    const sessions = await AgentSession.find({
      user_id: req.user._id,
      status: { $in: ['active', 'completed'] }
    })
    .sort({ updatedAt: -1 })
    .limit(50);

    const conversations = sessions
      .filter(session => session.messages?.length > 0)
      .map(session => {
        const firstUserMessage = session.messages.find(m => m.role === 'user');
        const lastMessage = session.messages[session.messages.length - 1];
        
        const title = firstUserMessage 
          ? firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
          : 'Conversación';

        return {
          id: session.session_id,
          _id: session._id,
          title,
          lastMessage: lastMessage?.content?.substring(0, 100) || '',
          messageCount: session.messages.length,
          status: session.status,
          createdAt: session.started_at || session.createdAt,
          updatedAt: session.updatedAt,
          favorite: session.feedback?.rating >= 4 || false
        };
      });

    res.json(conversations);

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 📄 GET /conversations/:id - Cargar conversación
// ═══════════════════════════════════════════════════════════════════════════

router.get('/conversations/:id', authenticate, async (req, res) => {
  try {
    const session = await AgentSession.findOne({
      session_id: req.params.id,
      user_id: req.user._id
    });

    if (!session) {
      return res.status(404).json({ status: 'error', message: 'Conversación no encontrada' });
    }

    res.json({
      id: session.session_id,
      messages: session.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      })),
      context: session.context,
      createdAt: session.started_at,
      updatedAt: session.updatedAt
    });

  } catch (error) {
    console.error('Get conversation error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ POST /conversations/:id/favorite
// ═══════════════════════════════════════════════════════════════════════════

router.post('/conversations/:id/favorite', authenticate, async (req, res) => {
  try {
    const session = await AgentSession.findOne({
      session_id: req.params.id,
      user_id: req.user._id
    });

    if (!session) {
      return res.status(404).json({ status: 'error', message: 'No encontrada' });
    }

    const newRating = (session.feedback?.rating || 0) >= 4 ? 3 : 5;
    await session.addFeedback(newRating, 'Toggle desde UI');

    res.json({ status: 'success', favorite: newRating >= 4 });

  } catch (error) {
    console.error('Toggle favorite error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 🗑️ DELETE /conversations/:id
// ═══════════════════════════════════════════════════════════════════════════

router.delete('/conversations/:id', authenticate, async (req, res) => {
  try {
    const result = await AgentSession.deleteOne({
      session_id: req.params.id,
      user_id: req.user._id
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ status: 'error', message: 'No encontrada' });
    }

    res.json({ status: 'success', message: 'Eliminada' });

  } catch (error) {
    console.error('Delete conversation error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 GET /canvas - Endpoint directo para canvas
// ═══════════════════════════════════════════════════════════════════════════

router.get('/canvas', authenticate, async (req, res) => {
  try {
    const { type, product_id } = req.query;

    if (!type) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Se requiere el parámetro type' 
      });
    }

    const canvasData = await getCanvasData(type, req.user._id, { product_id });

    if (!canvasData) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'Tipo de canvas no válido' 
      });
    }

    res.json(canvasData);

  } catch (error) {
    console.error('Canvas error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
