/**
 * ProjectArchitecture Model
 * Define la estructura técnica y arquitectónica de un proyecto/producto
 * Relacionado 1:1 con Product
 */

const mongoose = require('mongoose');

// Sub-schema para campos de tecnología
const TechFieldSchema = new mongoose.Schema({
  name: { type: String, required: true },
  version: String,
  notes: String
}, { _id: false });

// Sub-schema para Frontend Stack
const FrontendStackSchema = new mongoose.Schema({
  framework: { type: String },           // React, Vue, Angular, Svelte, Next.js
  language: { type: String },            // JavaScript, TypeScript
  ui_library: { type: String },          // Tailwind, Material UI, Chakra, Bootstrap
  state_management: { type: String },    // Redux, Zustand, Context API, Pinia
  routing: { type: String },             // React Router, Vue Router
  build_tool: { type: String },          // Vite, Webpack, esbuild
  testing: { type: String },             // Jest, Vitest, Cypress
  additional: [TechFieldSchema]
}, { _id: false });

// Sub-schema para Backend Stack
const BackendStackSchema = new mongoose.Schema({
  framework: { type: String },           // Express, NestJS, Fastify, Django, FastAPI
  language: { type: String },            // Node.js, Python, Java, Go
  orm: { type: String },                 // Mongoose, Prisma, Sequelize, TypeORM
  api_style: { type: String },           // REST, GraphQL, gRPC
  auth: { type: String },                // JWT, OAuth, Clerk, Auth0
  testing: { type: String },             // Jest, Mocha, PyTest
  additional: [TechFieldSchema]
}, { _id: false });

// Sub-schema para Database
const DatabaseStackSchema = new mongoose.Schema({
  primary: { type: String },             // MongoDB, PostgreSQL, MySQL, SQLite
  primary_version: { type: String },
  cache: { type: String },               // Redis, Memcached
  search: { type: String },              // Elasticsearch, Algolia, Meilisearch
  file_storage: { type: String },        // S3, Cloudinary, Firebase Storage
  additional: [TechFieldSchema]
}, { _id: false });

// Sub-schema para Infrastructure
const InfrastructureStackSchema = new mongoose.Schema({
  hosting_frontend: { type: String },    // Vercel, Netlify, AWS Amplify
  hosting_backend: { type: String },     // Render, Railway, AWS, Heroku
  ci_cd: { type: String },               // GitHub Actions, GitLab CI, Jenkins
  containers: { type: String },          // Docker, Kubernetes, Docker Compose
  monitoring: { type: String },          // Datadog, New Relic, Sentry
  logging: { type: String },             // Winston, Pino, CloudWatch
  cdn: { type: String },                 // Cloudflare, AWS CloudFront
  additional: [TechFieldSchema]
}, { _id: false });

// Sub-schema para Módulos/Componentes
const ModuleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  type: {
    type: String,
    enum: ['frontend', 'backend', 'shared', 'infrastructure', 'mobile', 'external'],
    default: 'backend'
  },
  status: {
    type: String,
    enum: ['planned', 'in_development', 'completed', 'deprecated', 'blocked'],
    default: 'planned'
  },
  path: { type: String },                // Ruta en el código: "src/modules/auth"
  dependencies: [{ type: String }],      // Otros módulos de los que depende
  estimated_complexity: {
    type: String,
    enum: ['trivial', 'low', 'medium', 'high', 'very_high'],
    default: 'medium'
  },
  estimated_hours: { type: Number },
  priority: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'medium'
  },
  assigned_sprint: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Sprint' 
  },
  related_stories: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'BacklogItem' 
  }],
  features: [{ type: String }],          // Lista de features del módulo
  notes: { type: String }
}, { _id: true });

