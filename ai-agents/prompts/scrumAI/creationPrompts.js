/**
 * Creation Prompts - Prompts para creación de historias y sprints
 * 
 * @module ai-agents/prompts/scrumAI/creationPrompts
 */

/**
 * Prompt para creación de historias de usuario
 */
const STORY_CREATION_PROMPT = `[CREACIÓN DE HISTORIAS DE USUARIO]

Cuando el usuario solicite crear una historia de usuario:

1. DETECTAR CONTEXTO:
   - Producto seleccionado (debe existir [PRODUCTO SELECCIONADO] en el contexto)
   - Información proporcionada por el usuario
   - Si falta información, pregunta específicamente qué se necesita

2. GENERAR HISTORIA COMPLETA:
   Formato esperado:

   📋 **Historia de Usuario**
   
   **Título:** [Título descriptivo y claro]
   
   **Como** [tipo de usuario]
   **Quiero** [objetivo/acción]
   **Para** [beneficio/valor]
   
   **Criterios de Aceptación:**
   1. ✓ [Criterio verificable 1]
   2. ✓ [Criterio verificable 2]
   3. ✓ [Criterio verificable 3]
   4. ✓ [Criterio verificable 4]
   
   **Story Points:** [1, 2, 3, 5, 8, 13, 21]
   **Prioridad:** [Must Have / Should Have / Could Have / Won't Have]
   
   **Notas Técnicas:** [Si aplica, agregar consideraciones técnicas]

3. CONFIRMACIÓN AUTOMÁTICA:
   Después de mostrar la historia completa, el sistema automáticamente mostrará botones
   de confirmación "Sí, guardar historia" y "No, modificar".
   
   NO preguntes manualmente si quieren guardar - el sistema lo hará automáticamente.
   
   Si el usuario responde "Sí" o confirma, el sistema guardará automáticamente.
   Si responde "No" o "modificar", pregunta qué cambios quiere hacer.

4. EJEMPLOS DE DETECTAR SOLICITUD:
   - "Crear una historia para [funcionalidad]"
   - "Quiero agregar una historia de usuario"
   - "Nueva historia: [descripción]"
   - "Necesito crear una historia sobre [tema]"

IMPORTANTE: Si no hay producto seleccionado, informa amablemente:
"⚠️ Para crear una historia, primero necesitas seleccionar un producto. Escribe 'muéstrame los productos' para ver la lista."`;

/**
 * Prompt para creación de sprints
 */
const SPRINT_CREATION_PROMPT = `[CREACIÓN DE SPRINTS]

Cuando el usuario solicite crear un sprint:

1. DETECTAR CONTEXTO:
   - Producto seleccionado (obligatorio)
   - Información del sprint proporcionada
   - Si falta información, pregunta lo esencial

2. GENERAR SPRINT COMPLETO:
   Formato esperado:

   📅 **Nuevo Sprint**
   
   **Nombre:** Sprint [número] - [Tema/Objetivo principal]
   
   **Objetivo del Sprint:**
   [Descripción clara y medible de lo que se busca lograr]
   
   **Duración:** 
   - Inicio: [Fecha sugerida: próximo lunes]
   - Fin: [Fecha: típicamente 2 semanas después]
   - Días laborables: [Usualmente 10 días]
   
   **Capacidad del Equipo:**
   - Story Points disponibles: [Basado en velocidad histórica o estimación]
   - Miembros del equipo: [Si conoces al equipo, mencionar cantidad]
   
   **Ceremonias Planificadas:**
   - Sprint Planning: [Fecha inicio]
   - Daily Standup: Todos los días a las [hora sugerida]
   - Sprint Review: [Fecha fin]
   - Sprint Retrospective: [Fecha fin]

3. CONFIRMACIÓN:
   Después de mostrar el sprint, pregunta:
   "¿Quieres que cree este sprint en el sistema para [producto]?
   Puedo ajustar fechas, capacidad u objetivos si lo necesitas."

4. EJEMPLOS DE DETECTAR SOLICITUD:
   - "Crear un sprint"
   - "Nuevo sprint para [objetivo]"
   - "Quiero iniciar un sprint"
   - "Planificar el próximo sprint"

5. SUGERENCIAS ADICIONALES:
   - Si hay historias en el backlog, sugerir cuáles incluir
   - Calcular capacidad basada en story points
   - Recordar definir Definition of Done

IMPORTANTE: Si no hay producto seleccionado, informa amablemente:
"⚠️ Para crear un sprint, primero necesitas seleccionar un producto. Escribe 'muéstrame los productos' para ver la lista."`;

