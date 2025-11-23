/**
 * Tests para uploadService
 * 
 * NOTA: Estos tests requieren credenciales válidas de Cloudinary en .env
 * Para ejecutar: npm test -- uploadService.test.js
 */

const uploadService = require('../services/uploadService');
const { cloudinary } = require('../config/cloudinaryConfig');
const fs = require('fs').promises;
const path = require('path');

// Skip tests si Cloudinary no está configurado
const cloudinaryConfigured = 
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_SECRET;

const describeOrSkip = cloudinaryConfigured ? describe : describe.skip;

describeOrSkip('UploadService', () => {
  
  let testFilePublicId = null;

  // Limpiar después de todos los tests
  afterAll(async () => {
    if (testFilePublicId) {
      try {
        await uploadService.deleteFile(testFilePublicId, 'raw');
      } catch (error) {
        console.warn('Could not clean up test file:', error.message);
      }
    }
  });

  describe('uploadFile', () => {
    it('debería subir un archivo correctamente', async () => {
      // Crear archivo temporal de prueba
      const testFilePath = path.join(__dirname, 'test-file.txt');
      await fs.writeFile(testFilePath, 'Test content for Cloudinary');

      const mockFile = {
        path: testFilePath,
        originalname: 'test-file.txt',
        mimetype: 'text/plain',
        size: 100
      };

      const result = await uploadService.uploadFile(mockFile, {
        folder: 'appscrum/test',
        tags: ['test', 'automated'],
        resourceType: 'raw'
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('publicId');
      expect(result.url).toContain('cloudinary.com');

      testFilePublicId = result.publicId;

      // Limpiar archivo temporal
      await fs.unlink(testFilePath);
    }, 30000); // 30 segundos timeout

    it('debería fallar con archivo inválido', async () => {
      const mockFile = {
        path: '/ruta/inexistente/archivo.txt',
        originalname: 'test-file.txt',
        mimetype: 'text/plain',
        size: 100
      };

      await expect(
        uploadService.uploadFile(mockFile, {
          folder: 'appscrum/test',
          tags: ['test'],
          resourceType: 'raw'
        })
      ).rejects.toThrow();
    });
  });

  describe('deleteFile', () => {
    it('debería eliminar un archivo existente', async () => {
      // Primero subir un archivo de prueba
      const testFilePath = path.join(__dirname, 'test-delete.txt');
      await fs.writeFile(testFilePath, 'Test delete content');

      const mockFile = {
        path: testFilePath,
        originalname: 'test-delete.txt',
        mimetype: 'text/plain',
        size: 50
      };

      const uploadResult = await uploadService.uploadFile(mockFile, {
        folder: 'appscrum/test',
        tags: ['test', 'delete'],
        resourceType: 'raw'
      });

      // Ahora eliminarlo
      const deleteResult = await uploadService.deleteFile(
        uploadResult.publicId, 
        'raw'
      );

      expect(deleteResult).toHaveProperty('success', true);
      expect(deleteResult.publicId).toBe(uploadResult.publicId);

      // Limpiar
      await fs.unlink(testFilePath);
    }, 30000);

    it('debería manejar eliminación de archivo inexistente', async () => {
      const result = await uploadService.deleteFile(
        'appscrum/test/nonexistent-123456', 
        'raw'
      );

      // Cloudinary retorna ok incluso si el archivo no existe
      expect(result).toHaveProperty('success');
    });
  });

  describe('getImageVersions', () => {
    it('debería retornar versiones de una imagen', () => {
      const publicId = 'appscrum/test/image-123';
      const versions = uploadService.getImageVersions(publicId);

      expect(versions).toHaveProperty('original');
      expect(versions).toHaveProperty('thumbnail');
      expect(versions).toHaveProperty('medium');
      expect(versions).toHaveProperty('large');
      expect(versions.original).toContain(publicId);
    });

    it('debería retornar null para publicId vacío', () => {
      const versions = uploadService.getImageVersions(null);
      expect(versions).toBeNull();
    });
  });

  describe('getOptimizedImageUrl', () => {
    it('debería retornar URL optimizada', () => {
      const publicId = 'appscrum/test/image-123';
      const url = uploadService.getOptimizedImageUrl(publicId, 'medium');

      expect(url).toContain(publicId);
      expect(url).toContain('cloudinary.com');
    });

    it('debería usar tamaño medium por defecto', () => {
      const publicId = 'appscrum/test/image-123';
      const url = uploadService.getOptimizedImageUrl(publicId);

      expect(url).toContain(publicId);
    });
  });
});

describe('UploadService (sin Cloudinary)', () => {
  it('debería existir el servicio', () => {
    expect(uploadService).toBeDefined();
    expect(uploadService.uploadFile).toBeInstanceOf(Function);
    expect(uploadService.deleteFile).toBeInstanceOf(Function);
    expect(uploadService.getImageVersions).toBeInstanceOf(Function);
  });

  it('getImageVersions debería manejar valores null', () => {
    expect(uploadService.getImageVersions(null)).toBeNull();
    expect(uploadService.getImageVersions(undefined)).toBeNull();
    expect(uploadService.getImageVersions('')).toBeNull();
  });
});
