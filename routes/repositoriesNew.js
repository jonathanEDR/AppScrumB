const express = require('express');
const router = express.Router();
const Repository = require('../models/Repository');
const RepositoryProduct = require('../models/RepositoryProduct');
const Product = require('../models/Product');
const githubService = require('../services/githubService');
const repositoryService = require('../services/repositoryService');

/**
 * GET /api/repositories - Obtener todos los repositorios del usuario
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const repositories = await Repository.find({ added_by: userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: repositories,
      total: repositories.length
    });
  } catch (error) {
    console.error('Error fetching repositories:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener repositorios'
    });
  }
});

/**
 * GET /api/repositories/github/available - Obtener repositorios disponibles de GitHub
 */
router.get('/github/available', async (req, res) => {
  try {
    console.log('🔍 Obteniendo repositorios disponibles de GitHub...');
    
    const githubRepos = await githubService.getUserRepositories();
    
    // Obtener repositorios ya agregados por el usuario
    const addedRepos = await Repository.find({ 
      added_by: req.user.id 
    }).select('repo_id').lean();
    
    const addedRepoIds = addedRepos.map(repo => repo.repo_id);
    
    // Filtrar repositorios no agregados
    const availableRepos = githubRepos.filter(repo => 
      !addedRepoIds.includes(repo.id.toString())
    );

    console.log(`✅ Encontrados ${availableRepos.length} repositorios disponibles`);

    res.json({
      success: true,
      repositories: availableRepos,
      total: availableRepos.length
    });
  } catch (error) {
    console.error('❌ Error obteniendo repositorios de GitHub:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener repositorios de GitHub',
      details: error.message
    });
  }
});

/**
 * POST /api/repositories/add - Agregar repositorio de GitHub
 */
router.post('/add', async (req, res) => {
  try {
    const { githubRepository } = req.body;
    const userId = req.user.id;

    console.log(`📝 Agregando repositorio: ${githubRepository.name}`);

    // Verificar si el repositorio ya existe
    const existingRepo = await Repository.findOne({
      repo_id: githubRepository.id.toString()
    });

    if (existingRepo) {
      return res.status(400).json({
        success: false,
        error: 'El repositorio ya está agregado'
      });
    }

    // Crear nuevo repositorio
    const repositoryData = {
      name: githubRepository.name,
      description: githubRepository.description || '',
      url: githubRepository.html_url,
      clone_url: githubRepository.clone_url,
      ssh_url: githubRepository.ssh_url,
      owner: githubRepository.owner.login,
      repo_id: githubRepository.id.toString(),
      full_name: githubRepository.full_name,
      language: githubRepository.language || 'No especificado',
      default_branch: githubRepository.default_branch || 'main',
      is_private: githubRepository.private,
      added_by: userId,
      status: 'active',
      github_data: {
        id: githubRepository.id,
        node_id: githubRepository.node_id,
        html_url: githubRepository.html_url,
        size: githubRepository.size,
        stargazers_count: githubRepository.stargazers_count,
        watchers_count: githubRepository.watchers_count,
        forks_count: githubRepository.forks_count,
        open_issues_count: githubRepository.open_issues_count,
        has_issues: githubRepository.has_issues,
        has_projects: githubRepository.has_projects,
        has_wiki: githubRepository.has_wiki,
        archived: githubRepository.archived,
        disabled: githubRepository.disabled,
        pushed_at: githubRepository.pushed_at,
        created_at: githubRepository.created_at,
        updated_at: githubRepository.updated_at
      }
    };

    const newRepository = await Repository.create(repositoryData);

    console.log(`✅ Repositorio agregado: ${newRepository.name} (ID: ${newRepository._id})`);

    res.status(201).json({
      success: true,
      repository: newRepository,
      message: 'Repositorio agregado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error agregando repositorio:', error);
    res.status(500).json({
      success: false,
      error: 'Error al agregar repositorio',
      details: error.message
    });
  }
});

/**
 * POST /api/repositories/:repositoryId/assign-to-product - Asignar repositorio a producto
 */
router.post('/:repositoryId/assign-to-product', async (req, res) => {
  try {
    const { repositoryId } = req.params;
    const { productId, role = 'primary', permissions = {} } = req.body;
    const userId = req.user.id;

    console.log(`🔗 Asignando repositorio ${repositoryId} al producto ${productId}`);

    // Verificar que el repositorio existe y pertenece al usuario
    const repository = await Repository.findOne({
      _id: repositoryId,
      added_by: userId
    });

    if (!repository) {
      return res.status(404).json({
        success: false,
        error: 'Repositorio no encontrado'
      });
    }

    // Verificar que el producto existe
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

    // Verificar si ya está asignado
    const existingAssignment = await RepositoryProduct.findOne({
      repository: repositoryId,
      product: productId
    });

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        error: 'El repositorio ya está asignado a este producto'
      });
    }

    // Crear asignación
    const assignment = await RepositoryProduct.create({
      repository: repositoryId,
      product: productId,
      role,
      permissions: {
        read: permissions.read !== false,
        write: permissions.write || false,
        admin: permissions.admin || false
      },
      assigned_by: userId
    });

    console.log(`✅ Repositorio asignado al producto exitosamente`);

    res.status(201).json({
      success: true,
      assignment,
      message: 'Repositorio asignado al producto exitosamente'
    });
  } catch (error) {
    console.error('❌ Error asignando repositorio al producto:', error);
    res.status(500).json({
      success: false,
      error: 'Error al asignar repositorio al producto',
      details: error.message
    });
  }
});