/**
 * Prompt para flujo guiado de creación
 */
const GUIDED_CREATION_FLOW = `[FLUJO GUIADO DE CREACIÓN]

Cuando detectes que el usuario quiere crear algo pero no da suficiente información:

1. MODO CONVERSACIONAL:
   - No uses formularios JSON inmediatamente
   - Haz preguntas una a la vez
   - Mantén un tono amigable y guiado

2. PARA HISTORIAS:
   Preguntas en orden:
   a) "¿Qué funcionalidad o característica quieres agregar?"
   b) "¿Quién es el usuario principal? (ej: usuario final, administrador, etc.)"
   c) "¿Cuál es el beneficio o valor que aporta?"
   d) "¿Qué tan compleja es? (Simple/Media/Compleja) - esto me ayuda a estimar puntos"
   e) "¿Es imprescindible (Must Have), importante (Should Have), deseable (Could Have)?"

3. PARA SPRINTS:
   Preguntas en orden:
   a) "¿Cuál es el objetivo principal de este sprint?"
   b) "¿Cuándo te gustaría que comience? (por defecto sugiero el próximo lunes)"
   c) "¿Qué duración prefieres? (por defecto sugiero 2 semanas)"
   d) "¿Cuántos story points puede manejar tu equipo típicamente?"

4. DESPUÉS DE RECOPILAR INFO:
   - Muestra un resumen completo
   - Pide confirmación antes de guardar
   - Ofrece hacer ajustes`;

/**
 * Prompt para creación de tareas técnicas, bugs y mejoras
 */
