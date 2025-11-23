const logger = require('../config/logger');
const path = require('path');

/**
 * Middleware para validar archivos de imagen
 */

/**
 * Validar tipo de archivo por mimetype y extensión
 * @param {Object} allowedTypes - Tipos permitidos { mimetypes: [], extensions: [] }
 * @returns {Function} Middleware de validación
 */
const validateFileType = (allowedTypes) => {
  return (req, file, cb) => {
    const {
      mimetypes = [],
      extensions = []
    } = allowedTypes;

    // Validar mimetype
    const mimetypeValid = mimetypes.length === 0 || mimetypes.includes(file.mimetype);
    
    // Validar extensión
    const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
    const extensionValid = extensions.length === 0 || extensions.includes(fileExtension);

    if (mimetypeValid && extensionValid) {
      logger.info('File type validation passed', {
        context: 'ImageValidation',
        fileName: file.originalname,
        mimetype: file.mimetype,
        extension: fileExtension
      });
      return cb(null, true);
    }

    logger.warn('File type validation failed', {
      context: 'ImageValidation',
      fileName: file.originalname,
      mimetype: file.mimetype,
      extension: fileExtension,
      allowedMimetypes: mimetypes,
      allowedExtensions: extensions
    });

    cb(new Error(
      `Tipo de archivo no permitido. ` +
      `Tipos aceptados: ${extensions.join(', ') || 'N/A'}. ` +
      `Recibido: ${fileExtension}`
    ), false);
  };
};

/**
 * Validación para imágenes solamente
 */
const validateImageFile = validateFileType({
  mimetypes: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ],
  extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
});

/**
 * Validación para archivos de bug reports (imágenes + documentos)
 */
const validateBugReportFile = validateFileType({
  mimetypes: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/log',
    'application/json',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  extensions: [
    'jpg', 'jpeg', 'png', 'gif', 'webp',
    'pdf', 'txt', 'log', 'json',
    'doc', 'docx'
  ]
});

/**
 * Validación para logos/branding (solo imágenes optimizadas)
 */
const validateBrandingFile = validateFileType({
  mimetypes: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/svg+xml'
  ],
  extensions: ['jpg', 'jpeg', 'png', 'webp', 'svg']
});

/**
 * Validar tamaño de archivo
 * @param {number} maxSizeInMB - Tamaño máximo en MB
 * @returns {Object} Configuración de límites para multer
 */
const validateFileSize = (maxSizeInMB) => {
  return {
    fileSize: maxSizeInMB * 1024 * 1024 // Convertir MB a bytes
  };
};

/**
 * Middleware para validar cantidad de archivos
 * @param {number} maxFiles - Cantidad máxima de archivos
 * @returns {Function} Middleware
 */
const validateFileCount = (maxFiles) => {
  return (req, res, next) => {
    const filesCount = req.files ? req.files.length : 0;
    
    if (filesCount > maxFiles) {
      logger.warn('File count validation failed', {
        context: 'ImageValidation',
        filesCount,
        maxFiles
      });
      
      return res.status(400).json({
        error: `Demasiados archivos. Máximo permitido: ${maxFiles}, recibidos: ${filesCount}`
      });
    }

    logger.info('File count validation passed', {
      context: 'ImageValidation',
      filesCount,
      maxFiles
    });

    next();
  };
};

/**
 * Middleware para validar dimensiones de imagen
 * @param {Object} dimensions - { minWidth, maxWidth, minHeight, maxHeight }
 * @returns {Function} Middleware
 */
const validateImageDimensions = (dimensions = {}) => {
  return async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return next();
      }

      const {
        minWidth = 0,
        maxWidth = Infinity,
        minHeight = 0,
        maxHeight = Infinity
      } = dimensions;

      // Validar cada archivo que sea imagen
      for (const file of req.files) {
        if (file.mimetype.startsWith('image/')) {
          // Obtener dimensiones usando sharp (si está instalado)
          try {
            const sharp = require('sharp');
            const metadata = await sharp(file.path).metadata();

            if (metadata.width < minWidth || metadata.width > maxWidth ||
                metadata.height < minHeight || metadata.height > maxHeight) {
              
              logger.warn('Image dimensions validation failed', {
                context: 'ImageValidation',
                fileName: file.originalname,
                width: metadata.width,
                height: metadata.height,
                constraints: dimensions
              });

              return res.status(400).json({
                error: `Dimensiones de imagen no válidas. ` +
                       `Tamaño: ${metadata.width}x${metadata.height}. ` +
                       `Permitido: ${minWidth}-${maxWidth}x${minHeight}-${maxHeight}`
              });
            }
          } catch (sharpError) {
            // Si sharp no está disponible, continuar sin validación de dimensiones
            logger.warn('Sharp not available for dimension validation', {
              context: 'ImageValidation'
            });
          }
        }
      }

      next();
    } catch (error) {
      logger.error('Error validating image dimensions', {
        context: 'ImageValidation',
        error: error.message
      });
      next(error);
    }
  };
};

/**
 * Sanitizar nombre de archivo
 * @param {string} filename - Nombre del archivo
 * @returns {string} Nombre sanitizado
 */
const sanitizeFileName = (filename) => {
  // Remover caracteres especiales y espacios
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
};

/**
 * Middleware para manejar errores de multer
 */
const handleMulterError = (err, req, res, next) => {
  if (err) {
    logger.error('Multer error', {
      context: 'ImageValidation',
      error: err.message,
      code: err.code
    });

    // Errores específicos de multer
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'El archivo excede el tamaño máximo permitido'
      });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Se excedió el número máximo de archivos permitidos'
      });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Campo de archivo inesperado'
      });
    }

    // Error genérico
    return res.status(400).json({
      error: err.message || 'Error al procesar el archivo'
    });
  }

  next();
};

/**
 * Configuraciones predefinidas para diferentes tipos de uploads
 */
const uploadConfigs = {
  // Configuración para bug reports
  bugReports: {
    fileFilter: validateBugReportFile,
    limits: validateFileSize(10), // 10MB
    maxFiles: 5
  },
  
  // Configuración para logos/branding
  branding: {
    fileFilter: validateBrandingFile,
    limits: validateFileSize(5), // 5MB
    maxFiles: 1
  },
  
  // Configuración para imágenes generales
  images: {
    fileFilter: validateImageFile,
    limits: validateFileSize(5), // 5MB
    maxFiles: 10
  },
  
  // Configuración para avatares de usuario
  avatars: {
    fileFilter: validateImageFile,
    limits: validateFileSize(2), // 2MB
    maxFiles: 1,
    dimensions: {
      minWidth: 100,
      maxWidth: 2000,
      minHeight: 100,
      maxHeight: 2000
    }
  }
};

module.exports = {
  validateFileType,
  validateImageFile,
  validateBugReportFile,
  validateBrandingFile,
  validateFileSize,
  validateFileCount,
  validateImageDimensions,
  sanitizeFileName,
  handleMulterError,
  uploadConfigs
};
