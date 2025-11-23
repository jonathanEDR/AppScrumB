const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Crear directorio de logs si no existe
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Formato personalizado con colores para desarrollo
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, context, ...meta }) => {
    const contextStr = context ? `[${context}]` : '';
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} ${level} ${contextStr}: ${message}${metaStr}`;
  })
);

// Formato para producción (JSON estructurado)
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Transport para archivos con rotación diaria
const dailyRotateFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d', // Mantener logs por 14 días
  level: 'info'
});

// Transport para errores con rotación
const errorRotateFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d', // Mantener errores por 30 días
  level: 'error'
});

// Configuración del logger
const transports = [
  // File transports con rotación
  dailyRotateFileTransport,
  errorRotateFileTransport
];

// Solo agregar console en desarrollo
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: devFormat
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
  transports,
  // Manejar excepciones no capturadas
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  // Manejar rechazos de promesas no capturadas
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Funciones helper para contexto
logger.withContext = (context) => {
  return {
    debug: (message, meta = {}) => logger.debug(message, { context, ...meta }),
    info: (message, meta = {}) => logger.info(message, { context, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { context, ...meta }),
    error: (message, meta = {}) => logger.error(message, { context, ...meta })
  };
};

// Middleware para Express
logger.expressMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // Log de request
  logger.info('HTTP Request', {
    context: 'Express',
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Override res.json para loguear responses
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - start;
    
    logger.info('HTTP Response', {
      context: 'Express',
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`
    });
    
    return originalJson.call(this, data);
  };

  next();
};

// Log inicial
logger.info('Logger initialized', {
  context: 'Logger',
  level: logger.level,
  environment: process.env.NODE_ENV || 'development'
});

module.exports = logger;
