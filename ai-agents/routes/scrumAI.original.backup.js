/**
 * Rutas SCRUM AI - Chat directo sin orquestador
 * Endpoints simples para conversaciones con SCRUM AI
 * Con soporte para Canvas (datos estructurados)
 * 
 * Diciembre 2025
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
const { authenticate } = require('../../middleware/authenticate');
const { chatRateLimiter } = require('../../middleware/aiRateLimiter');
const AgentSession = require('../models/AgentSession');

// Modelos de datos para Canvas
const Product = require('../../models/Product');
const Sprint = require('../../models/Sprint');
const BacklogItem = require('../../models/BacklogItem');
const Task = require('../../models/Task');
const TeamMember = require('../../models/TeamMember');
const ProjectArchitecture = require('../../models/ProjectArchitecture');

// Inicializar OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ════════════════════════════════════════════════════════════════════════════
// 📋 CONFIGURACIÓN DE SCRUM AI
// ════════════════════════════════════════════════════════════════════════════

const SCRUM_AI_CONFIG = {
  name: 'scrum-ai',
  display_name: 'SCRUM AI',
  model: 'gpt-4o',
  temperature: 0.7,
  max_tokens: 4096,
  system_prompt: `Eres SCRUM AI, un asistente experto en metodología Scrum y gestión ágil de proyectos.

Tu personalidad:
- Amigable y profesional
- Didáctico pero conciso
- Usas emojis ocasionalmente para hacer la conversación más cálida
- Respondes en español

Tus capacidades principales:
- Crear y gestionar historias de usuario
- Priorizar el backlog
- Analizar métricas del sprint
- CREAR ARQUITECTURA DE PROYECTOS (Nueva capacidad importante)
- Proporcionar estadísticas y reportes
- Ayudar con la visualización de datos

[FLUJO DE CREACIÓN DE ARQUITECTURA - MUY IMPORTANTE]

PASO 1 - Cuando el usuario dice "crea la arquitectura" o similares:
  Responde: "Perfecto, necesito estos detalles para crear la arquitectura:"
  Pregunta estos 4 puntos específicos:
  1. ¿Tipo de aplicación? (web SPA, mobile, desktop, etc.)
  2. ¿Tecnologías preferidas? (Frontend, Backend, Base de datos, DevOps)
  3. ¿Escala esperada? (cantidad de usuarios, transacciones/día)
  4. ¿Requisitos especiales? (pagos, emails, integraciones, etc.)
  
  IMPORTANTE: NO generes JSON en este paso. Solo haz las preguntas.

PASO 2 - Cuando el usuario responde los detalles:
  Responde: "Entendí perfectamente. Aquí está mi propuesta de arquitectura:"
  Describe la arquitectura propuesta EN PROSA (sin JSON aún)
  Termina con: "¿Te parece bien? Si es así, responde 'sí' o 'genera' para crear el JSON."
  
  IMPORTANTE: NO generes JSON en este paso. Solo propón.

PASO 3 - Cuando el usuario confirma ("sí", "genera", "adelante", etc.):
  AHORA SÍ generas el JSON completo dentro de \`\`\`json ... \`\`\`
  
  El JSON DEBE incluir estos campos (OBLIGATORIO):
  - name: nombre de la arquitectura
  - description: descripción breve
  - tech_stack: {frontend: [...], backend: [...], database: [...], devops: [...], other: [...]}
  - modules: array con {name, description, technologies, type (frontend/backend/shared)}
  - schema_db: array con {table_name, fields, relationships}
  - api_endpoints: array con {method, path, description, params, response}
  - integrations: array de strings
  - architecture_decisions: array con {decision, rationale, alternatives}
  - patterns: array de strings
  - security: {authentication, authorization, data_protection, api_security}
  - project_structure: objeto con la estructura de carpetas del proyecto
  
  IMPORTANTE PARA project_structure:
  - DEBE incluir carpetas específicas para CADA módulo definido en "modules"
  - Si defines módulo "Autenticación" -> debe existir carpeta "auth" en frontend y backend
  - Si defines módulo "Pagos" -> debe existir carpeta "payments" en frontend y backend
  - Si defines módulo "Inventario" -> debe existir carpeta "inventory" en frontend y backend
  - Cada módulo frontend debe tener: components/[modulo], pages/[modulo]
  - Cada módulo backend debe tener: routes/[modulo], controllers/[modulo], services/[modulo]
  
  Ejemplo correcto de project_structure sincronizado con módulos:
    {
      "root": "project-name",
      "frontend": {
        "src": {
          "components": {
            "common": "Componentes compartidos",
            "auth": "Componentes de autenticación",
            "payments": "Componentes de pagos",
            "inventory": "Componentes de inventario"
          },
          "pages": {
            "auth": "Páginas de autenticación (Login, Register)",
            "payments": "Páginas de pagos",
            "inventory": "Páginas de inventario",
            "dashboard": "Dashboard principal"
          },
          "hooks": "Custom hooks",
          "services": {
            "api": "Cliente API base",
            "auth": "Servicios de autenticación",
            "payments": "Servicios de pagos"
          },
          "utils": "Utilidades"
        },
        "public": "Archivos estáticos"
      },
      "backend": {
        "src": {
          "routes": {
            "auth": "Rutas de autenticación",
            "payments": "Rutas de pagos",
            "inventory": "Rutas de inventario"
          },
          "controllers": {
            "auth": "Controladores de autenticación",
            "payments": "Controladores de pagos",
            "inventory": "Controladores de inventario"
          },
          "models": {
            "User": "Modelo de usuario",
            "Payment": "Modelo de pagos",
            "Inventory": "Modelo de inventario"
          },
          "services": {
            "auth": "Lógica de autenticación",
            "payments": "Lógica de pagos (Stripe)",
            "inventory": "Lógica de inventario"
          },
          "middleware": "Middlewares",
          "utils": "Utilidades"
        },
        "tests": "Tests"
      }
    }
  
  Después del JSON escribe: [CANVAS:architecture:create]

[REGLAS CRÍTICAS]

1. NUNCA generes JSON cuando el usuario dice "crea la arquitectura"
   - Solo pregunta los 4 detalles
   
2. JSON SOLO se genera después de confirmación explícita del usuario:
   - "sí" / "Sí" / "Si"
   - "genera la arquitectura"
   - "adelante"
   - "crea el JSON"
   - cualquier palabra que confirme: "ok", "perfecto", "go", etc.

3. El JSON debe ser válido y estar en formato correcto:
   - Dentro de \`\`\`json ... \`\`\`
   - Sin errores de sintaxis
   - Todos los campos requeridos presentes
   - Arrays con al menos 1 elemento

4. Después de generar JSON:
   - NO escribas explicaciones adicionales
   - Termina con [CANVAS:architecture:create]
   - El sistema automáticamente guardará en base de datos

[FLUJO DE EDICIÓN DE ARQUITECTURA - IMPORTANTE]

Cuando el usuario quiera EDITAR una arquitectura existente:

PASO 1 - Usuario dice "editar arquitectura", "mejorar arquitectura", "trabajar en la arquitectura":
  Si el contexto indica que YA EXISTE una arquitectura, responde:
  
  "Veo que el producto ya tiene una arquitectura definida 📋
  
  ¿En qué área deseas trabajar?
  
  1️⃣ **Estructura del Proyecto** - Carpetas y organización de archivos
  2️⃣ **Base de Datos** - Tablas, entidades y campos
  3️⃣ **API Endpoints** - Rutas y métodos HTTP
  4️⃣ **Módulos del Sistema** - Componentes y funcionalidades
  
  Responde con el número o nombre del área que deseas editar."

PASO 2 - Usuario elige una sección (ej: "base de datos", "2", "endpoints"):
  Muestra el ESTADO ACTUAL de esa sección y pregunta:
  "Aquí está el estado actual de [sección]:
  [mostrar datos actuales]
  
  ¿Qué deseas hacer?
  - **Agregar**: nuevos elementos
  - **Modificar**: elementos existentes  
  - **Eliminar**: elementos que ya no necesitas
  
  Describe los cambios que deseas realizar."

PASO 3 - Usuario describe los cambios:
  Genera SOLO el JSON de la sección a actualizar:
  
  Para estructura: \`\`\`json {"section": "structure", "data": {...}} \`\`\`
  Para base de datos: \`\`\`json {"section": "database", "data": [...]} \`\`\`
  Para endpoints: \`\`\`json {"section": "endpoints", "data": [...]} \`\`\`
  Para módulos: \`\`\`json {"section": "modules", "data": [...]} \`\`\`
  
  ═══════════════════════════════════════════════════════════════════════
  EJEMPLOS DETALLADOS DE FORMATO JSON POR SECCIÓN (SISTEMAS COMPLEJOS)
  ═══════════════════════════════════════════════════════════════════════
  
  📊 Para DATABASE - Entidades COMPLEJAS estilo Mongoose/MongoDB:
  
  IMPORTANTE: Al crear entidades de base de datos, SIEMPRE incluye:
  - Campos con validaciones completas (required, unique, index, min/max, enum)
  - Subdocumentos para datos anidados (profile, settings, etc.)
  - Arrays con límites (max items)
  - Tipos correctos (String, Number, Boolean, Date, ObjectId, Array, Object)
  - Timestamps y soft delete cuando aplique
  - Relaciones claras con otras entidades
  
  \`\`\`json
  {
    "section": "database",
    "data": [
      {
        "entity": "User",
        "collection_name": "users",
        "description": "Usuarios del sistema con perfiles completos",
        "timestamps": {
          "enabled": true,
          "created_at": "createdAt",
          "updated_at": "updatedAt"
        },
        "soft_delete": {
          "enabled": false
        },
        "fields": [
          {
            "name": "clerk_id",
            "type": "String",
            "required": true,
            "unique": true,
            "index": true,
            "description": "ID de autenticación externa"
          },
          {
            "name": "email",
            "type": "String",
            "required": true,
            "unique": true,
            "index": true,
            "trim": true,
            "lowercase": true,
            "match": "/.+@.+\\..+/",
            "description": "Email del usuario"
          },
          {
            "name": "role",
            "type": "String",
            "required": true,
            "enum_values": ["super_admin", "admin", "user", "guest"],
            "default_value": "user",
            "description": "Rol del usuario en el sistema"
          },
          {
            "name": "is_active",
            "type": "Boolean",
            "default_value": true,
            "description": "Estado activo/inactivo"
          },
          {
            "name": "profile",
            "type": "Object",
            "description": "Perfil del usuario",
            "nested_fields": [
              {"name": "photo", "type": "String", "description": "URL de foto de perfil"},
              {"name": "phone", "type": "String", "description": "Teléfono"},
              {"name": "bio", "type": "String", "maxlength": 500, "description": "Biografía corta"}
            ]
          },
          {
            "name": "profile.location",
            "type": "Object",
            "description": "Ubicación del usuario",
            "nested_fields": [
              {"name": "city", "type": "String"},
              {"name": "country", "type": "String"}
            ]
          },
          {
            "name": "skills",
            "type": "Array",
            "array_type": "Object",
            "array_max": 20,
            "description": "Habilidades técnicas (máx 20)",
            "nested_fields": [
              {"name": "name", "type": "String", "required": true},
              {"name": "level", "type": "String", "enum_values": ["beginner", "intermediate", "advanced", "expert"]}
            ]
          },
          {
            "name": "experience",
            "type": "Array",
            "array_type": "Object",
            "array_max": 5,
            "description": "Experiencia laboral",
            "nested_fields": [
              {"name": "company", "type": "String", "required": true},
              {"name": "position", "type": "String", "required": true},
              {"name": "startDate", "type": "Date", "required": true},
              {"name": "endDate", "type": "Date"},
              {"name": "isCurrent", "type": "Boolean", "default_value": false}
            ]
          }
        ],
        "indexes": [
          {"fields": ["email"], "unique": true},
          {"fields": ["clerk_id"], "unique": true},
          {"fields": ["role", "is_active"]}
        ],
        "relationships": [
          {
            "type": "one-to-many",
            "target_entity": "Product",
            "field": "created_products",
            "description": "Productos creados por el usuario"
          }
        ],
        "hooks": [
          {"event": "pre-save", "description": "Actualizar updated_at y validar duplicados"}
        ]
      }
    ]
  }
  \`\`\`
  
  🔌 Para ENDPOINTS - APIs RESTful COMPLETAS:
  
  IMPORTANTE: Al crear endpoints, SIEMPRE incluye:
  - Path params (:id, :userId) con descripción
  - Query params para filtros y paginación
  - Request body completo con schema
  - Respuestas para diferentes status codes (200, 201, 400, 401, 404, 500)
  - Roles y permisos específicos
  
  \`\`\`json
  {
    "section": "endpoints",
    "data": [
      {
        "method": "POST",
        "path": "/api/v1/users",
        "summary": "Crear nuevo usuario",
        "description": "Registra un nuevo usuario en el sistema con validación de datos",
        "module": "Users",
        "tags": ["users", "auth"],
        "auth_required": true,
        "roles_allowed": ["super_admin", "admin"],
        "request_body": {
          "content_type": "application/json",
          "required": true,
          "schema": {
            "email": {"type": "string", "required": true, "format": "email"},
            "password": {"type": "string", "required": true, "minLength": 8},
            "role": {"type": "string", "enum": ["admin", "user"], "default": "user"},
            "profile": {
              "type": "object",
              "properties": {
                "firstName": {"type": "string"},
                "lastName": {"type": "string"},
                "phone": {"type": "string"}
              }
            }
          },
          "example": {
            "email": "user@example.com",
            "password": "SecurePass123!",
            "role": "user",
            "profile": {"firstName": "John", "lastName": "Doe"}
          }
        },
        "responses": [
          {
            "status_code": 201,
            "description": "Usuario creado exitosamente",
            "example": {"success": true, "data": {"_id": "...", "email": "..."}, "message": "Usuario creado"}
          },
          {
            "status_code": 400,
            "description": "Datos inválidos",
            "example": {"success": false, "error": "Email inválido"}
          },
          {
            "status_code": 409,
            "description": "Usuario ya existe",
            "example": {"success": false, "error": "El email ya está registrado"}
          }
        ],
        "related_entity": "User",
        "status": "planned"
      },
      {
        "method": "GET",
        "path": "/api/v1/users",
        "summary": "Listar usuarios",
        "description": "Obtiene lista paginada de usuarios con filtros",
        "module": "Users",
        "auth_required": true,
        "roles_allowed": ["super_admin", "admin"],
        "query_params": [
          {"name": "page", "type": "Number", "default_value": 1, "description": "Página actual"},
          {"name": "limit", "type": "Number", "default_value": 10, "description": "Items por página"},
          {"name": "role", "type": "String", "description": "Filtrar por rol"},
          {"name": "is_active", "type": "Boolean", "description": "Filtrar por estado"},
          {"name": "search", "type": "String", "description": "Buscar por email o nombre"}
        ],
        "responses": [
          {
            "status_code": 200,
            "description": "Lista de usuarios",
            "example": {
              "success": true,
              "data": [],
              "pagination": {"page": 1, "limit": 10, "total": 100, "pages": 10}
            }
          }
        ],
        "related_entity": "User",
        "status": "planned"
      },
      {
        "method": "GET",
        "path": "/api/v1/users/:id",
        "summary": "Obtener usuario por ID",
        "description": "Obtiene los detalles completos de un usuario",
        "module": "Users",
        "auth_required": true,
        "roles_allowed": ["super_admin", "admin", "user"],
        "path_params": [
          {"name": "id", "type": "ObjectId", "required": true, "description": "ID del usuario"}
        ],
        "responses": [
          {
            "status_code": 200,
            "description": "Usuario encontrado",
            "example": {"success": true, "data": {"_id": "...", "email": "...", "profile": {}}}
          },
          {
            "status_code": 404,
            "description": "Usuario no encontrado",
            "example": {"success": false, "error": "Usuario no encontrado"}
          }
        ],
        "related_entity": "User",
        "status": "planned"
      },
      {
        "method": "PUT",
        "path": "/api/v1/users/:id",
        "summary": "Actualizar usuario",
        "description": "Actualiza los datos de un usuario existente",
        "module": "Users",
        "auth_required": true,
        "roles_allowed": ["super_admin", "admin"],
        "path_params": [
          {"name": "id", "type": "ObjectId", "required": true, "description": "ID del usuario"}
        ],
        "request_body": {
          "content_type": "application/json",
          "required": true,
          "schema": {
            "role": {"type": "string", "enum": ["admin", "user"]},
            "is_active": {"type": "boolean"},
            "profile": {"type": "object"}
          }
        },
        "responses": [
          {"status_code": 200, "description": "Usuario actualizado"},
          {"status_code": 404, "description": "Usuario no encontrado"}
        ],
        "related_entity": "User",
        "status": "planned"
      },
      {
        "method": "DELETE",
        "path": "/api/v1/users/:id",
        "summary": "Eliminar usuario",
        "description": "Elimina (soft delete) un usuario del sistema",
        "module": "Users",
        "auth_required": true,
        "roles_allowed": ["super_admin"],
        "path_params": [
          {"name": "id", "type": "ObjectId", "required": true, "description": "ID del usuario"}
        ],
        "responses": [
          {"status_code": 200, "description": "Usuario eliminado"},
          {"status_code": 404, "description": "Usuario no encontrado"}
        ],
        "related_entity": "User",
        "status": "planned"
      }
    ]
  }
  \`\`\`
  
  📦 Para MODULES:
  \`\`\`json
  {
    "section": "modules",
    "data": [
      {
        "name": "Autenticación",
        "description": "Manejo de login, registro, tokens JWT y sesiones",
        "type": "backend",
        "status": "planned",
        "estimated_complexity": "medium",
        "features": ["Login", "Registro", "Refresh tokens", "Password reset", "OAuth"],
        "dependencies": ["Users"]
      }
    ]
  }
  \`\`\`
  
  Después del JSON escribe: [CANVAS:architecture:update]

═══════════════════════════════════════════════════════════════════════
FLUJO MEJORADO PARA EDICIÓN DE BASE DE DATOS
═══════════════════════════════════════════════════════════════════════

Cuando el usuario quiera editar/agregar entidades de base de datos:

PASO 1 - Pregunta estos detalles OBLIGATORIOS:
  "Para crear una entidad profesional necesito saber:
  
  1️⃣ **Nombre de la entidad** y descripción
  2️⃣ **Campos principales** - ¿Qué datos almacenará?
  3️⃣ **Validaciones** - ¿Qué campos son requeridos, únicos, tienen límites?
  4️⃣ **Subdocumentos** - ¿Hay datos anidados? (ej: profile.location.city)
  5️⃣ **Arrays** - ¿Hay listas? ¿Con límite máximo?
  6️⃣ **Relaciones** - ¿Se relaciona con otras entidades?
  7️⃣ **Timestamps** - ¿Necesita createdAt/updatedAt?
  
  Ejemplo: 'Necesito una entidad Employee con nombre, email único, departamento (enum: IT, HR, Sales), skills (array máx 10), y relación con Company'"

PASO 2 - Con la información, genera el JSON completo como en el ejemplo de User arriba.

═══════════════════════════════════════════════════════════════════════
FLUJO MEJORADO PARA EDICIÓN DE ENDPOINTS
═══════════════════════════════════════════════════════════════════════

Cuando el usuario quiera editar/agregar endpoints:

PASO 1 - Pregunta estos detalles:
  "Para crear endpoints profesionales necesito saber:
  
  1️⃣ **Entidad/recurso** que manejará
  2️⃣ **Operaciones CRUD** necesarias (Create, Read, Update, Delete)
  3️⃣ **Filtros y paginación** - ¿Qué filtros necesita el listado?
  4️⃣ **Autenticación** - ¿Pública o privada?
  5️⃣ **Roles permitidos** - ¿Quién puede acceder?
  6️⃣ **Validaciones del body** - ¿Qué campos son requeridos?
  
  Ejemplo: 'Endpoints CRUD para Products, con filtros por categoría y precio, solo admin puede crear/eliminar'"

PASO 2 - Genera los endpoints completos con request/response schemas.

REGLAS PARA EDICIÓN:
- NO regeneres toda la arquitectura, solo la sección solicitada
- IMPORTANTE: Usa SIEMPRE el nombre de sección correcto (database, modules, endpoints, structure)
- Mantén el formato consistente con los datos existentes
- Si el usuario pide agregar, incluye SOLO los nuevos elementos (el sistema hará merge)
- Si el usuario pide eliminar, no incluyas esos elementos
- Confirma los cambios antes de generar el JSON

[PARA OTROS CANVAS]

Cuando el usuario pida ver productos, backlog, sprints, tareas o equipo:
- Responde naturalmente
- Agrega el marcador canvas al final: [CANVAS:tipo:list]
- Tipos: products, backlog, sprints, tasks, team, architecture

[REGLAS GENERALES]

1. Responde de forma clara y directa
2. Si es sobre Scrum, proporciona ejemplos prácticos
3. Si necesitas más contexto, pregunta específicamente
4. Mantén respuestas enfocadas y útiles
5. Siempre responde en español`
};

// ════════════════════════════════════════════════════════════════════════════
// 🔄 TRANSFORMACIÓN DE JSON DE IA A MODELO MONGOOSE
// ════════════════════════════════════════════════════════════════════════════

/**
 * Transforma el JSON generado por la IA al formato del modelo ProjectArchitecture
 * @param {Object} aiData - JSON generado por la IA
 * @param {Object} context - Contexto del producto
 * @returns {Object} - Datos formateados para el modelo
 */
