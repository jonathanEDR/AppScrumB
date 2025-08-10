const Repository = require('../models/Repository');
const Commit = require('../models/Commit');
const PullRequest = require('../models/PullRequest');
const User = require('../models/User');
const githubService = require('./githubService');

class RepositoryService {
  /**
   * Obtiene repositorios del proyecto
   */
  async getProjectRepositories(projectId, userId = null) {
    try {
      let query = { project: projectId };
      
      // Si se especifica usuario, filtrar por repositorios donde tiene acceso
      if (userId) {
        // TODO: Implementar lógica de permisos por repositorio
      }

      const repositories = await Repository.find(query)
        .sort({ status: 1, name: 1 })
        .lean();

      // Enriquecer con datos en tiempo real de GitHub
      const enrichedRepos = await Promise.all(
        repositories.map(async (repo) => {
          try {
            const [commits, prs, branches] = await Promise.all([
              this.getRecentCommits(repo._id, 5),
              this.getRecentPullRequests(repo._id, 5),
              this.getBranchCount(repo.owner, repo.name)
            ]);

            return {
              ...repo,
              recentCommits: commits,
              recentPullRequests: prs,
              branchCount: branches,
              lastActivity: this.getLastActivity(commits, prs)
            };
          } catch (error) {
            console.error(`Error enriching repo ${repo.name}:`, error);
            return repo;
          }
        })
      );

      return enrichedRepos;
    } catch (error) {
      console.error('Error getting project repositories:', error);
      throw new Error(`Error al obtener repositorios: ${error.message}`);
    }
  }

  /**
   * Obtiene un repositorio específico con detalles completos
   */
  async getRepositoryDetails(repositoryId, userId = null) {
    try {
      const repository = await Repository.findById(repositoryId);
      
      if (!repository) {
        throw new Error('Repositorio no encontrado');
      }

      // Obtener datos adicionales
      const [commits, pullRequests, stats] = await Promise.all([
        this.getCommits(repositoryId, { limit: 20 }),
        this.getPullRequests(repositoryId, { limit: 10 }),
        this.getRepositoryStatistics(repositoryId)
      ]);

      return {
        ...repository.toObject(),
        commits,
        pullRequests,
        statistics: stats
      };
    } catch (error) {
      console.error('Error getting repository details:', error);
      throw new Error(`Error al obtener detalles del repositorio: ${error.message}`);
    }
  }

  /**
   * Sincroniza repositorio con GitHub
   */
  async syncRepository(repositoryId) {
    try {
      console.log(`🔄 Sincronizando repositorio ${repositoryId}`);
      
      const repository = await Repository.findById(repositoryId);
      if (!repository) {
        throw new Error('Repositorio no encontrado');
      }

      // Obtener datos actuales de GitHub
      const githubRepo = await githubService.getRepository(repository.owner, repository.name);
      
      // Actualizar información básica
      await Repository.findByIdAndUpdate(repositoryId, {
        description: githubRepo.description,
        language: githubRepo.language,
        default_branch: githubRepo.default_branch,
        is_private: githubRepo.private,
        'metrics.updated_at': new Date()
      });

      // Sincronizar commits
      await this.syncCommits(repository);
      
      // Sincronizar pull requests
      await this.syncPullRequests(repository);

      // Actualizar métricas
      await this.updateRepositoryMetrics(repositoryId);

      console.log(`✅ Repositorio ${repository.name} sincronizado exitosamente`);
      
      return await this.getRepositoryDetails(repositoryId);
    } catch (error) {
      console.error('Error syncing repository:', error);
      throw new Error(`Error al sincronizar repositorio: ${error.message}`);
    }
  }

