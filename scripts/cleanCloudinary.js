/**
 * Script para limpiar archivos huérfanos de Cloudinary
 * Elimina archivos que no tienen referencia en la base de datos
 * 
 * Uso: node scripts/cleanCloudinary.js [--folder=appscrum/bug-reports] [--dry-run]
 */

const mongoose = require('mongoose');
const uploadService = require('../services/uploadService');
const BugReport = require('../models/BugReport');
const SystemConfig = require('../models/SystemConfig');
const logger = require('../config/logger');
require('dotenv').config();

// Analizar argumentos de línea de comandos
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const folderArg = args.find(arg => arg.startsWith('--folder='));
const targetFolder = folderArg ? folderArg.split('=')[1] : null;

/**
 * Obtener todos los publicIds válidos de Bug Reports
 */
async function getBugReportsPublicIds() {
  try {
    const bugReports = await BugReport.find({}, 'attachments').lean();
    const publicIds = [];

    bugReports.forEach(bug => {
      if (bug.attachments && bug.attachments.length > 0) {
        bug.attachments.forEach(attachment => {
          if (attachment.publicId) {
            publicIds.push(attachment.publicId);
          } else if (attachment.cloudinaryData?.publicId) {
            publicIds.push(attachment.cloudinaryData.publicId);
          }
        });
      }
    });

    return publicIds;
  } catch (error) {
    logger.error('Error getting bug reports public IDs', {
      context: 'CleanCloudinary',
      error: error.message
    });
    throw error;
  }
}

/**
 * Obtener todos los publicIds válidos de System Config (logos)
 */
async function getSystemConfigPublicIds() {
  try {
    const config = await SystemConfig.findOne({ configId: 'main' }, 'branding').lean();
    const publicIds = [];

    if (config?.branding) {
      if (config.branding.logoPublicId) {
        publicIds.push(config.branding.logoPublicId);
      }
      if (config.branding.logoSmallPublicId) {
        publicIds.push(config.branding.logoSmallPublicId);
      }
    }

    return publicIds;
  } catch (error) {
    logger.error('Error getting system config public IDs', {
      context: 'CleanCloudinary',
      error: error.message
    });
    throw error;
  }
}

/**
 * Limpiar archivos huérfanos en una carpeta específica
 */
async function cleanFolder(folder, validPublicIds) {
  try {
    console.log(`\n🔍 Analizando carpeta: ${folder}`);
    console.log(`📋 IDs válidos encontrados: ${validPublicIds.length}`);

    if (dryRun) {
      console.log('⚠️  MODO DRY-RUN: No se eliminarán archivos realmente\n');
    }

    const result = dryRun 
      ? await analyzeOrphanedFiles(folder, validPublicIds)
      : await uploadService.cleanOrphanedFiles(folder, validPublicIds);

    console.log('\n✅ Análisis completado:');
    console.log(`   - Archivos huérfanos encontrados: ${result.totalOrphaned || result.orphanedCount}`);
    
    if (!dryRun) {
      console.log(`   - Archivos eliminados: ${result.deletedCount}`);
      console.log(`   - Fallos en eliminación: ${result.totalOrphaned - result.deletedCount}`);
    }

    return result;
  } catch (error) {
    logger.error('Error cleaning folder', {
      context: 'CleanCloudinary',
      folder,
      error: error.message
    });
    throw error;
  }
}

/**
 * Analizar archivos huérfanos sin eliminar (dry-run)
 */
async function analyzeOrphanedFiles(folder, validPublicIds) {
  const { files } = await uploadService.listFiles(folder, { maxResults: 500 });
  
  const orphanedFiles = files.filter(file => 
    !validPublicIds.includes(file.publicId)
  );

  if (orphanedFiles.length > 0) {
    console.log('\n📦 Archivos huérfanos encontrados:');
    orphanedFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.publicId}`);
      console.log(`      URL: ${file.url}`);
      console.log(`      Tamaño: ${(file.size / 1024).toFixed(2)} KB`);
      console.log(`      Fecha: ${new Date(file.createdAt).toLocaleString()}`);
    });
  } else {
    console.log('\n✨ No se encontraron archivos huérfanos');
  }

  return {
    orphanedCount: orphanedFiles.length,
    orphanedFiles
  };
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log('🚀 Iniciando limpieza de Cloudinary...\n');

    // Conectar a MongoDB
    console.log('📡 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    // Obtener todos los publicIds válidos
    console.log('🔍 Obteniendo referencias válidas de la base de datos...');
    const bugReportsIds = await getBugReportsPublicIds();
    const systemConfigIds = await getSystemConfigPublicIds();
    
    const allValidIds = [...new Set([...bugReportsIds, ...systemConfigIds])];
    
    console.log(`✅ Referencias encontradas:`);
    console.log(`   - Bug Reports: ${bugReportsIds.length} archivos`);
    console.log(`   - System Config: ${systemConfigIds.length} archivos`);
    console.log(`   - Total únicas: ${allValidIds.length} archivos`);

    // Limpiar carpetas específicas o todas
    const foldersToClean = targetFolder 
      ? [targetFolder]
      : ['appscrum/bug-reports', 'appscrum/branding'];

    const results = {};
    
    for (const folder of foldersToClean) {
      // Filtrar IDs válidos según la carpeta
      let validIdsForFolder = allValidIds;
      if (folder.includes('bug-reports')) {
        validIdsForFolder = bugReportsIds;
      } else if (folder.includes('branding')) {
        validIdsForFolder = systemConfigIds;
      }

      results[folder] = await cleanFolder(folder, validIdsForFolder);
    }

    // Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN FINAL');
    console.log('='.repeat(60));
    
    let totalOrphaned = 0;
    let totalDeleted = 0;

    Object.entries(results).forEach(([folder, result]) => {
      const orphaned = result.totalOrphaned || result.orphanedCount;
      const deleted = result.deletedCount || 0;
      totalOrphaned += orphaned;
      totalDeleted += deleted;

      console.log(`\n📁 ${folder}:`);
      console.log(`   Archivos huérfanos: ${orphaned}`);
      if (!dryRun) {
        console.log(`   Archivos eliminados: ${deleted}`);
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log(`📈 Total archivos huérfanos: ${totalOrphaned}`);
    if (!dryRun) {
      console.log(`🗑️  Total archivos eliminados: ${totalDeleted}`);
    }
    console.log('='.repeat(60) + '\n');

    if (dryRun) {
      console.log('💡 Ejecuta sin --dry-run para eliminar los archivos huérfanos\n');
    }

  } catch (error) {
    console.error('\n❌ Error en la limpieza:', error.message);
    logger.error('Clean Cloudinary script failed', {
      context: 'CleanCloudinary',
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  } finally {
    // Desconectar de MongoDB
    await mongoose.disconnect();
    console.log('👋 Desconectado de MongoDB');
  }
}

// Ejecutar script
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Script completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { cleanFolder, getBugReportsPublicIds, getSystemConfigPublicIds };