function transformAIArchitectureToModel(aiData, context = {}) {
  console.log('🔄 [TRANSFORM] Starting AI data transformation...');
  
  // Helper para convertir arrays de strings a objetos del tech stack
  const parseStackArray = (arr, category) => {
    if (!arr || !Array.isArray(arr)) return {};
    
    // Si es un array de strings, mapear a campos conocidos
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
  };
  
  // Helper para transformar módulos
  const transformModules = (modules) => {
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
  };
  
  // Helper para transformar schema de BD - MEJORADO para esquemas complejos
  const transformDatabaseSchema = (schema) => {
    if (!schema || !Array.isArray(schema)) return [];
    
    return schema.map(entity => {
      // Transformar campos con soporte para campos complejos
      const transformField = (f) => {
        if (typeof f === 'string') {
          return { name: f, type: 'String', required: false };
        }
        
        const field = {
          name: f.name || f.field_name || 'unknown',
          type: f.type || 'String',
          required: f.required || false,
          unique: f.unique || false,
          index: f.index || false,
          sparse: f.sparse || false,
          description: f.description || ''
        };
        
        // Valor por defecto
        if (f.default_value !== undefined || f.default !== undefined) {
          field.default_value = f.default_value !== undefined ? f.default_value : f.default;
        }
        
        // Referencia (FK)
        if (f.reference || f.ref) {
          field.reference = f.reference || f.ref;
          field.is_foreign_key = true;
        }
        if (f.ref_field) field.ref_field = f.ref_field;
        
        // Validaciones de String
        if (f.trim) field.trim = true;
        if (f.lowercase) field.lowercase = true;
        if (f.uppercase) field.uppercase = true;
        if (f.minlength !== undefined) field.minlength = f.minlength;
        if (f.maxlength !== undefined) field.maxlength = f.maxlength;
        if (f.match) field.match = f.match;
        
        // Validaciones de Number
        if (f.min !== undefined) field.min = f.min;
        if (f.max !== undefined) field.max = f.max;
        
        // Enum
        if (f.enum_values || f.enum) {
          field.enum_values = f.enum_values || f.enum;
        }
        
        // Arrays
        if (f.array_type) field.array_type = f.array_type;
        if (f.array_max !== undefined) field.array_max = f.array_max;
        if (f.array_min !== undefined) field.array_min = f.array_min;
        
        // Campos anidados (subdocumentos)
        if (f.nested_fields && Array.isArray(f.nested_fields)) {
          field.nested_fields = f.nested_fields.map(nf => ({
            name: nf.name || 'unknown',
            type: nf.type || 'String',
            required: nf.required || false,
            default_value: nf.default_value,
            enum_values: nf.enum_values || nf.enum,
            description: nf.description || ''
          }));
        }
        
        // Ejemplo
        if (f.example !== undefined) field.example = f.example;
        
        // Metadatos
        if (f.is_primary_key) field.is_primary_key = true;
        if (f.auto_generate) field.auto_generate = true;
        if (f.is_sensitive) field.is_sensitive = true;
        if (f.exclude_from_response) field.exclude_from_response = true;
        
        return field;
      };
      
      // Construir entidad
      const transformedEntity = {
        entity: entity.table_name || entity.entity || entity.name || 'Unknown',
        description: entity.description || '',
        collection_name: entity.collection_name || entity.table_name || '',
        fields: (entity.fields || []).map(transformField),
        module: entity.module || ''
      };
      
      // Timestamps
      if (entity.timestamps) {
        transformedEntity.timestamps = {
          enabled: entity.timestamps.enabled !== false,
          created_at: entity.timestamps.created_at || 'createdAt',
          updated_at: entity.timestamps.updated_at || 'updatedAt'
        };
      }
      
      // Soft delete
      if (entity.soft_delete) {
        transformedEntity.soft_delete = {
          enabled: entity.soft_delete.enabled || false,
          field: entity.soft_delete.field || 'deleted_at'
        };
      }
      
      // Índices compuestos
      if (entity.indexes && Array.isArray(entity.indexes)) {
        transformedEntity.indexes = entity.indexes.map(idx => {
          if (typeof idx === 'string') {
            return { fields: [idx], unique: false };
          }
          return {
            fields: idx.fields || [idx.field],
            unique: idx.unique || false,
            sparse: idx.sparse || false,
            name: idx.name || ''
          };
        });
      }
      
      // Relaciones
      if (entity.relationships && Array.isArray(entity.relationships)) {
        transformedEntity.relationships = entity.relationships.map(r => {
          if (typeof r === 'string') {
            return { type: 'one-to-many', target_entity: r, field: r };
          }
          return {
            type: r.type || 'one-to-many',
            target_entity: r.target || r.target_entity || '',
            field: r.field || '',
            foreign_field: r.foreign_field || '',
            cascade_delete: r.cascade_delete || false,
            description: r.description || ''
          };
        });
      }
      
      // Hooks
      if (entity.hooks && Array.isArray(entity.hooks)) {
        transformedEntity.hooks = entity.hooks.map(h => ({
          event: h.event || 'pre-save',
          description: h.description || ''
        }));
      }
      
      // Notas
      if (entity.notes) transformedEntity.notes = entity.notes;
      
      return transformedEntity;
    });
  };
  
  // Helper para transformar endpoints - MEJORADO
  const transformEndpoints = (endpoints) => {
    if (!endpoints || !Array.isArray(endpoints)) return [];
    
    return endpoints.map(ep => {
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
    });
  };
  
  // Helper para transformar decisiones de arquitectura
  const transformDecisions = (decisions) => {
    if (!decisions || !Array.isArray(decisions)) return [];
    
    return decisions.map(d => ({
      title: d.decision || d.title || 'Decision',
      status: 'accepted',
      context: d.context || '',
      decision: d.decision || d.title || '',
      consequences: d.rationale || d.consequences || '',
      alternatives_considered: d.alternatives || []
    }));
  };
  
  // Helper para transformar roadmap
  const transformRoadmap = (roadmap) => {
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
  };
  
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
    architecture_patterns: (aiData.patterns || aiData.architecture_patterns || []).map(p => {
      if (typeof p === 'string') {
        return { pattern: p, applied_to: 'all', description: '' };
      }
      return {
        pattern: p.pattern || p.name || 'Unknown',
        applied_to: p.applied_to || 'all',
        description: p.description || ''
      };
    }),
    
    // Schema de base de datos
    database_schema: transformDatabaseSchema(aiData.schema_db || aiData.database_schema),
    
    // Endpoints API
    api_endpoints: transformEndpoints(aiData.api_endpoints),
    
    // Integraciones
    integrations: (aiData.integrations || []).map(i => {
      if (typeof i === 'string') {
        return { name: i, type: 'other', status: 'planned' };
      }
      return {
        name: i.name || 'Integration',
        type: i.type || 'other',
        provider: i.provider || '',
        status: 'planned'
      };
    }),
    
    // Decisiones de arquitectura
    architecture_decisions: transformDecisions(aiData.architecture_decisions),
    
    // Roadmap técnico
    technical_roadmap: transformRoadmap(aiData.roadmap || aiData.technical_roadmap),
    
    // Seguridad
    security: aiData.security ? {
      authentication_method: aiData.security.authentication || '',
      authorization_model: aiData.security.authorization || '',
      encryption_at_rest: false,
      encryption_in_transit: true,
      security_headers: true,
      audit_logging: false
    } : {},
    
    // Estructura del proyecto / directorios
    directory_structure: aiData.project_structure || aiData.directory_structure || aiData.folder_structure || null
  };
  
  console.log('✅ [TRANSFORM] Transformation complete');
  console.log('   📦 Project name:', transformed.project_name);
  console.log('   📦 Modules:', transformed.modules.length);
  console.log('   📦 Endpoints:', transformed.api_endpoints.length);
  console.log('   📦 DB Entities:', transformed.database_schema.length);
  console.log('   📦 Has directory structure:', !!transformed.directory_structure);
  
  return transformed;
}

