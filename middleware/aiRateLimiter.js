/**
 * aiRateLimiter.js
 * Rate limiting específico para endpoints de AI
 * Protege contra abuso y controla costos de OpenAI
 */

const rateLimit = require('express-rate-limit');
const MongoStore = require('rate-limit-mongo');

/**
 * Rate limiter para endpoints AI - más estricto que el general
 * Límites:
 * - 10 requests por hora por usuario
 * - 50 requests por día por usuario
 */

const createAIRateLimiter = () => {
  // Configuración base
  const config = {
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 10, // 10 requests por hora
    standardHeaders: true,
    legacyHeaders: false,
    
    // Mensajes personalizados
    message: {
      status: 'error',
      message: 'Límite de solicitudes AI excedido. Por favor espera antes de hacer más peticiones.',
      retry_after: '1 hora',
      limits: {
        hourly: '10 requests/hora',
        daily: '50 requests/día'
      }
    },

    // Handler personalizado para loggear intentos bloqueados
    handler: (req, res) => {
      console.warn(`⚠️ [Rate Limit] User ${req.user?.id || 'unknown'} blocked - Too many AI requests`);
      res.status(429).json({
        status: 'error',
        message: 'Límite de solicitudes AI excedido',
        retry_after: '1 hora',
        limits: {
          hourly: '10 requests/hora',
          daily: '50 requests/día'
        },
        tip: 'Considera usar el cache o combinar múltiples operaciones en una sola petición'
      });
    },

    // Identificar usuario por req.user._id (Clerk)
    keyGenerator: (req, res) => {
      // Solo usar user ID (usuarios autenticados). Si no hay user, usar 'anonymous'
      // Esto evita problemas con IPv6 y asegura que solo usuarios autenticados puedan usar AI
      return req.user?._id?.toString() || 'anonymous';
    },

    // Skip para usuarios admin
    skip: (req) => {
      return req.user?.role === 'admin';
    }
  };

  // Usar MongoDB store si está disponible
  if (process.env.MONGODB_URI) {
    config.store = new MongoStore({
      uri: process.env.MONGODB_URI,
      collectionName: 'ai_rate_limits',
      expireTimeMs: 24 * 60 * 60 * 1000, // 24 horas
    });
  }

  return rateLimit(config);
};

/**
 * Rate limiter diario (más permisivo pero con límite total)
 */
const createDailyAIRateLimiter = () => {
  const config = {
    windowMs: 24 * 60 * 60 * 1000, // 24 horas
    max: 50, // 50 requests por día
    standardHeaders: true,
    legacyHeaders: false,
    
    message: {
      status: 'error',
      message: 'Límite diario de solicitudes AI excedido. Intenta mañana.',
      retry_after: '24 horas',
      limits: {
        daily: '50 requests/día'
      }
    },

    handler: (req, res) => {
      console.warn(`⚠️ [Daily Rate Limit] User ${req.user?.id || 'unknown'} blocked - Daily limit exceeded`);
      res.status(429).json({
        status: 'error',
        message: 'Límite diario de solicitudes AI excedido',
        retry_after: '24 horas',
        limits: {
          daily: '50 requests/día'
        }
      });
    },

    keyGenerator: (req, res) => {
      // Usar solo user ID para evitar problemas con IPv6
      return req.user?._id?.toString() || 'anonymous';
    },

    skip: (req) => {
      return req.user?.role === 'admin';
    }
  };

  if (process.env.MONGODB_URI) {
    config.store = new MongoStore({
      uri: process.env.MONGODB_URI,
      collectionName: 'ai_daily_rate_limits',
      expireTimeMs: 48 * 60 * 60 * 1000, // 48 horas
    });
  }

  return rateLimit(config);
};

/**
 * Rate limiter para conversaciones (más permisivo)
 */
const createChatRateLimiter = () => {
  const config = {
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 30, // 30 mensajes por hora
    standardHeaders: true,
    legacyHeaders: false,
    
    message: {
      status: 'error',
      message: 'Límite de mensajes de chat excedido',
      retry_after: '1 hora',
      limits: {
        hourly: '30 mensajes/hora'
      }
    },

    keyGenerator: (req, res) => {
      // Usar solo user ID para evitar problemas con IPv6
      return req.user?._id?.toString() || 'anonymous';
    },

    skip: (req) => {
      return req.user?.role === 'admin';
    }
  };

  if (process.env.MONGODB_URI) {
    config.store = new MongoStore({
      uri: process.env.MONGODB_URI,
      collectionName: 'ai_chat_rate_limits',
      expireTimeMs: 24 * 60 * 60 * 1000,
    });
  }

  return rateLimit(config);
};

module.exports = {
  aiRateLimiter: createAIRateLimiter(),
  dailyAIRateLimiter: createDailyAIRateLimiter(),
  chatRateLimiter: createChatRateLimiter()
};
