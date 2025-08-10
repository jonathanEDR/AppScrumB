const { Octokit } = require('@octokit/rest');
const crypto = require('crypto');

class GitHubService {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
      userAgent: 'AppScrum v1.0.0'
    });
    
    this.webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  }

  /**
   * Verifica la firma del webhook de GitHub
   */
  verifyWebhookSignature(payload, signature) {
    if (!this.webhookSecret) {
      console.warn('GitHub webhook secret not configured');
      return true; // En desarrollo, permitir sin verificación
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload, 'utf8')
      .digest('hex');

    return `sha256=${expectedSignature}` === signature;
  }

  /**
   * Obtiene todos los repositorios del usuario autenticado
   */
  async getUserRepositories(options = {}) {
    try {
      console.log('📁 Obteniendo repositorios del usuario de GitHub...');
      
      const { data } = await this.octokit.rest.repos.listForAuthenticatedUser({
        per_page: options.per_page || 100,
        sort: 'updated',
        direction: 'desc',
        affiliation: 'owner,collaborator',
        ...options
      });

      console.log(`✅ Obtenidos ${data.length} repositorios de GitHub`);
      return data;
    } catch (error) {
      console.error('❌ Error obteniendo repositorios del usuario:', error);
      throw error;
    }
  }

  /**
   * Obtiene información del repositorio
   */
  async getRepository(owner, repo) {
    try {
      const { data } = await this.octokit.rest.repos.get({
        owner,
        repo
      });
      return data;
    } catch (error) {
      console.error('Error getting repository:', error);
      throw error;
    }
  }

  /**
   * Alias para getRepository (para compatibilidad)
   */
  async getRepositoryInfo(owner, repo) {
    return this.getRepository(owner, repo);
  }

  /**
   * Obtiene branches del repositorio
   */
  async getRepositoryBranches(owner, repo, options = {}) {
    try {
      const { data } = await this.octokit.rest.repos.listBranches({
        owner,
        repo,
        per_page: options.per_page || 30,
        ...options
      });
      return data;
    } catch (error) {
      console.error('Error getting repository branches:', error);
      throw error;
    }
  }

  /**
   * Obtiene commits del repositorio
   */
  async getCommits(owner, repo, options = {}) {
    try {
      const params = {
        owner,
        repo,
        per_page: options.per_page || 30,
        page: options.page || 1
      };

      if (options.since) params.since = options.since;
      if (options.until) params.until = options.until;
      if (options.sha) params.sha = options.sha;
      if (options.path) params.path = options.path;
      if (options.author) params.author = options.author;

      const { data } = await this.octokit.rest.repos.listCommits(params);
      return data;
    } catch (error) {
      console.error('Error getting commits:', error);
      throw error;
    }
  }

  /**
   * Obtiene detalles de un commit específico
   */
  async getCommitDetails(owner, repo, sha) {
    try {
      const { data } = await this.octokit.rest.repos.getCommit({
        owner,
        repo,
        ref: sha
      });
      return data;
    } catch (error) {
      console.error('Error getting commit details:', error);
      throw error;
    }
  }

  /**
   * Obtiene pull requests
   */
  async getPullRequests(owner, repo, options = {}) {
    try {
      const params = {
        owner,
        repo,
        state: options.state || 'all',
        sort: options.sort || 'updated',
        direction: options.direction || 'desc',
        per_page: options.per_page || 30,
        page: options.page || 1
      };

      if (options.head) params.head = options.head;
      if (options.base) params.base = options.base;

      const { data } = await this.octokit.rest.pulls.list(params);
      return data;
    } catch (error) {
      console.error('Error getting pull requests:', error);
      throw error;
    }
  }

  /**
   * Obtiene detalles de un pull request
   */
  async getPullRequestDetails(owner, repo, pullNumber) {
    try {
      const { data } = await this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: pullNumber
      });
      return data;
    } catch (error) {
      console.error('Error getting pull request details:', error);
      throw error;
    }
  }

  /**
   * Obtiene branches del repositorio
   */
  async getBranches(owner, repo) {
    try {
      const { data } = await this.octokit.rest.repos.listBranches({
        owner,
        repo
      });
      return data;
    } catch (error) {
      console.error('Error getting branches:', error);
      throw error;
    }
  }

  /**
   * Obtiene colaboradores del repositorio
   */
  async getCollaborators(owner, repo) {
    try {
      const { data } = await this.octokit.rest.repos.listCollaborators({
        owner,
        repo
      });
      return data;
    } catch (error) {
      console.error('Error getting collaborators:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas del repositorio
   */
  async getRepositoryStats(owner, repo) {
    try {
      const [languages, contributors, codeFrequency] = await Promise.all([
        this.octokit.rest.repos.listLanguages({ owner, repo }),
        this.octokit.rest.repos.getContributorsStats({ owner, repo }),
        this.octokit.rest.repos.getCodeFrequencyStats({ owner, repo })
      ]);

      return {
        languages: languages.data,
        contributors: contributors.data,
        codeFrequency: codeFrequency.data
      };
    } catch (error) {
      console.error('Error getting repository stats:', error);
      throw error;
    }
  }

  /**
   * Crea un webhook en el repositorio
   */
  async createWebhook(owner, repo, webhookUrl) {
    try {
      const { data } = await this.octokit.rest.repos.createWebhook({
        owner,
        repo,
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: this.webhookSecret
        },
        events: [
          'push',
          'pull_request',
          'pull_request_review',
          'issues',
          'issue_comment',
          'commit_comment',
          'create',
          'delete'
        ]
      });
      return data;
    } catch (error) {
      console.error('Error creating webhook:', error);
      throw error;
    }
  }

  /**
   * Obtiene commits de un repositorio
   */
  async getRepositoryCommits(owner, repo, options = {}) {
    try {
      const { sha, since, until, per_page = 30, page = 1 } = options;
      
      const params = {
        owner,
        repo,
        per_page,
        page
      };

      if (sha) params.sha = sha;
      if (since) params.since = since;
      if (until) params.until = until;

      console.log(`🔄 Obteniendo commits de GitHub: ${owner}/${repo}`);
      
      const { data } = await this.octokit.rest.repos.listCommits(params);
      
      console.log(`✅ Obtenidos ${data.length} commits de GitHub`);
      return data;
    } catch (error) {
      console.error('❌ Error obteniendo commits de GitHub:', error);
      throw error;
    }
  }

  /**
   * Obtiene pull requests de un repositorio
   */
  async getRepositoryPullRequests(owner, repo, options = {}) {
    try {
      const { state = 'open', sort = 'updated', direction = 'desc', per_page = 30, page = 1 } = options;
      
      const params = {
        owner,
        repo,
        state,
        sort,
        direction,
        per_page,
        page
      };

      console.log(`🔄 Obteniendo PRs de GitHub: ${owner}/${repo}, estado: ${state}`);
      
      const { data } = await this.octokit.rest.pulls.list(params);
      
      console.log(`✅ Obtenidos ${data.length} PRs de GitHub`);
      return data;
    } catch (error) {
      console.error('❌ Error obteniendo PRs de GitHub:', error);
      throw error;
    }
  }

  /**
   * Obtiene detalles específicos de un pull request
   */
  async getPullRequest(owner, repo, pullNumber) {
    try {
      console.log(`🔄 Obteniendo PR #${pullNumber} de ${owner}/${repo}`);
      
      const { data } = await this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: pullNumber
      });
      
      console.log(`✅ Obtenido PR #${pullNumber}`);
      return data;
    } catch (error) {
      console.error(`❌ Error obteniendo PR #${pullNumber}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene commits de un pull request específico
   */
  async getPullRequestCommits(owner, repo, pullNumber) {
    try {
      console.log(`🔄 Obteniendo commits del PR #${pullNumber} de ${owner}/${repo}`);
      
      const { data } = await this.octokit.rest.pulls.listCommits({
        owner,
        repo,
        pull_number: pullNumber
      });
      
      console.log(`✅ Obtenidos ${data.length} commits del PR #${pullNumber}`);
      return data;
    } catch (error) {
      console.error(`❌ Error obteniendo commits del PR #${pullNumber}:`, error);
      throw error;
    }
  }
}

module.exports = new GitHubService();