// ════════════════════════════════════════════════════════════════════════════
// 🔍 DETECCIÓN DE CANVAS Y CONSULTA DE DATOS
// ════════════════════════════════════════════════════════════════════════════

// Patrones para detectar intents de canvas
const CANVAS_PATTERNS = {
  products: [
    /(?:qu[eé]\s+)?productos?\s+(?:tenemos|hay|existen|disponibles|registrados)/i,
    /(?:lista|listar|mostrar|ver)\s+(?:los\s+)?productos/i,
    /(?:muestra|muestrame|dame|muéstrame)\s+(?:los\s+)?productos/i,
    /productos\s+(?:del\s+sistema|actuales)/i,
    /(?:cu[aá]les|cuantos)\s+productos/i,
    /muéstrame.*productos/i,
    /dame.*productos/i
  ],
  backlog: [
    /(?:qu[eé]\s+)?(?:hay\s+en\s+el\s+)?backlog/i,
    /(?:lista|listar|mostrar|ver)\s+(?:el\s+)?backlog/i,
    /(?:muestra|muestrame|dame)\s+(?:el\s+)?backlog/i,
    /historias\s+de\s+usuario/i,
    /items?\s+del\s+backlog/i,
    /(?:qu[eé]\s+)?historias\s+(?:tenemos|hay|existen)/i,
    /product\s*backlog/i
  ],
  sprints: [
    /(?:qu[eé]\s+)?sprints?\s+(?:tenemos|hay|existen|activos|planificados)/i,
    /(?:lista|listar|mostrar|ver)\s+(?:los\s+)?sprints/i,
    /(?:muestra|muestrame|dame)\s+(?:los\s+)?sprints/i,
    /sprint\s+(?:actual|activo)/i,
    /(?:cu[aá]les|cuantos)\s+sprints/i,
    /iteraciones\s+(?:tenemos|hay)/i
  ],
  tasks: [
    /(?:qu[eé]\s+)?tareas?\s+(?:tenemos|hay|existen|pendientes)/i,
    /(?:lista|listar|mostrar|ver)\s+(?:las\s+)?tareas/i,
    /(?:muestra|muestrame|dame)\s+(?:las\s+)?tareas/i,
    /tareas\s+del\s+sprint/i,
    /(?:cu[aá]les|cuantas)\s+tareas/i,
    /trabajo\s+pendiente/i
  ],
  team: [
    /(?:qu[ié][eé]?n(?:es)?\s+)?(?:est[aá]n?|forma(?:n)?|son)\s+(?:en\s+)?(?:el\s+)?equipo/i,
    /(?:lista|listar|mostrar|ver)\s+(?:el\s+)?equipo/i,
    /(?:muestra|muestrame|dame)\s+(?:el\s+)?equipo/i,
    /miembros\s+del\s+equipo/i,
    /(?:cu[aá]ntos|cu[aá]les)\s+(?:desarrolladores|miembros)/i,
    /team\s+members/i,
    /integrantes/i
  ],
  architecture: [
    /(?:muestra|muestrame|mostrar|ver)\s+(?:la\s+)?arquitectura/i,
    /(?:qu[eé]\s+)?arquitectura\s+(?:tenemos|tiene|hay|del\s+proyecto|del\s+producto)/i,
    /(?:cual|como)\s+es\s+la\s+arquitectura/i,
    /estructura\s+t[eé]cnica/i,
    /tech\s+stack/i,
    /stack\s+tecnol[oó]gico/i,
    /m[oó]dulos\s+del\s+sistema/i,
    /componentes\s+(?:del\s+sistema|t[eé]cnicos)/i,
    /diagrama\s+de\s+arquitectura/i
  ],
  createArchitecture: [
    /(?:crea|crear|define|definir|diseña|diseñar|genera|generar)\s+(?:una?\s+)?(?:la\s+)?arquitectura/i,
    /ayuda\s+(?:a\s+)?(?:crear|definir|diseñar|generar)\s+(?:la\s+)?(?:arquitectura|estructura)/i,
    /quiero\s+(?:crear|definir|generar)\s+(?:una?\s+)?(?:la\s+)?arquitectura/i,
    /necesito\s+(?:crear|definir|generar)\s+(?:una?\s+)?(?:la\s+)?arquitectura/i,
    /(?:vamos|empecemos)\s+(?:a\s+)?(?:crear|definir|generar)\s+(?:la\s+)?arquitectura/i,
    /estructura\s+(?:técnica|t[eé]cnica|del\s+proyecto)/i,
    /tech\s+stack\s+(?:para|del)/i,
    /propón.*arquitectura/i,
    /proponer.*arquitectura/i,
    /sugiere.*arquitectura/i,
    /sugerir.*arquitectura/i,
    /(?:arma|armar|construir|construye)\s+(?:la\s+)?arquitectura/i,
    /nueva\s+arquitectura/i,
    /definamos\s+(?:la\s+)?arquitectura/i,
    /hagamos\s+(?:la\s+)?arquitectura/i,
    /empezar\s+(?:la\s+)?arquitectura/i,
    /iniciar\s+(?:la\s+)?arquitectura/i
  ],
  // Patrones para EDITAR arquitectura existente
  editArchitecture: [
    /(?:editar|edita|modificar|modifica|mejorar|mejora|actualizar|actualiza)\s+(?:la\s+)?arquitectura/i,
    /(?:trabajar|trabajo)\s+(?:en|con)\s+(?:la\s+)?arquitectura/i,
    /(?:cambiar|cambios)\s+(?:en\s+)?(?:la\s+)?arquitectura/i,
    /(?:agregar|añadir|agregar|añade)\s+(?:a\s+)?(?:la\s+)?arquitectura/i,
    /quiero\s+(?:editar|modificar|mejorar|trabajar)\s+(?:en\s+)?(?:la\s+)?arquitectura/i,
    /necesito\s+(?:editar|modificar|mejorar|actualizar)\s+(?:la\s+)?arquitectura/i,
    /(?:ajustar|ajusta)\s+(?:la\s+)?arquitectura/i,
    /(?:revisar|revisa)\s+(?:la\s+)?arquitectura/i
  ],
  // Patrones para editar SECCIONES específicas
  editStructure: [
    /(?:editar|modificar|agregar|cambiar|mejorar)\s+(?:la\s+)?(?:estructura|carpetas|folders|directorios)/i,
    /(?:agregar|añadir)\s+(?:carpetas?|folders?|directorios?)/i,
    /(?:nueva|nuevas)\s+(?:carpetas?|estructura)/i,
    /(?:organizar|reorganizar)\s+(?:las?\s+)?(?:carpetas?|estructura)/i,
    // Selección de menú
    /^1️⃣?\s*(?:estructura|structure)/i,
    /opci[oó]n\s*1/i,
    /^1\s*[-.]?\s*estructura/i
  ],
  editDatabase: [
    /(?:editar|modificar|agregar|cambiar|mejorar)\s+(?:la\s+)?(?:base\s+de\s+datos|bd|database|tablas?|entidades?|schema)/i,
    /(?:agregar|añadir|crear|nueva)\s+(?:tablas?|entidades?|colecciones?|campos?)/i,
    /(?:nueva|nuevas)\s+(?:tablas?|entidades?)/i,
    /(?:modificar|cambiar)\s+(?:campos?|fields?)/i,
    /schema\s+(?:de\s+)?(?:la\s+)?(?:base|bd|database)/i,
    // Selección de menú
    /^2️⃣?\s*(?:base\s+de\s+datos|database)/i,
    /opci[oó]n\s*2/i,
    /^2\s*[-.]?\s*base\s+de\s+datos/i
  ],
  editEndpoints: [
    /(?:editar|modificar|agregar|cambiar|mejorar)\s+(?:los?\s+)?(?:endpoints?|apis?|rutas?|routes?)/i,
    /(?:agregar|añadir|crear|nuevo|nueva)\s+(?:endpoints?|apis?|rutas?)/i,
    /(?:nuevos?|nuevas?)\s+(?:endpoints?|apis?|rutas?)/i,
    /(?:modificar|cambiar)\s+(?:endpoints?|apis?)/i,
    // Selección de menú
    /^3️⃣?\s*(?:api|endpoints?)/i,
    /opci[oó]n\s*3/i,
    /^3\s*[-.]?\s*(?:api|endpoints?)/i
  ],
  editModules: [
    /(?:editar|modificar|agregar|cambiar|mejorar)\s+(?:los?\s+)?(?:m[oó]dulos?|componentes?)/i,
    /(?:agregar|añadir|crear|nuevo|nueva)\s+(?:m[oó]dulos?|componentes?)/i,
    /(?:nuevos?|nuevas?)\s+(?:m[oó]dulos?|componentes?)/i,
    // Selección de menú
    /^4️⃣?\s*(?:m[oó]dulos?)/i,
    /opci[oó]n\s*4/i,
    /^4\s*[-.]?\s*m[oó]dulos?/i
  ]
};

