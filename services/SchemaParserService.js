/**
 * SchemaParserService
 * Servicio para parsear código de modelos (Mongoose, Prisma, etc.) 
 * y convertirlo a la estructura DatabaseSchema
 * 
 * @module services/SchemaParserService
 */

/**
 * Tipos de datos conocidos y sus mapeos
 */
const TYPE_MAPPINGS = {
  // Mongoose types
  'string': 'String',
  'number': 'Number',
  'boolean': 'Boolean',
  'bool': 'Boolean',
  'date': 'Date',
  'objectid': 'ObjectId',
  'buffer': 'Buffer',
  'array': 'Array',
  'object': 'Object',
  'mixed': 'Mixed',
  'map': 'Map',
  'decimal128': 'Decimal128',
  'uuid': 'UUID',
  
  // JavaScript types
  'mongoose.schema.types.objectid': 'ObjectId',
  'schema.types.objectid': 'ObjectId',
  'mongoose.schema.types.mixed': 'Mixed',
  'schema.types.mixed': 'Mixed',
  'mongoose.schema.types.decimal128': 'Decimal128',
  'schema.types.decimal128': 'Decimal128',
  'mongoose.types.objectid': 'ObjectId'
};

/**
 * Normaliza el tipo de dato al formato estándar
 * @param {string} type - Tipo original
 * @returns {string} Tipo normalizado
 */
