/**
 * Editing Prompts - Ejemplos JSON y flujos de edición de BD/Endpoints
 * 
 * @module ai-agents/prompts/scrumAI/editingPrompts
 */

/**
 * Ejemplos detallados de formato JSON
 */
const JSON_EXAMPLES = `═══════════════════════════════════════════════════════════════════════
EJEMPLOS DETALLADOS DE FORMATO JSON POR SECCIÓN (SISTEMAS COMPLEJOS)
═══════════════════════════════════════════════════════════════════════

📊 Para DATABASE - Entidades COMPLEJAS estilo Mongoose/MongoDB:

IMPORTANTE: Al crear entidades de base de datos, SIEMPRE incluye:
- Campos con validaciones completas (required, unique, index, min/max, enum)
- Subdocumentos para datos anidados (profile, settings, etc.)
- Arrays con límites (max items)
- Tipos correctos (String, Number, Boolean, Date, ObjectId, Array, Object, Subdocument)
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
          "match": "/.+@.+\\\\..+/",
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
\`\`\``;

/**
 * Flujo mejorado para edición de base de datos
 */
const DATABASE_EDIT_PROMPT = `═══════════════════════════════════════════════════════════════════════
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

PASO 2 - Con la información, genera el JSON completo como en el ejemplo de User arriba.`;

/**
 * Flujo mejorado para edición de endpoints
 */
const ENDPOINT_EDIT_PROMPT = `═══════════════════════════════════════════════════════════════════════
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

PASO 2 - Genera los endpoints completos con request/response schemas.`;

module.exports = {
  JSON_EXAMPLES,
  DATABASE_EDIT_PROMPT,
  ENDPOINT_EDIT_PROMPT
};
