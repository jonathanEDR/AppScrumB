const { cloudinary, getTransformedUrl, getImageVersions } = require('../config/cloudinaryConfig');
const logger = require('../config/logger');
const path = require('path');

/**
 * Servicio centralizado para gestión de archivos con Cloudinary
 */
class UploadService {
  
  /**
   * Subir un archivo a Cloudinary
   * @param {Object} file - Archivo de multer
   * @param {Object} options - Opciones de subida
   * @param {string} options.folder - Carpeta en Cloudinary
   * @param {string} options.resourceType - 'image', 'raw', 'video', 'auto'
   * @param {Array} options.tags - Tags para categorizar
   * @param {Object} options.transformation - Transformaciones a aplicar
   * @returns {Promise<Object>} Resultado de la subida
   */
  async uploadFile(file, options = {}) {
    try {
      const {
        folder = 'appscrum/general',
        resourceType = 'auto',
        tags = [],
        transformation = null
      } = options;

      // Determinar el resource_type si es auto
      let finalResourceType = resourceType;
      if (resourceType === 'auto') {
        finalResourceType = file.mimetype.startsWith('image/') ? 'image' : 'raw';
      }

      // Generar public_id único
      const timestamp = Date.now();
      const randomString = Math.round(Math.random() * 1E9);
      const fileExtension = path.extname(file.originalname).slice(1);
      const publicId = `${folder}/file-${timestamp}-${randomString}`;

      // Configuración de upload
      const uploadOptions = {
        resource_type: finalResourceType,
        public_id: publicId,
        tags: ['appscrum', ...tags],
        context: {
          alt: file.originalname,
          caption: `Uploaded file - ${file.originalname}`
        }
      };

      // Añadir transformaciones si es imagen
      if (finalResourceType === 'image' && transformation) {
        uploadOptions.transformation = transformation;
      }

      // Subir archivo
      const result = await cloudinary.uploader.upload(file.path, uploadOptions);

      logger.info('File uploaded to Cloudinary', {
        context: 'UploadService',
        publicId: result.public_id,
        format: result.format,
        resourceType: result.resource_type,
        size: result.bytes
      });

      return {
        success: true,
        publicId: result.public_id,
        url: result.secure_url,
        format: result.format,
        resourceType: result.resource_type,
        width: result.width,
        height: result.height,
        size: result.bytes,
        createdAt: result.created_at,
        versions: finalResourceType === 'image' ? getImageVersions(result.public_id) : null
      };

    } catch (error) {
      logger.error('Error uploading file to Cloudinary', {
        context: 'UploadService',
        error: error.message,
        fileName: file?.originalname
      });
      throw new Error(`Error al subir archivo: ${error.message}`);
    }
  }

