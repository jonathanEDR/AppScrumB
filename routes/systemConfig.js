const express = require('express');
const multer = require('multer');
const SystemConfig = require('../models/SystemConfig');
const { 
  authenticate, 
  requireSuperAdmin 
} = require('../middleware/authenticate');
const { brandingStorage } = require('../config/cloudinaryConfig');
const uploadService = require('../services/uploadService');
const { 
  uploadConfigs, 
  handleMulterError 
} = require('../middleware/imageValidation');
const router = express.Router();

// Configurar multer con Cloudinary para logos
const upload = multer({
  storage: brandingStorage,
  fileFilter: uploadConfigs.branding.fileFilter,
  limits: uploadConfigs.branding.limits
});

// ============= OBTENER CONFIGURACIÓN DEL SISTEMA =============
router.get('/config', authenticate, async (req, res) => {
  try {
    console.log('=== GET /system-config/config request ===');
    console.log('User making request:', req.user?.email);
    
    const config = await SystemConfig.getMainConfig();
    
    console.log('Configuration retrieved successfully');
    res.status(200).json({
      status: 'success',
      config
    });
  } catch (error) {
    console.error('Error obteniendo configuración del sistema:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error al obtener configuración del sistema', 
      error: error.message 
    });
  }
});

// ============= ACTUALIZAR CONFIGURACIÓN DEL SISTEMA =============
router.put('/config', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    console.log('=== PUT /system-config/config request ===');
    console.log('User making request:', req.user?.email);
    console.log('Update data:', req.body);
    
    const config = await SystemConfig.getMainConfig();
    const updatedConfig = await config.updateConfig(req.body, req.user._id);
    
    console.log('Configuration updated successfully');
    res.status(200).json({
      status: 'success',
      message: 'Configuración actualizada exitosamente',
      config: updatedConfig
    });
  } catch (error) {
    console.error('Error actualizando configuración del sistema:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error al actualizar configuración del sistema', 
      error: error.message 
    });
  }
});

// ============= SUBIR LOGO =============
router.post('/upload-logo', authenticate, requireSuperAdmin, upload.single('logo'), handleMulterError, async (req, res) => {
  try {
    console.log('=== POST /system-config/upload-logo request ===');
    console.log('User making request:', req.user?.email);
    console.log('File uploaded to Cloudinary:', req.file?.filename);
    
    if (!req.file) {
      return res.status(400).json({ 
        status: 'error',
        message: 'No se ha subido ningún archivo' 
      });
    }
    
    const logoType = req.body.logoType || 'main'; // 'main' o 'small'
    
    // URL de Cloudinary
    const logoUrl = req.file.path; // Cloudinary secure_url
    const publicId = req.file.filename; // Cloudinary public_id
    
    // Obtener versiones optimizadas de la imagen
    const imageVersions = uploadService.getImageVersions(publicId);
    
    // Actualizar configuración con la nueva URL del logo
    const config = await SystemConfig.getMainConfig();
    
    // Eliminar logo anterior de Cloudinary si existe
    if (logoType === 'main' && config.branding.logoPublicId) {
      try {
        await uploadService.deleteFile(config.branding.logoPublicId, 'image');
        console.log('Old logo deleted from Cloudinary:', config.branding.logoPublicId);
      } catch (err) {
        console.warn('Could not delete old logo from Cloudinary:', err.message);
      }
    } else if (logoType === 'small' && config.branding.logoSmallPublicId) {
      try {
        await uploadService.deleteFile(config.branding.logoSmallPublicId, 'image');
        console.log('Old small logo deleted from Cloudinary:', config.branding.logoSmallPublicId);
      } catch (err) {
        console.warn('Could not delete old small logo from Cloudinary:', err.message);
      }
    }
    
    // Actualizar con nuevo logo
    const updateData = {
      branding: {
        ...config.branding.toObject(),
        [logoType === 'main' ? 'logo' : 'logoSmall']: logoUrl,
        [logoType === 'main' ? 'logoPublicId' : 'logoSmallPublicId']: publicId,
        [logoType === 'main' ? 'logoVersions' : 'logoSmallVersions']: imageVersions
      }
    };
    
    const updatedConfig = await config.updateConfig(updateData, req.user._id);
    
    console.log('Logo uploaded to Cloudinary and configuration updated successfully');
    res.status(200).json({
      status: 'success',
      message: 'Logo subido exitosamente',
      logoUrl,
      logoUrl,
      publicId,
      versions: imageVersions,
      config: updatedConfig
    });
  } catch (error) {
    console.error('Error subiendo logo:', error);
    
    // Limpiar archivo de Cloudinary si hubo error
    if (req.file && req.file.filename) {
      uploadService.deleteFile(req.file.filename, 'image').catch(err => 
        console.error('Error eliminando archivo de Cloudinary:', err)
      );
    }
    
    res.status(500).json({ 
      status: 'error',
      message: 'Error al subir logo', 
      error: error.message 
    });
  }
});

