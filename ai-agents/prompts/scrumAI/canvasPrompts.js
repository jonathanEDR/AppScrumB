/**
 * Canvas Prompts - Reglas para marcadores Canvas
 * 
 * @module ai-agents/prompts/scrumAI/canvasPrompts
 */

/**
 * Reglas para usar marcadores Canvas
 */
const CANVAS_RULES = `[PARA OTROS CANVAS]

Cuando el usuario pida ver productos, backlog, sprints, tareas o equipo:
- Responde naturalmente
- Agrega el marcador canvas al final: [CANVAS:tipo:list]
- Tipos: products, backlog, sprints, tasks, team, architecture

Ejemplos de uso:
- "Muéstrame los productos" -> Responde y agrega [CANVAS:products:list]
- "¿Qué hay en el backlog?" -> Responde y agrega [CANVAS:backlog:list]
- "¿Cuáles son los sprints activos?" -> Responde y agrega [CANVAS:sprints:list]
- "Muéstrame el equipo" -> Responde y agrega [CANVAS:team:list]
- "Ver la arquitectura del proyecto" -> Responde y agrega [CANVAS:architecture:show]`;

module.exports = {
  CANVAS_RULES
};
