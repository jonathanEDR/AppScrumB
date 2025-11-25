/**
 * QueueService.js
 * Sistema de colas para procesamiento asíncrono de tareas AI
 * Usa Bull + Redis para gestión de trabajos
 */

const Bull = require('bull');
const OrchestratorService = require('./OrchestratorService');

// Configuración de Redis
const redisConfig = process.env.REDIS_URL 
  ? process.env.REDIS_URL 
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined
    };

// Cola para tareas AI
const aiQueue = new Bull('ai-tasks', redisConfig, {
  defaultJobOptions: {
    attempts: 3, // 3 intentos si falla
    backoff: {
      type: 'exponential',
      delay: 5000 // 5 segundos, luego 10, luego 20
    },
    removeOnComplete: 100, // Mantener últimos 100 completados
    removeOnFail: 200 // Mantener últimos 200 fallidos
  }
});

class QueueService {
  /**
   * Agrega una tarea AI a la cola
   */
  static async enqueueTask(userId, input, context, user, priority = 'normal') {
    try {
      const jobData = {
        userId,
        input,
        context,
        user: {
          _id: user._id,
          name: user.name || user.nombre_negocio,
          email: user.email,
          role: user.role
        },
        enqueued_at: new Date().toISOString()
      };

      // Determinar prioridad (1 = highest, 10 = lowest)
      let jobPriority = 5; // normal
      if (priority === 'high') jobPriority = 2;
      if (priority === 'low') jobPriority = 8;

      const job = await aiQueue.add(jobData, {
        priority: jobPriority,
        jobId: `${userId}-${Date.now()}` // ID único
      });

      console.log(`📥 [Queue] Task enqueued: ${job.id} (priority: ${priority})`);

      return {
        job_id: job.id,
        status: 'queued',
        position: await job.getPosition(),
        enqueued_at: jobData.enqueued_at
      };

    } catch (error) {
      console.error('QueueService.enqueueTask error:', error);
      throw error;
    }
  }

  /**
   * Obtiene el estado de una tarea
   */
  static async getTaskStatus(jobId) {
    try {
      const job = await aiQueue.getJob(jobId);
      
      if (!job) {
        return {
          status: 'not_found',
          message: 'Tarea no encontrada'
        };
      }

      const state = await job.getState();
      const progress = job.progress();
      
      let result = {
        job_id: jobId,
        status: state,
        progress: progress,
        created_at: new Date(job.timestamp).toISOString(),
        attempts: job.attemptsMade,
        max_attempts: job.opts.attempts
      };

      // Si está completado, incluir resultado
      if (state === 'completed') {
        result.result = job.returnvalue;
        result.completed_at = job.finishedOn ? new Date(job.finishedOn).toISOString() : null;
        result.duration_ms = job.finishedOn ? job.finishedOn - job.processedOn : null;
      }

      // Si falló, incluir error
      if (state === 'failed') {
        result.error = job.failedReason;
        result.failed_at = job.finishedOn ? new Date(job.finishedOn).toISOString() : null;
      }

      // Si está en cola, incluir posición
      if (state === 'waiting') {
        result.position = await job.getPosition();
      }

      return result;

    } catch (error) {
      console.error('QueueService.getTaskStatus error:', error);
      throw error;
    }
  }

  /**
   * Cancela una tarea en cola
   */
  static async cancelTask(jobId, userId) {
    try {
      const job = await aiQueue.getJob(jobId);
      
      if (!job) {
        return {
          status: 'not_found',
          message: 'Tarea no encontrada'
        };
      }

      // Verificar que el usuario sea el dueño del job
      if (job.data.userId !== userId) {
        return {
          status: 'forbidden',
          message: 'No tienes permiso para cancelar esta tarea'
        };
      }

      const state = await job.getState();
      
      // Solo se puede cancelar si está en espera o activa
      if (state === 'completed' || state === 'failed') {
        return {
          status: 'error',
          message: `No se puede cancelar una tarea ${state}`
        };
      }

      await job.remove();
      console.log(`🗑️ [Queue] Task cancelled: ${jobId}`);

      return {
        status: 'cancelled',
        job_id: jobId,
        message: 'Tarea cancelada exitosamente'
      };

    } catch (error) {
      console.error('QueueService.cancelTask error:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de la cola
   */
  static async getQueueStats() {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        aiQueue.getWaitingCount(),
        aiQueue.getActiveCount(),
        aiQueue.getCompletedCount(),
        aiQueue.getFailedCount(),
        aiQueue.getDelayedCount()
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed
      };

    } catch (error) {
      console.error('QueueService.getQueueStats error:', error);
      throw error;
    }
  }

  /**
   * Limpia trabajos completados/fallidos antiguos
   */
  static async cleanQueue(grace = 24 * 60 * 60 * 1000) { // 24 horas por defecto
    try {
      const jobs = await aiQueue.clean(grace, 'completed');
      const failedJobs = await aiQueue.clean(grace, 'failed');
      
      console.log(`🧹 [Queue] Cleaned ${jobs.length} completed and ${failedJobs.length} failed jobs`);
      
      return {
        cleaned_completed: jobs.length,
        cleaned_failed: failedJobs.length,
        total_cleaned: jobs.length + failedJobs.length
      };

    } catch (error) {
      console.error('QueueService.cleanQueue error:', error);
      throw error;
    }
  }
}

// Procesador de la cola
aiQueue.process(async (job) => {
  try {
    console.log(`⚙️ [Queue] Processing job: ${job.id}`);
    
    const { userId, input, context, user } = job.data;
    
    // Actualizar progreso
    await job.progress(10); // 10% - Iniciado
    
    // Ejecutar orquestador
    await job.progress(30); // 30% - Clasificando intent
    const result = await OrchestratorService.execute(userId, input, context, user);
    
    await job.progress(100); // 100% - Completado
    
    console.log(`✅ [Queue] Job completed: ${job.id}`);
    return result;

  } catch (error) {
    console.error(`❌ [Queue] Job failed: ${job.id}`, error);
    throw error;
  }
});

// Event listeners
aiQueue.on('completed', (job, result) => {
  console.log(`✅ [Queue Event] Job ${job.id} completed`);
});

aiQueue.on('failed', (job, err) => {
  console.error(`❌ [Queue Event] Job ${job.id} failed:`, err.message);
});

aiQueue.on('stalled', (job) => {
  console.warn(`⚠️ [Queue Event] Job ${job.id} stalled`);
});

module.exports = QueueService;
