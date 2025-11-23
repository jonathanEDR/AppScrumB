const NodeCache = require('node-cache');
const logger = require('./logger');

// Crear instancia de cache con TTL de 5 minutos por defecto
const cache = new NodeCache({
  stdTTL: 300, // 5 minutos
  checkperiod: 60, // Verificar cada 60 segundos
  useClones: false, // No clonar objetos (mejor performance)
  deleteOnExpire: true
});

// Eventos del cache
cache.on('set', (key, value) => {
  logger.debug('Cache set', { context: 'Cache', key, valueSize: JSON.stringify(value).length });
});

cache.on('del', (key, value) => {
  logger.debug('Cache delete', { context: 'Cache', key });
});

cache.on('expired', (key, value) => {
  logger.debug('Cache expired', { context: 'Cache', key });
});

cache.on('flush', () => {
  logger.info('Cache flushed', { context: 'Cache' });
});

// Wrapper functions con logging
const cacheWrapper = {
  /**
   * Obtener valor del cache
   * @param {string} key - Clave
   * @returns {*} Valor o undefined
   */
  get: (key) => {
    const value = cache.get(key);
    if (value !== undefined) {
      logger.debug('Cache hit', { context: 'Cache', key });
    } else {
      logger.debug('Cache miss', { context: 'Cache', key });
    }
    return value;
  },

  /**
   * Establecer valor en cache
   * @param {string} key - Clave
   * @param {*} value - Valor
   * @param {number} ttl - TTL en segundos (opcional)
   * @returns {boolean} Success
   */
  set: (key, value, ttl) => {
    const success = cache.set(key, value, ttl);
    if (!success) {
      logger.error('Cache set failed', { context: 'Cache', key });
    }
    return success;
  },

  /**
   * Eliminar valor del cache
   * @param {string} key - Clave
   * @returns {number} Número de keys eliminadas
   */
  del: (key) => {
    return cache.del(key);
  },

  /**
   * Eliminar múltiples valores
   * @param {string[]} keys - Array de claves
   * @returns {number} Número de keys eliminadas
   */
  delMultiple: (keys) => {
    return cache.del(keys);
  },

  /**
   * Limpiar todo el cache
   */
  flush: () => {
    cache.flushAll();
    logger.info('Cache cleared', { context: 'Cache' });
  },

  /**
   * Obtener estadísticas del cache
   * @returns {object} Estadísticas
   */
  getStats: () => {
    return cache.getStats();
  },

  /**
   * Obtener todas las claves
   * @returns {string[]} Array de claves
   */
  keys: () => {
    return cache.keys();
  },

  /**
   * Verificar si existe una clave
   * @param {string} key - Clave
   * @returns {boolean}
   */
  has: (key) => {
    return cache.has(key);
  },

  /**
   * Obtener TTL de una clave
   * @param {string} key - Clave
   * @returns {number} TTL en segundos o undefined
   */
  getTtl: (key) => {
    return cache.getTtl(key);
  }
};

// Middleware para cachear responses
const cacheMiddleware = (duration = 300) => {
  return (req, res, next) => {
    // Solo cachear GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generar clave única basada en URL y query params
    const key = `route_${req.originalUrl || req.url}`;

    // Intentar obtener del cache
    const cachedResponse = cacheWrapper.get(key);

    if (cachedResponse) {
      logger.info('Serving from cache', { 
        context: 'Cache Middleware', 
        route: req.originalUrl,
        method: req.method 
      });
      
      return res.json(cachedResponse);
    }

    // Si no está en cache, interceptar res.json
    const originalJson = res.json.bind(res);

    res.json = (data) => {
      // Solo cachear respuestas exitosas
      if (res.statusCode === 200) {
        cacheWrapper.set(key, data, duration);
        logger.info('Response cached', { 
          context: 'Cache Middleware', 
          route: req.originalUrl,
          ttl: duration 
        });
      }

      return originalJson(data);
    };

    next();
  };
};

// Función helper para invalidar cache relacionado
const invalidatePattern = (pattern) => {
  const keys = cache.keys();
  const matchingKeys = keys.filter(key => key.includes(pattern));
  
  if (matchingKeys.length > 0) {
    cache.del(matchingKeys);
    logger.info('Cache pattern invalidated', { 
      context: 'Cache', 
      pattern, 
      keysDeleted: matchingKeys.length 
    });
  }
};

// Prefijos de cache para diferentes tipos de datos
const CACHE_PREFIXES = {
  DASHBOARD: 'dashboard',
  TASKS: 'tasks',
  BUG_REPORTS: 'bug_reports',
  SPRINT_BOARD: 'sprint_board',
  TIME_TRACKING: 'time_tracking',
  USER: 'user'
};

// Duraciones recomendadas (en segundos)
const CACHE_DURATIONS = {
  SHORT: 60,        // 1 minuto
  MEDIUM: 300,      // 5 minutos
  LONG: 900,        // 15 minutos
  VERY_LONG: 3600   // 1 hora
};

module.exports = {
  cache: cacheWrapper,
  cacheMiddleware,
  invalidatePattern,
  CACHE_PREFIXES,
  CACHE_DURATIONS
};
