const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate, requireSuperAdmin } = require('../middleware/authenticate');
const { bugReportsStorage, brandingStorage } = require('../config/cloudinaryConfig');
const uploadService = require('../services/uploadService');
const { uploadConfigs } = require('../middleware/imageValidation');

/**
 * ============================================================
 * CLOUDINARY MANAGEMENT ROUTES - PRODUCTION
 * Endpoints de producción para gestión de archivos en Cloudinary
 * ============================================================
 */

// Configurar multer para diferentes tipos de archivos
const uploadBugReports = multer({
  storage: bugReportsStorage,
  limits: uploadConfigs.images.limits,
  fileFilter: uploadConfigs.images.fileFilter
});

const uploadBranding = multer({
  storage: brandingStorage,
  limits: uploadConfigs.branding.limits,
  fileFilter: uploadConfigs.branding.fileFilter
});

/**
 * GET /api/cloudinary/files/:folder - Listar archivos desde MongoDB (source of truth)
 * 
 * Este endpoint devuelve archivos que tienen referencias válidas en la base de datos.
 * NO consulta Cloudinary API directamente para evitar problemas de cache.
 */
router.get('/files/:folder', authenticate, async (req, res) => {
  try {
    const folder = req.params.folder;
    const BugReport = require('../models/BugReport');
    const SystemConfig = require('../models/SystemConfig');

    console.log('=== GET /api/cloudinary/files/:folder ===');
    console.log('Folder:', folder);
    console.log('Source: MongoDB (references)');

    let allFiles = [];

    // Obtener archivos de BugReports
    const bugReports = await BugReport.find({
      'attachments.0': { $exists: true }
    }).select('attachments');

    bugReports.forEach(bug => {
      bug.attachments.forEach(att => {
        const publicId = att.cloudinaryData?.publicId || att.publicId;
        const url = att.cloudinaryData?.secureUrl || att.cloudinaryData?.url || att.url || att.path;
        
        if (publicId && url) {
          // Filtrar por carpeta si no es "all"
          if (folder === 'all' || publicId.startsWith(`appscrum/${folder}`)) {
            allFiles.push({
              public_id: publicId,
              secure_url: url,
              format: att.cloudinaryData?.format || att.mimeType?.split('/')[1] || 'unknown',
              bytes: att.size || 0,
              created_at: att.uploadedAt || att.createdAt,
              resource_type: att.cloudinaryData?.resourceType || 'raw',
              filename: att.originalName || publicId.split('/').pop(),
              source: 'bug_report'
            });
          }
        }
      });
    });

    // Obtener archivos de SystemConfig
    const systemConfig = await SystemConfig.findOne({ configId: 'main' });
    if (systemConfig?.branding) {
      // Logo principal
      if (systemConfig.branding.logoPublicId && systemConfig.branding.logo) {
        if (folder === 'all' || folder === 'branding') {
          allFiles.push({
            public_id: systemConfig.branding.logoPublicId,
            secure_url: systemConfig.branding.logo,
            format: 'png',
            bytes: 0,
            created_at: new Date(),
            resource_type: 'image',
            filename: 'logo-principal',
            source: 'system_config'
          });
        }
      }

      // Logo pequeño
      if (systemConfig.branding.logoSmallPublicId && systemConfig.branding.logoSmall) {
        if (folder === 'all' || folder === 'branding') {
          allFiles.push({
            public_id: systemConfig.branding.logoSmallPublicId,
            secure_url: systemConfig.branding.logoSmall,
            format: 'png',
            bytes: 0,
            created_at: new Date(),
            resource_type: 'image',
            filename: 'logo-small',
            source: 'system_config'
          });
        }
      }
    }

    // Archivos del panel de administración
    if (systemConfig?.adminFiles && Array.isArray(systemConfig.adminFiles)) {
      systemConfig.adminFiles.forEach(file => {
        if (folder === 'all' || file.publicId.includes(folder)) {
          allFiles.push({
            public_id: file.publicId,
            secure_url: file.url,
            format: file.mimeType?.split('/')[1]?.replace('+xml', '') || 'unknown',
            bytes: file.size || 0,
            created_at: file.uploadedAt,
            resource_type: file.mimeType?.startsWith('image/') ? 'image' : 'raw',
            filename: file.originalName,
            source: 'admin_panel'
          });
        }
      });
    }

    console.log(`✅ Files found in MongoDB: ${allFiles.length}`);

    res.json({
      success: true,
      folder: folder,
      files: allFiles,
      total: allFiles.length,
      source: 'mongodb'
    });

  } catch (error) {
    console.error('❌ Error listing files from MongoDB:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/cloudinary/upload/:type - Subir archivo a Cloudinary
 * Types: bug-report, branding
 */
router.post('/upload/:type', authenticate, async (req, res) => {
  try {
    const uploadType = req.params.type;
    
    // Seleccionar el middleware de upload apropiado
    let uploadMiddleware;
    if (uploadType === 'branding') {
      uploadMiddleware = uploadBranding.single('file');
    } else {
      uploadMiddleware = uploadBugReports.single('file');
    }

    // Ejecutar multer middleware
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({
          success: false,
          error: err.message || 'Error al subir archivo'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No se proporcionó ningún archivo'
        });
      }

      console.log('✅ File uploaded:', req.file.filename);

      // Generar versiones optimizadas si es imagen
      let versions = null;
      if (req.file.mimetype.startsWith('image/') && req.file.mimetype !== 'image/svg+xml') {
        try {
          versions = uploadService.getImageVersions(req.file.filename);
        } catch (versionError) {
          console.warn('Could not generate image versions:', versionError.message);
        }
      }

      res.json({
        success: true,
        message: 'Archivo subido exitosamente',
        file: {
          publicId: req.file.filename,
          url: req.file.path,
          format: req.file.mimetype.split('/')[1],
          size: req.file.size,
          originalName: req.file.originalname
        },
        versions
      });
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/cloudinary/delete/:publicId - Eliminar archivo de Cloudinary
 * 
 * Este endpoint hace dos cosas:
 * 1. Elimina el archivo de Cloudinary
 * 2. Elimina la referencia en MongoDB (BugReport o SystemConfig)
 */
router.delete('/delete/:publicId', authenticate, async (req, res) => {
  try {
    const publicId = decodeURIComponent(req.params.publicId);
    
    console.log('=== DELETE /api/cloudinary/delete/:publicId ===');
    console.log('Public ID:', publicId);
    console.log('User:', req.user?.email);
    
    // Detectar tipo de recurso por extensión
    let resourceType = 'image';
    if (publicId.endsWith('.svg')) {
      resourceType = 'raw';
    } else if (publicId.match(/\.(pdf|doc|docx|txt)$/i)) {
      resourceType = 'raw';
    }
    
    console.log('Resource type:', resourceType);
    
    // 1. Intentar eliminar de Cloudinary (puede que ya no exista)
    const result = await uploadService.deleteFile(publicId, resourceType);
    console.log('✅ Cloudinary deletion result:', result);

    // ⚠️ IMPORTANTE: Aunque falle en Cloudinary, SIEMPRE limpiar MongoDB
    // Esto previene referencias huérfanas
    let cloudinaryDeleted = result.success;
    
    if (!cloudinaryDeleted) {
      console.log('⚠️  File not found in Cloudinary, but will clean MongoDB references');
    }

    // 2. Eliminar referencias en MongoDB (SIEMPRE ejecutar)
    const BugReport = require('../models/BugReport');
    const SystemConfig = require('../models/SystemConfig');
    
    let dbUpdateResult = { type: 'orphan', message: 'Archivo huérfano (sin referencia en BD)' };

    // A. Buscar en BugReports
    const bugReportUpdate = await BugReport.updateMany(
      {
        $or: [
          { 'attachments.publicId': publicId },
          { 'attachments.cloudinaryData.publicId': publicId }
        ]
      },
      {
        $pull: {
          attachments: {
            $or: [
              { publicId: publicId },
              { 'cloudinaryData.publicId': publicId }
            ]
          }
        }
      }
    );

    if (bugReportUpdate.modifiedCount > 0) {
      dbUpdateResult = {
        type: 'bug_report',
        message: `Eliminado de ${bugReportUpdate.modifiedCount} BugReport(s)`,
        modifiedCount: bugReportUpdate.modifiedCount
      };
      console.log('✅ Removed from BugReports:', bugReportUpdate.modifiedCount);
    }

    // B. Buscar en SystemConfig
    const systemConfig = await SystemConfig.findOne({ configId: 'main' });
    if (systemConfig) {
      let configUpdated = false;

      // Verificar logo principal
      if (systemConfig.branding?.logoPublicId === publicId) {
        systemConfig.branding.logo = null;
        systemConfig.branding.logoPublicId = null;
        systemConfig.branding.logoVersions = {};
        configUpdated = true;
        console.log('✅ Removed logo principal from SystemConfig');
      }

      // Verificar logo pequeño
      if (systemConfig.branding?.logoSmallPublicId === publicId) {
        systemConfig.branding.logoSmall = null;
        systemConfig.branding.logoSmallPublicId = null;
        systemConfig.branding.logoSmallVersions = {};
        configUpdated = true;
        console.log('✅ Removed logo pequeño from SystemConfig');
      }

      // Verificar adminFiles
      if (systemConfig.adminFiles && Array.isArray(systemConfig.adminFiles)) {
        const initialLength = systemConfig.adminFiles.length;
        systemConfig.adminFiles = systemConfig.adminFiles.filter(f => f.publicId !== publicId);
        
        if (systemConfig.adminFiles.length < initialLength) {
          configUpdated = true;
          console.log('✅ Removed from adminFiles');
          dbUpdateResult = {
            type: 'admin_panel',
            message: 'Eliminado de archivos de administración',
            removedCount: initialLength - systemConfig.adminFiles.length
          };
        }
      }

      if (configUpdated) {
        await systemConfig.save();
        if (dbUpdateResult.type === 'orphan') {
          dbUpdateResult = {
            type: 'system_config',
            message: 'Eliminado de SystemConfig (logo)',
            configUpdated: true
          };
        }
      }
    }

    console.log('📊 DB Update Result:', dbUpdateResult);

    res.json({
      success: true,
      message: cloudinaryDeleted 
        ? 'Archivo eliminado exitosamente de Cloudinary y MongoDB'
        : 'Referencia eliminada de MongoDB (archivo ya no existía en Cloudinary)',
      publicId: publicId,
      deletedAt: new Date().toISOString(),
      cloudinaryDeleted,
      databaseUpdate: dbUpdateResult
    });

  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/cloudinary/bulk-delete - Eliminar múltiples archivos
 */
router.delete('/bulk-delete', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { publicIds } = req.body;
    
    if (!Array.isArray(publicIds) || publicIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de publicIds'
      });
    }

    console.log('=== DELETE /api/cloudinary/bulk-delete ===');
    console.log('Deleting:', publicIds.length, 'files');
    console.log('User:', req.user?.email);

    const results = await Promise.allSettled(
      publicIds.map(publicId => {
        const resourceType = publicId.endsWith('.svg') ? 'raw' : 'image';
        return uploadService.deleteFile(publicId, resourceType);
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    console.log(`✅ Deleted: ${successful}, Failed: ${failed}`);

    res.json({
      success: true,
      message: `${successful} archivos eliminados, ${failed} fallidos`,
      results: {
        total: results.length,
        successful,
        failed,
        details: results.map((r, i) => ({
          publicId: publicIds[i],
          success: r.status === 'fulfilled' && r.value.success,
          error: r.status === 'rejected' ? r.reason.message : null
        }))
      }
    });

  } catch (error) {
    console.error('❌ Bulk delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/cloudinary/admin-upload - Subir archivo desde panel de administración
 * Este endpoint sube el archivo Y guarda la referencia en MongoDB
 */
router.post('/admin-upload', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    console.log('=== POST /api/cloudinary/admin-upload ===');
    console.log('User:', req.user?.email);

    // Usar el middleware de branding (permite más formatos)
    uploadBranding.single('file')(req, res, async (err) => {
      if (err) {
        console.error('❌ Upload error:', err);
        return res.status(400).json({
          success: false,
          error: err.message || 'Error al subir archivo'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No se proporcionó ningún archivo'
        });
      }

      console.log('✅ File uploaded to Cloudinary:', req.file.filename);
      console.log('📸 Cloudinary Response Details:', {
        filename: req.file.filename,
        path: req.file.path,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        encoding: req.file.encoding,
        fieldname: req.file.fieldname
      });

      // Guardar referencia en SystemConfig
      const SystemConfig = require('../models/SystemConfig');
      let systemConfig = await SystemConfig.findOne({ configId: 'main' });
      
      if (!systemConfig) {
        systemConfig = new SystemConfig({ configId: 'main' });
      }

      // Inicializar adminFiles si no existe
      if (!systemConfig.adminFiles) {
        systemConfig.adminFiles = [];
      }

      // Agregar referencia del archivo
      const fileData = {
        publicId: req.file.filename,
        url: req.file.path,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedBy: req.user.id,
        uploadedAt: new Date()
      };
      
      console.log('💾 Saving to MongoDB:', fileData);
      systemConfig.adminFiles.push(fileData);

      await systemConfig.save();

      console.log('✅ Reference saved in MongoDB');

      const responseData = {
        publicId: req.file.filename,
        url: req.file.path,
        secure_url: req.file.path,
        format: req.file.mimetype.split('/')[1],
        size: req.file.size,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        uploadedAt: new Date()
      };
      
      console.log('📤 Sending response to frontend:', responseData);

      res.json({
        success: true,
        message: 'Archivo subido y guardado exitosamente',
        file: responseData
      });
    });

  } catch (error) {
    console.error('❌ Admin upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/cloudinary/stats - Obtener estadísticas de uso
 */
router.get('/stats', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    console.log('=== GET /api/cloudinary/stats ===');
    
    // Obtener archivos de todas las carpetas
    const [imagesResult, rawResult] = await Promise.all([
      uploadService.listFiles('appscrum', {
        maxResults: 500,
        resourceType: 'image'
      }),
      uploadService.listFiles('appscrum', {
        maxResults: 500,
        resourceType: 'raw'
      })
    ]);

    const allFiles = [
      ...imagesResult.files,
      ...rawResult.files
    ];

    const totalSize = allFiles.reduce((sum, file) => sum + (file.size || 0), 0);
    const byFormat = {};
    
    allFiles.forEach(file => {
      const format = file.format || 'unknown';
      byFormat[format] = (byFormat[format] || 0) + 1;
    });

    const stats = {
      totalFiles: allFiles.length,
      totalSizeBytes: totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      images: imagesResult.files.length,
      raw: rawResult.files.length,
      byFormat,
      folders: {
        bugReports: allFiles.filter(f => f.publicId.includes('bug-reports')).length,
        branding: allFiles.filter(f => f.publicId.includes('branding')).length
      }
    };

    console.log('✅ Stats:', stats);

    res.json({
      success: true,
      stats,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
