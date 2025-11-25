/**
 * Configuración de proveedores de AI
 * Centraliza la configuración para OpenAI, Anthropic, Google, etc.
 */

const AI_PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
  COHERE: 'cohere',
  CUSTOM: 'custom'
};

// Modelos disponibles por proveedor
const AI_MODELS = {
  openai: {
    'gpt-4-turbo': {
      name: 'GPT-4 Turbo',
      context_window: 128000,
      max_output_tokens: 4096,
      pricing: {
        prompt: 0.01 / 1000,      // $0.01 per 1K tokens
        completion: 0.03 / 1000    // $0.03 per 1K tokens
      },
      capabilities: ['text', 'function_calling', 'json_mode'],
      recommended_for: ['complex_analysis', 'code_generation', 'structured_output']
    },
    'gpt-4': {
      name: 'GPT-4',
      context_window: 8192,
      max_output_tokens: 4096,
      pricing: {
        prompt: 0.03 / 1000,
        completion: 0.06 / 1000
      },
      capabilities: ['text', 'function_calling'],
      recommended_for: ['high_accuracy', 'complex_reasoning']
    },
    'gpt-4o': {
      name: 'GPT-4o',
      context_window: 128000,
      max_output_tokens: 4096,
      pricing: {
        prompt: 0.005 / 1000,
        completion: 0.015 / 1000
      },
      capabilities: ['text', 'vision', 'function_calling', 'json_mode'],
      recommended_for: ['multimodal', 'fast_response', 'cost_effective']
    },
    'gpt-3.5-turbo': {
      name: 'GPT-3.5 Turbo',
      context_window: 16385,
      max_output_tokens: 4096,
      pricing: {
        prompt: 0.0005 / 1000,
        completion: 0.0015 / 1000
      },
      capabilities: ['text', 'function_calling', 'json_mode'],
      recommended_for: ['fast_response', 'low_cost', 'simple_tasks']
    }
  },
  anthropic: {
    'claude-3-5-sonnet-20241022': {
      name: 'Claude 3.5 Sonnet',
      context_window: 200000,
      max_output_tokens: 8192,
      pricing: {
        prompt: 0.003 / 1000,
        completion: 0.015 / 1000
      },
      capabilities: ['text', 'vision', 'tool_use', 'json_mode'],
      recommended_for: ['long_context', 'analysis', 'writing']
    },
    'claude-3-opus-20240229': {
      name: 'Claude 3 Opus',
      context_window: 200000,
      max_output_tokens: 4096,
      pricing: {
        prompt: 0.015 / 1000,
        completion: 0.075 / 1000
      },
      capabilities: ['text', 'vision', 'tool_use'],
      recommended_for: ['complex_tasks', 'high_accuracy']
    },
    'claude-3-haiku-20240307': {
      name: 'Claude 3 Haiku',
      context_window: 200000,
      max_output_tokens: 4096,
      pricing: {
        prompt: 0.00025 / 1000,
        completion: 0.00125 / 1000
      },
      capabilities: ['text', 'vision', 'tool_use'],
      recommended_for: ['fast_response', 'low_cost', 'high_volume']
    }
  },
  google: {
    'gemini-1.5-pro': {
      name: 'Gemini 1.5 Pro',
      context_window: 1000000,
      max_output_tokens: 8192,
      pricing: {
        prompt: 0.00125 / 1000,
        completion: 0.005 / 1000
      },
      capabilities: ['text', 'vision', 'audio', 'video', 'function_calling'],
      recommended_for: ['very_long_context', 'multimodal', 'cost_effective']
    },
    'gemini-1.5-flash': {
      name: 'Gemini 1.5 Flash',
      context_window: 1000000,
      max_output_tokens: 8192,
      pricing: {
        prompt: 0.000075 / 1000,
        completion: 0.0003 / 1000
      },
      capabilities: ['text', 'vision', 'audio', 'video', 'function_calling'],
      recommended_for: ['very_fast_response', 'very_low_cost', 'high_volume']
    }
  }
};

// Configuración por defecto según el tipo de agente
const DEFAULT_CONFIGS = {
  product_owner: {
    provider: AI_PROVIDERS.OPENAI,
    model: 'gpt-4-turbo',
    temperature: 0.7,
    max_tokens: 4096,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0
  },
  scrum_master: {
    provider: AI_PROVIDERS.OPENAI,
    model: 'gpt-4-turbo',
    temperature: 0.6,
    max_tokens: 4096
  },
  developer: {
    provider: AI_PROVIDERS.OPENAI,
    model: 'gpt-4o',
    temperature: 0.3,
    max_tokens: 4096
  },
  tester: {
    provider: AI_PROVIDERS.OPENAI,
    model: 'gpt-4-turbo',
    temperature: 0.5,
    max_tokens: 4096
  }
};

