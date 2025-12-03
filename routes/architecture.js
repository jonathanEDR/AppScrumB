/**
 * Architecture Routes
 * Endpoints para gestión de arquitectura de proyectos
 * 
 * NOTA: Estas validaciones solo aplican a la API REST.
 *       El flujo de creación via chat (scrumAI.js) NO se ve afectado.
 */

const express = require('express');
const router = express.Router();
const ArchitectureService = require('../services/ArchitectureService');
const { authenticate } = require('../middleware/authenticate');

// Importar validaciones de arquitectura
const {
  validateCreate,
  validateUpdate,
  validateTechStack,
  validateModule,
  validateEndpoint,
  validateIntegration,
  validateDecision,
  validateProductId,
  validateModuleId
} = require('../middleware/validation/architectureValidation');

// Todas las rutas requieren autenticación
router.use(authenticate);

// ============================================
// CRUD BÁSICO
// ============================================

/**
 * GET /api/architecture
 * Listar todas las arquitecturas
 */
router.get('/', async (req, res) => {
  try {
    const { status, project_type } = req.query;
    const filters = {};
    
    if (status) filters.status = status;
    if (project_type) filters.project_type = project_type;
    
    const architectures = await ArchitectureService.list(filters);
    
    res.json({
      success: true,
      data: architectures,
      count: architectures.length
    });
  } catch (error) {
    console.error('GET /architecture error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/architecture/product/:productId
 * Obtener arquitectura de un producto
 */
router.get('/product/:productId', validateProductId, async (req, res) => {
  try {
    const { productId } = req.params;
    const result = await ArchitectureService.getByProduct(productId);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('GET /architecture/product/:productId error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/architecture/:id
 * Obtener arquitectura por ID
 */
router.get('/:id', async (req, res) => {
  try {
    const architecture = await ArchitectureService.getById(req.params.id);
    
    res.json({
      success: true,
      data: architecture
    });
  } catch (error) {
    console.error('GET /architecture/:id error:', error);
    res.status(error.message.includes('no encontrada') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/architecture
 * Crear arquitectura para un producto
 */
router.post('/', validateCreate, async (req, res) => {
  try {
    const { productId, ...data } = req.body;
    
    const userId = req.user._id || req.user.id;
    const result = await ArchitectureService.create(productId, userId, data);
    
    res.status(201).json(result);
  } catch (error) {
    console.error('POST /architecture error:', error);
    const status = error.message.includes('Ya existe') ? 409 : 
                   error.message.includes('no encontrado') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/architecture/product/:productId
 * Actualizar arquitectura de un producto
 */
router.put('/product/:productId', validateUpdate, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id || req.user.id;
    
    const result = await ArchitectureService.update(productId, userId, req.body);
    
    res.json(result);
  } catch (error) {
    console.error('PUT /architecture/product/:productId error:', error);
    res.status(error.message.includes('no encontrada') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/architecture/product/:productId
 * Eliminar arquitectura de un producto
 */
router.delete('/product/:productId', validateProductId, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id || req.user.id;
    
    const result = await ArchitectureService.delete(productId, userId);
    
    res.json(result);
  } catch (error) {
    console.error('DELETE /architecture/product/:productId error:', error);
    res.status(error.message.includes('no encontrada') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// TECH STACK
// ============================================

/**
 * PUT /api/architecture/product/:productId/tech-stack
 * Actualizar stack tecnológico
 */
router.put('/product/:productId/tech-stack', validateTechStack, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id || req.user.id;
    
    const result = await ArchitectureService.updateTechStack(productId, userId, req.body);
    
    res.json(result);
  } catch (error) {
    console.error('PUT /architecture/tech-stack error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// MÓDULOS
// ============================================

/**
 * POST /api/architecture/product/:productId/modules
 * Agregar módulo
 */
router.post('/product/:productId/modules', validateModule, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id || req.user.id;
    
    const result = await ArchitectureService.addModule(productId, userId, req.body);
    
    res.status(201).json(result);
  } catch (error) {
    console.error('POST /architecture/modules error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/architecture/product/:productId/modules/:moduleId
 * Actualizar módulo
 */
router.put('/product/:productId/modules/:moduleId', validateProductId, validateModuleId, async (req, res) => {
  try {
    const { productId, moduleId } = req.params;
    const userId = req.user._id || req.user.id;
    
    const result = await ArchitectureService.updateModule(productId, moduleId, userId, req.body);
    
    res.json(result);
  } catch (error) {
    console.error('PUT /architecture/modules/:moduleId error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/architecture/product/:productId/modules/:moduleId
 * Eliminar módulo
 */
router.delete('/product/:productId/modules/:moduleId', validateProductId, validateModuleId, async (req, res) => {
  try {
    const { productId, moduleId } = req.params;
    const userId = req.user._id || req.user.id;
    
    const result = await ArchitectureService.deleteModule(productId, moduleId, userId);
    
    res.json(result);
  } catch (error) {
    console.error('DELETE /architecture/modules/:moduleId error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/architecture/product/:productId/modules/:moduleId/link-story
 * Vincular historia a módulo
 */
router.post('/product/:productId/modules/:moduleId/link-story', validateProductId, validateModuleId, async (req, res) => {
  try {
    const { productId, moduleId } = req.params;
    const { storyId } = req.body;
    const userId = req.user._id || req.user.id;
    
    if (!storyId) {
      return res.status(400).json({
        success: false,
        error: 'storyId es requerido'
      });
    }
    
    const result = await ArchitectureService.linkStoryToModule(productId, moduleId, storyId, userId);
    
    res.json(result);
  } catch (error) {
    console.error('POST /architecture/modules/link-story error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// API ENDPOINTS
// ============================================

/**
 * POST /api/architecture/product/:productId/endpoints
 * Agregar endpoint
 */
router.post('/product/:productId/endpoints', validateEndpoint, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id || req.user.id;
    
    const result = await ArchitectureService.addEndpoint(productId, userId, req.body);
    
    res.status(201).json(result);
  } catch (error) {
    console.error('POST /architecture/endpoints error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/architecture/product/:productId/endpoints
 * Actualizar todos los endpoints
 */
router.put('/product/:productId/endpoints', async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id || req.user.id;
    const { endpoints } = req.body;
    
    const result = await ArchitectureService.updateEndpoints(productId, userId, endpoints);
    
    res.json(result);
  } catch (error) {
    console.error('PUT /architecture/endpoints error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// INTEGRACIONES
// ============================================

/**
 * POST /api/architecture/product/:productId/integrations
 * Agregar integración
 */
router.post('/product/:productId/integrations', validateIntegration, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id || req.user.id;
    
    const result = await ArchitectureService.addIntegration(productId, userId, req.body);
    
    res.status(201).json(result);
  } catch (error) {
    console.error('POST /architecture/integrations error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// DECISIONES DE ARQUITECTURA
// ============================================

/**
 * POST /api/architecture/product/:productId/decisions
 * Agregar decisión de arquitectura
 */
router.post('/product/:productId/decisions', validateDecision, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id || req.user.id;
    
    const result = await ArchitectureService.addDecision(productId, userId, req.body);
    
    res.status(201).json(result);
  } catch (error) {
    console.error('POST /architecture/decisions error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// ROADMAP
// ============================================

/**
 * PUT /api/architecture/product/:productId/roadmap
 * Actualizar roadmap completo
 */
router.put('/product/:productId/roadmap', validateProductId, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id || req.user.id;
    const { phases } = req.body;
    
    const result = await ArchitectureService.updateRoadmap(productId, userId, phases);
    
    res.json(result);
  } catch (error) {
    console.error('PUT /architecture/roadmap error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/architecture/product/:productId/roadmap/:phaseId
 * Actualizar fase específica del roadmap
 */
router.put('/product/:productId/roadmap/:phaseId', validateProductId, async (req, res) => {
  try {
    const { productId, phaseId } = req.params;
    const userId = req.user._id || req.user.id;
    
    const result = await ArchitectureService.updateRoadmapPhase(productId, phaseId, userId, req.body);
    
    res.json(result);
  } catch (error) {
    console.error('PUT /architecture/roadmap/:phaseId error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// NOTA: La gestión de database_schema se ha movido al módulo independiente /api/database-schema
// Ver routes/databaseSchema.js

// ============================================
// UTILIDADES
// ============================================

/**
 * GET /api/architecture/product/:productId/summary
 * Obtener resumen para AI
 */
router.get('/product/:productId/summary', validateProductId, async (req, res) => {
  try {
    const { productId } = req.params;
    const summary = await ArchitectureService.generateAISummary(productId);
    
    res.json({
      success: true,
      ...summary
    });
  } catch (error) {
    console.error('GET /architecture/summary error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/architecture/product/:productId/check
 * Verificar si un producto tiene arquitectura
 */
router.get('/product/:productId/check', validateProductId, async (req, res) => {
  try {
    const { productId } = req.params;
    const hasArchitecture = await ArchitectureService.hasArchitecture(productId);
    
    res.json({
      success: true,
      has_architecture: hasArchitecture
    });
  } catch (error) {
    console.error('GET /architecture/check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/architecture/products-without
 * Obtener productos sin arquitectura definida
 */
router.get('/products-without', async (req, res) => {
  try {
    const products = await ArchitectureService.getProductsWithoutArchitecture();
    
    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    console.error('GET /architecture/products-without error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
