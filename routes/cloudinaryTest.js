const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/authenticate');
const { bugReportsStorage } = require('../config/cloudinaryConfig');
const uploadService = require('../services/uploadService');
const { uploadConfigs } = require('../middleware/imageValidation');

// Configurar multer para pruebas
const upload = multer({
  storage: bugReportsStorage,
  limits: uploadConfigs.images.limits,
  fileFilter: uploadConfigs.images.fileFilter
});

/**
 * GET /api/cloudinary/test - Verificar configuración
 */
router.get('/test', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Cloudinary está configurado correctamente',
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      features: {
        upload: true,
        delete: true,
        transform: true,
        cdn: true
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/cloudinary/test-upload - Probar subida de imagen
 */
router.post('/test-upload', authenticate, (req, res, next) => {
  // Middleware de multer con manejo de errores
  upload.single('testImage')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({
        success: false,
        error: err.message || 'Error al procesar el archivo'
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    console.log('=== POST /api/cloudinary/test-upload ===');
    console.log('User:', req.user?.email);
    console.log('File received:', req.file ? req.file.originalname : 'NO FILE');

    if (!req.file) {
      console.log('Error: No file provided');
      return res.status(400).json({
        success: false,
        error: 'No se proporcionó ningún archivo'
      });
    }

    console.log('File details:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path
    });

    // El archivo ya está en Cloudinary gracias a multer-storage-cloudinary
    const fileInfo = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      url: req.file.path,
      publicId: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    };

    // Obtener versiones optimizadas si es imagen (excepto SVG)
    let versions = null;
    if (req.file.mimetype.startsWith('image/') && req.file.mimetype !== 'image/svg+xml') {
      try {
        versions = uploadService.getImageVersions(req.file.filename);
        console.log('Image versions generated');
      } catch (versionError) {
        console.warn('Could not generate image versions:', versionError.message);
        // No fallar la petición, solo registrar el warning
      }
    }

    console.log('Upload successful');
    res.json({
      success: true,
      message: 'Archivo subido exitosamente a Cloudinary',
      file: fileInfo,
      versions,
      instructions: {
        delete: `Para eliminar: DELETE /api/cloudinary/test-delete/${encodeURIComponent(fileInfo.publicId)}`
      }
    });

  } catch (error) {
    console.error('Error en test-upload:', error);
    // Asegurarse de que la respuesta se envía incluso si hay error
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
});

/**
 * DELETE /api/cloudinary/delete/:publicId - Eliminar archivo de Cloudinary
 * Endpoint de producción para gestión de archivos
 */
router.delete('/delete/:publicId', authenticate, async (req, res) => {
  try {
    const publicId = decodeURIComponent(req.params.publicId);
    
    console.log('=== DELETE /api/cloudinary/delete/:publicId ===');
    console.log('Public ID:', publicId);
    
    // Determinar tipo de recurso basado en la extensión
    let resourceType = 'image';
    if (publicId.endsWith('.svg')) {
      resourceType = 'raw';
    } else if (publicId.match(/\.(pdf|doc|docx|txt)$/i)) {
      resourceType = 'raw';
    }
    
    console.log('Resource type detectado:', resourceType);
    
    const result = await uploadService.deleteFile(publicId, resourceType);

    console.log('Resultado de eliminación:', result);

    res.json({
      success: result.success,
      message: result.success 
        ? 'Archivo eliminado exitosamente de Cloudinary' 
        : 'El archivo no existe o ya fue eliminado',
      publicId: result.publicId,
      deletedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error en delete:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/cloudinary/test-delete/:publicId - [DEPRECADO] Usar /delete/:publicId
 * Mantenido por retrocompatibilidad
 */
router.delete('/test-delete/:publicId', authenticate, async (req, res) => {
  console.warn('⚠️ DEPRECADO: Usando endpoint /test-delete, migrar a /delete');
  // Redirigir a la ruta de producción
  req.url = req.url.replace('/test-delete/', '/delete/');
  return router.handle(req, res);
});

/**
 * GET /api/cloudinary/list/:folder - Listar archivos en carpeta
 */
router.get('/list/:folder', authenticate, async (req, res) => {
  try {
    const folder = req.params.folder;
    const resourceType = req.query.resourceType;

    console.log('=== GET /api/cloudinary/list/:folder ===');
    console.log('Folder requested:', folder);
    console.log('Resource type:', resourceType);

    // Si es "all", listar todo el prefijo appscrum
    const folderPath = folder === 'all' 
      ? 'appscrum' 
      : folder.replace(/%2F/g, '/');

    console.log('Folder path:', folderPath);

    // Si no se especifica resourceType, obtener ambos tipos
    let allFiles = [];
    
    if (!resourceType) {
      // Obtener imágenes (png, jpg, webp, etc.)
      const imagesResult = await uploadService.listFiles(folderPath, {
        maxResults: 100,
        resourceType: 'image'
      });
      
      // Obtener archivos raw (SVG, etc.)
      const rawResult = await uploadService.listFiles(folderPath, {
        maxResults: 100,
        resourceType: 'raw'
      });
      
      allFiles = [
        ...imagesResult.files.map(f => ({ ...f, resource_type: 'image' })),
        ...rawResult.files.map(f => ({ ...f, resource_type: 'raw' }))
      ];
    } else {
      // Si se especifica un tipo, obtener solo ese
      const result = await uploadService.listFiles(folderPath, {
        maxResults: 100,
        resourceType
      });
      allFiles = result.files.map(f => ({ ...f, resource_type: resourceType }));
    }

    console.log('Files found:', allFiles.length);
    
    // Debug: Mostrar las URLs que se están devolviendo
    if (allFiles.length > 0) {
      console.log('Primera URL de ejemplo:', allFiles[0].url);
    }

    res.json({
      success: true,
      folder: folderPath,
      files: allFiles.map(file => ({
        public_id: file.publicId,
        secure_url: file.url,
        format: file.format,
        bytes: file.size,
        created_at: file.createdAt,
        width: file.width,
        height: file.height,
        resource_type: file.resource_type,
        filename: file.publicId.split('/').pop()
      })),
      total: allFiles.length
    });

  } catch (error) {
    console.error('Error listando archivos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/cloudinary/transform-url - Generar URL con transformaciones
 */
router.post('/transform-url', authenticate, async (req, res) => {
  try {
    const { publicId, transformation } = req.body;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere publicId'
      });
    }

    // Obtener versiones optimizadas
    const versions = uploadService.getImageVersions(publicId);
    const optimizedUrl = uploadService.getOptimizedImageUrl(publicId, transformation || 'medium');

    res.json({
      success: true,
      publicId,
      optimizedUrl,
      versions,
      availableTransformations: ['thumbnail', 'medium', 'large', 'logo']
    });

  } catch (error) {
    console.error('Error generando URL transformada:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
