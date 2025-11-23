/**
 * Script para migrar archivos locales existentes a Cloudinary
 * Migra archivos de uploads/ a Cloudinary y actualiza las referencias en MongoDB
 * 
 * Uso: node scripts/migrateToCloudinary.js [--dry-run]
 */

const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const uploadService = require('../services/uploadService');
const BugReport = require('../models/BugReport');
const SystemConfig = require('../models/SystemConfig');
const logger = require('../config/logger');
require('dotenv').config();

// Analizar argumentos
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

/**
 * Verificar si un archivo existe
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Migrar attachments de Bug Reports
 */
async function migrateBugReports() {
  try {
    console.log('\n📋 Migrando Bug Reports...');
    
    const bugReports = await BugReport.find({}).lean();
    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const bug of bugReports) {
      if (!bug.attachments || bug.attachments.length === 0) {
        continue;
      }

      let updated = false;
      const updatedAttachments = [];

      for (const attachment of bug.attachments) {
        // Si ya tiene publicId de Cloudinary, skip
        if (attachment.publicId || attachment.cloudinaryData?.publicId) {
          updatedAttachments.push(attachment);
          skipped++;
          continue;
        }

        // Si el path es una URL de Cloudinary, skip
        if (attachment.path && attachment.path.includes('cloudinary.com')) {
          updatedAttachments.push(attachment);
          skipped++;
          continue;
        }

        // Verificar si el archivo local existe
        const localPath = path.join(__dirname, '..', attachment.path);
        const exists = await fileExists(localPath);

        if (!exists) {
          console.warn(`   ⚠️  Archivo no encontrado: ${attachment.path}`);
          updatedAttachments.push(attachment);
          errors++;
          continue;
        }

        if (dryRun) {
          console.log(`   [DRY-RUN] Migraría: ${attachment.originalName}`);
          updatedAttachments.push(attachment);
          continue;
        }

        try {
          // Crear un objeto file-like para el servicio de upload
          const fileStats = await fs.stat(localPath);
          const fileData = {
            path: localPath,
            originalname: attachment.originalName,
            mimetype: attachment.mimeType,
            size: fileStats.size
          };

          // Subir a Cloudinary
          const result = await uploadService.uploadFile(fileData, {
            folder: `appscrum/bug-reports/${bug._id}`,
            tags: ['migrated', 'bug-report'],
            resourceType: 'auto'
          });

          // Actualizar attachment con datos de Cloudinary
          const updatedAttachment = {
            ...attachment,
            url: result.url,
            publicId: result.publicId,
            cloudinaryData: {
              publicId: result.publicId,
              url: result.url,
              secureUrl: result.url,
              format: result.format,
              resourceType: result.resourceType
            }
          };

          updatedAttachments.push(updatedAttachment);
          migrated++;
          console.log(`   ✅ Migrado: ${attachment.originalName}`);

          // Opcional: Eliminar archivo local después de migrar
          // await fs.unlink(localPath);

        } catch (uploadError) {
          console.error(`   ❌ Error migrando ${attachment.originalName}:`, uploadError.message);
          updatedAttachments.push(attachment);
          errors++;
        }

        updated = true;
      }

      // Actualizar bug report si hubo cambios
      if (updated && !dryRun) {
        await BugReport.updateOne(
          { _id: bug._id },
          { $set: { attachments: updatedAttachments } }
        );
      }
    }

    console.log(`\n   📊 Resultado Bug Reports:`);
    console.log(`      ✅ Migrados: ${migrated}`);
    console.log(`      ⏭️  Omitidos: ${skipped}`);
    console.log(`      ❌ Errores: ${errors}`);

    return { migrated, skipped, errors };

  } catch (error) {
    console.error('❌ Error migrando Bug Reports:', error.message);
    throw error;
  }
}

/**
 * Migrar logos de System Config
 */
