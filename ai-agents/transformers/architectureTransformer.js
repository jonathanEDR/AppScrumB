/**
 * Architecture Transformer
 * Transforma el JSON completo de arquitectura de la IA al modelo Mongoose
 * 
 * Este es el transformador principal que orquesta todos los demás
 * 
 * NOTA: La transformación de database_schema se ha movido al módulo independiente DatabaseSchema
 * 
 * @module ai-agents/transformers/architectureTransformer
 */

const { transformEndpoints } = require('./endpointTransformer');

/**
 * Convierte arrays de strings a objetos del tech stack
 * @param {Array} arr - Array de tecnologías
 * @param {string} category - Categoría (frontend, backend, database, infrastructure)
 * @returns {Object} Objeto estructurado
 */
function parseStackArray(arr, category) {
  if (!arr || !Array.isArray(arr)) return {};
  
  const result = {};
  const knownFields = {
    frontend: ['framework', 'language', 'ui_library', 'state_management', 'routing', 'build_tool', 'testing'],
    backend: ['framework', 'language', 'orm', 'api_style', 'auth', 'testing'],
    database: ['primary', 'cache', 'search', 'file_storage'],
    infrastructure: ['hosting_frontend', 'hosting_backend', 'ci_cd', 'containers', 'monitoring', 'logging', 'cdn']
  };
  
  const fields = knownFields[category] || [];
  arr.forEach((item, index) => {
    if (typeof item === 'string') {
      if (fields[index]) {
        result[fields[index]] = item;
      }
    } else if (typeof item === 'object') {
      Object.assign(result, item);
    }
  });
  
  return result;
}

/**
 * Transforma array de módulos
 * @param {Array} modules - Módulos de la IA
 * @returns {Array} Módulos transformados
 */
function transformModules(modules) {
  if (!modules || !Array.isArray(modules)) return [];
  
  return modules.map((mod, idx) => ({
    name: mod.name || mod.module_name || `Módulo ${idx + 1}`,
    description: mod.description || '',
    type: mod.type || 'backend',
    status: 'planned',
    features: mod.features || mod.technologies || [],
    dependencies: mod.dependencies || [],
    estimated_complexity: mod.complexity || 'medium',
    notes: mod.notes || ''
  }));
}

/**
 * Transforma decisiones de arquitectura
 * @param {Array} decisions - Decisiones de la IA
 * @returns {Array} Decisiones transformadas
 */
function transformDecisions(decisions) {
  if (!decisions || !Array.isArray(decisions)) return [];
  
  return decisions.map(d => ({
    title: d.decision || d.title || 'Decision',
    status: 'accepted',
    context: d.context || '',
    decision: d.decision || d.title || '',
    consequences: d.rationale || d.consequences || '',
    alternatives_considered: d.alternatives || []
  }));
}

/**
 * Transforma roadmap técnico
 * @param {Array} roadmap - Roadmap de la IA
 * @returns {Array} Roadmap transformado
 */
function transformRoadmap(roadmap) {
  if (!roadmap || !Array.isArray(roadmap)) return [];
  
  return roadmap.map((phase, idx) => {
    if (typeof phase === 'string') {
      return {
        phase: `Fase ${idx + 1}`,
        name: phase,
        description: phase,
        status: 'planned'
      };
    }
    return {
      phase: phase.phase || phase.name || `Fase ${idx + 1}`,
      name: phase.name || phase.phase || '',
      description: phase.description || '',
      modules_included: phase.modules || phase.modules_included || [],
      features: phase.features || [],
      status: 'planned'
    };
  });
}

/**
 * Transforma patrones de arquitectura
 * @param {Array} patterns - Patrones de la IA
 * @returns {Array} Patrones transformados
 */
function transformPatterns(patterns) {
  if (!patterns || !Array.isArray(patterns)) return [];
  
  return patterns.map(p => {
    if (typeof p === 'string') {
      return { pattern: p, applied_to: 'all', description: '' };
    }
    return {
      pattern: p.pattern || p.name || 'Unknown',
      applied_to: p.applied_to || 'all',
      description: p.description || ''
    };
  });
}

/**
 * Transforma integraciones externas
 * @param {Array} integrations - Integraciones de la IA
 * @returns {Array} Integraciones transformadas
 */