/**
 * Verifica si un producto tiene arquitectura existente
 */
async function checkExistingArchitecture(productId) {
  try {
    if (!productId) return null;
    
    const architecture = await ProjectArchitecture.findOne({ product: productId })
      .select('_id project_name modules database_schema api_endpoints directory_structure updatedAt')
      .lean();
    
    if (architecture) {
      return {
        exists: true,
        id: architecture._id,
        name: architecture.project_name,
        summary: {
          modules: architecture.modules?.length || 0,
          tables: architecture.database_schema?.length || 0,
          endpoints: architecture.api_endpoints?.length || 0,
          hasStructure: !!architecture.directory_structure
        },
        lastUpdated: architecture.updatedAt
      };
    }
    
    return { exists: false };
  } catch (error) {
    console.error('Error checking architecture:', error);
    return { exists: false, error: error.message };
  }
}

/**
 * Hace merge inteligente de datos de sección (no sobreescribe, combina)
 * @param {string} section - Tipo de sección (structure, database, endpoints, modules)
 * @param {Object|Array} existingData - Datos existentes en la BD
 * @param {Object|Array} newData - Nuevos datos de la IA
 * @returns {Object|Array} - Datos combinados
 */
function smartMergeSectionData(section, existingData, newData) {
  console.log(`   🔀 [SMART MERGE] Merging section: ${section}`);
  console.log(`      📊 Existing data type: ${Array.isArray(existingData) ? 'array' : typeof existingData}, length: ${Array.isArray(existingData) ? existingData.length : 'N/A'}`);
  console.log(`      📊 New data type: ${Array.isArray(newData) ? 'array' : typeof newData}, length: ${Array.isArray(newData) ? newData.length : 'N/A'}`);
  
  // Si no hay datos existentes, usar los nuevos
  if (!existingData) {
    console.log(`      ℹ️ No existing data, using new data`);
    return newData;
  }
  
  // Si no hay datos nuevos, mantener los existentes
  if (!newData) {
    console.log(`      ℹ️ No new data, keeping existing`);
    return existingData;
  }
  
  switch (section) {
    case 'structure':
      // Para estructura (objeto), hacer deep merge
      return deepMergeObjects(existingData, newData);
      
    case 'database':
    case 'endpoints':
    case 'modules':
      // Para arrays, combinar por nombre/identificador único
      return mergeArrayByKey(existingData, newData, section);
      
    default:
      // Por defecto, reemplazar
      return newData;
  }
}

/**
 * Deep merge de objetos (para estructura de carpetas)
 */
function deepMergeObjects(target, source) {
  const result = { ...target };
  
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
        // Ambos son objetos, hacer merge recursivo
        result[key] = deepMergeObjects(target[key], source[key]);
      } else {
        // Target no es objeto, usar source
        result[key] = source[key];
      }
    } else {
      // No es objeto (es string, array, etc), usar source
      result[key] = source[key];
    }
  }
  
  console.log(`      ✅ Deep merged structure object`);
  return result;
}

/**
 * Merge arrays por clave única (name, table_name, path, entity)
 */
