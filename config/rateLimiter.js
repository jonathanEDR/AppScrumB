const rateLimit = require('express-rate-limit');
const logger = require('./logger');

// Detectar entorno de desarrollo
const isDevelopment = process.env.NODE_ENV !== 'production';

// ✅ OPTIMIZACIÓN: Rate limiter diferenciado para operaciones GET (lectura)
// GET puede tener más requests porque son operaciones de solo lectura
const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: isDevelopment ? 2000 : 200, // 2000 en desarrollo, 200 en producción
  message: {
    success: false,
    error: 'Demasiadas solicitudes de lectura, por favor intenta de nuevo más tarde.',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (isDevelopment) {
      return true; // Skip en desarrollo
    }
    return false;
  },
  handler: (req, res) => {
    logger.warn('Read rate limit exceeded', {
      context: 'ReadRateLimit',
      ip: req.ip,
      url: req.originalUrl,
      method: req.method
    });
    
    res.status(429).json({
      success: false,
      error: 'Demasiadas solicitudes de lectura desde esta IP',
      retryAfter: '15 minutos'
    });
  }
});

// ✅ OPTIMIZACIÓN: Rate limiter diferenciado para operaciones POST/PUT/DELETE (escritura)
// Escritura más restrictiva para prevenir spam y abuso
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: isDevelopment ? 500 : 50, // 500 en desarrollo, 50 en producción
  message: {
    success: false,
    error: 'Demasiadas operaciones de escritura, por favor intenta de nuevo más tarde.',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (isDevelopment) {
      return true; // Skip en desarrollo
    }
    return false;
  },
  handler: (req, res) => {
    logger.warn('Write rate limit exceeded', {
      context: 'WriteRateLimit',
      ip: req.ip,
      url: req.originalUrl,
      method: req.method
    });
    
    res.status(429).json({
      success: false,
      error: 'Demasiadas operaciones de escritura desde esta IP',
      retryAfter: '15 minutos'
    });
  }
});

// Rate limiter general (fallback para mantener compatibilidad)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 1000 : 100,
  message: {
    success: false,
    error: 'Demasiadas solicitudes desde esta IP, por favor intenta de nuevo más tarde.',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (isDevelopment) {
      return true;
    }
    return false;
  },
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      context: 'RateLimit',
      ip: req.ip,
      url: req.originalUrl,
      method: req.method
    });
    
    res.status(429).json({
      success: false,
      error: 'Demasiadas solicitudes desde esta IP',
      retryAfter: '15 minutos'
    });
  }
});

// Rate limiter estricto para endpoints de creación
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: isDevelopment ? 500 : 50, // 500 creaciones en desarrollo, 50 en producción
  message: {
    success: false,
    error: 'Límite de creación excedido, intenta de nuevo en 1 hora.',
    retryAfter: '1 hora'
  },
  skipSuccessfulRequests: false,
  skip: (req) => {
    // En desarrollo, solo loguear pero no bloquear
    if (isDevelopment) {
      return true;
    }
    return false;
  },
  handler: (req, res) => {
    logger.warn('Create rate limit exceeded', {
      context: 'RateLimit',
      ip: req.ip,
      url: req.originalUrl
    });
    
    res.status(429).json({
      success: false,
      error: 'Límite de creación excedido',
      retryAfter: '1 hora'
    });
  }
});

// Rate limiter para uploads de archivos
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20, // 20 uploads por hora
  message: {
    success: false,
    error: 'Límite de subida de archivos excedido.',
    retryAfter: '1 hora'
  },
  handler: (req, res) => {
    logger.warn('Upload rate limit exceeded', {
      context: 'RateLimit',
      ip: req.ip,
      url: req.originalUrl
    });
    
    res.status(429).json({
      success: false,
      error: 'Límite de subida de archivos excedido',
      retryAfter: '1 hora'
    });
  }
});

// Rate limiter para autenticación (más estricto)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 intentos de login
  message: {
    success: false,
    error: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.',
    retryAfter: '15 minutos'
  },
  skipSuccessfulRequests: true, // No contar requests exitosos
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      context: 'RateLimit',
      ip: req.ip,
      url: req.originalUrl
    });
    
    res.status(429).json({
      success: false,
      error: 'Demasiados intentos de autenticación',
      retryAfter: '15 minutos'
    });
  }
});

// Rate limiter flexible para búsquedas/queries
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // 30 búsquedas por minuto
  message: {
    success: false,
    error: 'Límite de búsquedas excedido.',
    retryAfter: '1 minuto'
  },
  handler: (req, res) => {
    logger.warn('Search rate limit exceeded', {
      context: 'RateLimit',
      ip: req.ip,
      url: req.originalUrl,
      query: req.query
    });
    
    res.status(429).json({
      success: false,
      error: 'Límite de búsquedas excedido',
      retryAfter: '1 minuto'
    });
  }
});

module.exports = {
  generalLimiter,
  readLimiter,      // ✅ NUEVO: Para operaciones GET
  writeLimiter,     // ✅ NUEVO: Para operaciones POST/PUT/DELETE
  createLimiter,
  uploadLimiter,
  authLimiter,
  searchLimiter
};