function normalizeType(type) {
  if (!type) return 'String';
  
  const cleanType = type.toString().toLowerCase().trim();
  
  // Buscar en mapeos
  if (TYPE_MAPPINGS[cleanType]) {
    return TYPE_MAPPINGS[cleanType];
  }
  
  // Si es un array tipo [String], [Number], etc.
  if (cleanType.startsWith('[') && cleanType.endsWith(']')) {
    return 'Array';
  }
  
  // Capitalizar primera letra si no está mapeado
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Extrae el tipo de array del código
 * @param {string} code - Fragmento de código
 * @returns {string|null} Tipo de elementos del array
 */
function extractArrayType(code) {
  // Patrones comunes: [String], [{ type: String }], [SubSchema]
  const patterns = [
    /\[\s*(\w+)\s*\]/,                           // [String]
    /\[\s*{\s*type:\s*(\w+)/,                   // [{ type: String }]
    /type:\s*\[\s*(\w+)\s*\]/,                  // type: [String]
  ];
  
  for (const pattern of patterns) {
    const match = code.match(pattern);
    if (match) {
      return normalizeType(match[1]);
    }
  }
  
  return null;
}

/**
 * Parsea un campo individual del schema
 * @param {string} fieldName - Nombre del campo
 * @param {string} fieldCode - Código del campo
 * @returns {Object} Campo parseado
 */
function parseField(fieldName, fieldCode) {
  const field = {
    name: fieldName,
    type: 'String',
    required: false,
    unique: false,
    index: false
  };
  
  // Si es solo el tipo (ej: String, Number)
  const simpleTypeMatch = fieldCode.match(/^\s*(\w+)\s*$/);
  if (simpleTypeMatch) {
    field.type = normalizeType(simpleTypeMatch[1]);
    return field;
  }
  
  // Si es un array simple [Type]
  const simpleArrayMatch = fieldCode.match(/^\s*\[\s*(\w+)\s*\]\s*$/);
  if (simpleArrayMatch) {
    field.type = 'Array';
    field.array_type = normalizeType(simpleArrayMatch[1]);
    return field;
  }
  
  // Extraer type
  const typeMatch = fieldCode.match(/type:\s*([\w.]+(?:\[\s*\w+\s*\])?)/i);
  if (typeMatch) {
    let typeValue = typeMatch[1];
    
    // Verificar si es array
    if (typeValue.includes('[') || fieldCode.includes('type: [')) {
      field.type = 'Array';
      field.array_type = extractArrayType(fieldCode);
    } else {
      field.type = normalizeType(typeValue);
    }
  }
  
  // Verificar si el campo completo es un array
  if (fieldCode.trim().startsWith('[')) {
    field.type = 'Array';
    const arrayType = extractArrayType(fieldCode);
    if (arrayType) field.array_type = arrayType;
  }
  
  // Extraer required
  const requiredMatch = fieldCode.match(/required:\s*(true|\[true|false)/i);
  if (requiredMatch) {
    field.required = requiredMatch[1].toLowerCase().includes('true');
  }
  
  // Extraer unique
  if (/unique:\s*true/i.test(fieldCode)) {
    field.unique = true;
  }
  
  // Extraer index
  if (/index:\s*true/i.test(fieldCode)) {
    field.index = true;
  }
  
  // Extraer sparse
  if (/sparse:\s*true/i.test(fieldCode)) {
    field.sparse = true;
  }
  
  // Extraer trim
  if (/trim:\s*true/i.test(fieldCode)) {
    field.trim = true;
  }
  
  // Extraer lowercase
  if (/lowercase:\s*true/i.test(fieldCode)) {
    field.lowercase = true;
  }
  
  // Extraer uppercase
  if (/uppercase:\s*true/i.test(fieldCode)) {
    field.uppercase = true;
  }
  
  // Extraer default
  const defaultMatch = fieldCode.match(/default:\s*([^,}\n]+)/);
  if (defaultMatch) {
    let defaultValue = defaultMatch[1].trim();
    // Limpiar comillas
    if ((defaultValue.startsWith("'") && defaultValue.endsWith("'")) ||
        (defaultValue.startsWith('"') && defaultValue.endsWith('"'))) {
      defaultValue = defaultValue.slice(1, -1);
    }
    // No guardar funciones como default
    if (!defaultValue.includes('function') && !defaultValue.includes('=>') && defaultValue !== 'Date.now') {
      field.default_value = defaultValue;
    }
  }
  
  // Extraer enum
  const enumMatch = fieldCode.match(/enum:\s*\[([^\]]+)\]/);
  if (enumMatch) {
    const enumValues = enumMatch[1]
      .split(',')
      .map(v => v.trim().replace(/['"]/g, ''))
      .filter(v => v.length > 0);
    field.enum_values = enumValues;
  }
  
  // Extraer enum con values
  const enumValuesMatch = fieldCode.match(/enum:\s*{\s*values:\s*\[([^\]]+)\]/);
  if (enumValuesMatch) {
    const enumValues = enumValuesMatch[1]
      .split(',')
      .map(v => v.trim().replace(/['"]/g, ''))
      .filter(v => v.length > 0);
    field.enum_values = enumValues;
  }
  
  // Extraer ref (referencia a otra entidad)
  const refMatch = fieldCode.match(/ref:\s*['"](\w+)['"]/);
  if (refMatch) {
    field.reference = refMatch[1];
    field.is_foreign_key = true;
    if (field.type === 'String') {
      field.type = 'ObjectId';
    }
  }
  
  // Extraer min/max para números
  const minMatch = fieldCode.match(/min:\s*(\d+)/);
  if (minMatch) field.min = parseInt(minMatch[1]);
  
  const maxMatch = fieldCode.match(/max:\s*(\d+)/);
  if (maxMatch) field.max = parseInt(maxMatch[1]);
  
  // Extraer minlength/maxlength para strings
  const minLengthMatch = fieldCode.match(/minlength:\s*(\d+)/);
  if (minLengthMatch) field.minlength = parseInt(minLengthMatch[1]);
  
  const maxLengthMatch = fieldCode.match(/maxlength:\s*(\d+)/);
  if (maxLengthMatch) field.maxlength = parseInt(maxLengthMatch[1]);
  
  // Extraer match (regex)
  const matchRegexMatch = fieldCode.match(/match:\s*\[?\/?([^\/\],]+)\/?/);
  if (matchRegexMatch) {
    field.match = matchRegexMatch[1];
  }
  
  return field;
}

/**
 * Parsea campos anidados (subdocumentos)
 * @param {string} code - Código del subdocumento
 * @returns {Array} Array de campos anidados
 */
function parseNestedFields(code) {
  const fields = [];
  
  // Remover llaves externas
  let innerCode = code.trim();
  if (innerCode.startsWith('{')) {
    innerCode = innerCode.slice(1);
  }
  if (innerCode.endsWith('}')) {
    innerCode = innerCode.slice(0, -1);
  }
  
  // Dividir por campos de primer nivel
  const fieldMatches = innerCode.matchAll(/(\w+):\s*({[^{}]*(?:{[^{}]*}[^{}]*)*}|[^,{}]+)/g);
  
  for (const match of fieldMatches) {
    const fieldName = match[1].trim();
    const fieldValue = match[2].trim();
    
    // Ignorar campos de configuración del schema
    if (['_id', 'timestamps'].includes(fieldName)) continue;
    
    const parsedField = parseField(fieldName, fieldValue);
    fields.push({
      name: parsedField.name,
      type: parsedField.type,
      required: parsedField.required,
      default_value: parsedField.default_value,
      enum_values: parsedField.enum_values,
      description: ''
    });
  }
  
  return fields;
}

/**
 * Extrae los índices del código del schema
 * @param {string} code - Código completo
 * @param {string} schemaVarName - Nombre de la variable del schema
 * @returns {Array} Array de índices
 */
function extractIndexes(code, schemaVarName) {
  const indexes = [];
  
  // Buscar .index() calls
  const indexPattern = new RegExp(`${schemaVarName}\\.index\\(\\s*{([^}]+)}`, 'g');
  let match;
  
  while ((match = indexPattern.exec(code)) !== null) {
    const indexBody = match[1];
    const fields = [];
    let isUnique = false;
    let isSparse = false;
    
    // Extraer campos del índice
    const fieldMatches = indexBody.matchAll(/(\w+):\s*(1|-1|'text'|"text")/g);
    for (const fieldMatch of fieldMatches) {
      fields.push(fieldMatch[1]);
    }
    
    // Buscar opciones (unique, sparse)
    const optionsMatch = code.slice(match.index).match(/index\([^)]+,\s*{([^}]+)}/);
    if (optionsMatch) {
      isUnique = /unique:\s*true/i.test(optionsMatch[1]);
      isSparse = /sparse:\s*true/i.test(optionsMatch[1]);
    }
    
    if (fields.length > 0) {
      indexes.push({
        fields,
        unique: isUnique,
        sparse: isSparse,
        name: fields.join('_')
      });
    }
  }
  
  return indexes;
}

/**
 * Detecta si el schema tiene timestamps
 * @param {string} code - Código del schema
 * @returns {Object} Configuración de timestamps
 */
function detectTimestamps(code) {
  const timestampsMatch = code.match(/timestamps:\s*(true|{[^}]+})/);
  
  if (timestampsMatch) {
    if (timestampsMatch[1] === 'true') {
      return { enabled: true, created_at: 'createdAt', updated_at: 'updatedAt' };
    }
    
    // Timestamps personalizados
    const createdMatch = timestampsMatch[1].match(/createdAt:\s*['"](\w+)['"]/);
    const updatedMatch = timestampsMatch[1].match(/updatedAt:\s*['"](\w+)['"]/);
    
    return {
      enabled: true,
      created_at: createdMatch ? createdMatch[1] : 'createdAt',
      updated_at: updatedMatch ? updatedMatch[1] : 'updatedAt'
    };
  }
  
  return { enabled: false };
}

/**
 * Extrae el nombre del modelo del código
 * @param {string} code - Código completo
 * @returns {string} Nombre del modelo
 */
function extractModelName(code) {
  // Patrón: mongoose.model('ModelName', schema)
  const modelMatch = code.match(/mongoose\.model\s*\(\s*['"](\w+)['"]/);
  if (modelMatch) return modelMatch[1];
  
  // Patrón: module.exports = mongoose.model('ModelName'
  const exportModelMatch = code.match(/exports\s*=\s*mongoose\.model\s*\(\s*['"](\w+)['"]/);
  if (exportModelMatch) return exportModelMatch[1];
  
  // Patrón: const ModelSchema = new mongoose.Schema
  const schemaVarMatch = code.match(/const\s+(\w+)Schema\s*=\s*new\s+mongoose\.Schema/);
  if (schemaVarMatch) return schemaVarMatch[1];
  
  // Patrón: const modelSchema = new Schema
  const simpleSchemaMatch = code.match(/const\s+(\w+)Schema\s*=\s*new\s+Schema/);
  if (simpleSchemaMatch) {
    // Capitalizar primera letra
    const name = simpleSchemaMatch[1];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  
  return 'UnknownModel';
}

/**
 * Extrae el nombre de la colección si está especificado
 * @param {string} code - Código completo
 * @returns {string|null} Nombre de la colección
 */
function extractCollectionName(code) {
  // Patrón en options del schema: { collection: 'nombre' }
  const collectionMatch = code.match(/collection:\s*['"](\w+)['"]/);
  if (collectionMatch) return collectionMatch[1];
  
  return null;
}

/**
 * Parsea código Mongoose y extrae la estructura de la entidad
 * @param {string} code - Código fuente del modelo Mongoose
 * @returns {Object} Entidad parseada
 */
function parseMongooseSchema(code) {
  console.log('🔍 [PARSER] Parsing Mongoose schema...');
  
  const entity = {
    entity: extractModelName(code),
    description: '',
    collection_name: extractCollectionName(code),
    fields: [],
    indexes: [],
    relationships: [],
    timestamps: detectTimestamps(code),
    soft_delete: { enabled: false },
    source_code: code,
    source_type: 'mongoose'
  };
  
  // Encontrar el cuerpo del schema
  // Patrón: new mongoose.Schema({ ... }, options) o new Schema({ ... })
  const schemaBodyMatch = code.match(/new\s+(?:mongoose\.)?Schema\s*\(\s*({[\s\S]*?})\s*(?:,\s*{[\s\S]*?})?\s*\)/);
  
  if (!schemaBodyMatch) {
    console.warn('⚠️ [PARSER] Could not find schema body');
    return entity;
  }
  
  const schemaBody = schemaBodyMatch[1];
  
  // Parsear campos del schema
  // Usar un enfoque más robusto para manejar objetos anidados
  let depth = 0;
  let currentField = '';
  let currentFieldName = '';
  let inField = false;
  let i = 0;
  
  // Saltar la llave inicial
  while (i < schemaBody.length && schemaBody[i] !== '{') i++;
  i++;
  
  while (i < schemaBody.length) {
    const char = schemaBody[i];
    
    if (!inField) {
      // Buscar inicio de campo
      const remainingCode = schemaBody.slice(i);
      const fieldStartMatch = remainingCode.match(/^\s*(\w+)\s*:/);
      
      if (fieldStartMatch) {
        currentFieldName = fieldStartMatch[1];
        inField = true;
        currentField = '';
        i += fieldStartMatch[0].length;
        continue;
      }
    } else {
      // Dentro de un campo
      if (char === '{' || char === '[') {
        depth++;
        currentField += char;
      } else if (char === '}' || char === ']') {
        if (depth > 0) {
          depth--;
          currentField += char;
        } else {
          // Fin del schema
          break;
        }
      } else if (char === ',' && depth === 0) {
        // Fin del campo actual
        const parsedField = parseField(currentFieldName, currentField.trim());
        
        // Detectar subdocumentos
        if (currentField.includes('{') && !currentField.includes('type:')) {
          parsedField.type = 'Object';
          parsedField.nested_fields = parseNestedFields(currentField);
        }
        
        entity.fields.push(parsedField);
        inField = false;
        currentField = '';
        currentFieldName = '';
      } else {
        currentField += char;
      }
    }
    
    i++;
  }
  
  // Procesar último campo si existe
  if (inField && currentFieldName && currentField.trim()) {
    const parsedField = parseField(currentFieldName, currentField.trim());
    
    if (currentField.includes('{') && !currentField.includes('type:')) {
      parsedField.type = 'Object';
      parsedField.nested_fields = parseNestedFields(currentField);
    }
    
    entity.fields.push(parsedField);
  }
  
  // Extraer índices
  const schemaVarMatch = code.match(/const\s+(\w+)\s*=\s*new\s+(?:mongoose\.)?Schema/);
  if (schemaVarMatch) {
    entity.indexes = extractIndexes(code, schemaVarMatch[1]);
  }
  
  // Detectar relaciones (campos con ref)
  entity.fields.forEach(field => {
    if (field.reference) {
      entity.relationships.push({
        type: field.type === 'Array' ? 'one-to-many' : 'one-to-one',
        target_entity: field.reference,
        field: field.name,
        description: `Reference to ${field.reference}`
      });
    }
  });
  
  // Detectar soft delete
  const deletedAtField = entity.fields.find(f => 
    f.name.toLowerCase().includes('deleted') || 
    f.name.toLowerCase().includes('is_deleted')
  );
  if (deletedAtField) {
    entity.soft_delete = {
      enabled: true,
      field: deletedAtField.name
    };
  }
  
  console.log(`✅ [PARSER] Parsed entity: ${entity.entity}`);
  console.log(`   📦 Fields: ${entity.fields.length}`);
  console.log(`   📦 Indexes: ${entity.indexes.length}`);
  console.log(`   📦 Relationships: ${entity.relationships.length}`);
  
  return entity;
}

/**
 * Parsea código y detecta automáticamente el tipo de ORM
 * @param {string} code - Código fuente
 * @param {string} ormType - Tipo de ORM (opcional, se detecta si no se especifica)
 * @returns {Object} Entidad parseada
 */
function parseSchema(code, ormType = null) {
  // Detectar tipo de ORM si no se especifica
  if (!ormType) {
    if (code.includes('mongoose') || code.includes('new Schema(')) {
      ormType = 'mongoose';
    } else if (code.includes('prisma') || code.includes('model ')) {
      ormType = 'prisma';
    } else if (code.includes('sequelize') || code.includes('DataTypes')) {
      ormType = 'sequelize';
    } else if (code.includes('@Entity') || code.includes('typeorm')) {
      ormType = 'typeorm';
    } else {
      // Default a mongoose
      ormType = 'mongoose';
    }
  }
  
  switch (ormType.toLowerCase()) {
    case 'mongoose':
      return parseMongooseSchema(code);
    case 'prisma':
      // TODO: Implementar parser de Prisma
      console.warn('⚠️ [PARSER] Prisma parser not yet implemented, using basic parse');
      return parsePrismaSchema(code);
    case 'sequelize':
      // TODO: Implementar parser de Sequelize
      console.warn('⚠️ [PARSER] Sequelize parser not yet implemented');
      return { entity: 'Unknown', fields: [], source_type: 'sequelize' };
    case 'typeorm':
      // TODO: Implementar parser de TypeORM
      console.warn('⚠️ [PARSER] TypeORM parser not yet implemented');
      return { entity: 'Unknown', fields: [], source_type: 'typeorm' };
    default:
      return parseMongooseSchema(code);
  }
}

/**
 * Parser básico para Prisma (simplificado)
 * @param {string} code - Código Prisma
 * @returns {Object} Entidad parseada
 */
function parsePrismaSchema(code) {
  const entity = {
    entity: 'Unknown',
    fields: [],
    indexes: [],
    relationships: [],
    timestamps: { enabled: false },
    source_type: 'prisma'
  };
  
  // Extraer nombre del modelo
  const modelMatch = code.match(/model\s+(\w+)\s*{/);
  if (modelMatch) {
    entity.entity = modelMatch[1];
  }
  
  // Extraer campos
  const fieldPattern = /^\s+(\w+)\s+(\w+)(\[\])?\s*(@[^\n]+)?/gm;
  let match;
  
  while ((match = fieldPattern.exec(code)) !== null) {
    const field = {
      name: match[1],
      type: match[2],
      required: !match[4]?.includes('?'),
      is_array: !!match[3]
    };
    
    if (field.is_array) {
      field.type = 'Array';
      field.array_type = match[2];
    }
    
    // Detectar relaciones
    if (match[4]?.includes('@relation')) {
      field.is_foreign_key = true;
      const refMatch = match[4].match(/references:\s*\[(\w+)\]/);
      if (refMatch) {
        field.reference = match[2]; // El tipo es la entidad referenciada
      }
    }
    
    entity.fields.push(field);
  }
  
  return entity;
}

/**
 * Valida el código antes de parsearlo
 * @param {string} code - Código a validar
 * @returns {Object} Resultado de validación
 */
function validateCode(code) {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'El código es requerido y debe ser un string' };
  }
  
  if (code.trim().length < 20) {
    return { valid: false, error: 'El código es demasiado corto para ser un schema válido' };
  }
  
  // Verificar que parece ser código de schema
  const hasSchemaPattern = 
    code.includes('Schema') || 
    code.includes('model ') || 
    code.includes('DataTypes') ||
    code.includes('@Entity');
  
  if (!hasSchemaPattern) {
    return { 
      valid: false, 
      error: 'El código no parece ser un schema válido. Asegúrate de incluir la definición del modelo.' 
    };
  }
  
  return { valid: true };
}

module.exports = {
  parseSchema,
  parseMongooseSchema,
  parsePrismaSchema,
  validateCode,
  normalizeType,
  parseField,
  parseNestedFields,
  extractIndexes,
  detectTimestamps,
  extractModelName,
  extractCollectionName
};