function mergeArrayByKey(existingArray, newArray, section) {
  if (!Array.isArray(existingArray)) existingArray = [];
  if (!Array.isArray(newArray)) newArray = [];
  
  console.log(`      🔍 [MERGE] Section: ${section}`);
  console.log(`      🔍 [MERGE] Existing items: ${existingArray.length}`);
  console.log(`      🔍 [MERGE] New items: ${newArray.length}`);
  
  // Log de claves de items nuevos para debug
  if (newArray.length > 0) {
    console.log(`      🔍 [MERGE] Sample new item keys: ${JSON.stringify(Object.keys(newArray[0]))}`);
    console.log(`      🔍 [MERGE] Sample new item: ${JSON.stringify(newArray[0]).substring(0, 200)}...`);
  }
  
  // Determinar las posibles claves únicas según la sección
  const keyOptions = {
    'database': ['entity', 'table_name', 'name', 'collection_name'],
    'endpoints': ['path', 'endpoint', 'route'],
    'modules': ['name', 'module_name']
  };
  
  const possibleKeys = keyOptions[section] || ['name'];
  console.log(`      🔍 [MERGE] Possible keys for ${section}: ${possibleKeys.join(', ')}`);
  
  // Función para obtener la clave de un item
  const getItemKey = (item) => {
    for (const key of possibleKeys) {
      if (item[key]) {
        console.log(`         ✓ Found key '${key}' = '${item[key]}'`);
        return item[key];
      }
    }
    console.log(`         ✗ No key found in item with keys: ${Object.keys(item).join(', ')}`);
    return null;
  };
  
  // Crear mapa de elementos existentes
  const existingMap = new Map();
  existingArray.forEach(item => {
    const itemKey = getItemKey(item);
    if (itemKey) {
      existingMap.set(itemKey.toLowerCase(), item);
    }
  });
  
  console.log(`      🔍 [MERGE] Existing map size: ${existingMap.size}`);
  
  // Agregar/actualizar con nuevos elementos
  newArray.forEach((item, idx) => {
    const itemKey = getItemKey(item);
    console.log(`      🔍 [MERGE] Processing new item ${idx + 1}: key = '${itemKey}'`);
    
    if (itemKey) {
      const normalizedKey = itemKey.toLowerCase();
      // Si existe, hacer merge del item
      if (existingMap.has(normalizedKey)) {
        const existingItem = existingMap.get(normalizedKey);
        existingMap.set(normalizedKey, { ...existingItem, ...item });
        console.log(`         📝 Updated existing item: ${normalizedKey}`);
      } else {
        // Si no existe, agregar nuevo
        existingMap.set(normalizedKey, item);
        console.log(`         ➕ Added new item: ${normalizedKey}`);
      }
    } else {
      // Si no tiene clave, agregar con clave única generada
      const uniqueKey = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      existingMap.set(uniqueKey, item);
      console.log(`      ⚠️ Item without key added with generated key: ${uniqueKey}`);
    }
  });
  
  const result = Array.from(existingMap.values());
  console.log(`      ✅ Merged arrays: ${existingArray.length} existing + ${newArray.length} new = ${result.length} total`);
  
  return result;
}

/**
 * Obtiene una sección específica de la arquitectura para edición
 */
async function getArchitectureSection(productId, section) {
  try {
    const architecture = await ProjectArchitecture.findOne({ product: productId }).lean();
    if (!architecture) return null;
    
    switch (section) {
      case 'structure':
        return {
          section: 'structure',
          data: architecture.directory_structure,
          title: 'Estructura del Proyecto'
        };
      case 'database':
        return {
          section: 'database',
          data: architecture.database_schema,
          title: 'Esquema de Base de Datos'
        };
      case 'endpoints':
        return {
          section: 'endpoints',
          data: architecture.api_endpoints,
          title: 'API Endpoints'
        };
      case 'modules':
        return {
          section: 'modules',
          data: architecture.modules,
          title: 'Módulos del Sistema'
        };
      default:
        return null;
    }
  } catch (error) {
    console.error('Error getting architecture section:', error);
    return null;
  }
}

/**
 * Detecta si el mensaje requiere mostrar un canvas
 */
function detectCanvasIntent(message) {
  const lowerMessage = message.toLowerCase();
  
  // Primero verificar intents de edición específicos (más específicos primero)
  const editSectionPatterns = {
    editStructure: { type: 'architecture', action: 'edit', section: 'structure' },
    editDatabase: { type: 'architecture', action: 'edit', section: 'database' },
    editEndpoints: { type: 'architecture', action: 'edit', section: 'endpoints' },
    editModules: { type: 'architecture', action: 'edit', section: 'modules' }
  };
  
  for (const [patternKey, result] of Object.entries(editSectionPatterns)) {
    const patterns = CANVAS_PATTERNS[patternKey];
    if (patterns) {
      for (const pattern of patterns) {
        if (pattern.test(lowerMessage)) {
          return result;
        }
      }
    }
  }
  
  // Luego verificar edición general de arquitectura
  if (CANVAS_PATTERNS.editArchitecture) {
    for (const pattern of CANVAS_PATTERNS.editArchitecture) {
      if (pattern.test(lowerMessage)) {
        return { type: 'architecture', action: 'edit', section: null };
      }
    }
  }
  
  // Finalmente verificar otros patrones
  for (const [type, patterns] of Object.entries(CANVAS_PATTERNS)) {
    // Saltar los patrones de edición ya procesados
    if (type.startsWith('edit')) continue;
    
    for (const pattern of patterns) {
      if (pattern.test(lowerMessage)) {
        // Si es crear arquitectura, retornar action 'create'
        if (type === 'createArchitecture') {
          return { type: 'architecture', action: 'create' };
        }
        return { type, action: 'list' };
      }
    }
  }
  
  return null;
}

/**
 * Obtiene los datos para el canvas según el tipo
 */