// Sub-schema para Patrones de Arquitectura
const ArchitecturePatternSchema = new mongoose.Schema({
  pattern: { type: String, required: true }, // MVC, CQRS, Clean Architecture, Hexagonal
  applied_to: {
    type: String,
    enum: ['frontend', 'backend', 'all', 'database', 'infrastructure'],
    default: 'all'
  },
  description: { type: String },
  benefits: [{ type: String }],
  notes: { type: String }
}, { _id: false });

// NOTA: Los esquemas de base de datos ahora se manejan en el módulo independiente DatabaseSchema
// Ver models/DatabaseSchema.js para la definición de entidades de base de datos

// Sub-schema para parámetros de API
const ApiParameterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },           // String, Number, Boolean, Array, Object
  required: { type: Boolean, default: false },
  description: { type: String },
  default_value: { type: mongoose.Schema.Types.Mixed },
  enum_values: [{ type: mongoose.Schema.Types.Mixed }],
  example: { type: mongoose.Schema.Types.Mixed },
  validation: { type: String }                      // Descripción de validación
}, { _id: false });

// Sub-schema para API Endpoints - MEJORADO
const ApiEndpointSchema = new mongoose.Schema({
  method: { 
    type: String, 
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    required: true 
  },
  path: { type: String, required: true },
  summary: { type: String },                        // Resumen corto (para Swagger)
  description: { type: String },                    // Descripción detallada
  
  // Categorización
  module: { type: String },
  tags: [{ type: String }],                         // Tags para agrupar en docs
  
  // Seguridad
  auth_required: { type: Boolean, default: true },
  roles_allowed: [{ type: String }],
  permissions: [{ type: String }],                  // Permisos específicos
  
  // Parámetros de ruta (ej: /users/:id)
  path_params: [ApiParameterSchema],
  
  // Parámetros de query (ej: ?page=1&limit=10)
  query_params: [ApiParameterSchema],
  
  // Headers requeridos
  headers: [{
    name: { type: String, required: true },
    required: { type: Boolean, default: false },
    description: { type: String },
    example: { type: String }
  }],
  
  // Request body (para POST, PUT, PATCH)
  request_body: {
    content_type: { type: String, default: 'application/json' },
    required: { type: Boolean, default: true },
    description: { type: String },
    schema: { type: mongoose.Schema.Types.Mixed },  // Estructura del body
    example: { type: mongoose.Schema.Types.Mixed }
  },
  
  // Respuestas posibles
  responses: [{
    status_code: { type: Number, required: true },  // 200, 201, 400, 401, 404, 500
    description: { type: String },
    content_type: { type: String, default: 'application/json' },
    schema: { type: mongoose.Schema.Types.Mixed },
    example: { type: mongoose.Schema.Types.Mixed }
  }],
  
  // Rate limiting
  rate_limit: {
    enabled: { type: Boolean, default: false },
    max_requests: { type: Number },
    window_ms: { type: Number }                     // Ventana de tiempo en ms
  },
  
  // Estado y metadatos
  status: {
    type: String,
    enum: ['planned', 'in_development', 'implemented', 'testing', 'deprecated'],
    default: 'planned'
  },
  version: { type: String, default: 'v1' },
  deprecated_date: { type: Date },
  deprecated_reason: { type: String },
  
  // Relación con entidad
  related_entity: { type: String },                 // Entidad principal que maneja
  
  // Notas
  notes: { type: String }
}, { _id: true });

// Sub-schema para Integraciones Externas
const IntegrationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['payment', 'auth', 'email', 'sms', 'analytics', 'storage', 'ai', 'maps', 'social', 'other']
  },
  provider: { type: String },             // Stripe, SendGrid, Twilio, etc.
  status: {
    type: String,
    enum: ['planned', 'configured', 'active', 'deprecated'],
    default: 'planned'
  },
  api_version: { type: String },
  // Variables de entorno - Schema mixto para soportar formato antiguo (strings) y nuevo (objetos)
  environment_vars: { type: mongoose.Schema.Types.Mixed, default: [] },
  documentation_url: { type: String },
  notes: { type: String }
}, { _id: true });

