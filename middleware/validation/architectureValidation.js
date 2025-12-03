/**
 * Middleware de validación para Architecture
 * Valida datos de entrada para operaciones de arquitectura via API REST
 * 
 * NOTA: Este middleware NO afecta el flujo de creación via chat (scrumAI.js)
 *       Solo aplica a las rutas REST de /api/architecture
 */

const mongoose = require('mongoose');

// Tipos de proyecto válidos (según el modelo)
const VALID_PROJECT_TYPES = [
  'web_app', 'spa', 'mobile_app', 'pwa', 'api_only', 
  'desktop', 'microservices', 'monolith', 'serverless', 
  'hybrid', 'cli', 'library', 'other'
];

// Escalas válidas
const VALID_SCALES = ['prototype', 'mvp', 'small', 'medium', 'large', 'enterprise'];

// Estados válidos
const VALID_STATUSES = ['draft', 'review', 'approved', 'active', 'archived'];

// Tipos de módulo válidos
const VALID_MODULE_TYPES = ['frontend', 'backend', 'shared', 'infrastructure', 'mobile', 'external'];

// Estados de módulo válidos
const VALID_MODULE_STATUSES = ['planned', 'in_development', 'completed', 'deprecated', 'blocked'];

// Complejidad válida
const VALID_COMPLEXITY = ['trivial', 'low', 'medium', 'high', 'very_high'];

// Métodos HTTP válidos
const VALID_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Valida que un string sea un ObjectId válido de MongoDB
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Valida creación de arquitectura
 */
const validateCreate = (req, res, next) => {
  const errors = [];
  const { productId, project_name, project_type, scale } = req.body;

  // productId es obligatorio
  if (!productId) {
    errors.push({ field: 'productId', message: 'El ID del producto es requerido' });
  } else if (!isValidObjectId(productId)) {
    errors.push({ field: 'productId', message: 'El ID del producto no es válido' });
  }

  // Validar project_type si se proporciona
  if (project_type && !VALID_PROJECT_TYPES.includes(project_type)) {
    errors.push({ 
      field: 'project_type', 
      message: `Tipo de proyecto inválido. Valores permitidos: ${VALID_PROJECT_TYPES.join(', ')}` 
    });
  }

  // Validar scale si se proporciona
  if (scale && !VALID_SCALES.includes(scale)) {
    errors.push({ 
      field: 'scale', 
      message: `Escala inválida. Valores permitidos: ${VALID_SCALES.join(', ')}` 
    });
  }

  // Validar project_name si se proporciona (no vacío)
  if (project_name !== undefined && typeof project_name === 'string' && project_name.trim() === '') {
    errors.push({ field: 'project_name', message: 'El nombre del proyecto no puede estar vacío' });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Errores de validación',
      validation_errors: errors
    });
  }

  next();
};

/**
 * Valida actualización de arquitectura
 */
const validateUpdate = (req, res, next) => {
  const errors = [];
  const { project_type, scale, status } = req.body;
  const { productId } = req.params;

  // Validar productId del path
  if (!isValidObjectId(productId)) {
    errors.push({ field: 'productId', message: 'El ID del producto no es válido' });
  }

  // Validar project_type si se proporciona
  if (project_type && !VALID_PROJECT_TYPES.includes(project_type)) {
    errors.push({ 
      field: 'project_type', 
      message: `Tipo de proyecto inválido. Valores permitidos: ${VALID_PROJECT_TYPES.join(', ')}` 
    });
  }

  // Validar scale si se proporciona
  if (scale && !VALID_SCALES.includes(scale)) {
    errors.push({ 
      field: 'scale', 
      message: `Escala inválida. Valores permitidos: ${VALID_SCALES.join(', ')}` 
    });
  }

  // Validar status si se proporciona
  if (status && !VALID_STATUSES.includes(status)) {
    errors.push({ 
      field: 'status', 
      message: `Estado inválido. Valores permitidos: ${VALID_STATUSES.join(', ')}` 
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Errores de validación',
      validation_errors: errors
    });
  }

  next();
};

/**
 * Valida datos de tech stack
 */
const validateTechStack = (req, res, next) => {
  const errors = [];
  const { productId } = req.params;
  const techStack = req.body;

  if (!isValidObjectId(productId)) {
    errors.push({ field: 'productId', message: 'El ID del producto no es válido' });
  }

  // Validar que al menos un campo del tech_stack esté presente
  const validStackFields = ['frontend', 'backend', 'database', 'infrastructure'];
  const hasValidField = validStackFields.some(field => techStack[field] !== undefined);
  
  if (!hasValidField && Object.keys(techStack).length > 0) {
    // Hay datos pero ninguno es un campo válido del stack
    errors.push({ 
      field: 'tech_stack', 
      message: `Campos válidos del tech stack: ${validStackFields.join(', ')}` 
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Errores de validación',
      validation_errors: errors
    });
  }

  next();
};

/**
 * Valida datos de módulo
 */