/**
 * Obtener configuración del proveedor desde variables de entorno
 */
function getProviderConfig(provider) {
  const configs = {
    [AI_PROVIDERS.OPENAI]: {
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORGANIZATION || null,
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    },
    [AI_PROVIDERS.ANTHROPIC]: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'
    },
    [AI_PROVIDERS.GOOGLE]: {
      apiKey: process.env.GOOGLE_AI_API_KEY,
      projectId: process.env.GOOGLE_PROJECT_ID || null
    },
    [AI_PROVIDERS.COHERE]: {
      apiKey: process.env.COHERE_API_KEY
    }
  };

  return configs[provider] || null;
}

/**
 * Validar que un proveedor está correctamente configurado
 */
function validateProviderConfig(provider) {
  const config = getProviderConfig(provider);
  
  if (!config) {
    throw new Error(`Proveedor no soportado: ${provider}`);
  }
  
  if (!config.apiKey) {
    throw new Error(`API Key no configurada para ${provider}. Verifica tu archivo .env`);
  }
  
  return true;
}

/**
 * Calcular costo de una operación
 */
function calculateCost(provider, model, promptTokens, completionTokens) {
  const modelConfig = AI_MODELS[provider]?.[model];
  
  if (!modelConfig || !modelConfig.pricing) {
    console.warn(`No se pudo calcular costo para ${provider}/${model}`);
    return 0;
  }
  
  const promptCost = promptTokens * modelConfig.pricing.prompt;
  const completionCost = completionTokens * modelConfig.pricing.completion;
  
  return promptCost + completionCost;
}

/**
 * Obtener información de un modelo
 */
function getModelInfo(provider, model) {
  return AI_MODELS[provider]?.[model] || null;
}

/**
 * Listar todos los modelos disponibles
 */
function listAvailableModels() {
  const models = [];
  
  for (const [provider, providerModels] of Object.entries(AI_MODELS)) {
    for (const [modelKey, modelInfo] of Object.entries(providerModels)) {
      models.push({
        provider,
        model: modelKey,
        name: modelInfo.name,
        context_window: modelInfo.context_window,
        capabilities: modelInfo.capabilities,
        recommended_for: modelInfo.recommended_for
      });
    }
  }
  
  return models;
}

/**
 * Recomendar modelo según requisitos
 */
function recommendModel(requirements = {}) {
  const {
    cost_priority = 'medium', // low, medium, high
    speed_priority = 'medium',
    quality_priority = 'high',
    context_size = 'medium', // small, medium, large, very_large
    capabilities = []
  } = requirements;
  
  // Lógica simple de recomendación
  if (cost_priority === 'low' && speed_priority === 'high') {
    return { provider: 'openai', model: 'gpt-3.5-turbo' };
  }
  
  if (context_size === 'very_large') {
    return { provider: 'google', model: 'gemini-1.5-flash' };
  }
  
  if (quality_priority === 'high') {
    return { provider: 'openai', model: 'gpt-4-turbo' };
  }
  
  // Default
  return { provider: 'openai', model: 'gpt-4o' };
}

/**
 * Verificar si un provider está disponible (tiene API key)
 */
function isProviderAvailable(provider) {
  try {
    validateProviderConfig(provider);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Obtener provider por defecto (el primero que esté configurado)
 */
function getDefaultProvider() {
  const providers = [
    AI_PROVIDERS.OPENAI,
    AI_PROVIDERS.ANTHROPIC,
    AI_PROVIDERS.GOOGLE,
    AI_PROVIDERS.COHERE
  ];
  
  for (const provider of providers) {
    if (isProviderAvailable(provider)) {
      return provider;
    }
  }
  
  throw new Error('No hay ningún proveedor de AI configurado. Revisa tu archivo .env');
}

module.exports = {
  AI_PROVIDERS,
  AI_MODELS,
  DEFAULT_CONFIGS,
  getProviderConfig,
  validateProviderConfig,
  calculateCost,
  getModelInfo,
  listAvailableModels,
  recommendModel,
  isProviderAvailable,
  getDefaultProvider
};