/**
 * GET /api/repositories/product/:productId - Obtener repositorios de un producto
 */
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;

    console.log(`📋 Obteniendo repositorios del producto ${productId}`);

    const assignments = await RepositoryProduct.find({
      product: productId,
      status: 'active'
    })
    .populate('repository')
    .populate('assigned_by', 'email nombre_negocio')
    .sort({ assigned_at: -1 })
    .lean();

    const repositories = assignments.map(assignment => ({
      ...assignment.repository,
      assignment: {
        role: assignment.role,
        permissions: assignment.permissions,
        assigned_by: assignment.assigned_by,
        assigned_at: assignment.assigned_at
      }
    }));

    console.log(`✅ Encontrados ${repositories.length} repositorios en el producto`);

    res.json({
      success: true,
      data: repositories,
      total: repositories.length
    });
  } catch (error) {
    console.error('❌ Error obteniendo repositorios del producto:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener repositorios del producto'
    });
  }
});

/**
 * DELETE /api/repositories/:repositoryId/remove-from-product/:productId - Remover repositorio de producto
 */
router.delete('/:repositoryId/remove-from-product/:productId', async (req, res) => {
  try {
    const { repositoryId, productId } = req.params;
    const userId = req.user.id;

    console.log(`🗑️ Removiendo repositorio ${repositoryId} del producto ${productId}`);

    const assignment = await RepositoryProduct.findOneAndDelete({
      repository: repositoryId,
      product: productId,
      assigned_by: userId
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Asignación no encontrada'
      });
    }

    console.log(`✅ Repositorio removido del producto exitosamente`);

    res.json({
      success: true,
      message: 'Repositorio removido del producto exitosamente'
    });
  } catch (error) {
    console.error('❌ Error removiendo repositorio del producto:', error);
    res.status(500).json({
      success: false,
      error: 'Error al remover repositorio del producto'
    });
  }
});

/**
 * POST /api/repositories/:repositoryId/sync - Sincronizar repositorio con GitHub
 */
router.post('/:repositoryId/sync', async (req, res) => {
  try {
    const { repositoryId } = req.params;
    const userId = req.user.id;

    console.log(`🔄 Sincronizando repositorio ${repositoryId}`);

    // Verificar que el repositorio pertenece al usuario
    const repository = await Repository.findOne({
      _id: repositoryId,
      added_by: userId
    });

    if (!repository) {
      return res.status(404).json({
        success: false,
        error: 'Repositorio no encontrado'
      });
    }

    // Sincronizar con GitHub
    const syncResult = await repositoryService.syncRepository(repositoryId);

    console.log(`✅ Repositorio sincronizado exitosamente`);

    res.json({
      success: true,
      data: syncResult,
      message: 'Repositorio sincronizado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error sincronizando repositorio:', error);
    res.status(500).json({
      success: false,
      error: 'Error al sincronizar repositorio',
      details: error.message
    });
  }
});

module.exports = router;