const validateModule = (req, res, next) => {
  const errors = [];
  const { productId } = req.params;
  const moduleData = req.body;

  if (!isValidObjectId(productId)) {
    errors.push({ field: 'productId', message: 'El ID del producto no es válido' });
  }

  // name es requerido para crear módulo
  if (!moduleData.name || typeof moduleData.name !== 'string' || moduleData.name.trim() === '') {
    errors.push({ field: 'name', message: 'El nombre del módulo es requerido' });
  }

  // Validar type si se proporciona
  if (moduleData.type && !VALID_MODULE_TYPES.includes(moduleData.type)) {
    errors.push({ 
      field: 'type', 
      message: `Tipo de módulo inválido. Valores permitidos: ${VALID_MODULE_TYPES.join(', ')}` 
    });
  }

  // Validar status si se proporciona
  if (moduleData.status && !VALID_MODULE_STATUSES.includes(moduleData.status)) {
    errors.push({ 
      field: 'status', 
      message: `Estado de módulo inválido. Valores permitidos: ${VALID_MODULE_STATUSES.join(', ')}` 
    });
  }

  // Validar estimated_complexity si se proporciona
  if (moduleData.estimated_complexity && !VALID_COMPLEXITY.includes(moduleData.estimated_complexity)) {
    errors.push({ 
      field: 'estimated_complexity', 
      message: `Complejidad inválida. Valores permitidos: ${VALID_COMPLEXITY.join(', ')}` 
    });
  }

  // Validar estimated_hours si se proporciona (debe ser número positivo)
  if (moduleData.estimated_hours !== undefined) {
    if (typeof moduleData.estimated_hours !== 'number' || moduleData.estimated_hours < 0) {
      errors.push({ field: 'estimated_hours', message: 'Las horas estimadas deben ser un número positivo' });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Errores de validación',
      validation_errors: errors
    });
  }

  next();
};

/**
 * Valida datos de endpoint API
 */
const validateEndpoint = (req, res, next) => {
  const errors = [];
  const { productId } = req.params;
  const endpoint = req.body;

  if (!isValidObjectId(productId)) {
    errors.push({ field: 'productId', message: 'El ID del producto no es válido' });
  }

  // method es requerido
  if (!endpoint.method) {
    errors.push({ field: 'method', message: 'El método HTTP es requerido' });
  } else if (!VALID_HTTP_METHODS.includes(endpoint.method.toUpperCase())) {
    errors.push({ 
      field: 'method', 
      message: `Método HTTP inválido. Valores permitidos: ${VALID_HTTP_METHODS.join(', ')}` 
    });
  }

  // path es requerido
  if (!endpoint.path || typeof endpoint.path !== 'string' || endpoint.path.trim() === '') {
    errors.push({ field: 'path', message: 'El path del endpoint es requerido' });
  } else if (!endpoint.path.startsWith('/')) {
    errors.push({ field: 'path', message: 'El path debe comenzar con /' });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Errores de validación',
      validation_errors: errors
    });
  }

  // Normalizar método a mayúsculas
  if (endpoint.method) {
    req.body.method = endpoint.method.toUpperCase();
  }

  next();
};

/**
 * Valida datos de integración
 */
const validateIntegration = (req, res, next) => {
  const errors = [];
  const { productId } = req.params;
  const integration = req.body;

  if (!isValidObjectId(productId)) {
    errors.push({ field: 'productId', message: 'El ID del producto no es válido' });
  }

  // name es requerido
  if (!integration.name || typeof integration.name !== 'string' || integration.name.trim() === '') {
    errors.push({ field: 'name', message: 'El nombre de la integración es requerido' });
  }

  // Validar type si se proporciona
  const validIntegrationTypes = ['payment', 'auth', 'email', 'sms', 'analytics', 'storage', 'ai', 'maps', 'social', 'other'];
  if (integration.type && !validIntegrationTypes.includes(integration.type)) {
    errors.push({ 
      field: 'type', 
      message: `Tipo de integración inválido. Valores permitidos: ${validIntegrationTypes.join(', ')}` 
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Errores de validación',
      validation_errors: errors
    });
  }

  next();
};

/**
 * Valida datos de decisión de arquitectura
 */
const validateDecision = (req, res, next) => {
  const errors = [];
  const { productId } = req.params;
  const decision = req.body;

  if (!isValidObjectId(productId)) {
    errors.push({ field: 'productId', message: 'El ID del producto no es válido' });
  }

  // title es requerido
  if (!decision.title || typeof decision.title !== 'string' || decision.title.trim() === '') {
    errors.push({ field: 'title', message: 'El título de la decisión es requerido' });
  }

  // Validar status si se proporciona
  const validDecisionStatuses = ['proposed', 'accepted', 'deprecated', 'superseded'];
  if (decision.status && !validDecisionStatuses.includes(decision.status)) {
    errors.push({ 
      field: 'status', 
      message: `Estado inválido. Valores permitidos: ${validDecisionStatuses.join(', ')}` 
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Errores de validación',
      validation_errors: errors
    });
  }

  next();
};

/**
 * Valida productId en params
 */
const validateProductId = (req, res, next) => {
  const { productId } = req.params;

  if (!productId) {
    return res.status(400).json({
      success: false,
      error: 'El ID del producto es requerido'
    });
  }

  if (!isValidObjectId(productId)) {
    return res.status(400).json({
      success: false,
      error: 'El ID del producto no es válido'
    });
  }

  next();
};

/**
 * Valida moduleId en params
 */
const validateModuleId = (req, res, next) => {
  const { moduleId } = req.params;

  if (!moduleId) {
    return res.status(400).json({
      success: false,
      error: 'El ID del módulo es requerido'
    });
  }

  if (!isValidObjectId(moduleId)) {
    return res.status(400).json({
      success: false,
      error: 'El ID del módulo no es válido'
    });
  }

  next();
};

module.exports = {
  validateCreate,
  validateUpdate,
  validateTechStack,
  validateModule,
  validateEndpoint,
  validateIntegration,
  validateDecision,
  validateProductId,
  validateModuleId,
  // Exportar constantes para reutilización
  VALID_PROJECT_TYPES,
  VALID_SCALES,
  VALID_STATUSES,
  VALID_MODULE_TYPES,
  VALID_MODULE_STATUSES,
  VALID_COMPLEXITY,
  VALID_HTTP_METHODS
};
