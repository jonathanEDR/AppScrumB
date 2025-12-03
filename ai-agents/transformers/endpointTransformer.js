/**
 * Endpoint Transformer
 * Transforma los endpoints API de la IA al formato del modelo
 * 
 * Soporta endpoints completos con:
 * - Path params y query params
 * - Request body con schema
 * - Múltiples responses con status codes
 * - Rate limiting
 * - Roles y permisos
 * 
 * @module ai-agents/transformers/endpointTransformer
 */

/**
 * Transforma un endpoint individual
 * @param {Object} ep - Endpoint a transformar
 * @returns {Object} Endpoint transformado
 */
function transformEndpoint(ep) {
  const endpoint = {
    method: (ep.method || 'GET').toUpperCase(),
    path: ep.path || ep.endpoint || '/',
    summary: ep.summary || '',
    description: ep.description || '',
    module: ep.module || '',
    auth_required: ep.auth_required !== false,
    roles_allowed: ep.roles || ep.roles_allowed || [],
    permissions: ep.permissions || [],
    tags: ep.tags || [],
    status: ep.status || 'planned',
    version: ep.version || 'v1',
    related_entity: ep.related_entity || ''
  };
  
  // Path params
  if (ep.path_params && Array.isArray(ep.path_params)) {
    endpoint.path_params = ep.path_params.map(p => ({
      name: p.name,
      type: p.type || 'String',
      required: p.required !== false,
      description: p.description || ''
    }));
  }
  
  // Query params
  if (ep.query_params && Array.isArray(ep.query_params)) {
    endpoint.query_params = ep.query_params.map(p => ({
      name: p.name,
      type: p.type || 'String',
      required: p.required || false,
      description: p.description || '',
      default_value: p.default_value,
      enum_values: p.enum_values
    }));
  }
  
  // Headers
  if (ep.headers && Array.isArray(ep.headers)) {
    endpoint.headers = ep.headers;
  }
  
  // Request body
  if (ep.request_body) {
    endpoint.request_body = {
      content_type: ep.request_body.content_type || 'application/json',
      required: ep.request_body.required !== false,
      description: ep.request_body.description || '',
      schema: ep.request_body.schema || null,
      example: ep.request_body.example || null
    };
  }
  
  // Responses
  if (ep.responses && Array.isArray(ep.responses)) {
    endpoint.responses = ep.responses.map(r => ({
      status_code: r.status_code || r.status || 200,
      description: r.description || '',
      content_type: r.content_type || 'application/json',
      schema: r.schema || null,
      example: r.example || null
    }));
  }
  
  // Rate limiting
  if (ep.rate_limit) {
    endpoint.rate_limit = {
      enabled: ep.rate_limit.enabled || false,
      max_requests: ep.rate_limit.max_requests,
      window_ms: ep.rate_limit.window_ms
    };
  }
  
  // Deprecation
  if (ep.deprecated_date) endpoint.deprecated_date = ep.deprecated_date;
  if (ep.deprecated_reason) endpoint.deprecated_reason = ep.deprecated_reason;
  
  // Notes
  if (ep.notes) endpoint.notes = ep.notes;
  
  return endpoint;
}

/**
 * Transforma array completo de endpoints
 * @param {Array} endpoints - Array de endpoints de la IA
 * @returns {Array} Array de endpoints transformados
 */
function transformEndpoints(endpoints) {
  if (!endpoints || !Array.isArray(endpoints)) return [];
  
  return endpoints.map(transformEndpoint);
}

module.exports = {
  transformEndpoints,
  transformEndpoint
};
