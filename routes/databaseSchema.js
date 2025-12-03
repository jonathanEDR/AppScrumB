/**
 * Database Schema Routes
 * Endpoints para gestión de esquemas de base de datos
 * 
 * Módulo independiente para importar, visualizar y gestionar
 * estructuras de base de datos por producto
 * 
 * @module routes/databaseSchema
 */

const express = require('express');
const router = express.Router();
const DatabaseSchemaService = require('../services/DatabaseSchemaService');
const { authenticate } = require('../middleware/authenticate');

// Todas las rutas requieren autenticación
router.use(authenticate);

// ============================================
// VALIDACIONES
// ============================================

/**
 * Validar productId
 */
const validateProductId = (req, res, next) => {
  const { productId } = req.params;
  
  if (!productId || productId.length !== 24) {
    return res.status(400).json({
      success: false,
      error: 'productId inválido'
    });
  }
  
  next();
};

/**
 * Validar entityName
 */
const validateEntityName = (req, res, next) => {
  const { entityName } = req.params;
  
  if (!entityName || entityName.length < 1) {
    return res.status(400).json({
      success: false,
      error: 'entityName es requerido'
    });
  }
  
  next();
};

// ============================================
// CRUD BÁSICO
// ============================================

/**
 * GET /api/database-schema/product/:productId
 * Obtener esquema de base de datos de un producto
 */