// Sub-schema para Architecture Decision Records (ADRs)
const ArchitectureDecisionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['proposed', 'accepted', 'deprecated', 'superseded'],
    default: 'accepted'
  },
  context: { type: String },              // Por qué se tomó esta decisión
  decision: { type: String },             // Qué se decidió
  consequences: { type: String },         // Impacto positivo y negativo
  alternatives_considered: [{ type: String }],
  related_modules: [{ type: String }],
  decided_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }
}, { _id: true });

// Sub-schema para Fases del Roadmap Técnico
const RoadmapPhaseSchema = new mongoose.Schema({
  phase: { type: String, required: true },  // "MVP", "v1.0", "v2.0", "Phase 1"
  name: { type: String },
  description: { type: String },
  modules_included: [{ type: String }],
  features: [{ type: String }],
  estimated_start: { type: Date },
  estimated_end: { type: Date },
  actual_start: { type: Date },
  actual_end: { type: Date },
  status: {
    type: String,
    enum: ['planned', 'in_progress', 'completed', 'delayed', 'cancelled'],
    default: 'planned'
  },
  sprint_count: { type: Number },
  notes: { type: String }
}, { _id: true });

// Sub-schema para Environment Configuration
const EnvironmentConfigSchema = new mongoose.Schema({
  name: { type: String, required: true },  // development, staging, production
  url: { type: String },
  database_name: { type: String },
  variables: [{
    key: String,
    description: String,
    required: Boolean,
    sensitive: Boolean
  }],
  notes: { type: String }
}, { _id: false });

// ============================================
// SCHEMA PRINCIPAL: ProjectArchitecture
// ============================================