async function migrateSystemConfig() {
  try {
    console.log('\n🎨 Migrando System Config (Logos)...');
    
    const config = await SystemConfig.findOne({ configId: 'main' });
    
    if (!config) {
      console.log('   ⚠️  No se encontró configuración del sistema');
      return { migrated: 0, skipped: 0, errors: 0 };
    }

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    // Migrar logo principal
    if (config.branding.logo && !config.branding.logoPublicId) {
      // Si ya es URL de Cloudinary, skip
      if (config.branding.logo.includes('cloudinary.com')) {
        skipped++;
      } else {
        const localPath = path.join(__dirname, '..', config.branding.logo);
        const exists = await fileExists(localPath);

        if (exists) {
          if (dryRun) {
            console.log(`   [DRY-RUN] Migraría logo principal: ${config.branding.logo}`);
          } else {
            try {
              const fileStats = await fs.stat(localPath);
              const fileExt = path.extname(config.branding.logo);
              const fileData = {
                path: localPath,
                originalname: `logo-main${fileExt}`,
                mimetype: `image/${fileExt.slice(1)}`,
                size: fileStats.size
              };

              const result = await uploadService.uploadFile(fileData, {
                folder: 'appscrum/branding',
                tags: ['migrated', 'logo', 'main'],
                resourceType: 'image'
              });

              config.branding.logo = result.url;
              config.branding.logoPublicId = result.publicId;
              config.branding.logoVersions = result.versions;

              migrated++;
              console.log(`   ✅ Logo principal migrado`);
            } catch (error) {
              console.error(`   ❌ Error migrando logo principal:`, error.message);
              errors++;
            }
          }
        } else {
          console.warn(`   ⚠️  Logo principal no encontrado: ${config.branding.logo}`);
          errors++;
        }
      }
    } else {
      skipped++;
    }

    // Migrar logo pequeño
    if (config.branding.logoSmall && !config.branding.logoSmallPublicId) {
      if (config.branding.logoSmall.includes('cloudinary.com')) {
        skipped++;
      } else {
        const localPath = path.join(__dirname, '..', config.branding.logoSmall);
        const exists = await fileExists(localPath);

        if (exists) {
          if (dryRun) {
            console.log(`   [DRY-RUN] Migraría logo pequeño: ${config.branding.logoSmall}`);
          } else {
            try {
              const fileStats = await fs.stat(localPath);
              const fileExt = path.extname(config.branding.logoSmall);
              const fileData = {
                path: localPath,
                originalname: `logo-small${fileExt}`,
                mimetype: `image/${fileExt.slice(1)}`,
                size: fileStats.size
              };

              const result = await uploadService.uploadFile(fileData, {
                folder: 'appscrum/branding',
                tags: ['migrated', 'logo', 'small'],
                resourceType: 'image'
              });

              config.branding.logoSmall = result.url;
              config.branding.logoSmallPublicId = result.publicId;
              config.branding.logoSmallVersions = result.versions;

              migrated++;
              console.log(`   ✅ Logo pequeño migrado`);
            } catch (error) {
              console.error(`   ❌ Error migrando logo pequeño:`, error.message);
              errors++;
            }
          }
        } else {
          console.warn(`   ⚠️  Logo pequeño no encontrado: ${config.branding.logoSmall}`);
          errors++;
        }
      }
    } else {
      skipped++;
    }

    // Guardar cambios
    if (!dryRun && migrated > 0) {
      await config.save();
    }

    console.log(`\n   📊 Resultado System Config:`);
    console.log(`      ✅ Migrados: ${migrated}`);
    console.log(`      ⏭️  Omitidos: ${skipped}`);
    console.log(`      ❌ Errores: ${errors}`);

    return { migrated, skipped, errors };

  } catch (error) {
    console.error('❌ Error migrando System Config:', error.message);
    throw error;
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log('🚀 Iniciando migración a Cloudinary...\n');

    if (dryRun) {
      console.log('⚠️  MODO DRY-RUN: No se realizarán cambios reales\n');
    }

    // Conectar a MongoDB
    console.log('📡 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Ejecutar migraciones
    const bugReportsResult = await migrateBugReports();
    const systemConfigResult = await migrateSystemConfig();

    // Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN FINAL DE MIGRACIÓN');
    console.log('='.repeat(60));
    
    const totalMigrated = bugReportsResult.migrated + systemConfigResult.migrated;
    const totalSkipped = bugReportsResult.skipped + systemConfigResult.skipped;
    const totalErrors = bugReportsResult.errors + systemConfigResult.errors;

    console.log(`\n✅ Archivos migrados: ${totalMigrated}`);
    console.log(`⏭️  Archivos omitidos: ${totalSkipped}`);
    console.log(`❌ Errores: ${totalErrors}`);
    console.log('\n' + '='.repeat(60) + '\n');

    if (dryRun) {
      console.log('💡 Ejecuta sin --dry-run para realizar la migración real\n');
    } else if (totalMigrated > 0) {
      console.log('✨ Migración completada exitosamente');
      console.log('💡 Considera ejecutar cleanCloudinary.js para limpiar archivos locales\n');
    }

  } catch (error) {
    console.error('\n❌ Error en la migración:', error.message);
    logger.error('Migration script failed', {
      context: 'MigrateToCloudinary',
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Desconectado de MongoDB');
  }
}

// Ejecutar script
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Script completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { migrateBugReports, migrateSystemConfig };
