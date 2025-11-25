/**
 * ContextCache.js
 * Sistema de caché para contexto de agentes AI
 * Reduce tokens de OpenAI y mejora performance
 */

const NodeCache = require('node-cache');

class ContextCache {
  constructor() {
    // Cache en memoria con TTL de 5 minutos (300 segundos)
    this.cache = new NodeCache({
      stdTTL: 300,
      checkperiod: 60, // Limpia cada 60 segundos
      useClones: false // Performance: no clonar objetos
    });

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0
    };
  }

  /**
   * Genera clave de cache
   */
  _generateKey(type, id, params = {}) {
    const paramsStr = Object.keys(params).length > 0 
      ? JSON.stringify(params) 
      : '';
    return `${type}:${id}${paramsStr}`;
  }

  /**
   * Obtiene contexto de producto del cache
   */
  async getProductContext(productId) {
    const key = this._generateKey('product', productId);
    const cached = this.cache.get(key);
    
    if (cached) {
      this.stats.hits++;
      console.log(`📦 [Cache HIT] Product context: ${productId}`);
      return cached;
    }
    
    this.stats.misses++;
    console.log(`🔍 [Cache MISS] Product context: ${productId}`);
    return null;
  }

  /**
   * Guarda contexto de producto en cache
   */
  async setProductContext(productId, context) {
    const key = this._generateKey('product', productId);
    this.cache.set(key, context);
    this.stats.sets++;
    console.log(`💾 [Cache SET] Product context: ${productId}`);
    return true;
  }

  /**
   * Obtiene backlog del cache
   */
  async getBacklogContext(productId, params = {}) {
    const key = this._generateKey('backlog', productId, params);
    const cached = this.cache.get(key);
    
    if (cached) {
      this.stats.hits++;
      console.log(`📦 [Cache HIT] Backlog: ${productId}`);
      return cached;
    }
    
    this.stats.misses++;
    console.log(`🔍 [Cache MISS] Backlog: ${productId}`);
    return null;
  }

  /**
   * Guarda backlog en cache
   */
  async setBacklogContext(productId, context, params = {}) {
    const key = this._generateKey('backlog', productId, params);
    this.cache.set(key, context);
    this.stats.sets++;
    console.log(`💾 [Cache SET] Backlog: ${productId}`);
    return true;
  }

  /**
   * Obtiene sprints del cache
   */
  async getSprintsContext(productId) {
    const key = this._generateKey('sprints', productId);
    const cached = this.cache.get(key);
    
    if (cached) {
      this.stats.hits++;
      console.log(`📦 [Cache HIT] Sprints: ${productId}`);
      return cached;
    }
    
    this.stats.misses++;
    console.log(`🔍 [Cache MISS] Sprints: ${productId}`);
    return null;
  }

  /**
   * Guarda sprints en cache
   */
  async setSprintsContext(productId, context) {
    const key = this._generateKey('sprints', productId);
    this.cache.set(key, context);
    this.stats.sets++;
    console.log(`💾 [Cache SET] Sprints: ${productId}`);
    return true;
  }

  /**
   * Invalida cache de un producto específico
   */
  async invalidateProduct(productId) {
    const keys = this.cache.keys();
    let deleted = 0;

    keys.forEach(key => {
      if (key.includes(`:${productId}`)) {
        this.cache.del(key);
        deleted++;
      }
    });

    console.log(`🗑️ [Cache INVALIDATE] Product ${productId}: ${deleted} entries deleted`);
    return deleted;
  }

  /**
   * Invalida todo el cache
   */
  async invalidateAll() {
    const count = this.cache.keys().length;
    this.cache.flushAll();
    console.log(`🗑️ [Cache FLUSH] All cache cleared: ${count} entries`);
    return count;
  }

  /**
   * Obtiene estadísticas del cache
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;
    
    return {
      ...this.stats,
      total_requests: total,
      hit_rate: `${hitRate}%`,
      cache_size: this.cache.keys().length,
      cache_stats: this.cache.getStats()
    };
  }

  /**
   * Resetea estadísticas
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0
    };
  }
}

// Singleton instance
const contextCache = new ContextCache();

module.exports = contextCache;
