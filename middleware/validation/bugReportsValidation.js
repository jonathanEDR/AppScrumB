const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

// Validación para crear bug report
const validateCreateBugReport = [
  body('title')
    .notEmpty()
    .withMessage('El título es requerido')
    .isString()
    .withMessage('El título debe ser un texto')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('El título debe tener entre 5 y 200 caracteres'),
  
  body('description')
    .notEmpty()
    .withMessage('La descripción es requerida')
    .isString()
    .withMessage('La descripción debe ser un texto')
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('La descripción debe tener entre 10 y 5000 caracteres'),
  
  body('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('La severidad debe ser: low, medium, high, o critical'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('La prioridad debe ser: low, medium, high, o urgent'),
  
  body('type')
    .optional()
    .isIn(['bug', 'defect', 'error', 'crash', 'performance', 'security', 'ui', 'other'])
    .withMessage('El tipo de bug no es válido'),
  
  body('environment')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('El entorno debe tener máximo 500 caracteres'),
  
  body('stepsToReproduce')
    .optional()
    .isArray()
    .withMessage('Los pasos para reproducir deben ser un array'),
  
  body('stepsToReproduce.*')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Cada paso debe tener entre 1 y 1000 caracteres'),
  
  body('expectedBehavior')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('El comportamiento esperado debe tener máximo 2000 caracteres'),
  
  body('actualBehavior')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('El comportamiento actual debe tener máximo 2000 caracteres'),
  
  body('relatedTask')
    .optional()
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('El ID de tarea relacionada no es válido'),
  
  body('relatedSprint')
    .optional()
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('El ID de sprint relacionado no es válido'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Las etiquetas deben ser un array'),
  
  body('tags.*')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Cada etiqueta debe tener entre 1 y 50 caracteres')
];

// Validación para actualizar bug report
const validateUpdateBugReport = [
  param('id')
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('ID de bug report no válido'),
  
  body('title')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('El título debe tener entre 5 y 200 caracteres'),
  
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('La descripción debe tener entre 10 y 5000 caracteres'),
  
  body('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('La severidad debe ser: low, medium, high, o critical'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('La prioridad debe ser: low, medium, high, o urgent'),
  
  body('status')
    .optional()
    .isIn(['open', 'in_progress', 'resolved', 'closed', 'reopened'])
    .withMessage('El estado no es válido'),
  
  body('type')
    .optional()
    .isIn(['bug', 'defect', 'error', 'crash', 'performance', 'security', 'ui', 'other'])
    .withMessage('El tipo de bug no es válido'),
  
  body('assignedTo')
    .optional()
    .custom((value) => !value || mongoose.Types.ObjectId.isValid(value))
    .withMessage('El ID de usuario asignado no es válido')
];

// Validación para cambiar estado
const validateChangeBugStatus = [
  param('id')
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('ID de bug report no válido'),
  
  body('status')
    .notEmpty()
    .withMessage('El estado es requerido')
    .isIn(['open', 'in_progress', 'resolved', 'closed', 'reopened'])
    .withMessage('El estado debe ser: open, in_progress, resolved, closed, o reopened'),
  
  body('resolution')
    .optional()
    .isIn(['fixed', 'wont_fix', 'duplicate', 'cannot_reproduce', 'works_as_designed'])
    .withMessage('La resolución no es válida'),
  
  body('comment')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('El comentario debe tener entre 1 y 2000 caracteres')
];

// Validación para asignar bug
const validateAssignBug = [
  param('id')
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('ID de bug report no válido'),
  
  body('assignedTo')
    .notEmpty()
    .withMessage('El ID de usuario es requerido')
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('El ID de usuario no es válido')
];

// Validación para consultas/filtros
const validateBugReportQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número entero mayor a 0'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('El límite debe estar entre 1 y 100'),
  
  query('status')
    .optional()
    .isIn(['open', 'in_progress', 'resolved', 'closed', 'reopened'])
    .withMessage('El estado no es válido'),
  
  query('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('La severidad no es válida'),
  
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('La prioridad no es válida'),
  
  query('type')
    .optional()
    .isIn(['bug', 'defect', 'error', 'crash', 'performance', 'security', 'ui', 'other'])
    .withMessage('El tipo no es válido'),
  
  query('reporter')
    .optional()
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('El ID de reporter no es válido'),
  
  query('assignedTo')
    .optional()
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('El ID de asignado no es válido'),
  
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('La búsqueda debe tener entre 1 y 200 caracteres'),
  
  query('sortBy')
    .optional()
    .isIn(['createdAt', '-createdAt', 'updatedAt', '-updatedAt', 'severity', '-severity', 'priority', '-priority'])
    .withMessage('El ordenamiento no es válido')
];

// Validación de ObjectId genérico
const validateObjectId = (paramName = 'id') => [
  param(paramName)
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage(`El ID (${paramName}) no es válido`)
];

module.exports = {
  validateCreateBugReport,
  validateUpdateBugReport,
  validateChangeBugStatus,
  validateAssignBug,
  validateBugReportQuery,
  validateObjectId
};
