const mongoose = require('mongoose');
const logger = require('../config/logger');

/**
 * Agrega índices optimizados a los modelos para mejorar performance de queries
 */
const addDatabaseIndexes = async () => {
  try {
    // Task indexes
    const Task = mongoose.model('Task');
    await Task.collection.createIndex({ assignedTo: 1, status: 1 });
    await Task.collection.createIndex({ sprint: 1, status: 1 });
    await Task.collection.createIndex({ assignedTo: 1, sprint: 1, status: 1 });
    await Task.collection.createIndex({ title: 'text', description: 'text', tags: 'text' });
    await Task.collection.createIndex({ createdAt: -1 });
    await Task.collection.createIndex({ updatedAt: -1 });

    // BugReport indexes
    const BugReport = mongoose.model('BugReport');
    await BugReport.collection.createIndex({ reporter: 1, status: 1 });
    await BugReport.collection.createIndex({ assignedTo: 1, status: 1 });
    await BugReport.collection.createIndex({ status: 1, severity: 1, priority: 1 });
    await BugReport.collection.createIndex({ title: 'text', description: 'text', tags: 'text' });
    await BugReport.collection.createIndex({ createdAt: -1 });
    await BugReport.collection.createIndex({ relatedTask: 1 });
    await BugReport.collection.createIndex({ relatedSprint: 1 });

    // Comment indexes
    const Comment = mongoose.model('Comment');
    await Comment.collection.createIndex({ resourceType: 1, resourceId: 1, createdAt: -1 });
    await Comment.collection.createIndex({ author: 1, createdAt: -1 });
    await Comment.collection.createIndex({ parentComment: 1 });
    await Comment.collection.createIndex({ isDeleted: 1 });

    // TimeTracking indexes
    const TimeTracking = mongoose.model('TimeTracking');
    await TimeTracking.collection.createIndex({ user: 1, startTime: -1 });
    await TimeTracking.collection.createIndex({ task: 1, endTime: -1 });
    await TimeTracking.collection.createIndex({ user: 1, task: 1, startTime: -1 });
    await TimeTracking.collection.createIndex({ endTime: 1 }, { sparse: true }); // Para timers activos

    // Sprint indexes
    const Sprint = mongoose.model('Sprint');
    await Sprint.collection.createIndex({ status: 1, startDate: -1 });
    await Sprint.collection.createIndex({ endDate: 1 });
    await Sprint.collection.createIndex({ 'team': 1 });

    // BacklogItem indexes
    const BacklogItem = mongoose.model('BacklogItem');
    await BacklogItem.collection.createIndex({ status: 1, priority: 1 });
    await BacklogItem.collection.createIndex({ assignedTo: 1, status: 1 });
    await BacklogItem.collection.createIndex({ sprint: 1 });
    await BacklogItem.collection.createIndex({ product: 1, status: 1 });
    
    // Índice de texto - manejar si ya existe con otro nombre
    try {
      await BacklogItem.collection.createIndex({ title: 'text', description: 'text' });
    } catch (textIndexError) {
      if (textIndexError.code === 85 || textIndexError.message.includes('equivalent index already exists')) {
        // Silenciar - índice ya existe
      } else {
        throw textIndexError;
      }
    }

    // User indexes
    const User = mongoose.model('User');
    // Índices únicos con sparse: true para permitir múltiples null values
    try {
      await User.collection.createIndex({ clerkUserId: 1 }, { unique: true, sparse: true });
    } catch (userIndexError) {
      if (userIndexError.code === 11000 || 
          userIndexError.code === 85 || 
          userIndexError.message.includes('duplicate key') ||
          userIndexError.message.includes('existing index')) {
        // Silenciar - índice ya existe
      } else {
        throw userIndexError;
      }
    }
    
    try {
      await User.collection.createIndex({ email: 1 }, { unique: true, sparse: true });
    } catch (emailIndexError) {
      if (emailIndexError.code === 11000 || 
          emailIndexError.code === 85 ||
          emailIndexError.message.includes('duplicate key') ||
          emailIndexError.message.includes('existing index')) {
        // Silenciar - índice ya existe
      } else {
        throw emailIndexError;
      }
    }
    
    await User.collection.createIndex({ role: 1 });

    return true;
  } catch (error) {
    logger.error('Error creating database indexes', { 
      context: 'Database Optimization', 
      error: error.message,
      stack: error.stack 
    });
    return false;
  }
};

/**
 * Obtiene estadísticas de índices de una colección
 */
const getIndexStats = async (modelName) => {
  try {
    const Model = mongoose.model(modelName);
    const indexes = await Model.collection.indexes();
    const stats = await Model.collection.stats();

    return {
      model: modelName,
      indexCount: indexes.length,
      indexes: indexes.map(idx => ({
        name: idx.name,
        keys: idx.key,
        unique: idx.unique || false,
        sparse: idx.sparse || false
      })),
      collectionSize: stats.size,
      documentCount: stats.count,
      avgDocumentSize: stats.avgObjSize
    };
  } catch (error) {
    logger.error('Error getting index stats', { 
      context: 'Database Optimization', 
      model: modelName,
      error: error.message 
    });
    return null;
  }
};

/**
 * Analiza y reporta el uso de índices en queries
 */
const analyzeQueryPerformance = async () => {
  try {
    const models = ['Task', 'BugReport', 'Comment', 'TimeTracking', 'Sprint', 'BacklogItem', 'User'];
    const results = [];

    for (const modelName of models) {
      const stats = await getIndexStats(modelName);
      if (stats) {
        results.push(stats);
      }
    }

    logger.info('Query performance analysis completed', { 
      context: 'Database Optimization',
      modelsAnalyzed: results.length,
      totalIndexes: results.reduce((sum, r) => sum + r.indexCount, 0)
    });

    return results;
  } catch (error) {
    logger.error('Error analyzing query performance', { 
      context: 'Database Optimization',
      error: error.message 
    });
    return [];
  }
};

/**
 * Limpia índices no utilizados o duplicados
 */
const cleanupIndexes = async (modelName) => {
  try {
    const Model = mongoose.model(modelName);
    const indexes = await Model.collection.indexes();
    
    logger.info('Current indexes', { 
      context: 'Database Optimization',
      model: modelName,
      count: indexes.length,
      indexes: indexes.map(i => i.name)
    });

    // Aquí podrías implementar lógica para identificar y eliminar índices duplicados
    // Por seguridad, solo reportamos, no eliminamos automáticamente
    
    return indexes;
  } catch (error) {
    logger.error('Error cleaning up indexes', { 
      context: 'Database Optimization',
      model: modelName,
      error: error.message 
    });
    return [];
  }
};

module.exports = {
  addDatabaseIndexes,
  getIndexStats,
  analyzeQueryPerformance,
  cleanupIndexes
};
