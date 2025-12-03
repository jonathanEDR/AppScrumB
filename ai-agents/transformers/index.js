/**
 * Transformers - Funciones de transformación de datos AI a modelos Mongoose
 * 
 * Este módulo exporta todas las funciones de transformación utilizadas
 * para convertir respuestas JSON de la IA al formato del modelo ProjectArchitecture
 * 
 * @module ai-agents/transformers
 */

const architectureTransformer = require('./architectureTransformer');
const databaseTransformer = require('./databaseTransformer');
const endpointTransformer = require('./endpointTransformer');

module.exports = {
  // Transformador principal de arquitectura
  transformAIArchitectureToModel: architectureTransformer.transformAIArchitectureToModel,
  
  // Transformadores específicos
  transformDatabaseSchema: databaseTransformer.transformDatabaseSchema,
  transformEndpoints: endpointTransformer.transformEndpoints,
  
  // Helpers de transformación
  parseStackArray: architectureTransformer.parseStackArray,
  transformModules: architectureTransformer.transformModules,
  transformDecisions: architectureTransformer.transformDecisions,
  transformRoadmap: architectureTransformer.transformRoadmap
};