const ProjectArchitectureSchema = new mongoose.Schema({
  // ========== RELACIÓN CON PRODUCTO ==========
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    unique: true
  },

  // ========== INFORMACIÓN GENERAL ==========
  project_name: { type: String },
  project_type: {
    type: String,
    enum: [
      'web_app',           // Aplicación web tradicional
      'spa',               // Single Page Application
      'mobile_app',        // App móvil (React Native, Flutter)
      'pwa',               // Progressive Web App
      'api_only',          // Solo API/Backend
      'desktop',           // Aplicación de escritorio
      'microservices',     // Arquitectura de microservicios
      'monolith',          // Monolito tradicional
      'serverless',        // Arquitectura serverless
      'hybrid',            // Híbrido
      'cli',               // Herramienta de línea de comandos
      'library',           // Librería/SDK
      'other'
    ],
    default: 'web_app'
  },
  
  description: { type: String },
  
  // Escala del proyecto
  scale: {
    type: String,
    enum: ['prototype', 'mvp', 'small', 'medium', 'large', 'enterprise'],
    default: 'mvp'
  },
  
  // Usuarios esperados
  expected_users: {
    initial: { type: Number },
    growth_target: { type: Number },
    timeframe: { type: String }          // "6 months", "1 year"
  },

  // ========== STACK TECNOLÓGICO ==========
  tech_stack: {
    frontend: FrontendStackSchema,
    backend: BackendStackSchema,
    database: DatabaseStackSchema,
    infrastructure: InfrastructureStackSchema
  },

  // ========== MÓDULOS/COMPONENTES ==========
  modules: [ModuleSchema],

  // ========== PATRONES DE ARQUITECTURA ==========
  architecture_patterns: [ArchitecturePatternSchema],

  // NOTA: El esquema de base de datos ahora se maneja en el módulo independiente DatabaseSchema
  // Ver models/DatabaseSchema.js

  // ========== API ENDPOINTS ==========
  api_endpoints: [ApiEndpointSchema],
  
  // API Configuration
  api_config: {
    base_path: { type: String, default: '/api' },
    version: { type: String, default: 'v1' },
    rate_limiting: { type: Boolean, default: true },
    cors_enabled: { type: Boolean, default: true },
    documentation_tool: { type: String }  // Swagger, Postman, etc.
  },

  // ========== INTEGRACIONES ==========
  integrations: [IntegrationSchema],

  // ========== DECISIONES DE ARQUITECTURA ==========
  architecture_decisions: [ArchitectureDecisionSchema],

  // ========== ROADMAP TÉCNICO ==========
  technical_roadmap: [RoadmapPhaseSchema],

  // ========== ENVIRONMENTS ==========
  environments: [EnvironmentConfigSchema],

  // ========== ESTRUCTURA DE DIRECTORIOS ==========
  directory_structure: {
    frontend: { type: mongoose.Schema.Types.Mixed },
    backend: { type: mongoose.Schema.Types.Mixed },
    shared: { type: mongoose.Schema.Types.Mixed }
  },

  // ========== CODING STANDARDS ==========
  coding_standards: {
    style_guide: { type: String },        // Airbnb, Google, Standard
    linter: { type: String },             // ESLint, Prettier
    commit_convention: { type: String },  // Conventional Commits
    branch_strategy: { type: String },    // GitFlow, GitHub Flow, Trunk Based
    code_review_required: { type: Boolean, default: true },
    test_coverage_target: { type: Number }, // Porcentaje objetivo
    documentation_required: { type: Boolean, default: true }
  },

  // ========== SEGURIDAD ==========
  security: {
    authentication_method: { type: String },
    authorization_model: { type: String }, // RBAC, ABAC, ACL
    encryption_at_rest: { type: Boolean, default: false },
    encryption_in_transit: { type: Boolean, default: true },
    security_headers: { type: Boolean, default: true },
    audit_logging: { type: Boolean, default: false },
    compliance: [{ type: String }],       // GDPR, HIPAA, SOC2
    notes: { type: String }
  },

  // ========== PERFORMANCE REQUIREMENTS ==========
  performance: {
    target_response_time_ms: { type: Number },
    target_uptime_percentage: { type: Number, default: 99.9 },
    caching_strategy: { type: String },
    cdn_required: { type: Boolean, default: false },
    optimization_notes: { type: String }
  },

  // ========== METADATA ==========
  version: { type: String, default: '1.0.0' },
  status: {
    type: String,
    enum: ['draft', 'review', 'approved', 'active', 'archived'],
    default: 'draft'
  },
  completeness_score: { type: Number, default: 0 },  // 0-100
  
  last_analyzed: { type: Date },
  analyzed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  ai_generated: { type: Boolean, default: false },
  ai_confidence: { type: Number },        // 0-100
  ai_suggestions: [{ type: String }],     // Sugerencias pendientes del AI
  
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  tags: [{ type: String }],
  notes: { type: String }
  
}, {
  timestamps: true
});

// ============================================
// ÍNDICES
// ============================================
// Nota: El índice unique en 'product' ya se crea automáticamente por unique: true

ProjectArchitectureSchema.index({ 'modules.name': 'text', 'modules.description': 'text' });
ProjectArchitectureSchema.index({ project_type: 1 });
ProjectArchitectureSchema.index({ status: 1 });
ProjectArchitectureSchema.index({ created_by: 1 });

// ============================================
// VIRTUALS
// ============================================

// Estadísticas de módulos
ProjectArchitectureSchema.virtual('module_stats').get(function() {
  const modules = this.modules || [];
  return {
    total: modules.length,
    by_status: {
      planned: modules.filter(m => m.status === 'planned').length,
      in_development: modules.filter(m => m.status === 'in_development').length,
      completed: modules.filter(m => m.status === 'completed').length,
      deprecated: modules.filter(m => m.status === 'deprecated').length
    },
    by_type: {
      frontend: modules.filter(m => m.type === 'frontend').length,
      backend: modules.filter(m => m.type === 'backend').length,
      shared: modules.filter(m => m.type === 'shared').length,
      infrastructure: modules.filter(m => m.type === 'infrastructure').length
    },
    total_estimated_hours: modules.reduce((sum, m) => sum + (m.estimated_hours || 0), 0)
  };
});