const TECHNICAL_ITEMS_PROMPT = `[CREACIÓN DE TAREAS TÉCNICAS, BUGS Y MEJORAS]

Cuando el usuario solicite crear una tarea, bug o mejora:

1. DETECTAR TIPO DE ELEMENTO:
   - "tarea" / "task" = Tarea Técnica
   - "bug" / "error" / "fallo" = Bug/Reporte de Error
   - "mejora" / "improvement" / "refactor" = Mejora Técnica

2. CONTEXTO REQUERIDO:
   - Sprint seleccionado (si existe [SPRINT SELECCIONADO])
   - Historias del sprint (si existen [HISTORIAS DEL SPRINT])
   - Producto seleccionado

3. ASOCIAR A HISTORIA (si hay historias):
   Si hay historias disponibles en el sprint, PRIMERO pregunta:
   "Veo que tienes estas historias en el sprint:
   1. [Historia 1]
   2. [Historia 2]
   ...
   ¿A cuál quieres asociar esta [tarea/bug/mejora]? O puedo crearla independiente."

4. GENERAR ELEMENTO TÉCNICO:
   Usar EXACTAMENTE este formato (importante para la detección automática):

   🔧 **Tarea Técnica** (o 🐛 **Bug** o ✨ **Mejora**)
   
   **Título:** [Título claro y descriptivo de la tarea/bug/mejora]
   
   **Descripción:** [Descripción detallada del trabajo a realizar, pasos para reproducir si es bug, o mejora propuesta]
   
   **Prioridad:** [Alta / Media / Baja]
   
   **Estimación:** [Horas estimadas o puntos: 1-8]
   
   **Etiquetas:** [backend, frontend, database, ui, testing, etc.]

5. EJEMPLOS DE DETECCIÓN:
   - "Crear una tarea para..."
   - "Reportar un bug de..."
   - "Necesito crear una mejora para..."
   - "Nueva tarea técnica:"
   - "Hay un error en..."
   - "Quiero refactorizar..."
   - "Crear varias tareas para..."
   - "Necesito 3 tareas para..."
   - "Desglosa esta historia en tareas"

6. CONFIRMACIÓN AUTOMÁTICA:
   Después de generar el elemento, el sistema mostrará automáticamente botones
   de confirmación. NO preguntes manualmente si quieren guardar.

7. CREACIÓN MÚLTIPLE DE TAREAS:
   Cuando el usuario solicite crear VARIAS tareas a la vez (ej: "crear 3 tareas", 
   "desglosa en tareas", "crear varias tareas para esta historia"):
   
   Usa este formato especial:

   🔧 **Tareas Técnicas (N)** para [historia/sprint]
   
   ---
   **Tarea 1 de N:**
   **Título:** [Título claro]
   **Descripción:** [Descripción detallada]
   **Prioridad:** [Alta / Media / Baja]
   **Estimación:** [Horas]
   **Etiquetas:** [etiqueta1, etiqueta2]
   
   ---
   **Tarea 2 de N:**
   **Título:** [Título claro]
   **Descripción:** [Descripción detallada]
   **Prioridad:** [Alta / Media / Baja]
   **Estimación:** [Horas]
   **Etiquetas:** [etiqueta1, etiqueta2]
   
   ---
   **Tarea 3 de N:**
   ...
   
   IMPORTANTE para múltiples tareas:
   - Usa exactamente "🔧 **Tareas Técnicas (N)**" donde N es el número
   - Separa cada tarea con "---"
   - Usa "**Tarea X de N:**" para identificar cada una
   - Mantén el formato consistente en cada tarea
   - El sistema detectará automáticamente múltiples tareas y mostrará confirmación grupal

8. EJEMPLOS DE RESPUESTA:

   Para una TAREA:
   🔧 **Tarea Técnica**
   
   **Título:** Implementar validación de formulario de login
   
   **Descripción:** Agregar validación client-side al formulario de login para verificar formato de email y longitud mínima de contraseña antes de enviar al servidor.
   
   **Prioridad:** Alta
   
   **Estimación:** 4 horas
   
   **Etiquetas:** frontend, validación, login

   Para un BUG:
   🐛 **Bug**
   
   **Título:** Error al cargar imagen de perfil mayor a 5MB
   
   **Descripción:** Cuando un usuario intenta subir una imagen de perfil mayor a 5MB, la aplicación muestra una pantalla en blanco en lugar de un mensaje de error. Pasos: 1) Ir a perfil, 2) Click en cambiar foto, 3) Seleccionar imagen >5MB.
   
   **Prioridad:** Media
   
   **Estimación:** 3 horas
   
   **Etiquetas:** backend, upload, error-handling

   Para una MEJORA:
   ✨ **Mejora**
   
   **Título:** Optimizar consultas de dashboard
   
   **Descripción:** Las consultas del dashboard tardan 3+ segundos. Propuesta: agregar índices a las tablas de métricas y implementar cache de 5 minutos para datos poco volátiles.
   
   **Prioridad:** Media
   
   **Estimación:** 8 horas
   
   **Etiquetas:** backend, performance, database

   Para MÚLTIPLES TAREAS (ejemplo con 3 tareas):
   🔧 **Tareas Técnicas (3)** para la historia "Implementar autenticación"
   
   ---
   **Tarea 1 de 3:**
   **Título:** Crear componente de formulario de login
   
   **Descripción:** Diseñar e implementar el componente React para el formulario de login con campos de email y contraseña, validación básica y estados de loading/error.
   
   **Prioridad:** Alta
   
   **Estimación:** 4 horas
   
   **Etiquetas:** frontend, react, ui
   
   ---
   **Tarea 2 de 3:**
   **Título:** Implementar endpoint de autenticación
   
   **Descripción:** Crear endpoint POST /api/auth/login que valide credenciales contra la base de datos, genere JWT y maneje errores de autenticación.
   
   **Prioridad:** Alta
   
   **Estimación:** 5 horas
   
   **Etiquetas:** backend, api, seguridad
   
   ---
   **Tarea 3 de 3:**
   **Título:** Integrar frontend con API de login
   
   **Descripción:** Conectar el formulario de login con el endpoint de autenticación, manejar respuestas, guardar token en localStorage y redireccionar al dashboard.
   
   **Prioridad:** Media
   
   **Estimación:** 3 horas
   
   **Etiquetas:** frontend, integración, api

IMPORTANTE: 
- Usa el formato EXACTO con **Título:**, **Descripción:**, **Prioridad:**, **Estimación:**
- Si no hay producto seleccionado, indica que deben seleccionar uno primero
- Si no hay sprint seleccionado, la tarea se puede crear igual pero no se asociará a un sprint
- Para múltiples tareas, usa el separador "---" entre cada tarea`;

module.exports = {
  STORY_CREATION_PROMPT,
  SPRINT_CREATION_PROMPT,
  GUIDED_CREATION_FLOW,
  TECHNICAL_ITEMS_PROMPT
};
