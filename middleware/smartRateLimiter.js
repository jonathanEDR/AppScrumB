/**
 * Middleware inteligente que aplica rate limiters diferenciados según el método HTTP
 * GET requests -> readLimiter (más permisivo)
 * POST/PUT/PATCH/DELETE requests -> writeLimiter (más restrictivo)
 */

const { readLimiter, writeLimiter } = require('../config/rateLimiter');

/**
 * Aplica el rate limiter apropiado basándose en el método HTTP
 */
const smartRateLimiter = (req, res, next) => {
  // Métodos de lectura - usar limiter más permisivo
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return readLimiter(req, res, next);
  }
  
  // Métodos de escritura - usar limiter más estricto
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
    return writeLimiter(req, res, next);
  }
  
  // Fallback para métodos no estándar
  return readLimiter(req, res, next);
};

module.exports = smartRateLimiter;
