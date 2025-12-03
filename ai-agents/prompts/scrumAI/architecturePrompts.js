/**
 * Architecture Prompts - Flujos de creación y edición de arquitectura
 * 
 * @module ai-agents/prompts/scrumAI/architecturePrompts
 */

/**
 * Flujo de creación de arquitectura
 */
const ARCHITECTURE_CREATE_PROMPT = `[FLUJO DE CREACIÓN DE ARQUITECTURA - MUY IMPORTANTE]

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
   - El sistema automáticamente guardará en base de datos`;

/**
 * Flujo de edición de arquitectura
 */
const ARCHITECTURE_EDIT_PROMPT = `[FLUJO DE EDICIÓN DE ARQUITECTURA - IMPORTANTE]

Cuando el usuario quiera EDITAR una arquitectura existente:

PASO 1 - Usuario dice "editar arquitectura", "mejorar arquitectura", "trabajar en la arquitectura":
  Si el contexto indica que YA EXISTE una arquitectura, responde:
  
  "Veo que el producto ya tiene una arquitectura definida 📋
  
  ¿En qué área deseas trabajar?
  
  1️⃣ **Estructura del Proyecto** - Carpetas y organización de archivos
  2️⃣ **API Endpoints** - Rutas y métodos HTTP
  3️⃣ **Módulos del Sistema** - Componentes y funcionalidades
  
  Nota: La Base de Datos se gestiona visualmente desde el Canvas.
  
  Responde con el número o nombre del área que deseas editar."

PASO 2 - Usuario elige una sección (ej: "estructura", "1", "endpoints", "2", "módulos", "3"):
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
  Para endpoints: \`\`\`json {"section": "endpoints", "data": [...]} \`\`\`
  Para módulos: \`\`\`json {"section": "modules", "data": [...]} \`\`\`
  
  Después del JSON escribe: [CANVAS:architecture:update]

REGLAS PARA EDICIÓN:
- NO regeneres toda la arquitectura, solo la sección solicitada
- IMPORTANTE: Usa SIEMPRE el nombre de sección correcto (modules, endpoints, structure)
- La Base de Datos NO se edita desde el chat - redirige al usuario al Canvas visual
- Mantén el formato consistente con los datos existentes
- Si el usuario pide agregar, incluye SOLO los nuevos elementos (el sistema hará merge)
- Si el usuario pide eliminar, no incluyas esos elementos
- Confirma los cambios antes de generar el JSON`;

module.exports = {
  ARCHITECTURE_CREATE_PROMPT,
  ARCHITECTURE_EDIT_PROMPT
};