async function getCanvasData(type, userId, context = {}) {
  try {
    switch (type) {
      case 'products': {
        const products = await Product.find({})
          .populate('responsable', 'firstName lastName email profile.photo')
          .sort({ createdAt: -1 })
          .limit(50)
          .lean();
        
        return {
          type: 'products',
          title: 'Productos',
          data: products.map(p => ({
            ...p,
            responsable_nombre: p.responsable ? 
              `${p.responsable.firstName || ''} ${p.responsable.lastName || ''}`.trim() || p.responsable.email : 
              'Sin asignar',
            responsable_email: p.responsable?.email,
            responsable_avatar: p.responsable?.profile?.photo
          })),
          metadata: {
            count: products.length,
            updatedAt: new Date().toISOString()
          }
        };
      }
      
      case 'backlog': {
        const backlogItems = await BacklogItem.find(
          context.product_id ? { producto: context.product_id } : {}
        )
          .sort({ prioridad: 1, createdAt: -1 })
          .limit(100)
          .lean();
        
        return {
          type: 'backlog',
          title: 'Product Backlog',
          data: backlogItems.map(item => ({
            _id: item._id,
            titulo: item.titulo,
            descripcion: item.descripcion,
            priority: item.prioridad || 'could',
            story_points: item.puntos_historia || item.storyPoints,
            status: item.estado || 'pending',
            acceptance_criteria: item.criterios_aceptacion
          })),
          metadata: {
            count: backlogItems.length,
            updatedAt: new Date().toISOString()
          }
        };
      }
      
      case 'sprints': {
        const sprints = await Sprint.find(
          context.product_id ? { producto: context.product_id } : {}
        )
          .populate('producto', 'nombre')
          .sort({ fecha_inicio: -1 })
          .limit(20)
          .lean();
        
        return {
          type: 'sprints',
          title: 'Sprints',
          data: sprints.map(s => ({
            _id: s._id,
            nombre: s.nombre,
            objetivo: s.objetivo,
            estado: s.estado,
            fecha_inicio: s.fecha_inicio,
            fecha_fin: s.fecha_fin,
            producto: s.producto?.nombre || 'Sin producto',
            progreso: s.progreso || 0,
            velocidad_planificada: s.velocidad_planificada,
            velocidad_real: s.velocidad_real
          })),
          metadata: {
            count: sprints.length,
            activos: sprints.filter(s => s.estado === 'activo').length,
            updatedAt: new Date().toISOString()
          }
        };
      }

      case 'tasks': {
        const query = {};
        if (context.sprint_id) query.sprint = context.sprint_id;
        if (context.product_id) query.product = context.product_id;
        
        const tasks = await Task.find(query)
          .populate('assignee', 'firstName lastName email profile.photo')
          .populate('sprint', 'nombre')
          .sort({ priority: -1, createdAt: -1 })
          .limit(100)
          .lean();
        
        return {
          type: 'tasks',
          title: 'Tareas',
          data: tasks.map(t => {
            const assigneeName = t.assignee ? 
              `${t.assignee.firstName || ''} ${t.assignee.lastName || ''}`.trim() || t.assignee.email : 
              'Sin asignar';
            return {
              _id: t._id,
              titulo: t.title,
              descripcion: t.description,
              tipo: t.type,
              estado: t.status,
              prioridad: t.priority,
              puntos: t.storyPoints,
              asignado: assigneeName,
              asignado_avatar: t.assignee?.profile?.photo,
              sprint: t.sprint?.nombre || 'Sin sprint'
            };
          }),
          metadata: {
            count: tasks.length,
            pendientes: tasks.filter(t => t.status === 'todo').length,
            en_progreso: tasks.filter(t => t.status === 'in_progress').length,
            completadas: tasks.filter(t => t.status === 'done').length,
            updatedAt: new Date().toISOString()
          }
        };
      }

      case 'architecture': {
        console.log('🏗️ [ARCHITECTURE CANVAS] Starting query');
        const ProjectArchitecture = require('../../models/ProjectArchitecture');
        
        // Buscar arquitectura del producto en contexto
        const productId = context.product_id || context.products?.[0]?._id;
        console.log('🏗️ [ARCHITECTURE CANVAS] Product ID from context:', productId);
        
        if (!productId) {
          console.log('❌ [ARCHITECTURE CANVAS] No product ID found');
          return {
            type: 'architecture',
            title: 'Arquitectura del Proyecto',
            data: [],
            metadata: {
              count: 0,
              message: 'No hay producto seleccionado',
              updatedAt: new Date().toISOString()
            }
          };
        }
        
        console.log(`🔍 [ARCHITECTURE CANVAS] Querying ProjectArchitecture for product: ${productId}`);
        const architecture = await ProjectArchitecture.findOne({ product: productId }).lean();
        console.log('🔍 [ARCHITECTURE CANVAS] Query result:', architecture ? 'FOUND' : 'NOT FOUND');
        
        if (!architecture) {
          console.log('📭 [ARCHITECTURE CANVAS] No architecture defined for this product');
          return {
            type: 'architecture',
            title: 'Arquitectura del Proyecto',
            data: [],
            metadata: {
              count: 0,
              message: 'Arquitectura no definida para este producto',
              productId: productId,
              updatedAt: new Date().toISOString()
            }
          };
        }
        
        console.log('✅ [ARCHITECTURE CANVAS] Architecture found, returning data');
        return {
          type: 'architecture',
          title: 'Arquitectura del Proyecto',
          data: [architecture],
          metadata: {
            count: 1,
            totalModules: architecture.modules?.length || 0,
            totalEndpoints: architecture.api_endpoints?.length || 0,
            totalTables: architecture.database_schema?.length || 0,
            hasTechStack: !!(architecture.tech_stack),
            updatedAt: architecture.updatedAt || architecture.createdAt
          }
        };
      }

      case 'team': {
        const members = await TeamMember.find({ status: 'active' })
          .populate('user', 'firstName lastName email profile.photo role clerk_id')
          .populate('currentSprint', 'nombre')
          .sort({ role: 1 })
          .lean();
        
        const { clerkClient } = require('@clerk/clerk-sdk-node');
        
        const membersWithAvatars = await Promise.all(members.map(async (m) => {
          const fullName = m.user ? 
            `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() : 
            null;
          
          let avatar = m.user?.profile?.photo || null;
          
          if (!avatar && m.user?.clerk_id) {
            try {
              const clerkUser = await clerkClient.users.getUser(m.user.clerk_id);
              avatar = clerkUser?.imageUrl || null;
            } catch (err) {
              console.log(`No se pudo obtener imagen de Clerk para ${m.user?.email}`);
            }
          }
          
          return {
            _id: m._id,
            nombre: fullName || m.user?.email?.split('@')[0] || 'Usuario',
            email: m.user?.email,
            avatar: avatar,
            rol: m.role,
            rol_usuario: m.user?.role,
            team: m.team,
            estado: m.status,
            disponibilidad: m.availability,
            skills: m.skills,
            sprint_actual: m.currentSprint?.nombre || null,
            carga_trabajo: m.workload
          };
        }));
        
        return {
          type: 'team',
          title: 'Equipo',
          data: membersWithAvatars,
          metadata: {
            count: members.length,
            por_rol: {
              scrum_master: members.filter(m => m.role === 'scrum_master').length,
              product_owner: members.filter(m => m.role === 'product_owner').length,
              developers: members.filter(m => m.role === 'developers').length
            },
            updatedAt: new Date().toISOString()
          }
        };
      }
      
      default:
        return null;
    }
  } catch (error) {
    console.error('Error fetching canvas data:', error.message);
    return null;
  }
}

/**
 * Formatea los datos de la BD en texto legible para el AI
 */
function formatDataForAI(type, data) {
  if (!data || data.length === 0) return '';

  switch (type) {
    case 'products': {
      const productList = data.map((p, i) => {
        const responsable = p.responsable_nombre || 'Sin asignar';
        const estado = p.estado || 'activo';
        const descripcion = p.descripcion ? ` - ${p.descripcion.substring(0, 100)}` : '';
        return `${i + 1}. **${p.nombre}** (${estado})${descripcion} | Responsable: ${responsable}`;
      }).join('\n');
      
      return `PRODUCTOS REGISTRADOS (${data.length} total):\n${productList}`;
    }

    case 'backlog': {
      const backlogList = data.map((item, i) => {
        const prioridad = item.prioridad || item.priority || 'sin prioridad';
        const puntos = item.puntos_historia || item.story_points || 'N/A';
        const estado = item.estado || item.status || 'pendiente';
        return `${i + 1}. [${prioridad.toUpperCase()}] ${item.titulo} (${puntos} pts) - Estado: ${estado}`;
      }).join('\n');
      
      return `ITEMS DEL BACKLOG (${data.length} total):\n${backlogList}`;
    }

    case 'sprints': {
      const sprintList = data.map((s, i) => {
        const estado = s.estado || 'planificado';
        const objetivo = s.objetivo ? ` - Objetivo: ${s.objetivo.substring(0, 80)}` : '';
        const fechas = s.fecha_inicio && s.fecha_fin ? 
          ` | ${new Date(s.fecha_inicio).toLocaleDateString('es-ES')} - ${new Date(s.fecha_fin).toLocaleDateString('es-ES')}` : '';
        const progreso = s.progreso ? ` | Progreso: ${s.progreso}%` : '';
        return `${i + 1}. Sprint "${s.nombre}" [${estado.toUpperCase()}]${objetivo}${fechas}${progreso}`;
      }).join('\n');
      
      return `SPRINTS (${data.length} total):\n${sprintList}`;
    }

    case 'tasks': {
      const taskList = data.map((t, i) => {
        const prioridad = t.prioridad || t.priority || 'media';
        const estado = t.estado || t.status || 'todo';
        const puntos = t.puntos || t.storyPoints || 'N/A';
        const asignado = t.asignado || 'Sin asignar';
        return `${i + 1}. [${prioridad.toUpperCase()}] ${t.titulo || t.title} (${puntos} pts) - ${estado} | Asignado: ${asignado}`;
      }).join('\n');
      
      return `TAREAS (${data.length} total):\n${taskList}`;
    }

    case 'team': {
      const rolLabels = {
        'scrum_master': 'Scrum Master',
        'product_owner': 'Product Owner',
        'developers': 'Developer',
        'tester': 'QA Tester',
        'designer': 'Designer',
        'analyst': 'Analyst',
        'super_admin': 'Super Admin'
      };
      
      const teamList = data.map((m, i) => {
        const rol = rolLabels[m.rol] || m.rol || 'Developer';
        const disponibilidad = m.disponibilidad !== undefined ? `${m.disponibilidad}%` : '100%';
        const skills = m.skills?.map(s => s.name).join(', ') || 'Sin skills registrados';
        const email = m.email ? ` (${m.email})` : '';
        const team = m.team ? ` | Equipo: ${m.team}` : '';
        return `${i + 1}. **${m.nombre}**${email} - ${rol} | Disponibilidad: ${disponibilidad}${team} | Skills: ${skills}`;
      }).join('\n');
      
      return `EQUIPO (${data.length} miembros):\n${teamList}`;
    }

    default:
      return JSON.stringify(data, null, 2);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 💬 POST /chat - Chat directo con SCRUM AI
// ════════════════════════════════════════════════════════════════════════════

router.post('/chat', authenticate, chatRateLimiter, async (req, res) => {
  try {
    console.log('📨 [SCRUM AI CHAT] Request received');
    console.log('User:', req.user?.email, '| Role:', req.user?.role);
    console.log('Message:', req.body.message?.substring(0, 100));
    
    const { message, session_id, context } = req.body;
    
    // Validación básica de mensaje
    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.log('❌ [SCRUM AI CHAT] Invalid message');
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere el campo "message" con un texto válido'
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // ✅ VALIDACIÓN: Detectar si solicita crear arquitectura sin producto
    // ════════════════════════════════════════════════════════════════════════
    const isArchitectureCreateRequest = /cre[aá]r?\s+(una?\s+)?(la\s+)?arquitec|defin[ei]r?\s+(la\s+)?arquitec|arquitec.*cre[aá]|nueva\s+arquitec/i.test(message);
    
    if (isArchitectureCreateRequest && !context?.product_id) {
      console.log('⚠️ [SCRUM AI CHAT] Architecture request without product_id - returning early');
      return res.status(400).json({
        status: 'error',
        code: 'PRODUCT_REQUIRED',
        message: 'Para crear una arquitectura, primero debes seleccionar un producto. Ve al panel de productos y selecciona uno.',
        needs_product_selection: true
      });
    }

    // 1. Cargar o crear sesión
    let session = null;
    let isNewSession = false;

    if (session_id) {
      session = await AgentSession.findOne({
        session_id: session_id,
        user_id: req.user._id
      });
    }

    if (!session) {
      const newSessionId = uuidv4();
      
      session = new AgentSession({
        session_id: newSessionId,
        user_id: req.user._id,
        context: {
          product_id: context?.product_id || null,
          sprint_id: context?.sprint_id || null,
          workspace: 'scrum-ai-chat',
          initial_intent: message.substring(0, 100)
        },
        messages: [],
        status: 'active',
        started_at: new Date()
      });
      
      await session.save({ validateBeforeSave: false });
      isNewSession = true;
    }

    // 2. Detectar intent de canvas
    const canvasIntent = detectCanvasIntent(message);
    console.log('🔍 Canvas intent detected:', canvasIntent);
    console.log('📦 Context received:', JSON.stringify(context, null, 2));
    
    let canvasData = null;
    let dataContextMessage = '';

    // Si hay intent de canvas, obtener datos reales
    if (canvasIntent) {
      console.log(`📊 Fetching canvas data for type: ${canvasIntent.type}, action: ${canvasIntent.action}`);
      
      if (canvasIntent.type === 'architecture' && canvasIntent.action === 'create') {
        console.log('🏗️ [CREATE ARCHITECTURE] User wants to create architecture');
        if (!context?.product_id) {
          console.log('❌ [CREATE ARCHITECTURE] No product ID');
          dataContextMessage = '\n[CONTEXTO]: Usuario quiere crear arquitectura pero no hay producto seleccionado. Sugiere seleccionar uno primero.';
        } else {
          console.log('✅ [CREATE ARCHITECTURE] Product selected');
          dataContextMessage = `\n[CONTEXTO]: Usuario quiere CREAR la arquitectura para "${context.product_name}". Haz preguntas sobre tipo de aplicación, tecnologías, escala y requisitos especiales. Luego propón la arquitectura completa.`;
        }
      } else {
        canvasData = await getCanvasData(canvasIntent.type, req.user._id, context || {});
        console.log('📊 Canvas data fetched:', canvasData ? `type=${canvasData.type}, count=${canvasData.metadata?.count}` : 'null');
        
        if (canvasData && canvasData.data && canvasData.data.length > 0) {
          console.log('✅ Canvas has data');
          dataContextMessage = formatDataForAI(canvasIntent.type, canvasData.data);
        } else if (canvasIntent.type === 'architecture' && canvasData) {
          console.log('🏗️ Architecture canvas - no data case');
          if (!context?.product_id) {
            dataContextMessage = '\n[CONTEXTO]: No hay producto seleccionado. Sugiere ver la lista de productos primero.';
          } else {
            dataContextMessage = `\n[CONTEXTO]: El producto seleccionado NO tiene arquitectura definida todavía. Ofrece crearla.`;
          }
        }
      }
    }
    
    // Agregar contexto del producto
    let contextInfo = '';
    if (context?.product_id && context?.product_name) {
      contextInfo = `\n[PRODUCTO SELECCIONADO]: ${context.product_name} (ID: ${context.product_id})`;
      
      // Si es un intent de edición de arquitectura, verificar si existe y agregar contexto
      if (canvasIntent?.action === 'edit') {
        console.log('✏️ Edit architecture intent detected, checking existing architecture...');
        const existingArch = await checkExistingArchitecture(context.product_id);
        
        if (existingArch.exists) {
          console.log('   ✅ Architecture exists:', existingArch.summary);
          contextInfo += `\n[ARQUITECTURA EXISTENTE]: Sí, última actualización: ${new Date(existingArch.lastUpdated).toLocaleDateString('es-ES')}`;
          contextInfo += `\n[RESUMEN ARQUITECTURA]: ${existingArch.summary.modules} módulos, ${existingArch.summary.tables} tablas DB, ${existingArch.summary.endpoints} endpoints`;
          contextInfo += existingArch.summary.hasStructure ? ', tiene estructura de carpetas definida' : ', SIN estructura de carpetas definida';
          
          // Si es edición de sección específica, obtener datos de esa sección
          if (canvasIntent.section) {
            const sectionData = await getArchitectureSection(context.product_id, canvasIntent.section);
            if (sectionData && sectionData.data) {
              contextInfo += `\n[SECCIÓN A EDITAR]: ${sectionData.title}`;
              // Aumentar límite para BD y endpoints que suelen ser más largos
              const charLimit = ['database', 'endpoints'].includes(canvasIntent.section) ? 4000 : 2500;
              contextInfo += `\n[DATOS ACTUALES DE ${sectionData.section.toUpperCase()}]:\n${JSON.stringify(sectionData.data, null, 2).substring(0, charLimit)}`;
              
              // Agregar instrucción específica para edición de sección
              contextInfo += `\n\n[INSTRUCCIÓN IMPORTANTE]: Estás editando la sección "${sectionData.section}". Cuando generes el JSON de actualización, USA EXACTAMENTE: {"section": "${sectionData.section}", "data": [...]}`;
            }
          }
        } else {
          contextInfo += `\n[ARQUITECTURA EXISTENTE]: No, el producto no tiene arquitectura definida todavía.`;
        }
      }
    }

    // 3. Preparar mensajes para OpenAI
    const userMessageWithContext = `${message}${contextInfo}${dataContextMessage ? `\n\n[DATOS DEL SISTEMA]:\n${dataContextMessage}` : ''}`;

    const messagesForOpenAI = [
      { role: 'system', content: SCRUM_AI_CONFIG.system_prompt },
      ...session.messages.slice(-10).map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content || ''
      })),
      { role: 'user', content: userMessageWithContext }
    ];

    // 4. Llamar a OpenAI
    console.log('🤖 Calling OpenAI...');
    const startTime = Date.now();
    
    const completion = await openai.chat.completions.create({
      model: SCRUM_AI_CONFIG.model,
      messages: messagesForOpenAI,
      temperature: SCRUM_AI_CONFIG.temperature,
      max_tokens: SCRUM_AI_CONFIG.max_tokens
    });

    const executionTime = Date.now() - startTime;
    let response = completion.choices[0].message.content;
    const tokensUsed = completion.usage.total_tokens;
    console.log(`✅ OpenAI response received (${executionTime}ms, ${tokensUsed} tokens)`);

    // 5. Verificar marcadores de canvas
    const canvasMarkerMatch = response.match(/\[CANVAS:(\w+):(\w+)\]/);
    
    if (canvasMarkerMatch) {
      response = response.replace(/\[CANVAS:\w+:\w+\]/g, '').trim();
      
      if (!canvasData) {
        const canvasType = canvasMarkerMatch[1];
        if (canvasType) {
          canvasData = await getCanvasData(canvasType, req.user._id, context || {});
        }
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // ✅ PRIMERO: DETECTAR SI ES ACTUALIZACIÓN DE SECCIÓN (tiene prioridad)
    // ════════════════════════════════════════════════════════════════════════
    let architectureSaveResult = null; // Para tracking del resultado
    const isArchitectureUpdateMarker = canvasMarkerMatch && canvasMarkerMatch[1] === 'architecture' && canvasMarkerMatch[2] === 'update';
    const hasUpdateJson = response.includes('```json') && response.includes('"section"');
    
    const shouldUpdateArchitectureSection = (isArchitectureUpdateMarker || hasUpdateJson) && context?.product_id;
    
    if (shouldUpdateArchitectureSection) {
      console.log('✏️ [UPDATE ARCHITECTURE SECTION] Processing section update');
      
      try {
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
        
        if (jsonMatch) {
          const updateData = JSON.parse(jsonMatch[1].trim());
          const section = updateData.section;
          const sectionData = updateData.data;
          
          if (section && sectionData) {
            console.log(`   📍 Updating section: ${section}`);
            
            // Mapear sección a campo de BD
            const sectionFieldMap = {
              'structure': 'directory_structure',
              'database': 'database_schema',
              'endpoints': 'api_endpoints',
              'modules': 'modules'
            };
            
            const dbField = sectionFieldMap[section];
            if (dbField) {
              // Log detallado de los datos que llegan
              console.log(`   📊 Section data received:`, JSON.stringify(sectionData).substring(0, 500));
              console.log(`   📊 Section data is array: ${Array.isArray(sectionData)}, length: ${Array.isArray(sectionData) ? sectionData.length : 'N/A'}`);
              
              // Obtener arquitectura actual para hacer MERGE
              const existingArch = await ProjectArchitecture.findOne({ product: context.product_id }).lean();
              
              let mergedData;
              
              if (existingArch) {
                const existingData = existingArch[dbField];
                console.log(`   📊 Existing data is array: ${Array.isArray(existingData)}, length: ${Array.isArray(existingData) ? existingData.length : 'N/A'}`);
                
                // Función para hacer merge inteligente
                mergedData = smartMergeSectionData(section, existingData, sectionData);
                console.log(`   🔀 Merged existing data with new data`);
                console.log(`   📊 Merged data is array: ${Array.isArray(mergedData)}, length: ${Array.isArray(mergedData) ? mergedData.length : 'N/A'}`);
              } else {
                mergedData = sectionData;
                console.log(`   📊 No existing architecture, using new data directly`);
              }
              
              const updateObj = { [dbField]: mergedData, updated_by: req.user._id };
              
              const updated = await ProjectArchitecture.findOneAndUpdate(
                { product: context.product_id },
                { $set: updateObj },
                { new: true }
              );
              
              if (updated) {
                console.log(`✅ [UPDATE ARCHITECTURE SECTION] Section '${section}' updated successfully`);
                console.log(`   📍 Updated ${dbField} with ${Array.isArray(mergedData) ? mergedData.length : 'object'} items`);
                
                // Refrescar canvas
                canvasData = await getCanvasData('architecture', req.user._id, context || {});
                
                architectureSaveResult = {
                  saved: true,
                  updated_section: section,
                  architecture_id: updated._id,
                  message: `Sección '${section}' actualizada exitosamente`
                };
              } else {
                console.log('⚠️ [UPDATE ARCHITECTURE SECTION] No architecture found to update');
              }
            } else {
              console.log(`⚠️ [UPDATE ARCHITECTURE SECTION] Unknown section: ${section}`);
            }
          }
        }
      } catch (error) {
        console.error('❌ [UPDATE ARCHITECTURE SECTION] Error:', error.message);
        architectureSaveResult = {
          saved: false,
          reason: 'update_error',
          error: error.message
        };
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // ✅ SEGUNDO: GUARDAR ARQUITECTURA COMPLETA SI ES NECESARIO (solo si no fue update de sección)
    // ════════════════════════════════════════════════════════════════════════
    
    // DETECTAR SI DEBEMOS GUARDAR ARQUITECTURA COMPLETA:
    // 1. Si el intent original era crear arquitectura (canvasIntent)
    // 2. O si la respuesta del AI contiene el marcador [CANVAS:architecture:create]
    // 3. O si la respuesta contiene un JSON de arquitectura COMPLETA (no de sección)
    // 4. Y NO se actualizó ya una sección
    const isArchitectureCreateIntent = canvasIntent?.type === 'architecture' && canvasIntent?.action === 'create';
    const hasArchitectureMarker = canvasMarkerMatch && canvasMarkerMatch[1] === 'architecture' && canvasMarkerMatch[2] === 'create';
    
    // Solo considerar como arquitectura completa si tiene tech_stack real Y modules
    const hasArchitectureJson = response.includes('```json') && 
      response.includes('"tech_stack"') && 
      response.includes('"modules"') &&
      !response.includes('"section"'); // Excluir si es actualización de sección
    
    // Verificar si el JSON realmente tiene datos de arquitectura completa
    let isCompleteArchitectureJson = false;
    if (hasArchitectureJson) {
      try {
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1].trim());
          // Solo es arquitectura completa si tiene tech_stack con datos Y no tiene "section"
          isCompleteArchitectureJson = parsed.tech_stack && 
            !parsed.section && 
            (parsed.tech_stack.frontend?.length > 0 || parsed.tech_stack.backend?.length > 0);
        }
      } catch (e) {
        isCompleteArchitectureJson = false;
      }
    }
    
    // Solo guardar arquitectura completa si:
    // 1. No se actualizó ya una sección
    // 2. Hay marcador [CANVAS:architecture:create] O es JSON de arquitectura completa validada
    // 3. El intent original era 'create' (no 'edit')
    const shouldSaveArchitecture = !architectureSaveResult?.saved && 
      canvasIntent?.action !== 'edit' &&
      (hasArchitectureMarker || isCompleteArchitectureJson) && 
      context?.product_id;
    
    console.log('🔍 [ARCHITECTURE CHECK] Conditions:', {
      isArchitectureCreateIntent,
      hasArchitectureMarker,
      hasArchitectureJson,
      isCompleteArchitectureJson,
      canvasIntentAction: canvasIntent?.action,
      hasProductId: !!context?.product_id,
      alreadySavedSection: !!architectureSaveResult?.saved,
      shouldSaveArchitecture
    });
    
    if (shouldSaveArchitecture) {
      console.log('🏗️ [CREATE ARCHITECTURE] Processing architecture creation');
      console.log('   📍 Product ID:', context.product_id);
      console.log('   📍 Product Name:', context.product_name);
      console.log('   📍 User ID:', req.user._id);
      
      try {
        // PASO 1: Buscar JSON en la respuesta
        console.log('🔎 [CREATE ARCHITECTURE] Searching for JSON in response...');
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
        
        if (!jsonMatch) {
          console.log('⚠️ [CREATE ARCHITECTURE] No JSON block found in AI response');
          console.log('   ℹ️ This is normal if AI is asking questions first');
          architectureSaveResult = {
            saved: false,
            reason: 'no_json_in_response',
            message: 'El AI aún no ha generado el JSON de arquitectura (puede estar haciendo preguntas)'
          };
        } else {
          const jsonString = jsonMatch[1].trim();
          console.log('📄 [CREATE ARCHITECTURE] Found JSON block, length:', jsonString.length);
          
          // PASO 2: Parsear JSON con validación
          let architectureData;
          try {
            architectureData = JSON.parse(jsonString);
            console.log('✅ [CREATE ARCHITECTURE] JSON parsed successfully');
          } catch (parseError) {
            console.error('❌ [CREATE ARCHITECTURE] JSON parse error:', parseError.message);
            console.log('   Raw JSON (first 500 chars):', jsonString.substring(0, 500));
            throw new Error(`JSON inválido generado por el AI: ${parseError.message}`);
          }
          
          // PASO 3: Validar estructura mínima requerida
          console.log('🔍 [CREATE ARCHITECTURE] Validating structure...');
          const requiredFields = ['tech_stack'];
          const missingFields = requiredFields.filter(field => !architectureData[field]);
          
          if (missingFields.length > 0) {
            console.log('⚠️ [CREATE ARCHITECTURE] Missing required fields:', missingFields);
            // No es error crítico, podemos continuar pero advertir
          }
          
          // Asegurar que tiene al menos nombre
          if (!architectureData.name && context.product_name) {
            architectureData.name = `Arquitectura de ${context.product_name}`;
            console.log('   ℹ️ Added default name:', architectureData.name);
          }
          
          console.log('✅ [CREATE ARCHITECTURE] Structure validation passed');
          console.log('   📦 Architecture name:', architectureData.name);
          console.log('   📦 Has tech_stack:', !!architectureData.tech_stack);
          console.log('   📦 Has modules:', Array.isArray(architectureData.modules) ? architectureData.modules.length : 0);
          
          // PASO 3.5: TRANSFORMAR JSON DE IA AL MODELO MONGOOSE
          console.log('🔄 [CREATE ARCHITECTURE] Transforming AI data to Mongoose model format...');
          const transformedData = transformAIArchitectureToModel(architectureData, context);
          console.log('✅ [CREATE ARCHITECTURE] Data transformed successfully');
          
          // PASO 4: Guardar en base de datos
          console.log('💾 [CREATE ARCHITECTURE] Saving to database...');
          const ArchitectureService = require('../../services/ArchitectureService');
          const ProjectArchitecture = require('../../models/ProjectArchitecture');
          
          try {
            const existing = await ProjectArchitecture.findOne({ product: context.product_id });
            console.log('   🔍 Existing architecture:', existing ? 'YES (will update)' : 'NO (will create)');
            
            let savedArchitecture;
            if (existing) {
              console.log('🔄 [CREATE ARCHITECTURE] Updating existing architecture...');
              savedArchitecture = await ArchitectureService.update(
                context.product_id,
                req.user._id,
                transformedData  // Usar datos transformados
              );
            } else {
              console.log('✨ [CREATE ARCHITECTURE] Creating NEW architecture...');
              savedArchitecture = await ArchitectureService.create(
                context.product_id,
                req.user._id,
                transformedData  // Usar datos transformados
              );
            }
            
            const savedId = savedArchitecture.data?._id || savedArchitecture._id;
            console.log('✅ [CREATE ARCHITECTURE] Successfully saved!');
            console.log('   📍 Architecture ID:', savedId);
            console.log('   📍 Product ID:', context.product_id);
            
            // PASO 5: Actualizar canvas con datos de BD
            canvasData = await getCanvasData('architecture', req.user._id, context || {});
            console.log('✅ [CREATE ARCHITECTURE] Canvas data refreshed from database');
            
            architectureSaveResult = {
              saved: true,
              architecture_id: savedId,
              message: existing ? 'Arquitectura actualizada exitosamente' : 'Arquitectura creada exitosamente'
            };
            
          } catch (dbError) {
            console.error('❌ [CREATE ARCHITECTURE] Database error:', dbError.message);
            console.error('   Stack:', dbError.stack?.substring(0, 300));
            throw new Error(`Error al guardar en base de datos: ${dbError.message}`);
          }
        }
        
      } catch (error) {
        console.error('❌ [CREATE ARCHITECTURE] Error in architecture save process:', error.message);
        architectureSaveResult = {
          saved: false,
          reason: 'error',
          error: error.message
        };
      }
    }
    
    // Log final del resultado de arquitectura
    if (architectureSaveResult) {
      console.log('📊 [ARCHITECTURE] Final result:', JSON.stringify(architectureSaveResult));
    }

    // 6. Guardar sesión
    session.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });
    
    session.messages.push({
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      metadata: canvasData ? { has_canvas: true, canvas_type: canvasData.type } : null
    });
    
    session.metrics = session.metrics || {};
    session.metrics.total_tokens = (session.metrics.total_tokens || 0) + tokensUsed;
    session.metrics.total_messages = session.messages.length;
    
    await session.save({ validateBeforeSave: false });

    // ════════════════════════════════════════════════════════════════════════
    // 7. Construir respuesta con feedback de arquitectura
    // ════════════════════════════════════════════════════════════════════════
    const responsePayload = {
      status: 'success',
      response: response,
      session_id: session.session_id,
      conversation_length: session.messages.length,
      is_new_session: isNewSession,
      canvas: canvasData,
      metadata: {
        tokens_used: tokensUsed,
        execution_time_ms: executionTime,
        model: SCRUM_AI_CONFIG.model
      }
    };
    
    // ✅ Incluir resultado de arquitectura si aplica
    if (architectureSaveResult) {
      responsePayload.architecture = architectureSaveResult;
      
      if (architectureSaveResult.saved) {
        console.log('✅ [RESPONSE] Including architecture success in response');
      } else if (architectureSaveResult.reason === 'no_json_in_response') {
        console.log('ℹ️ [RESPONSE] Architecture JSON not yet in response (normal for first message)');
      } else {
        console.log('⚠️ [RESPONSE] Including architecture error in response:', architectureSaveResult.error);
      }
    }
    
    res.json(responsePayload);

  } catch (error) {
    console.error('SCRUM AI chat error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Error en la conversación con SCRUM AI',
      error: error.message
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 📜 GET /conversations - Lista de conversaciones
// ════════════════════════════════════════════════════════════════════════════

router.get('/conversations', authenticate, async (req, res) => {
  try {
    const sessions = await AgentSession.find({
      user_id: req.user._id,
      status: { $in: ['active', 'completed'] }
    })
    .sort({ updatedAt: -1 })
    .limit(50);

    const conversations = sessions
      .filter(session => session.messages && session.messages.length > 0)
      .map(session => {
        const firstUserMessage = session.messages.find(m => m.role === 'user');
        const lastMessage = session.messages[session.messages.length - 1];
        
        const title = firstUserMessage 
          ? firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
          : 'Conversación';

        return {
          id: session.session_id,
          _id: session._id,
          title,
          lastMessage: lastMessage?.content?.substring(0, 100) || '',
          messageCount: session.messages.length,
          status: session.status,
          createdAt: session.started_at || session.createdAt,
          updatedAt: session.updatedAt,
          favorite: session.feedback?.rating >= 4 || false
        };
      });

    res.json(conversations);

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 📄 GET /conversations/:id - Cargar conversación
// ════════════════════════════════════════════════════════════════════════════

router.get('/conversations/:id', authenticate, async (req, res) => {
  try {
    const session = await AgentSession.findOne({
      session_id: req.params.id,
      user_id: req.user._id
    });

    if (!session) {
      return res.status(404).json({ status: 'error', message: 'Conversación no encontrada' });
    }

    res.json({
      id: session.session_id,
      messages: session.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      })),
      context: session.context,
      createdAt: session.started_at,
      updatedAt: session.updatedAt
    });

  } catch (error) {
    console.error('Get conversation error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// ⭐ POST /conversations/:id/favorite
// ════════════════════════════════════════════════════════════════════════════

router.post('/conversations/:id/favorite', authenticate, async (req, res) => {
  try {
    const session = await AgentSession.findOne({
      session_id: req.params.id,
      user_id: req.user._id
    });

    if (!session) {
      return res.status(404).json({ status: 'error', message: 'No encontrada' });
    }

    const newRating = (session.feedback?.rating || 0) >= 4 ? 3 : 5;
    await session.addFeedback(newRating, 'Toggle desde UI');

    res.json({ status: 'success', favorite: newRating >= 4 });

  } catch (error) {
    console.error('Toggle favorite error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 🗑️ DELETE /conversations/:id
// ════════════════════════════════════════════════════════════════════════════

router.delete('/conversations/:id', authenticate, async (req, res) => {
  try {
    const result = await AgentSession.deleteOne({
      session_id: req.params.id,
      user_id: req.user._id
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ status: 'error', message: 'No encontrada' });
    }

    res.json({ status: 'success', message: 'Eliminada' });

  } catch (error) {
    console.error('Delete conversation error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 🎨 GET /canvas
// ════════════════════════════════════════════════════════════════════════════

router.get('/canvas', authenticate, async (req, res) => {
  try {
    const { type, product_id } = req.query;

    if (!type) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Se requiere el parámetro type' 
      });
    }

    const canvasData = await getCanvasData(type, req.user._id, { product_id });

    if (!canvasData) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'Tipo de canvas no válido' 
      });
    }

    res.json(canvasData);

  } catch (error) {
    console.error('Canvas error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