// ============= ELIMINAR LOGO =============
router.delete('/logo/:type', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    console.log('=== DELETE /system-config/logo/:type request ===');
    console.log('User making request:', req.user?.email);
    console.log('Logo type:', req.params.type);
    
    const { type } = req.params;
    
    if (!['main', 'small'].includes(type)) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Tipo de logo inválido. Use "main" o "small"' 
      });
    }
    
    const config = await SystemConfig.getMainConfig();
    const logoField = type === 'main' ? 'logo' : 'logoSmall';
    const publicIdField = type === 'main' ? 'logoPublicId' : 'logoSmallPublicId';
    const logoUrl = config.branding[logoField];
    const publicId = config.branding[publicIdField];
    
    if (!logoUrl) {
      return res.status(404).json({ 
        status: 'error',
        message: 'No hay logo configurado para eliminar' 
      });
    }
    
    // Eliminar archivo de Cloudinary
    if (publicId) {
      try {
        await uploadService.deleteFile(publicId, 'image');
        console.log('Logo deleted from Cloudinary:', publicId);
      } catch (err) {
        console.warn('Could not delete logo from Cloudinary:', err.message);
      }
    }
    
    // Actualizar configuración
    const updateData = {
      branding: {
        ...config.branding.toObject(),
        [logoField]: null,
        [publicIdField]: null,
        [type === 'main' ? 'logoVersions' : 'logoSmallVersions']: null
      }
    };
    
    const updatedConfig = await config.updateConfig(updateData, req.user._id);
    
    console.log('Logo deleted successfully');
    res.status(200).json({
      status: 'success',
      message: 'Logo eliminado exitosamente',
      config: updatedConfig
    });
  } catch (error) {
    console.error('Error eliminando logo:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error al eliminar logo', 
      error: error.message 
    });
  }
});

// ============= CAMBIAR TEMA =============
router.put('/theme', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    console.log('=== PUT /system-config/theme request ===');
    console.log('User making request:', req.user?.email);
    console.log('Theme data:', req.body);
    
    const { mode, defaultMode, allowUserToggle } = req.body;
    
    const config = await SystemConfig.getMainConfig();
    
    const updateData = {
      theme: {
        ...config.theme.toObject(),
        ...(mode && { mode }),
        ...(defaultMode && { defaultMode }),
        ...(allowUserToggle !== undefined && { allowUserToggle })
      }
    };
    
    const updatedConfig = await config.updateConfig(updateData, req.user._id);
    
    console.log('Theme updated successfully');
    res.status(200).json({
      status: 'success',
      message: 'Tema actualizado exitosamente',
      config: updatedConfig
    });
  } catch (error) {
    console.error('Error actualizando tema:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error al actualizar tema', 
      error: error.message 
    });
  }
});

// ============= RESTABLECER CONFIGURACIÓN POR DEFECTO =============
router.post('/reset', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    console.log('=== POST /system-config/reset request ===');
    console.log('User making request:', req.user?.email);
    
    const config = await SystemConfig.getMainConfig();
    
    // Eliminar logos si existen
    if (config.branding.logo) {
      try {
        const logoPath = path.join(__dirname, '..', config.branding.logo);
        await fs.unlink(logoPath);
      } catch (err) {
        console.warn('Could not delete logo:', err.message);
      }
    }
    
    if (config.branding.logoSmall) {
      try {
        const logoPath = path.join(__dirname, '..', config.branding.logoSmall);
        await fs.unlink(logoPath);
      } catch (err) {
        console.warn('Could not delete small logo:', err.message);
      }
    }
    
    // Restablecer a valores por defecto
    const defaultConfig = {
      branding: {
        appName: 'AppScrum',
        logo: null,
        logoSmall: null,
        description: 'Sistema de gestión ágil de proyectos'
      },
      theme: {
        mode: 'light',
        defaultMode: 'light',
        allowUserToggle: true
      },
      features: {
        enableDarkMode: true,
        enableCustomColors: false
      }
    };
    
    const updatedConfig = await config.updateConfig(defaultConfig, req.user._id);
    
    console.log('Configuration reset to defaults successfully');
    res.status(200).json({
      status: 'success',
      message: 'Configuración restablecida a valores por defecto',
      config: updatedConfig
    });
  } catch (error) {
    console.error('Error restableciendo configuración:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error al restablecer configuración', 
      error: error.message 
    });
  }
});

module.exports = router;