router.get('/product/:productId', validateProductId, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id || req.user.id;
    
    const result = await DatabaseSchemaService.getOrCreate(productId, userId);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('GET /database-schema/product/:productId error:', error);
    res.status(error.message.includes('no encontrado') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/database-schema/product/:productId
 * Actualizar información general del esquema
 */
router.put('/product/:productId', validateProductId, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id || req.user.id;
    
    const result = await DatabaseSchemaService.update(productId, userId, req.body);
    
    res.json(result);
  } catch (error) {
    console.error('PUT /database-schema/product/:productId error:', error);
    res.status(error.message.includes('no encontrado') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// IMPORTACIÓN DE CÓDIGO
// ============================================

/**
 * POST /api/database-schema/product/:productId/import
 * Importar una entidad desde código fuente
 * 
 * Body:
 * {
 *   code: "const mongoose = require('mongoose')...",
 *   orm_type: "mongoose" (opcional),
 *   overwrite: true (opcional)
 * }
 */
router.post('/product/:productId/import', validateProductId, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id || req.user.id;
    const { code, orm_type, overwrite } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'El código fuente es requerido'
      });
    }
    
    const result = await DatabaseSchemaService.importFromCode(productId, userId, code, {
      orm_type,
      overwrite
    });
    
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('POST /database-schema/import error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/database-schema/product/:productId/import-bulk
 * Importar múltiples entidades desde código fuente
 * 
 * Body:
 * {
 *   codes: ["code1...", "code2..."],
 *   orm_type: "mongoose" (opcional),
 *   overwrite: true (opcional)
 * }
 */
router.post('/product/:productId/import-bulk', validateProductId, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id || req.user.id;
    const { codes, orm_type, overwrite } = req.body;
    
    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de códigos fuente'
      });
    }
    
    const result = await DatabaseSchemaService.importMultipleFromCode(productId, userId, codes, {
      orm_type,
      overwrite
    });
    
    res.json(result);
  } catch (error) {
    console.error('POST /database-schema/import-bulk error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// GESTIÓN DE ENTIDADES
// ============================================

/**
 * GET /api/database-schema/product/:productId/entities
 * Listar todas las entidades de un producto
 */
router.get('/product/:productId/entities', validateProductId, async (req, res) => {
  try {
    const { productId } = req.params;
    
    const result = await DatabaseSchemaService.listEntities(productId);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('GET /database-schema/entities error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/database-schema/product/:productId/entity/:entityName
 * Obtener una entidad específica
 */
router.get('/product/:productId/entity/:entityName', validateProductId, validateEntityName, async (req, res) => {
  try {
    const { productId, entityName } = req.params;
    
    const result = await DatabaseSchemaService.getEntity(productId, entityName);
    
    res.json(result);
  } catch (error) {
    console.error('GET /database-schema/entity/:entityName error:', error);
    res.status(error.message.includes('no encontrad') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/database-schema/product/:productId/entity/:entityName
 * Actualizar una entidad existente
 */
router.put('/product/:productId/entity/:entityName', validateProductId, validateEntityName, async (req, res) => {
  try {
    const { productId, entityName } = req.params;
    const userId = req.user._id || req.user.id;
    
    const result = await DatabaseSchemaService.updateEntity(productId, userId, entityName, req.body);
    
    res.json(result);
  } catch (error) {
    console.error('PUT /database-schema/entity/:entityName error:', error);
    res.status(error.message.includes('no encontrad') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/database-schema/product/:productId/entity/:entityName
 * Eliminar una entidad
 */
router.delete('/product/:productId/entity/:entityName', validateProductId, validateEntityName, async (req, res) => {
  try {
    const { productId, entityName } = req.params;
    const userId = req.user._id || req.user.id;
    
    const result = await DatabaseSchemaService.deleteEntity(productId, userId, entityName);
    
    res.json(result);
  } catch (error) {
    console.error('DELETE /database-schema/entity/:entityName error:', error);
    res.status(error.message.includes('no encontrad') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/database-schema/product/:productId/entity/:entityName/resync
 * Re-sincronizar una entidad desde su código fuente almacenado
 */
router.post('/product/:productId/entity/:entityName/resync', validateProductId, validateEntityName, async (req, res) => {
  try {
    const { productId, entityName } = req.params;
    const userId = req.user._id || req.user.id;
    
    const result = await DatabaseSchemaService.resyncEntity(productId, userId, entityName);
    
    res.json(result);
  } catch (error) {
    console.error('POST /database-schema/entity/:entityName/resync error:', error);
    res.status(error.message.includes('no') ? 400 : 500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// VISUALIZACIÓN Y EXPORTACIÓN
// ============================================

/**
 * GET /api/database-schema/product/:productId/relationship-map
 * Obtener mapa de relaciones para visualización
 */
router.get('/product/:productId/relationship-map', validateProductId, async (req, res) => {
  try {
    const { productId } = req.params;
    
    const result = await DatabaseSchemaService.getRelationshipMap(productId);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('GET /database-schema/relationship-map error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/database-schema/product/:productId/export
 * Exportar esquema completo a JSON
 */
router.get('/product/:productId/export', validateProductId, async (req, res) => {
  try {
    const { productId } = req.params;
    
    const result = await DatabaseSchemaService.exportToJSON(productId);
    
    // Establecer headers para descarga
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="database-schema-${productId}.json"`);
    
    res.json(result.data);
  } catch (error) {
    console.error('GET /database-schema/export error:', error);
    res.status(error.message.includes('no encontrado') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/database-schema/product/:productId/entity/:entityName/code
 * Generar código Mongoose a partir de una entidad
 */
router.get('/product/:productId/entity/:entityName/code', validateProductId, validateEntityName, async (req, res) => {
  try {
    const { productId, entityName } = req.params;
    
    const result = await DatabaseSchemaService.generateCode(productId, entityName);
    
    res.json(result);
  } catch (error) {
    console.error('GET /database-schema/entity/:entityName/code error:', error);
    res.status(error.message.includes('no encontrad') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// UTILIDADES
// ============================================

/**
 * POST /api/database-schema/parse-preview
 * Previsualizar el resultado de parsear código sin guardar
 */
router.post('/parse-preview', async (req, res) => {
  try {
    const { code, orm_type } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'El código fuente es requerido'
      });
    }
    
    const { parseSchema, validateCode } = require('../services/SchemaParserService');
    
    // Validar código
    const validation = validateCode(code);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }
    
    // Parsear sin guardar
    const parsedEntity = parseSchema(code, orm_type);
    
    res.json({
      success: true,
      preview: true,
      entity: parsedEntity,
      message: 'Vista previa generada. Use el endpoint de importación para guardar.'
    });
  } catch (error) {
    console.error('POST /database-schema/parse-preview error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
