/**
 * Handlers Index - Exporta todos los handlers del sistema SCRUM AI
 * 
 * @module ai-agents/handlers
 */

const canvasHandler = require('./canvasHandler');
const architectureHandler = require('./architectureHandler');

module.exports = {
  // Canvas Handler
  CANVAS_PATTERNS: canvasHandler.CANVAS_PATTERNS,
  detectCanvasIntent: canvasHandler.detectCanvasIntent,
  getCanvasData: canvasHandler.getCanvasData,
  formatDataForAI: canvasHandler.formatDataForAI,
  
  // Architecture Handler
  checkExistingArchitecture: architectureHandler.checkExistingArchitecture,
  getArchitectureSection: architectureHandler.getArchitectureSection,
  smartMergeSectionData: architectureHandler.smartMergeSectionData,
  updateArchitectureSection: architectureHandler.updateArchitectureSection,
  getSectionFieldName: architectureHandler.getSectionFieldName
};
