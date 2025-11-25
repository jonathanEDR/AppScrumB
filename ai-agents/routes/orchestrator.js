/**
 * Rutas del Orquestador - API unificada para interactuar con agentes AI
 * Endpoints principales: /execute y /chat
 */

const express = require('express');
const router = express.Router();
const OrchestratorService = require('../services/OrchestratorService');
const QueueService = require('../services/QueueService');
const contextCache = require('../services/ContextCache');
const { authenticate } = require('../../middleware/authenticate');
const { aiRateLimiter, dailyAIRateLimiter, chatRateLimiter } = require('../../middleware/aiRateLimiter');

/**
 * POST /api/ai-agents/orchestrator/execute
 * Ejecuta una tarea coordinada por el orquestador
 * 
 * Body:
 * {
 *   "input": "Necesito crear 3 historias para el módulo de reportes",
 *   "context": {
 *     "product_id": "67890",
 *     "sprint_id": "12345" // opcional
 *   }
 * }
 */
router.post('/execute', authenticate, aiRateLimiter, dailyAIRateLimiter, async (req, res) => {
  try {
    console.log('\n=== POST /orchestrator/execute ===');
    console.log('User:', req.user._id);
    console.log('Body:', req.body);

    const { input, context } = req.body;
    
    // Validación
    if (!input || typeof input !== 'string' || input.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere el campo "input" con un texto válido'
      });
    }

    // Ejecutar orquestador
    const result = await OrchestratorService.execute(
      req.user._id,
      input,
      context || {},
      req.user
    );

    // Determinar código de respuesta
    let statusCode = 200;
    if (result.status === 'error') {
      statusCode = 500;
    } else if (result.status === 'no_agent_available') {
      statusCode = 403;
    } else if (result.status === 'needs_clarification') {
      statusCode = 200; // No es un error, solo necesita más info
    }

    res.status(statusCode).json(result);

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
 * POST /api/ai-agents/orchestrator/execute-async
 * Ejecuta una tarea de forma asíncrona (en cola)
 * Útil para operaciones largas o cuando no necesitas respuesta inmediata
 * 
 * Body:
 * {
 *   "input": "Analizar todo el backlog y generar reporte completo",
 *   "context": { "product_id": "..." },
 *   "priority": "high" // opcional: high, normal, low (default: normal)
 * }
 * 
 * Retorna job_id para consultar estado después
 */
router.post('/execute-async', authenticate, aiRateLimiter, dailyAIRateLimiter, async (req, res) => {
  try {
    console.log('\n=== POST /orchestrator/execute-async ===');
    const { input, context, priority } = req.body;
    
    if (!input || typeof input !== 'string' || input.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere el campo "input" con un texto válido'
      });
    }

    // Encolar tarea
    const queueResult = await QueueService.enqueueTask(
      req.user._id,
      input,
      context || {},
      req.user,
      priority || 'normal'
    );

    res.status(202).json({
      status: 'queued',
      ...queueResult,
      message: 'Tarea encolada correctamente',
      check_status_url: `/api/ai-agents/orchestrator/status/${queueResult.job_id}`
    });

  } catch (error) {
    console.error('Orchestrator execute-async error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al encolar la tarea',
      error: error.message
    });
  }
});

/**
 * GET /api/ai-agents/orchestrator/status/:job_id
 * Consulta el estado de una tarea asíncrona
 */
router.get('/status/:job_id', authenticate, async (req, res) => {
  try {
    const { job_id } = req.params;
    
    const status = await QueueService.getTaskStatus(job_id);
    
    if (status.status === 'not_found') {
      return res.status(404).json(status);
    }

    res.json({
      status: 'success',
      task: status
    });

  } catch (error) {
    console.error('Orchestrator status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al consultar estado',
      error: error.message
    });
  }
});

/**
 * DELETE /api/ai-agents/orchestrator/tasks/:job_id
 * Cancela una tarea en cola
 */
router.delete('/tasks/:job_id', authenticate, async (req, res) => {
  try {
    const { job_id } = req.params;
    
    const result = await QueueService.cancelTask(job_id, req.user._id.toString());
    
    if (result.status === 'not_found') {
      return res.status(404).json(result);
    }
    if (result.status === 'forbidden') {
      return res.status(403).json(result);
    }
    if (result.status === 'error') {
      return res.status(400).json(result);
    }

    res.json(result);

  } catch (error) {
    console.error('Orchestrator cancel error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al cancelar tarea',
      error: error.message
    });
  }
});

/**
 * GET /api/ai-agents/orchestrator/queue/stats
 * Obtiene estadísticas de la cola
 */
