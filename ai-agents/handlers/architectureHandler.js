/**
 * Architecture Handler - Gestión de arquitectura de proyectos
 * 
 * Contiene funciones para verificar, crear, editar y hacer merge de arquitecturas
 * 
 * @module ai-agents/handlers/architectureHandler
 */

const ProjectArchitecture = require('../../models/ProjectArchitecture');

/**
 * Verifica si un producto tiene arquitectura existente
 * @param {string} productId - ID del producto
 * @returns {Object} Información de la arquitectura existente
 */
async function checkExistingArchitecture(productId) {
  try {
    if (!productId) return { exists: false };
    
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
 * Obtiene una sección específica de la arquitectura para edición
 * @param {string} productId - ID del producto
 * @param {string} section - Nombre de la sección
 * @returns {Object|null} Datos de la sección
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
 * @param {Object} target - Objeto destino
 * @param {Object} source - Objeto fuente
 * @returns {Object} Objeto mergeado
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
 * @param {Array} existingArray - Array existente
 * @param {Array} newArray - Array nuevo
 * @param {string} section - Tipo de sección
 * @returns {Array} Array mergeado
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
        return item[key];
      }
    }
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
 * Mapea el nombre de sección del usuario al campo de la BD
 * @param {string} section - Nombre de sección del usuario
 * @returns {string} Nombre del campo en la BD
 */
function getSectionFieldName(section) {
  const sectionMap = {
    'structure': 'directory_structure',
    'database': 'database_schema',
    'endpoints': 'api_endpoints',
    'modules': 'modules'
  };
  return sectionMap[section] || section;
}

/**
 * Actualiza una sección específica de la arquitectura
 * @param {string} productId - ID del producto
 * @param {string} section - Nombre de la sección
 * @param {Object|Array} data - Nuevos datos
 * @param {string} userId - ID del usuario
 * @returns {Object} Resultado de la actualización
 */
async function updateArchitectureSection(productId, section, data, userId) {
  try {
    const fieldName = getSectionFieldName(section);
    
    // Obtener arquitectura existente
    const existingArch = await ProjectArchitecture.findOne({ product: productId });
    if (!existingArch) {
      return { success: false, error: 'Arquitectura no encontrada' };
    }
    
    // Hacer merge inteligente
    const existingData = existingArch[fieldName];
    const mergedData = smartMergeSectionData(section, existingData, data);
    
    // Actualizar
    const updateData = {
      [fieldName]: mergedData,
      updated_by: userId,
      updatedAt: new Date()
    };
    
    const updated = await ProjectArchitecture.findOneAndUpdate(
      { product: productId },
      { $set: updateData },
      { new: true }
    );
    
    return {
      success: true,
      architecture: updated,
      section: section,
      itemsCount: Array.isArray(mergedData) ? mergedData.length : 1
    };
  } catch (error) {
    console.error('Error updating architecture section:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  checkExistingArchitecture,
  getArchitectureSection,
  smartMergeSectionData,
  deepMergeObjects,
  mergeArrayByKey,
  getSectionFieldName,
  updateArchitectureSection
};