  /**
   * Sincroniza commits desde GitHub
   */
  async syncCommits(repository) {
    try {
      console.log(`📥 Sincronizando commits para ${repository.name}`);
      
      // Obtener último commit sincronizado
      const lastCommit = await Commit.findOne({ repository: repository._id })
        .sort({ commit_date: -1 })
        .select('commit_date');

      const since = lastCommit ? lastCommit.commit_date : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 días atrás

      // Obtener commits desde GitHub
      const githubCommits = await githubService.getCommits(repository.owner, repository.name, {
        since: since.toISOString(),
        per_page: 100
      });

      let newCommitsCount = 0;

      for (const githubCommit of githubCommits) {
        const existingCommit = await Commit.findOne({ 
          $or: [
            { sha: githubCommit.sha },
            { hash: githubCommit.sha }
          ]
        });
        
        if (!existingCommit) {
          // Obtener detalles completos del commit
          const commitDetails = await githubService.getCommitDetails(
            repository.owner, 
            repository.name, 
            githubCommit.sha
          );

          // Buscar usuario por email
          const user = await User.findOne({ email: githubCommit.commit.author.email });

          const commitData = {
            sha: githubCommit.sha,
            hash: githubCommit.sha, // Mantener compatibilidad
            message: githubCommit.commit.message,
            author: {
              name: githubCommit.commit.author.name,
              email: githubCommit.commit.author.email,
              user: user ? user._id : null,
              github_username: githubCommit.author?.login,
              avatar_url: githubCommit.author?.avatar_url
            },
            committer: {
              name: githubCommit.commit.committer.name,
              email: githubCommit.commit.committer.email,
              date: new Date(githubCommit.commit.committer.date)
            },
            repository: repository._id,
            url: githubCommit.url,
            html_url: githubCommit.html_url,
            commit_date: new Date(githubCommit.commit.author.date),
            commitDate: new Date(githubCommit.commit.author.date), // Mantener compatibilidad
            date: new Date(githubCommit.commit.author.date), // Alias
            stats: {
              additions: commitDetails.stats?.additions || 0,
              deletions: commitDetails.stats?.deletions || 0,
              total: commitDetails.stats?.total || 0
            },
            changes: { // Alias para stats
              additions: commitDetails.stats?.additions || 0,
              deletions: commitDetails.stats?.deletions || 0,
              totalChanges: commitDetails.stats?.total || 0
            },
            files: commitDetails.files?.map(file => ({
              filename: file.filename,
              status: file.status,
              additions: file.additions,
              deletions: file.deletions,
              changes: file.changes
            })) || [],
            tags: this.extractCommitTags(githubCommit.commit.message),
            verified: githubCommit.commit.verification?.verified || false,
            // Campos adicionales para compatibilidad
            author_name: githubCommit.commit.author.name,
            author_email: githubCommit.commit.author.email,
            author_username: githubCommit.author?.login || 'unknown',
            tree_hash: githubCommit.commit.tree.sha,
            tree_sha: githubCommit.commit.tree.sha,
            parent_hashes: githubCommit.parents?.map(p => p.sha) || [],
            parentCommits: githubCommit.parents?.map(p => p.sha) || []
          };

          await Commit.create(commitData);
          newCommitsCount++;
        }
      }

      console.log(`📥 ${newCommitsCount} nuevos commits sincronizados para ${repository.name}`);
      return newCommitsCount;
    } catch (error) {
      console.error('Error syncing commits:', error);
      throw error;
    }
  }

  /**
   * Sincroniza pull requests desde GitHub
   */
  async syncPullRequests(repository) {
    try {
      console.log(`📥 Sincronizando PRs para ${repository.name}`);
      
      const githubPRs = await githubService.getPullRequests(repository.owner, repository.name, {
        state: 'all',
        per_page: 50
      });

      let newPRsCount = 0;

      for (const githubPR of githubPRs) {
        const existingPR = await PullRequest.findOne({ 
          'github_data.id': githubPR.id 
        });

        const author = await User.findOne({ 
          $or: [
            { email: githubPR.user.email },
            { 'github.username': githubPR.user.login }
          ]
        });

        const prData = {
          number: githubPR.number,
          title: githubPR.title,
          description: githubPR.body,
          state: githubPR.state,
          status: this.mapGitHubPRStatus(githubPR),
          author: author ? author._id : null,
          github_author: {
            username: githubPR.user.login,
            avatar_url: githubPR.user.avatar_url,
            html_url: githubPR.user.html_url
          },
          repository: repository._id,
          base_branch: githubPR.base.ref,
          head_branch: githubPR.head.ref,
          stats: {
            additions: githubPR.additions || 0,
            deletions: githubPR.deletions || 0,
            changed_files: githubPR.changed_files || 0,
            commits_count: githubPR.commits || 0
          },
          github_data: {
            id: githubPR.id,
            node_id: githubPR.node_id,
            html_url: githubPR.html_url,
            diff_url: githubPR.diff_url,
            patch_url: githubPR.patch_url
          },
          created_at: new Date(githubPR.created_at),
          updated_at: new Date(githubPR.updated_at),
          closed_at: githubPR.closed_at ? new Date(githubPR.closed_at) : null,
          merged_at: githubPR.merged_at ? new Date(githubPR.merged_at) : null,
          merge_commit_sha: githubPR.merge_commit_sha,
          draft: githubPR.draft,
          mergeable: githubPR.mergeable,
          mergeable_state: githubPR.mergeable_state,
          merged: githubPR.merged
        };

        if (existingPR) {
          await PullRequest.findByIdAndUpdate(existingPR._id, prData);
        } else {
          await PullRequest.create(prData);
          newPRsCount++;
        }
      }

      console.log(`📥 ${newPRsCount} nuevos PRs sincronizados para ${repository.name}`);
      return newPRsCount;
    } catch (error) {
      console.error('Error syncing pull requests:', error);
      throw error;
    }
  }

