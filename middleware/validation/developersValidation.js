const mongoose = require('mongoose');

/**
 * Validación para creación de entrada de time tracking
 */
const validateTimeEntry = (req, res, next) => {
  const { taskId, startTime, endTime, date } = req.body;
  const errors = [];

  // Validar campos requeridos
  if (!taskId) {
    errors.push('El ID de la tarea es requerido');
  } else if (!mongoose.Types.ObjectId.isValid(taskId)) {
    errors.push('ID de tarea inválido');
  }

  if (!startTime) {
    errors.push('La hora de inicio es requerida');
  } else if (isNaN(Date.parse(startTime))) {
    errors.push('Formato de hora de inicio inválido');
  }

  if (!endTime) {
    errors.push('La hora de fin es requerida');
  } else if (isNaN(Date.parse(endTime))) {
    errors.push('Formato de hora de fin inválido');
  }

  if (!date) {
    errors.push('La fecha es requerida');
  } else if (isNaN(Date.parse(date))) {
    errors.push('Formato de fecha inválido');
  }

  // Validar que endTime sea posterior a startTime
  if (startTime && endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end <= start) {
      errors.push('La hora de fin debe ser posterior a la hora de inicio');
    }

    // Validar que la duración no sea mayor a 12 horas
    const duration = (end - start) / (1000 * 60 * 60); // en horas
    if (duration > 12) {
      errors.push('La duración no puede ser mayor a 12 horas');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Datos de entrada inválidos',
      details: errors
    });
  }

  next();
};

/**
 * Validación para actualización de estado de tarea
 */
const validateTaskStatusUpdate = (req, res, next) => {
  const { status } = req.body;
  const validStatuses = ['todo', 'in_progress', 'code_review', 'testing', 'done'];

  if (!status) {
    return res.status(400).json({
      success: false,
      error: 'El estado es requerido'
    });
  }

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: 'Estado inválido',
      validStatuses
    });
  }

  next();
};

/**
 * Validación para creación de reporte de bug
 */
const validateBugReport = (req, res, next) => {
  const { title, description, priority, type, actualBehavior } = req.body;
  const errors = [];

  // Validar campos requeridos
  if (!title || title.trim().length === 0) {
    errors.push('El título es requerido');
  } else if (title.length < 5) {
    errors.push('El título debe tener al menos 5 caracteres');
  } else if (title.length > 200) {
    errors.push('El título no puede tener más de 200 caracteres');
  }

  if (!description || description.trim().length === 0) {
    errors.push('La descripción es requerida');
  } else if (description.length > 2000) {
    errors.push('La descripción no puede tener más de 2000 caracteres');
  }

  // Validar actualBehavior (requerido en el modelo)
  if (!actualBehavior || actualBehavior.trim().length === 0) {
    errors.push('El comportamiento actual (actualBehavior) es requerido');
  } else if (actualBehavior.length > 1000) {
    errors.push('El comportamiento actual no puede tener más de 1000 caracteres');
  }

  // Validar prioridad
  const validPriorities = ['low', 'medium', 'high', 'critical'];
  if (priority && !validPriorities.includes(priority)) {
    errors.push(`Prioridad inválida. Valores válidos: ${validPriorities.join(', ')}`);
  }

  // Validar tipo
  const validTypes = ['bug', 'feature', 'improvement', 'security'];
  if (type && !validTypes.includes(type)) {
    errors.push(`Tipo inválido. Valores válidos: ${validTypes.join(', ')}`);
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Datos de reporte inválidos',
      details: errors
    });
  }

  next();
};

/**
 * Validación para inicio de timer
 */
const validateTimerStart = (req, res, next) => {
  const { taskId } = req.body;

  if (!taskId) {
    return res.status(400).json({
      success: false,
      error: 'El ID de la tarea es requerido'
    });
  }

  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    return res.status(400).json({
      success: false,
      error: 'ID de tarea inválido'
    });
  }

  next();
};

/**
 * Validación para parámetros de consulta de time tracking
 */
const validateTimeTrackingQuery = (req, res, next) => {
  const { startDate, endDate, period } = req.query;
  const errors = [];

  // Validar fechas si se proporcionan
  if (startDate && isNaN(Date.parse(startDate))) {
    errors.push('Formato de fecha de inicio inválido');
  }

  if (endDate && isNaN(Date.parse(endDate))) {
    errors.push('Formato de fecha de fin inválido');
  }

  // Validar que startDate sea anterior a endDate
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      errors.push('La fecha de inicio debe ser anterior a la fecha de fin');
    }
  }

  // Validar período
  const validPeriods = ['week', 'month', 'quarter', 'year'];
  if (period && !validPeriods.includes(period)) {
    errors.push(`Período inválido. Valores válidos: ${validPeriods.join(', ')}`);
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Parámetros de consulta inválidos',
      details: errors
    });
  }

  next();
};

/**
 * Validación de ObjectId en parámetros de ruta
 */
const validateObjectId = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: `${paramName} inválido`
      });
    }
    
    next();
  };
};

module.exports = {
  validateTimeEntry,
  validateTaskStatusUpdate,
  validateBugReport,
  validateTimerStart,
  validateTimeTrackingQuery,
  validateObjectId
};