  /**
   * Subir múltiples archivos
   * @param {Array} files - Array de archivos de multer
   * @param {Object} options - Opciones de subida
   * @returns {Promise<Array>} Resultados de las subidas
   */
  async uploadMultipleFiles(files, options = {}) {
    try {
      const uploadPromises = files.map(file => this.uploadFile(file, options));
      const results = await Promise.all(uploadPromises);
      
      logger.info('Multiple files uploaded to Cloudinary', {
        context: 'UploadService',
        count: results.length
      });

      return results;
    } catch (error) {
      logger.error('Error uploading multiple files', {
        context: 'UploadService',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Eliminar un archivo de Cloudinary
   * @param {string} publicId - ID público del archivo en Cloudinary
   * @param {string} resourceType - Tipo de recurso ('image', 'raw', 'video')
   * @returns {Promise<Object>} Resultado de la eliminación
   */
  async deleteFile(publicId, resourceType = 'image') {
    try {
      if (!publicId) {
        throw new Error('Public ID es requerido');
      }

      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true // Invalidar CDN cache
      });

      logger.info('File deleted from Cloudinary', {
        context: 'UploadService',
        publicId,
        result: result.result
      });

      return {
        success: result.result === 'ok',
        publicId,
        result: result.result
      };

    } catch (error) {
      logger.error('Error deleting file from Cloudinary', {
        context: 'UploadService',
        publicId,
        error: error.message
      });
      throw new Error(`Error al eliminar archivo: ${error.message}`);
    }
  }

  /**
   * Eliminar múltiples archivos
   * @param {Array} publicIds - Array de IDs públicos
   * @param {string} resourceType - Tipo de recurso
   * @returns {Promise<Array>} Resultados de las eliminaciones
   */
  async deleteMultipleFiles(publicIds, resourceType = 'image') {
    try {
      const deletePromises = publicIds.map(publicId => 
        this.deleteFile(publicId, resourceType).catch(err => ({
          success: false,
          publicId,
          error: err.message
        }))
      );
      
      const results = await Promise.all(deletePromises);
      
      logger.info('Multiple files deleted from Cloudinary', {
        context: 'UploadService',
        count: results.length,
        successful: results.filter(r => r.success).length
      });

      return results;
    } catch (error) {
      logger.error('Error deleting multiple files', {
        context: 'UploadService',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtener información de un archivo
   * @param {string} publicId - ID público del archivo
   * @returns {Promise<Object>} Información del archivo
   */
  async getFileInfo(publicId) {
    try {
      const result = await cloudinary.api.resource(publicId, {
        resource_type: 'image',
        image_metadata: true
      });

      return {
        publicId: result.public_id,
        url: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        size: result.bytes,
        createdAt: result.created_at,
        tags: result.tags,
        versions: getImageVersions(result.public_id)
      };

    } catch (error) {
      // Si falla como imagen, intentar como raw
      try {
        const result = await cloudinary.api.resource(publicId, {
          resource_type: 'raw'
        });

        return {
          publicId: result.public_id,
          url: result.secure_url,
          format: result.format,
          size: result.bytes,
          createdAt: result.created_at,
          tags: result.tags
        };
      } catch (rawError) {
        logger.error('Error getting file info from Cloudinary', {
          context: 'UploadService',
          publicId,
          error: error.message
        });
        throw new Error(`Error al obtener información del archivo: ${error.message}`);
      }
    }
  }

  /**
   * Listar archivos en una carpeta
   * @param {string} folder - Carpeta a listar
   * @param {Object} options - Opciones de listado
   * @returns {Promise<Object>} Lista de archivos
   */
  async listFiles(folder, options = {}) {
    try {
      const {
        maxResults = 100,
        resourceType = 'image',
        type = 'upload'
      } = options;

      const result = await cloudinary.api.resources({
        type,
        prefix: folder,
        max_results: maxResults,
        resource_type: resourceType
      });

      logger.info('Files listed from Cloudinary', {
        context: 'UploadService',
        folder,
        count: result.resources.length
      });

      const mappedFiles = result.resources.map(resource => ({
        publicId: resource.public_id,
        url: resource.secure_url,
        format: resource.format,
        size: resource.bytes,
        createdAt: resource.created_at,
        width: resource.width,
        height: resource.height
      }));

      // Debug: Log de la primera URL para verificar
      if (mappedFiles.length > 0) {
        console.log('🔍 DEBUG - Primera URL de Cloudinary:', mappedFiles[0].url);
      }

      return {
        files: mappedFiles,
        total: result.resources.length,
        nextCursor: result.next_cursor
      };

    } catch (error) {
      logger.error('Error listing files from Cloudinary', {
        context: 'UploadService',
        folder,
        error: error.message
      });
      throw new Error(`Error al listar archivos: ${error.message}`);
    }
  }

  /**
   * Limpiar archivos huérfanos (sin referencias en BD)
   * @param {string} folder - Carpeta a limpiar
   * @param {Array} validPublicIds - IDs públicos válidos que NO deben eliminarse
   * @returns {Promise<Object>} Resultado de la limpieza
   */
  async cleanOrphanedFiles(folder, validPublicIds = []) {
    try {
      // Listar todos los archivos en la carpeta
      const { files } = await this.listFiles(folder, { maxResults: 500 });
      
      // Filtrar archivos huérfanos
      const orphanedFiles = files.filter(file => 
        !validPublicIds.includes(file.publicId)
      );

      if (orphanedFiles.length === 0) {
        logger.info('No orphaned files found', {
          context: 'UploadService',
          folder
        });
        return {
          success: true,
          deletedCount: 0,
          message: 'No se encontraron archivos huérfanos'
        };
      }

      // Eliminar archivos huérfanos
      const deleteResults = await this.deleteMultipleFiles(
        orphanedFiles.map(f => f.publicId)
      );

      const deletedCount = deleteResults.filter(r => r.success).length;

      logger.info('Orphaned files cleaned', {
        context: 'UploadService',
        folder,
        deletedCount,
        totalOrphaned: orphanedFiles.length
      });

      return {
        success: true,
        deletedCount,
        totalOrphaned: orphanedFiles.length,
        results: deleteResults
      };

    } catch (error) {
      logger.error('Error cleaning orphaned files', {
        context: 'UploadService',
        folder,
        error: error.message
      });
      throw new Error(`Error al limpiar archivos huérfanos: ${error.message}`);
    }
  }

  /**
   * Generar URL firmada (signed URL) para acceso privado
   * @param {string} publicId - ID público del archivo
   * @param {Object} options - Opciones de firma
   * @returns {string} URL firmada
   */
  generateSignedUrl(publicId, options = {}) {
    try {
      const {
        expiresAt = Math.floor(Date.now() / 1000) + 3600, // 1 hora por defecto
        transformation = null
      } = options;

      const signedUrl = cloudinary.url(publicId, {
        sign_url: true,
        expires_at: expiresAt,
        transformation
      });

      return signedUrl;

    } catch (error) {
      logger.error('Error generating signed URL', {
        context: 'UploadService',
        publicId,
        error: error.message
      });
      throw new Error(`Error al generar URL firmada: ${error.message}`);
    }
  }

  /**
   * Optimizar imagen con transformaciones
   * @param {string} publicId - ID público de la imagen
   * @param {string} size - Tamaño ('thumbnail', 'medium', 'large')
   * @returns {string} URL optimizada
   */
  getOptimizedImageUrl(publicId, size = 'medium') {
    return getTransformedUrl(publicId, size);
  }

  /**
   * Obtener todas las versiones de una imagen
   * @param {string} publicId - ID público de la imagen
   * @returns {Object} URLs de diferentes tamaños
   */
  getImageVersions(publicId) {
    return getImageVersions(publicId);
  }
}

module.exports = new UploadService();
