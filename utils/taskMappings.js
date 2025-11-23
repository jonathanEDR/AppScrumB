/**
 * Utilidades para mapeo de estados y prioridades entre BacklogItem y Task
 * 
 * Estos mapeos aseguran consistencia al convertir entre los diferentes
 * esquemas de estados y prioridades usados en el sistema.
 */

/**
 * Mapea el estado de una Task al estado de un BacklogItem
 * @param {string} taskStatus - Estado de la tarea (todo, in_progress, etc.)
 * @returns {string} Estado del backlog item
 */
const mapTaskStatusToBacklogStatus = (taskStatus) => {
  const statusMap = {
    'todo': 'pendiente',
    'in_progress': 'en_progreso',
    'code_review': 'en_revision',
    'testing': 'en_revision',
    'done': 'completado'
  };
  return statusMap[taskStatus] || 'pendiente';
};

/**
 * Mapea el estado de un BacklogItem al estado de una Task
 * @param {string} backlogStatus - Estado del backlog item (pendiente, en_progreso, etc.)
 * @returns {string} Estado de la tarea
 */
const mapBacklogStatusToTaskStatus = (backlogStatus) => {
  const statusMap = {
    'pendiente': 'todo',
    'en_progreso': 'in_progress',
    'en_revision': 'code_review',
    'testing': 'testing',
    'completado': 'done'
  };
  return statusMap[backlogStatus] || 'todo';
};

/**
 * Mapea la prioridad de un BacklogItem a la prioridad de una Task
 * @param {string} backlogPriority - Prioridad del backlog item (baja, media, alta, muy_alta)
 * @returns {string} Prioridad de la tarea (low, medium, high, critical)
 */
const mapBacklogPriorityToTaskPriority = (backlogPriority) => {
  const priorityMap = {
    'baja': 'low',
    'media': 'medium',
    'alta': 'high',
    'muy_alta': 'critical',
    'critica': 'critical',
    'crítica': 'critical'
  };
  return priorityMap[backlogPriority] || 'medium';
};

/**
 * Mapea la prioridad de una Task a la prioridad de un BacklogItem
 * @param {string} taskPriority - Prioridad de la tarea (low, medium, high, critical)
 * @returns {string} Prioridad del backlog item
 */
const mapTaskPriorityToBacklogPriority = (taskPriority) => {
  const priorityMap = {
    'low': 'baja',
    'medium': 'media',
    'high': 'alta',
    'critical': 'muy_alta'
  };
  return priorityMap[taskPriority] || 'media';
};

/**
 * Mapea el tipo de BacklogItem al tipo de Task
 * @param {string} backlogType - Tipo del backlog item (historia, tarea, bug, mejora)
 * @returns {string} Tipo de la tarea (story, task, bug, epic, spike)
 */
const mapBacklogTypeToTaskType = (backlogType) => {
  const typeMap = {
    'historia': 'story',
    'tarea': 'task',
    'bug': 'bug',
    'mejora': 'story',
    'epic': 'epic',
    'spike': 'spike'
  };
  return typeMap[backlogType] || 'task';
};

/**
 * Mapea el tipo de Task al tipo de BacklogItem
 * @param {string} taskType - Tipo de la tarea (story, task, bug, epic, spike)
 * @returns {string} Tipo del backlog item
 */
const mapTaskTypeToBacklogType = (taskType) => {
  const typeMap = {
    'story': 'historia',
    'task': 'tarea',
    'bug': 'bug',
    'epic': 'epic',
    'spike': 'tarea'
  };
  return typeMap[taskType] || 'tarea';
};

module.exports = {
  mapTaskStatusToBacklogStatus,
  mapBacklogStatusToTaskStatus,
  mapBacklogPriorityToTaskPriority,
  mapTaskPriorityToBacklogPriority,
  mapBacklogTypeToTaskType,
  mapTaskTypeToBacklogType
};