  /**
   * Obtiene commits recientes
   */
  async getRecentCommits(repositoryId, limit = 10) {
    try {
      return await Commit.find({ repository: repositoryId })
        .populate('author.user', 'firstName lastName email')
        .sort({ commit_date: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      console.error('Error getting recent commits:', error);
      return [];
    }
  }

  /**
   * Obtiene pull requests recientes
   */
  async getRecentPullRequests(repositoryId, limit = 10) {
    try {
      return await PullRequest.find({ repository: repositoryId })
        .populate('author', 'firstName lastName email')
        .sort({ created_at: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      console.error('Error getting recent pull requests:', error);
      return [];
    }
  }

  /**
   * Utilitarios
   */
  extractCommitTags(message) {
    const tags = [];
    const lowerMessage = message.toLowerCase();
    
    const tagPatterns = {
      feat: /^feat(\(.*\))?:/,
      fix: /^fix(\(.*\))?:/,
      docs: /^docs(\(.*\))?:/,
      style: /^style(\(.*\))?:/,
      refactor: /^refactor(\(.*\))?:/,
      test: /^test(\(.*\))?:/,
      chore: /^chore(\(.*\))?:/,
      perf: /^perf(\(.*\))?:/,
      ci: /^ci(\(.*\))?:/
    };

    for (const [tag, pattern] of Object.entries(tagPatterns)) {
      if (pattern.test(lowerMessage)) {
        tags.push(tag);
        break;
      }
    }

    return tags;
  }

  mapGitHubPRStatus(githubPR) {
    if (githubPR.merged) return 'merged';
    if (githubPR.state === 'closed') return 'closed';
    if (githubPR.draft) return 'draft';
    
    // Aquí podrías verificar el estado de reviews
    return 'open';
  }

  getLastActivity(commits, prs) {
    const allDates = [
      ...commits.map(c => new Date(c.commit_date)),
      ...prs.map(pr => new Date(pr.updated_at))
    ];
    
    return allDates.length > 0 ? new Date(Math.max(...allDates)) : null;
  }

  async getBranchCount(owner, name) {
    try {
      const branches = await githubService.getBranches(owner, name);
      return branches.length;
    } catch (error) {
      console.error('Error getting branch count:', error);
      return 0;
    }
  }

  async updateRepositoryMetrics(repositoryId) {
    try {
      const [commitsCount, prsCount, lastCommit] = await Promise.all([
        Commit.countDocuments({ repository: repositoryId }),
        PullRequest.countDocuments({ repository: repositoryId }),
        Commit.findOne({ repository: repositoryId }).sort({ commit_date: -1 })
      ]);

      await Repository.findByIdAndUpdate(repositoryId, {
        'metrics.total_commits': commitsCount,
        'metrics.last_commit_date': lastCommit?.commit_date,
        'metrics.updated_at': new Date()
      });
    } catch (error) {
      console.error('Error updating repository metrics:', error);
    }
  }

  async getRepositoryStatistics(repositoryId) {
    try {
      const [
        totalCommits,
        totalPRs,
        openPRs,
        mergedPRs,
        commitsByAuthor,
        commitsLastWeek
      ] = await Promise.all([
        Commit.countDocuments({ repository: repositoryId }),
        PullRequest.countDocuments({ repository: repositoryId }),
        PullRequest.countDocuments({ repository: repositoryId, state: 'open' }),
        PullRequest.countDocuments({ repository: repositoryId, merged: true }),
        this.getCommitsByAuthor(repositoryId),
        this.getCommitsLastWeek(repositoryId)
      ]);

      return {
        totalCommits,
        totalPRs,
        openPRs,
        mergedPRs,
        commitsByAuthor,
        commitsLastWeek
      };
    } catch (error) {
      console.error('Error getting repository statistics:', error);
      return {};
    }
  }

  async getCommitsByAuthor(repositoryId) {
    try {
      return await Commit.aggregate([
        { $match: { repository: repositoryId } },
        { 
          $group: {
            _id: '$author.email',
            count: { $sum: 1 },
            name: { $first: '$author.name' },
            lastCommit: { $max: '$commit_date' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);
    } catch (error) {
      console.error('Error getting commits by author:', error);
      return [];
    }
  }

  async getCommitsLastWeek(repositoryId) {
    try {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return await Commit.countDocuments({
        repository: repositoryId,
        commit_date: { $gte: weekAgo }
      });
    } catch (error) {
      console.error('Error getting commits last week:', error);
      return 0;
    }
  }

  /**
   * Obtiene commits de un repositorio con paginación
   */
  async getCommits(repositoryId, options = {}) {
    try {
      const { limit = 20, page = 1 } = options;
      const skip = (page - 1) * limit;

      const commits = await Commit.find({ repository: repositoryId })
        .populate('author.user', 'firstName lastName email')
        .sort({ commit_date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      return commits;
    } catch (error) {
      console.error('Error getting commits:', error);
      return [];
    }
  }

  /**
   * Obtiene pull requests de un repositorio con paginación
   */
  async getPullRequests(repositoryId, options = {}) {
    try {
      const { limit = 10, state = 'all' } = options;

      let query = { repository: repositoryId };
      if (state !== 'all') {
        query.state = state;
      }

      const pullRequests = await PullRequest.find(query)
        .populate('author', 'firstName lastName email')
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .lean();

      return pullRequests;
    } catch (error) {
      console.error('Error getting pull requests:', error);
      return [];
    }
  }

  /**
   * Obtiene commits de un repositorio con paginación
   */
  async getRepositoryCommits(repositoryId, options = {}) {
    try {
      const { page = 1, limit = 20, branch = 'main' } = options;
      const skip = (page - 1) * limit;

      console.log(`📝 Obteniendo commits para repo ${repositoryId}, página ${page}`);

      // Buscar el repositorio
      const repository = await Repository.findById(repositoryId);
      if (!repository) {
        throw new Error('Repositorio no encontrado');
      }

      // Obtener commits de la base de datos
      let commits = await Commit.find({ repository: repositoryId })
        .sort({ commit_date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Si no hay commits en la DB, intentar obtener de GitHub
      if (commits.length === 0) {
        console.log('🔄 No hay commits en DB, obteniendo de GitHub...');
        commits = await this.syncRepositoryCommits(repositoryId);
        
        // Aplicar paginación a los commits de GitHub
        commits = commits
          .sort((a, b) => new Date(b.commit_date) - new Date(a.commit_date))
          .slice(skip, skip + parseInt(limit));
      }

      console.log(`✅ Encontrados ${commits.length} commits`);
      return commits;
    } catch (error) {
      console.error('❌ Error obteniendo commits del repositorio:', error);
      throw error;
    }
  }

  /**
   * Obtiene pull requests de un repositorio
   */
  async getRepositoryPullRequests(repositoryId, options = {}) {
    try {
      const { state = 'all' } = options;

      console.log(`🔀 Obteniendo PRs para repo ${repositoryId}, estado: ${state}`);

      // Buscar el repositorio
      const repository = await Repository.findById(repositoryId);
      if (!repository) {
        throw new Error('Repositorio no encontrado');
      }

      // Construir query
      let query = { repository: repositoryId };
      if (state !== 'all') {
        query.state = state;
      }

      // Obtener PRs de la base de datos
      let pullRequests = await PullRequest.find(query)
        .sort({ updated_at: -1 })
        .lean();

      // Si no hay PRs en la DB, intentar obtener de GitHub
      if (pullRequests.length === 0) {
        console.log('🔄 No hay PRs en DB, obteniendo de GitHub...');
        pullRequests = await this.syncRepositoryPullRequests(repositoryId, state);
      }

      console.log(`✅ Encontrados ${pullRequests.length} pull requests`);
      return pullRequests;
    } catch (error) {
      console.error('❌ Error obteniendo pull requests del repositorio:', error);
      throw error;
    }
  }

  /**
   * Sincroniza commits desde GitHub
   */
  async syncRepositoryCommits(repositoryId) {
    try {
      const repository = await Repository.findById(repositoryId);
      if (!repository) {
        throw new Error('Repositorio no encontrado');
      }

      console.log(`🔄 Sincronizando commits de ${repository.owner}/${repository.name}`);

      // Obtener commits desde GitHub
      const githubCommits = await githubService.getRepositoryCommits(
        repository.owner,
        repository.name,
        { per_page: 50 }
      );

      const commits = [];

      // Procesar cada commit
      for (const githubCommit of githubCommits) {
        const commitData = {
          repository: repositoryId,
          sha: githubCommit.sha,
          hash: githubCommit.sha, // Mantener compatibilidad
          message: githubCommit.commit.message,
          author_name: githubCommit.commit.author.name,
          author_email: githubCommit.commit.author.email,
          author_username: githubCommit.author?.login || 'unknown',
          commit_date: new Date(githubCommit.commit.author.date),
          commitDate: new Date(githubCommit.commit.author.date), // Alias
          date: new Date(githubCommit.commit.author.date), // Otro alias
          url: githubCommit.html_url,
          html_url: githubCommit.html_url,
          tree_sha: githubCommit.commit.tree.sha,
          tree_hash: githubCommit.commit.tree.sha, // Alias
          // Campos de autor estructurados
          author: {
            name: githubCommit.commit.author.name,
            email: githubCommit.commit.author.email
          },
          committer: {
            name: githubCommit.commit.committer.name,
            email: githubCommit.commit.committer.email
          }
        };

        // Crear o actualizar commit
        const commit = await Commit.findOneAndUpdate(
          { 
            $or: [
              { sha: githubCommit.sha, repository: repositoryId },
              { hash: githubCommit.sha, repository: repositoryId }
            ]
          },
          {
            ...commitData,
            sha: githubCommit.sha,
            hash: githubCommit.sha // Mantener compatibilidad
          },
          { upsert: true, new: true }
        );

        commits.push(commit);
      }

      console.log(`✅ Sincronizados ${commits.length} commits`);
      return commits;
    } catch (error) {
      console.error('❌ Error sincronizando commits:', error);
      return [];
    }
  }

  /**
   * Sincroniza pull requests desde GitHub
   */
  async syncRepositoryPullRequests(repositoryId, state = 'all') {
    try {
      const repository = await Repository.findById(repositoryId);
      if (!repository) {
        throw new Error('Repositorio no encontrado');
      }

      console.log(`🔄 Sincronizando PRs de ${repository.owner}/${repository.name}`);

      // Obtener PRs desde GitHub
      const githubPRs = await githubService.getRepositoryPullRequests(
        repository.owner,
        repository.name,
        { state: state === 'all' ? 'all' : state, per_page: 50 }
      );

      const pullRequests = [];

      // Procesar cada PR
      for (const githubPR of githubPRs) {
        const prData = {
          repository: repositoryId,
          number: githubPR.number,
          title: githubPR.title,
          description: githubPR.body || '',
          state: githubPR.state,
          author_username: githubPR.user.login,
          author_avatar: githubPR.user.avatar_url,
          base_branch: githubPR.base.ref,
          head_branch: githubPR.head.ref,
          created_at: new Date(githubPR.created_at),
          updated_at: new Date(githubPR.updated_at),
          closed_at: githubPR.closed_at ? new Date(githubPR.closed_at) : null,
          merged_at: githubPR.merged_at ? new Date(githubPR.merged_at) : null,
          url: githubPR.html_url
        };

        // Crear o actualizar PR
        const pr = await PullRequest.findOneAndUpdate(
          { number: githubPR.number, repository: repositoryId },
          prData,
          { upsert: true, new: true }
        );

        pullRequests.push(pr);
      }

      console.log(`✅ Sincronizados ${pullRequests.length} pull requests`);
      return pullRequests;
    } catch (error) {
      console.error('❌ Error sincronizando pull requests:', error);
      return [];
    }
  }
  /**
   * Conecta un repositorio de GitHub al proyecto
   */
  async connectGitHubRepository(projectId, githubRepository, userId) {
    try {
      console.log(`🔗 Conectando repositorio ${githubRepository.name} al proyecto ${projectId}`);
      
      // Verificar si el repositorio ya existe
      const existingRepo = await Repository.findOne({ 
        repo_id: githubRepository.id.toString() 
      });

      if (existingRepo) {
        throw new Error('Este repositorio ya está conectado');
      }

      // Crear nuevo repositorio
      const repoData = {
        repo_id: githubRepository.id.toString(),
        name: githubRepository.name,
        description: githubRepository.description || 'Sin descripción',
        url: githubRepository.html_url,
        clone_url: githubRepository.clone_url,
        ssh_url: githubRepository.ssh_url,
        owner: githubRepository.owner.login,
        is_private: githubRepository.private,
        project: projectId,
        language: githubRepository.language || 'No especificado',
        default_branch: githubRepository.default_branch || 'main',
        status: 'active',
        github_data: {
          id: githubRepository.id,
          node_id: githubRepository.node_id,
          full_name: githubRepository.full_name,
          clone_url: githubRepository.clone_url,
          git_url: githubRepository.git_url,
          ssh_url: githubRepository.ssh_url,
          homepage: githubRepository.homepage,
          size: githubRepository.size || 0,
          stargazers_count: githubRepository.stargazers_count || 0,
          watchers_count: githubRepository.watchers_count || 0,
          forks_count: githubRepository.forks_count || 0,
          open_issues_count: githubRepository.open_issues_count || 0,
          has_issues: githubRepository.has_issues || false,
          has_projects: githubRepository.has_projects || false,
          has_wiki: githubRepository.has_wiki || false,
          has_pages: githubRepository.has_pages || false,
          has_downloads: githubRepository.has_downloads || false,
          archived: githubRepository.archived || false,
          disabled: githubRepository.disabled || false,
          pushed_at: githubRepository.pushed_at,
          created_at: githubRepository.created_at,
          updated_at: githubRepository.updated_at
        },
        metrics: {
          last_commit_date: githubRepository.pushed_at ? new Date(githubRepository.pushed_at) : null,
          created_at: new Date(githubRepository.created_at),
          updated_at: new Date(githubRepository.updated_at)
        }
      };

      const newRepo = await Repository.create(repoData);
      console.log(`✅ Repositorio ${newRepo.name} conectado exitosamente`);

      // Sincronizar datos iniciales de commits y PRs en segundo plano
      this.syncRepository(newRepo._id).catch(error => {
        console.error(`❌ Error en sincronización inicial de ${newRepo.name}:`, error);
      });

      return newRepo;
    } catch (error) {
      console.error('❌ Error conectando repositorio de GitHub:', error);
      throw error;
    }
  }

  /**
   * Desconecta un repositorio del proyecto
   */
  async disconnectRepository(repositoryId, userId) {
    try {
      console.log(`🔌 Desconectando repositorio ${repositoryId}`);
      
      const repository = await Repository.findById(repositoryId);
      if (!repository) {
        throw new Error('Repositorio no encontrado');
      }

      // Eliminar commits y PRs asociados
      await Promise.all([
        Commit.deleteMany({ repository: repositoryId }),
        PullRequest.deleteMany({ repository: repositoryId })
      ]);

      // Eliminar el repositorio
      await Repository.findByIdAndDelete(repositoryId);

      console.log(`✅ Repositorio ${repository.name} desconectado exitosamente`);
      return true;
    } catch (error) {
      console.error('❌ Error desconectando repositorio:', error);
      throw error;
    }
  }

}

module.exports = new RepositoryService();