router.get('/queue/stats', authenticate, async (req, res) => {
  try {
    const stats = await QueueService.getQueueStats();
    
    res.json({
      status: 'success',
      queue_stats: stats
    });

  } catch (error) {
    console.error('Queue stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
});

/**
 * POST /api/ai-agents/orchestrator/chat
 * Conversación natural con el orquestador
 * Mantiene historial de conversación mediante session_id
 * 
 * Body:
 * {
 *   "message": "Hola, necesito ayuda con mi backlog",
 *   "session_id": "abc123" // opcional, para continuar conversación
 *   "context": {
 *     "product_id": "67890"
 *   }
 * }
 */
router.post('/chat', authenticate, chatRateLimiter, async (req, res) => {
  try {
    console.log('\n=== POST /orchestrator/chat ===');
    console.log('User:', req.user._id);
    console.log('Body:', req.body);

    const { message, session_id, context } = req.body;
    
    // Validación
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere el campo "message" con un texto válido'
      });
    }

    // Ejecutar chat
    const result = await OrchestratorService.chat(
      req.user._id,
      message,
      session_id || null,
      context || {},
      req.user
    );

    // Determinar código de respuesta
    let statusCode = 200;
    if (result.status === 'error') {
      statusCode = 500;
    } else if (result.status === 'no_agent_available') {
      statusCode = 403;
    }

    res.status(statusCode).json(result);

  } catch (error) {
    console.error('Orchestrator chat error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error en la conversación',
      error: error.message
    });
  }
});

/**
 * GET /api/ai-agents/orchestrator/suggestions
 * Obtiene sugerencias de acciones disponibles
 * 
 * Query params:
 * - product_id: ID del producto actual (opcional)
 * - sprint_id: ID del sprint actual (opcional)
 */
router.get('/suggestions', authenticate, async (req, res) => {
  try {
    console.log('\n=== GET /orchestrator/suggestions ===');
    console.log('User:', req.user._id);
    console.log('Query:', req.query);

    const context = {
      product_id: req.query.product_id,
      sprint_id: req.query.sprint_id
    };

    const result = await OrchestratorService.getSuggestions(
      req.user._id,
      context
    );

    res.json(result);

  } catch (error) {
    console.error('Orchestrator suggestions error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener sugerencias',
      error: error.message
    });
  }
});

/**
 * GET /api/ai-agents/orchestrator/health
 * Health check del orquestador
 */
router.get('/health', authenticate, async (req, res) => {
  try {
    const Agent = require('../models/Agent');
    const AgentDelegation = require('../models/AgentDelegation');

    const [totalAgents, activeAgents, userDelegations] = await Promise.all([
      Agent.countDocuments({}),
      Agent.countDocuments({ status: 'active' }),
      AgentDelegation.countDocuments({ 
        user_id: req.user._id, 
        status: 'active' 
      })
    ]);

    res.json({
      status: 'healthy',
      orchestrator_version: '2.0.0',
      components: {
        intent_classifier: 'ready',
        context_builder: 'ready',
        agent_selector: 'ready',
        orchestrator_service: 'ready'
      },
      statistics: {
        total_agents: totalAgents,
        active_agents: activeAgents,
        user_delegations: userDelegations
      },
      capabilities: [
        'intent_classification',
        'context_building',
        'agent_selection',
        'task_execution',
        'conversation_management'
      ],
      phase: 'FASE 2 - Orquestador Principal',
      note: 'FASE 3 implementará ejecución real con AI'
    });

  } catch (error) {
    console.error('Orchestrator health error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * GET /api/ai-agents/orchestrator/cache/stats
 * Obtiene estadísticas del cache de contexto
 */
router.get('/cache/stats', authenticate, async (req, res) => {
  try {
    const stats = contextCache.getStats();
    
    res.json({
      status: 'success',
      cache_stats: stats,
      recommendations: {
        hit_rate_optimal: '> 60%',
        current_performance: stats.hit_rate >= '60%' ? 'optimal' : 'suboptimal',
        suggestion: stats.hit_rate < '60%' ? 'Consider increasing cache TTL' : 'Cache performing well'
      }
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * POST /api/ai-agents/orchestrator/cache/invalidate
 * Invalida el cache de un producto específico o todo el cache
 * 
 * Body:
 * {
 *   "product_id": "688e4f88e8620a705fbebd6a" // opcional, si no se provee invalida todo
 * }
 */
router.post('/cache/invalidate', authenticate, async (req, res) => {
  try {
    const { product_id } = req.body;
    
    let result;
    if (product_id) {
      const deleted = await contextCache.invalidateProduct(product_id);
      result = {
        action: 'product_cache_invalidated',
        product_id,
        entries_deleted: deleted
      };
    } else {
      const deleted = await contextCache.invalidateAll();
      result = {
        action: 'all_cache_invalidated',
        entries_deleted: deleted
      };
    }
    
    res.json({
      status: 'success',
      ...result
    });
  } catch (error) {
    console.error('Cache invalidate error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;