// Resumen del stack
ProjectArchitectureSchema.virtual('stack_summary').get(function() {
  const stack = this.tech_stack || {};
  return {
    frontend: stack.frontend?.framework ? 
      `${stack.frontend.framework}${stack.frontend.language ? ' + ' + stack.frontend.language : ''}` : 
      'No definido',
    backend: stack.backend?.framework ? 
      `${stack.backend.framework}${stack.backend.language ? ' + ' + stack.backend.language : ''}` : 
      'No definido',
    database: stack.database?.primary || 'No definido',
    hosting: stack.infrastructure?.hosting_frontend || stack.infrastructure?.hosting_backend || 'No definido'
  };
});

// ============================================
// METHODS
// ============================================

// Calcular puntuación de completitud
ProjectArchitectureSchema.methods.calculateCompleteness = function() {
  let score = 0;
  const weights = {
    project_type: 5,
    tech_stack_frontend: 15,
    tech_stack_backend: 15,
    tech_stack_database: 10,
    modules: 25,  // Aumentado ya que database_schema se movió
    api_endpoints: 15, // Aumentado
    integrations: 5,
    roadmap: 5,
    security: 5
  };
  
  if (this.project_type) score += weights.project_type;
  if (this.tech_stack?.frontend?.framework) score += weights.tech_stack_frontend;
  if (this.tech_stack?.backend?.framework) score += weights.tech_stack_backend;
  if (this.tech_stack?.database?.primary) score += weights.tech_stack_database;
  if (this.modules?.length > 0) score += weights.modules;
  if (this.api_endpoints?.length > 0) score += weights.api_endpoints;
  if (this.integrations?.length > 0) score += weights.integrations;
  if (this.technical_roadmap?.length > 0) score += weights.roadmap;
  if (this.security?.authentication_method) score += weights.security;
  
  this.completeness_score = score;
  return score;
};

// Obtener módulos por estado
ProjectArchitectureSchema.methods.getModulesByStatus = function(status) {
  return this.modules.filter(m => m.status === status);
};

// Agregar módulo
ProjectArchitectureSchema.methods.addModule = function(moduleData) {
  this.modules.push(moduleData);
  this.calculateCompleteness();
  return this.modules[this.modules.length - 1];
};

// Generar resumen para AI
ProjectArchitectureSchema.methods.generateAISummary = function() {
  const stats = this.module_stats;
  const stack = this.stack_summary;
  
  return {
    project_name: this.project_name || 'Sin nombre',
    project_type: this.project_type,
    scale: this.scale,
    stack: stack,
    modules: {
      total: stats.total,
      completed: stats.by_status.completed,
      in_progress: stats.by_status.in_development,
      planned: stats.by_status.planned
    },
    endpoints_count: this.api_endpoints?.length || 0,
    integrations_count: this.integrations?.length || 0,
    completeness: this.completeness_score,
    has_roadmap: this.technical_roadmap?.length > 0,
    current_phase: this.technical_roadmap?.find(p => p.status === 'in_progress')?.phase || null
  };
};

// ============================================
// STATICS
// ============================================

// Buscar por producto
ProjectArchitectureSchema.statics.findByProduct = function(productId) {
  return this.findOne({ product: productId });
};

// Crear arquitectura inicial
ProjectArchitectureSchema.statics.createInitial = async function(productId, userId, initialData = {}) {
  const architecture = new this({
    product: productId,
    created_by: userId,
    ...initialData
  });
  
  architecture.calculateCompleteness();
  return await architecture.save();
};

// ============================================
// HOOKS
// ============================================

// Antes de guardar, calcular completitud
ProjectArchitectureSchema.pre('save', function(next) {
  this.calculateCompleteness();
  next();
});

// ============================================
// EXPORT
// ============================================

module.exports = mongoose.models.ProjectArchitecture || 
  mongoose.model('ProjectArchitecture', ProjectArchitectureSchema);
