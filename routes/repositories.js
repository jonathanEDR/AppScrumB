const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticate } = require('../middleware/authenticate');
const repositoryService = require('../services/repositoryService');
const githubService = require('../services/githubService');

// Middleware para verificar webhook de GitHub
const verifyGitHubWebhook = (req, res, next) => {
  const signature = req.get('X-Hub-Signature-256');
  if (!signature) {
    return res.status(401).json({ error: 'No signature provided' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  const providedSignature = signature.replace('sha256=', '');

  if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(providedSignature))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
};

// **ENDPOINTS PARA EL FRONTEND**

/**
 * GET /api/repositories/project/:projectId
 * Obtiene todos los repositorios de un proyecto
 */
router.get('/project/:projectId', authenticate, async (req, res) => {
  try {
    const { projectId } = req.params;
    const repositories = await repositoryService.getProjectRepositories(projectId);
    
    res.json({
      success: true,
      data: repositories
    });
  } catch (error) {
    console.error('❌ Error obteniendo repositorios del proyecto:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/repositories/:repositoryId
 * Obtiene detalles completos de un repositorio específico
 */
router.get('/:repositoryId', authenticate, async (req, res) => {
  try {
    const { repositoryId } = req.params;
    const repository = await repositoryService.getRepositoryWithDetails(repositoryId);
    
    if (!repository) {
      return res.status(404).json({
        success: false,
        error: 'Repositorio no encontrado'
      });
    }

    res.json({
      success: true,
      data: repository
    });
  } catch (error) {
    console.error('❌ Error obteniendo detalles del repositorio:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/repositories/:repositoryId/commits
 * Obtiene commits de un repositorio con paginación
 */
router.get('/:repositoryId/commits', authenticate, async (req, res) => {
  try {
    const { repositoryId } = req.params;
    const { page = 1, limit = 20, branch = 'main' } = req.query;
    
    const commits = await repositoryService.getRepositoryCommits(repositoryId, {
      page: parseInt(page),
      limit: parseInt(limit),
      branch
    });
    
    res.json({
      success: true,
      data: commits
    });
  } catch (error) {
    console.error('❌ Error obteniendo commits:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/repositories/:repositoryId/pull-requests
 * Obtiene pull requests de un repositorio
 */
router.get('/:repositoryId/pull-requests', authenticate, async (req, res) => {
  try {
    const { repositoryId } = req.params;
    const { state = 'all' } = req.query;
    
    const pullRequests = await repositoryService.getRepositoryPullRequests(repositoryId, {
      state
    });
    
    res.json({
      success: true,
      data: pullRequests
    });
  } catch (error) {
    console.error('❌ Error obteniendo pull requests:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/repositories/:repositoryId/sync
 * Sincroniza un repositorio específico con GitHub
 */
router.post('/:repositoryId/sync', authenticate, async (req, res) => {
  try {
    const { repositoryId } = req.params;
    const updatedRepository = await repositoryService.syncRepository(repositoryId);
    
    res.json({
      success: true,
      data: updatedRepository,
      message: 'Repositorio sincronizado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error sincronizando repositorio:', error);
    res.status(500).json({
      success: false,
      error: 'Error al sincronizar repositorio'
    });
  }
});

/**
 * POST /api/repositories/connect
 * Conecta un nuevo repositorio desde GitHub
 */
router.post('/connect', authenticate, async (req, res) => {
  try {
    const { githubUrl, projectId, name, description } = req.body;
    
    if (!githubUrl || !projectId) {
      return res.status(400).json({
        success: false,
        error: 'githubUrl y projectId son requeridos'
      });
    }

    const repository = await repositoryService.connectRepository({
      githubUrl,
      projectId,
      name,
      description,
      userId: req.user.id
    });
    
    res.status(201).json({
      success: true,
      data: repository,
      message: 'Repositorio conectado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error conectando repositorio:', error);
    res.status(500).json({
      success: false,
      error: 'Error al conectar repositorio'
    });
  }
});

// **WEBHOOKS DE GITHUB**

/**
 * POST /api/repositories/webhook/github
 * Maneja webhooks de GitHub
 */
router.post('/webhook/github', verifyGitHubWebhook, async (req, res) => {
  try {
    const event = req.get('X-GitHub-Event');
    const payload = req.body;

    console.log(`🔔 Webhook recibido: ${event}`);

    switch (event) {
      case 'push':
        await handlePushEvent(payload);
        break;
        
      case 'pull_request':
        await handlePullRequestEvent(payload);
        break;
        
      case 'issues':
        await handleIssueEvent(payload);
        break;
        
      case 'release':
        await handleReleaseEvent(payload);
        break;
        
      default:
        console.log(`ℹ️ Evento no manejado: ${event}`);
    }

    res.status(200).json({ success: true, message: 'Webhook procesado' });
  } catch (error) {
    console.error('❌ Error procesando webhook:', error);
    res.status(500).json({ error: 'Error procesando webhook' });
  }
});

// **FUNCIONES PARA MANEJAR EVENTOS DE WEBHOOK**

const handlePushEvent = async (payload) => {
  try {
    const { repository, commits, pusher, ref } = payload;
    
    console.log(`📝 Push a ${repository.full_name} por ${pusher.name}`);
    console.log(`📦 ${commits.length} commits en ${ref}`);

    // Buscar el repositorio en nuestra base de datos
    const repo = await repositoryService.findRepositoryByGithubUrl(repository.html_url);
    
    if (!repo) {
      console.log('⚠️ Repositorio no encontrado en la base de datos');
      return;
    }

    // Procesar cada commit
    for (const commit of commits) {
      await repositoryService.createOrUpdateCommit({
        repositoryId: repo._id,
        sha: commit.id,
        message: commit.message,
        author: {
          name: commit.author.name,
          email: commit.author.email,
          username: commit.author.username
        },
        date: new Date(commit.timestamp),
        url: commit.url,
        additions: commit.added?.length || 0,
        deletions: commit.removed?.length || 0,
        modifications: commit.modified?.length || 0,
        branch: ref.replace('refs/heads/', '')
      });
    }

    // Actualizar métricas del repositorio
    await repositoryService.updateRepositoryMetrics(repo._id);
    
    console.log(`✅ Procesados ${commits.length} commits para ${repository.full_name}`);
  } catch (error) {
    console.error('❌ Error procesando push event:', error);
  }
};

const handlePullRequestEvent = async (payload) => {
  try {
    const { action, pull_request, repository } = payload;
    
    console.log(`🔀 Pull Request ${action}: #${pull_request.number} en ${repository.full_name}`);

    // Buscar el repositorio en nuestra base de datos
    const repo = await repositoryService.findRepositoryByGithubUrl(repository.html_url);
    
    if (!repo) {
      console.log('⚠️ Repositorio no encontrado en la base de datos');
      return;
    }

    // Crear o actualizar pull request
    await repositoryService.createOrUpdatePullRequest({
      repositoryId: repo._id,
      number: pull_request.number,
      title: pull_request.title,
      description: pull_request.body,
      state: pull_request.state,
      author: {
        username: pull_request.user.login,
        avatarUrl: pull_request.user.avatar_url
      },
      baseBranch: pull_request.base.ref,
      headBranch: pull_request.head.ref,
      createdAt: new Date(pull_request.created_at),
      updatedAt: new Date(pull_request.updated_at),
      closedAt: pull_request.closed_at ? new Date(pull_request.closed_at) : null,
      mergedAt: pull_request.merged_at ? new Date(pull_request.merged_at) : null,
      url: pull_request.html_url,
      additions: pull_request.additions || 0,
      deletions: pull_request.deletions || 0,
      changedFiles: pull_request.changed_files || 0
    });

    // Actualizar métricas del repositorio
    await repositoryService.updateRepositoryMetrics(repo._id);
    
    console.log(`✅ Pull Request procesado: #${pull_request.number}`);
  } catch (error) {
    console.error('❌ Error procesando pull request event:', error);
  }
};

const handleIssueEvent = async (payload) => {
  try {
    const { action, issue, repository } = payload;
    
    console.log(`🐛 Issue ${action}: #${issue.number} en ${repository.full_name}`);
    
    // Aquí podrías manejar issues si tienes un modelo para ello
    // Por ahora solo logeamos el evento
  } catch (error) {
    console.error('❌ Error procesando issue event:', error);
  }
};

const handleReleaseEvent = async (payload) => {
  try {
    const { action, release, repository } = payload;
    
    console.log(`🚀 Release ${action}: ${release.tag_name} en ${repository.full_name}`);
    
    // Buscar el repositorio en nuestra base de datos
    const repo = await repositoryService.findRepositoryByGithubUrl(repository.html_url);
    
    if (!repo) {
      console.log('⚠️ Repositorio no encontrado en la base de datos');
      return;
    }

    // Crear release si es necesario
    if (action === 'published') {
      await repositoryService.createRelease({
        repositoryId: repo._id,
        tagName: release.tag_name,
        name: release.name,
        description: release.body,
        publishedAt: new Date(release.published_at),
        url: release.html_url,
        author: {
          username: release.author.login,
          avatarUrl: release.author.avatar_url
        }
      });
    }
    
    console.log(`✅ Release procesado: ${release.tag_name}`);
  } catch (error) {
    console.error('❌ Error procesando release event:', error);
  }
};

// **NUEVAS RUTAS PARA GESTIÓN DINÁMICA DE REPOSITORIOS**

/**
 * GET /api/repositories/github/available
 * Obtiene todos los repositorios disponibles en GitHub del usuario
 */
router.get('/github/available', authenticate, async (req, res) => {
  try {
    const repositories = await githubService.getUserRepositories();
    
    res.json({
      success: true,
      repositories
    });
  } catch (error) {
    console.error('❌ Error obteniendo repositorios de GitHub:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener repositorios de GitHub'
    });
  }
});

/**
 * POST /api/repositories/connect
 * Conecta un repositorio de GitHub al proyecto
 */
router.post('/connect', authenticate, async (req, res) => {
  try {
    const { projectId, githubRepository } = req.body;
    
    if (!projectId || !githubRepository) {
      return res.status(400).json({
        success: false,
        message: 'ProjectId y githubRepository son requeridos'
      });
    }

    const repository = await repositoryService.connectGitHubRepository(
      projectId, 
      githubRepository, 
      req.user.id
    );
    
    res.json({
      success: true,
      repository,
      message: `Repositorio ${githubRepository.name} conectado exitosamente`
    });
  } catch (error) {
    console.error('❌ Error conectando repositorio:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * DELETE /api/repositories/:repositoryId/disconnect
 * Desconecta un repositorio del proyecto
 */
router.delete('/:repositoryId/disconnect', authenticate, async (req, res) => {
  try {
    const { repositoryId } = req.params;
    await repositoryService.disconnectRepository(repositoryId, req.user.id);
    
    res.json({
      success: true,
      message: 'Repositorio desconectado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error desconectando repositorio:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
