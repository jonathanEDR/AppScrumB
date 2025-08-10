const mongoose = require('mongoose');
const { Octokit } = require('@octokit/rest');
require('dotenv').config();

// Importar modelos
const Repository = require('../models/Repository');
const Product = require('../models/Product');
const User = require('../models/User');

async function syncAllRepositories() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Configurar Octokit
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    // Obtener usuario autenticado
    const { data: user } = await octokit.rest.users.getAuthenticated();
    console.log(`👤 Usuario autenticado: ${user.login}`);

    // Obtener todos los repositorios del usuario
    const { data: githubRepos } = await octokit.rest.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: 'updated',
      direction: 'desc'
    });

    console.log(`📁 Encontrados ${githubRepos.length} repositorios en GitHub`);

    // Buscar un usuario existente para asociar el producto
    let systemUser = await User.findOne().sort({ fecha_creacion: 1 });
    
    if (!systemUser) {
      // Crear un usuario temporal si no existe ninguno
      systemUser = await User.create({
        clerk_id: 'system_github_sync',
        email: 'system@appscrum.com',
        role: 'super_admin',
        is_active: true
      });
      console.log(`✅ Usuario del sistema creado: ${systemUser.email}`);
    } else {
      console.log(`✅ Usando usuario existente: ${systemUser.email}`);
    }

    // Buscar o crear un producto para asociar los repositorios
    let product = await Product.findOne({ nombre: 'Repositorios GitHub' });
    
    if (!product) {
      product = await Product.create({
        nombre: 'Repositorios GitHub',
        descripcion: 'Repositorios sincronizados desde GitHub',
        responsable: systemUser._id,
        estado: 'activo',
        created_by: systemUser._id,
        fecha_inicio: new Date()
      });
      console.log(`✅ Producto creado: ${product.nombre}`);
    }

    let syncedCount = 0;
    let skippedCount = 0;

    // Procesar cada repositorio
    for (const githubRepo of githubRepos) {
      try {
        // Verificar si el repositorio ya existe
        const existingRepo = await Repository.findOne({ 
          repo_id: githubRepo.id.toString() 
        });

        if (existingRepo) {
          console.log(`⏭️ Repositorio ${githubRepo.name} ya existe, saltando...`);
          skippedCount++;
          continue;
        }

        // Crear nuevo repositorio
        const repoData = {
          repo_id: githubRepo.id.toString(),
          name: githubRepo.name,
          description: githubRepo.description || 'Sin descripción',
          url: githubRepo.html_url,
          clone_url: githubRepo.clone_url,
          ssh_url: githubRepo.ssh_url,
          owner: githubRepo.owner.login,
          is_private: githubRepo.private,
          project: product._id,
          language: githubRepo.language || 'No especificado',
          default_branch: githubRepo.default_branch || 'main',
          status: 'active',
          github_data: {
            id: githubRepo.id,
            node_id: githubRepo.node_id,
            full_name: githubRepo.full_name,
            clone_url: githubRepo.clone_url,
            git_url: githubRepo.git_url,
            ssh_url: githubRepo.ssh_url,
            homepage: githubRepo.homepage,
            size: githubRepo.size,
            stargazers_count: githubRepo.stargazers_count,
            watchers_count: githubRepo.watchers_count,
            forks_count: githubRepo.forks_count,
            open_issues_count: githubRepo.open_issues_count,
            has_issues: githubRepo.has_issues,
            has_projects: githubRepo.has_projects,
            has_wiki: githubRepo.has_wiki,
            has_pages: githubRepo.has_pages,
            has_downloads: githubRepo.has_downloads,
            archived: githubRepo.archived,
            disabled: githubRepo.disabled,
            pushed_at: githubRepo.pushed_at,
            created_at: githubRepo.created_at,
            updated_at: githubRepo.updated_at
          },
          metrics: {
            last_commit_date: githubRepo.pushed_at ? new Date(githubRepo.pushed_at) : null,
            created_at: new Date(githubRepo.created_at),
            updated_at: new Date(githubRepo.updated_at)
          }
        };

        const newRepo = await Repository.create(repoData);
        console.log(`✅ Repositorio sincronizado: ${newRepo.name} (ID: ${newRepo._id})`);
        syncedCount++;

      } catch (error) {
        console.error(`❌ Error procesando repositorio ${githubRepo.name}:`, error.message);
      }
    }

    console.log(`\n📊 Resumen de sincronización:`);
    console.log(`   📁 Total de repositorios en GitHub: ${githubRepos.length}`);
    console.log(`   ✅ Repositorios sincronizados: ${syncedCount}`);
    console.log(`   ⏭️ Repositorios ya existentes: ${skippedCount}`);
    console.log(`   🆔 ID del Producto: ${product._id}`);

    // Mostrar lista de repositorios sincronizados
    const allRepos = await Repository.find({ project: product._id });
    console.log(`\n📋 Repositorios en la base de datos (${allRepos.length}):`);
    allRepos.forEach((repo, index) => {
      console.log(`   ${index + 1}. ${repo.name} (${repo.language}) - ${repo.url}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Conexión cerrada');
  }
}

syncAllRepositories();
