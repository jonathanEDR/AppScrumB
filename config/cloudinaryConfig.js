const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const logger = require('./logger');

// Configurar Cloudinary con variables de entorno
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true // Siempre usar HTTPS
});

/**
 * Verificar la configuración de Cloudinary
 * @returns {Promise<boolean>}
 */
const verifyCloudinaryConfig = async () => {
  try {
    // Validar que las credenciales estén configuradas
    if (!process.env.CLOUDINARY_CLOUD_NAME || 
        !process.env.CLOUDINARY_API_KEY || 
        !process.env.CLOUDINARY_API_SECRET) {
      logger.warn('Cloudinary credentials not configured', { 
        context: 'CloudinaryConfig' 
      });
      return false;
    }

    // Intentar hacer ping a Cloudinary
    await cloudinary.api.ping();
    logger.info('Cloudinary connection verified successfully', { 
      context: 'CloudinaryConfig',
      cloudName: process.env.CLOUDINARY_CLOUD_NAME 
    });
    return true;
  } catch (error) {
    logger.error('Failed to verify Cloudinary connection', { 
      context: 'CloudinaryConfig',
      error: error.message 
    });
    return false;
  }
};

/**
 * Configuración de almacenamiento para Bug Reports
 * Almacena archivos en: appscrum/bug-reports/{bugId}/
 */
const bugReportsStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Determinar el tipo de recurso basado en el mimetype
    // SVG debe ser 'raw' porque Cloudinary no lo procesa como imagen rasterizada
    let resourceType = 'image';
    if (file.mimetype === 'image/svg+xml') {
      resourceType = 'raw';
    } else if (!file.mimetype.startsWith('image/')) {
      resourceType = 'raw';
    }
    
    // Obtener ID del bug desde el body o generar uno temporal
    const bugId = req.body.bugId || `temp-${Date.now()}`;
    
    // Generar nombre único
    const timestamp = Date.now();
    const randomString = Math.round(Math.random() * 1E9);
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    
    // Para archivos raw, incluir la extensión en el public_id
    const publicId = resourceType === 'raw' 
      ? `attachment-${timestamp}-${randomString}.${fileExtension}`
      : `attachment-${timestamp}-${randomString}`;
    
    return {
      folder: `appscrum/bug-reports/${bugId}`,
      resource_type: resourceType,
      public_id: publicId,
      // NO especificar format para raw, Cloudinary lo detecta automáticamente
      // Solo establecer allowed_formats para images, no para raw
      ...(resourceType === 'image' ? {
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp']
      } : {}),
      // Metadata adicional
      context: {
        alt: file.originalname,
        caption: `Bug report attachment - ${file.originalname}`
      },
      tags: ['bug-report', 'attachment']
    };
  }
});

/**
 * Configuración de almacenamiento para Logos y Branding
 * Almacena archivos en: appscrum/branding/
 */
const brandingStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const logoType = req.body.logoType || 'main';
    const timestamp = Date.now();
    const randomString = Math.round(Math.random() * 1E9);
    
    // SVG debe usar resource_type 'raw' en Cloudinary
    const resourceType = file.mimetype === 'image/svg+xml' ? 'raw' : 'image';
    
    // Extraer extensión del archivo original
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    
    // Para archivos raw (SVG), incluir la extensión en el public_id
    const publicId = resourceType === 'raw' 
      ? `logo-${logoType}-${timestamp}-${randomString}.${fileExtension}`
      : `logo-${logoType}-${timestamp}-${randomString}`;
    
    return {
      folder: 'appscrum/branding',
      resource_type: resourceType,
      public_id: publicId,
      // NO especificar format para raw, Cloudinary lo detecta automáticamente
      // Solo allowed_formats para imágenes rasterizadas
      ...(resourceType === 'image' ? {
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp']
      } : {}),
      // Transformaciones automáticas solo para imágenes rasterizadas
      ...(resourceType === 'image' ? {
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ]
      } : {}),
      // Metadata
      context: {
        alt: `${logoType} logo`,
        caption: `Company branding - ${logoType}`
      },
      tags: ['branding', 'logo', logoType]
    };
  }
});

/**
 * Configuración de almacenamiento genérica
 * Para otros tipos de archivos
 */
const generalStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const resourceType = file.mimetype.startsWith('image/') ? 'image' : 'raw';
    const timestamp = Date.now();
    const randomString = Math.round(Math.random() * 1E9);
    const fileExtension = file.originalname.split('.').pop();
    
    return {
      folder: 'appscrum/general',
      resource_type: resourceType,
      public_id: `file-${timestamp}-${randomString}`,
      format: fileExtension,
      tags: ['general', 'upload']
    };
  }
});

/**
 * Transformaciones predefinidas para optimización de imágenes
 */
const imageTransformations = {
  // Thumbnail pequeño (100x100)
  thumbnail: {
    width: 100,
    height: 100,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto:good',
    fetch_format: 'auto'
  },
  // Imagen mediana (400x400)
  medium: {
    width: 400,
    height: 400,
    crop: 'limit',
    quality: 'auto:good',
    fetch_format: 'auto'
  },
  // Imagen grande optimizada (1200 width máximo)
  large: {
    width: 1200,
    crop: 'limit',
    quality: 'auto:best',
    fetch_format: 'auto'
  },
  // Logo optimizado
  logo: {
    height: 200,
    crop: 'fit',
    quality: 'auto:best',
    fetch_format: 'auto',
    background: 'transparent'
  }
};

/**
 * Generar URL con transformaciones
 * @param {string} publicId - ID público de Cloudinary
 * @param {string} transformation - Tipo de transformación ('thumbnail', 'medium', 'large', 'logo')
 * @returns {string} URL transformada
 */
const getTransformedUrl = (publicId, transformation = 'medium') => {
  if (!publicId) return null;
  
  try {
    const transform = imageTransformations[transformation] || imageTransformations.medium;
    return cloudinary.url(publicId, transform);
  } catch (error) {
    logger.error('Error generating transformed URL', {
      context: 'CloudinaryConfig',
      publicId,
      transformation,
      error: error.message
    });
    return null;
  }
};

/**
 * Obtener múltiples versiones de una imagen
 * @param {string} publicId - ID público de Cloudinary
 * @returns {Object} URLs de diferentes tamaños
 */
const getImageVersions = (publicId) => {
  if (!publicId) return null;
  
  try {
    return {
      original: cloudinary.url(publicId),
      thumbnail: getTransformedUrl(publicId, 'thumbnail'),
      medium: getTransformedUrl(publicId, 'medium'),
      large: getTransformedUrl(publicId, 'large')
    };
  } catch (error) {
    logger.error('Error generating image versions', {
      context: 'CloudinaryConfig',
      publicId,
      error: error.message
    });
    return null;
  }
};

module.exports = {
  cloudinary,
  bugReportsStorage,
  brandingStorage,
  generalStorage,
  imageTransformations,
  getTransformedUrl,
  getImageVersions,
  verifyCloudinaryConfig
};