function transformIntegrations(integrations) {
  if (!integrations || !Array.isArray(integrations)) return [];
  
  return integrations.map(i => {
    if (typeof i === 'string') {
      return { name: i, type: 'other', status: 'planned' };
    }
    return {
      name: i.name || 'Integration',
      type: i.type || 'other',
      provider: i.provider || '',
      status: 'planned'
    };
  });
}

/**
 * Transforma configuración de seguridad
 * @param {Object} security - Configuración de seguridad de la IA
 * @returns {Object} Seguridad transformada
 */
function transformSecurity(security) {
  if (!security) return {};
  
  return {
    authentication_method: security.authentication || '',
    authorization_model: security.authorization || '',
    encryption_at_rest: false,
    encryption_in_transit: true,
    security_headers: true,
    audit_logging: false
  };
}

/**
 * Transforma el JSON generado por la IA al formato del modelo ProjectArchitecture
 * Esta es la función principal que orquesta todas las transformaciones
 * 
 * @param {Object} aiData - JSON generado por la IA
 * @param {Object} context - Contexto del producto
 * @returns {Object} - Datos formateados para el modelo
 */
function transformAIArchitectureToModel(aiData, context = {}) {
  console.log('🔄 [TRANSFORM] Starting AI data transformation...');
  
  // Construir objeto transformado
  const transformed = {
    project_name: aiData.name || aiData.project_name || context.product_name || 'Arquitectura del Proyecto',
    description: aiData.description || '',
    project_type: aiData.project_type || aiData.type || 'web_app',
    scale: aiData.scale || 'mvp',
    
    // Tech Stack - transformar de arrays a objetos estructurados
    tech_stack: {
      frontend: typeof aiData.tech_stack?.frontend === 'object' && !Array.isArray(aiData.tech_stack.frontend)
        ? aiData.tech_stack.frontend 
        : parseStackArray(aiData.tech_stack?.frontend, 'frontend'),
      backend: typeof aiData.tech_stack?.backend === 'object' && !Array.isArray(aiData.tech_stack.backend)
        ? aiData.tech_stack.backend
        : parseStackArray(aiData.tech_stack?.backend, 'backend'),
      database: typeof aiData.tech_stack?.database === 'object' && !Array.isArray(aiData.tech_stack.database)
        ? aiData.tech_stack.database
        : parseStackArray(aiData.tech_stack?.database, 'database'),
      infrastructure: typeof aiData.tech_stack?.infrastructure === 'object' && !Array.isArray(aiData.tech_stack.infrastructure)
        ? aiData.tech_stack.infrastructure
        : parseStackArray(aiData.tech_stack?.devops || aiData.tech_stack?.infrastructure, 'infrastructure')
    },
    
    // Módulos
    modules: transformModules(aiData.modules),
    
    // Patrones de arquitectura
    architecture_patterns: transformPatterns(aiData.patterns || aiData.architecture_patterns),
    
    // NOTA: database_schema ahora se maneja en el módulo independiente DatabaseSchema
    // El usuario puede importar esquemas de base de datos desde código fuente
    
    // Endpoints API (usa transformer dedicado)
    api_endpoints: transformEndpoints(aiData.api_endpoints),
    
    // Integraciones
    integrations: transformIntegrations(aiData.integrations),
    
    // Decisiones de arquitectura
    architecture_decisions: transformDecisions(aiData.architecture_decisions),
    
    // Roadmap técnico
    technical_roadmap: transformRoadmap(aiData.roadmap || aiData.technical_roadmap),
    
    // Seguridad
    security: transformSecurity(aiData.security),
    
    // Estructura del proyecto / directorios
    directory_structure: aiData.project_structure || aiData.directory_structure || aiData.folder_structure || null
  };
  
  console.log('✅ [TRANSFORM] Transformation complete');
  console.log('   📦 Project name:', transformed.project_name);
  console.log('   📦 Modules:', transformed.modules.length);
  console.log('   📦 Endpoints:', transformed.api_endpoints.length);
  console.log('   📦 Has directory structure:', !!transformed.directory_structure);
  
  return transformed;
}

module.exports = {
  transformAIArchitectureToModel,
  parseStackArray,
  transformModules,
  transformDecisions,
  transformRoadmap,
  transformPatterns,
  transformIntegrations,
  transformSecurity
};
