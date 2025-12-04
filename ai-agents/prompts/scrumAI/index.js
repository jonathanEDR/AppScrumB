/**
 * SCRUM AI Prompts - Index
 * 
 * Exporta todos los prompts organizados del sistema SCRUM AI
 * 
 * @module ai-agents/prompts/scrumAI
 */

const { BASE_PERSONALITY, GENERAL_RULES } = require('./basePrompt');
const { ARCHITECTURE_CREATE_PROMPT, ARCHITECTURE_EDIT_PROMPT } = require('./architecturePrompts');
const { DATABASE_EDIT_PROMPT, ENDPOINT_EDIT_PROMPT, JSON_EXAMPLES } = require('./editingPrompts');
const { CANVAS_RULES } = require('./canvasPrompts');
const { STORY_CREATION_PROMPT, SPRINT_CREATION_PROMPT, GUIDED_CREATION_FLOW, TECHNICAL_ITEMS_PROMPT } = require('./creationPrompts');

/**
 * Construye el system prompt completo combinando todas las partes
 * @returns {string} System prompt completo
 */
function buildSystemPrompt() {
  return `${BASE_PERSONALITY}

${STORY_CREATION_PROMPT}

${SPRINT_CREATION_PROMPT}

${TECHNICAL_ITEMS_PROMPT}

${GUIDED_CREATION_FLOW}

${ARCHITECTURE_CREATE_PROMPT}

${ARCHITECTURE_EDIT_PROMPT}

${JSON_EXAMPLES}

${DATABASE_EDIT_PROMPT}

${ENDPOINT_EDIT_PROMPT}

${CANVAS_RULES}

${GENERAL_RULES}`;
}

/**
 * Configuración de SCRUM AI
 */
const SCRUM_AI_CONFIG = {
  name: 'scrum-ai',
  display_name: 'SCRUM AI',
  model: 'gpt-4o',
  temperature: 0.7,
  max_tokens: 4096,
  system_prompt: buildSystemPrompt()
};

module.exports = {
  SCRUM_AI_CONFIG,
  buildSystemPrompt,
  // Exportar partes individuales para testing/customización
  BASE_PERSONALITY,
  ARCHITECTURE_CREATE_PROMPT,
  ARCHITECTURE_EDIT_PROMPT,
  DATABASE_EDIT_PROMPT,
  ENDPOINT_EDIT_PROMPT,
  JSON_EXAMPLES,
  CANVAS_RULES,
  GENERAL_RULES,
  STORY_CREATION_PROMPT,
  SPRINT_CREATION_PROMPT,
  GUIDED_CREATION_FLOW,
  TECHNICAL_ITEMS_PROMPT
};
