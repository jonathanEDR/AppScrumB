/**
 * AIProviderService - Servicio para comunicación con APIs de AI
 * Implementa patrón Strategy para soportar múltiples proveedores
 */

const {
  AI_PROVIDERS,
  getProviderConfig,
  validateProviderConfig,
  calculateCost,
  getModelInfo
} = require('../config/aiProviders');

class AIProviderService {
  constructor() {
    this.providers = {};
    this.initializeProviders();
  }

  /**
   * Inicializar providers disponibles
   */
  initializeProviders() {
    // Solo inicializar providers que tengan API key configurada
    try {
      if (process.env.OPENAI_API_KEY) {
        this.providers[AI_PROVIDERS.OPENAI] = this.createOpenAIProvider();
      }
    } catch (error) {
      console.warn('OpenAI provider no disponible:', error.message);
    }

    try {
      if (process.env.ANTHROPIC_API_KEY) {
        this.providers[AI_PROVIDERS.ANTHROPIC] = this.createAnthropicProvider();
      }
    } catch (error) {
      console.warn('Anthropic provider no disponible:', error.message);
    }

    try {
      if (process.env.GOOGLE_AI_API_KEY) {
        this.providers[AI_PROVIDERS.GOOGLE] = this.createGoogleProvider();
      }
    } catch (error) {
      console.warn('Google AI provider no disponible:', error.message);
    }

    if (Object.keys(this.providers).length === 0) {
      throw new Error('No hay ningún proveedor de AI configurado. Verifica tu archivo .env');
    }
  }

  /**
   * Crear provider de OpenAI
   */
  createOpenAIProvider() {
    const config = getProviderConfig(AI_PROVIDERS.OPENAI);
    
    return {
      name: AI_PROVIDERS.OPENAI,
      
      async sendPrompt(params) {
        const {
          model = 'gpt-4-turbo',
          messages,
          temperature = 0.7,
          max_tokens = 4096,
          top_p = 1,
          frequency_penalty = 0,
          presence_penalty = 0,
          response_format = null,
          tools = null,
          tool_choice = null
        } = params;

        try {
          // Importar OpenAI SDK (lazy loading)
          const OpenAI = require('openai');
          const openai = new OpenAI({
            apiKey: config.apiKey,
            organization: config.organization,
            baseURL: config.baseURL
          });

          const requestBody = {
            model,
            messages,
            temperature,
            max_tokens,
            top_p,
            frequency_penalty,
            presence_penalty
          };

          if (response_format) {
            requestBody.response_format = response_format;
          }

          if (tools && tools.length > 0) {
            requestBody.tools = tools;
            if (tool_choice) {
              requestBody.tool_choice = tool_choice;
            }
          }

          const startTime = Date.now();
          const response = await openai.chat.completions.create(requestBody);
          const endTime = Date.now();

          return {
            success: true,
            response: response.choices[0].message.content,
            full_response: response,
            usage: {
              prompt_tokens: response.usage.prompt_tokens,
              completion_tokens: response.usage.completion_tokens,
              total_tokens: response.usage.total_tokens
            },
            cost: calculateCost(
              AI_PROVIDERS.OPENAI,
              model,
              response.usage.prompt_tokens,
              response.usage.completion_tokens
            ),
            response_time_ms: endTime - startTime,
            model: response.model,
            finish_reason: response.choices[0].finish_reason
          };
        } catch (error) {
          console.error('Error en OpenAI provider:', error);
          throw new Error(`OpenAI Error: ${error.message}`);
        }
      },

      async streamPrompt(params) {
        // TODO: Implementar streaming
        throw new Error('Streaming no implementado aún para OpenAI');
      }
    };
  }

  /**
   * Crear provider de Anthropic (Claude)
   */
  createAnthropicProvider() {
    const config = getProviderConfig(AI_PROVIDERS.ANTHROPIC);
    
    return {
      name: AI_PROVIDERS.ANTHROPIC,
      
      async sendPrompt(params) {
        const {
          model = 'claude-3-5-sonnet-20241022',
          messages,
          temperature = 0.7,
          max_tokens = 4096,
          system = null
        } = params;

        try {
          // Importar Anthropic SDK (lazy loading)
          const Anthropic = require('@anthropic-ai/sdk');
          const anthropic = new Anthropic({
            apiKey: config.apiKey
          });

          // Anthropic requiere system prompt separado
          const requestBody = {
            model,
            messages,
            temperature,
            max_tokens
          };

          if (system) {
            requestBody.system = system;
          }

          const startTime = Date.now();
          const response = await anthropic.messages.create(requestBody);
          const endTime = Date.now();

          const content = response.content[0].text;

          return {
            success: true,
            response: content,
            full_response: response,
            usage: {
              prompt_tokens: response.usage.input_tokens,
              completion_tokens: response.usage.output_tokens,
              total_tokens: response.usage.input_tokens + response.usage.output_tokens
            },
            cost: calculateCost(
              AI_PROVIDERS.ANTHROPIC,
              model,
              response.usage.input_tokens,
              response.usage.output_tokens
            ),
            response_time_ms: endTime - startTime,
            model: response.model,
            finish_reason: response.stop_reason
          };
        } catch (error) {
          console.error('Error en Anthropic provider:', error);
          throw new Error(`Anthropic Error: ${error.message}`);
        }
      },

      async streamPrompt(params) {
        // TODO: Implementar streaming
        throw new Error('Streaming no implementado aún para Anthropic');
      }
    };
  }

  /**
   * Crear provider de Google (Gemini)
   */
  createGoogleProvider() {
    const config = getProviderConfig(AI_PROVIDERS.GOOGLE);
    
    return {
      name: AI_PROVIDERS.GOOGLE,
      
      async sendPrompt(params) {
        const {
          model = 'gemini-1.5-pro',
          messages,
          temperature = 0.7,
          max_tokens = 8192
        } = params;

        try {
          // Importar Google Generative AI SDK (lazy loading)
          const { GoogleGenerativeAI } = require('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(config.apiKey);

          // Convertir mensajes de formato OpenAI a formato Gemini
          const geminiMessages = this.convertMessagesToGemini(messages);

          const geminiModel = genAI.getGenerativeModel({ 
            model,
            generationConfig: {
              temperature,
              maxOutputTokens: max_tokens
            }
          });

          const startTime = Date.now();
          const result = await geminiModel.generateContent(geminiMessages);
          const endTime = Date.now();

          const response = result.response;
          const content = response.text();

          // Gemini no siempre devuelve usage metrics precisos
          const estimatedPromptTokens = Math.ceil(JSON.stringify(messages).length / 4);
          const estimatedCompletionTokens = Math.ceil(content.length / 4);

          return {
            success: true,
            response: content,
            full_response: response,
            usage: {
              prompt_tokens: estimatedPromptTokens,
              completion_tokens: estimatedCompletionTokens,
              total_tokens: estimatedPromptTokens + estimatedCompletionTokens
            },
            cost: calculateCost(
              AI_PROVIDERS.GOOGLE,
              model,
              estimatedPromptTokens,
              estimatedCompletionTokens
            ),
            response_time_ms: endTime - startTime,
            model: model,
            finish_reason: response.candidates?.[0]?.finishReason || 'stop'
          };
        } catch (error) {
          console.error('Error en Google AI provider:', error);
          throw new Error(`Google AI Error: ${error.message}`);
        }
      },

      async streamPrompt(params) {
        // TODO: Implementar streaming
        throw new Error('Streaming no implementado aún para Google AI');
      }
    };
  }

  /**
   * Convertir mensajes de formato OpenAI a formato Gemini
   */
  convertMessagesToGemini(messages) {
    // Gemini usa un formato diferente
    // Necesitamos extraer el system prompt y crear un prompt único
    let systemPrompt = '';
    const conversationParts = [];

    messages.forEach(msg => {
      if (msg.role === 'system') {
        systemPrompt += msg.content + '\n\n';
      } else if (msg.role === 'user') {
        conversationParts.push({
          role: 'user',
          parts: [{ text: msg.content }]
        });
      } else if (msg.role === 'assistant') {
        conversationParts.push({
          role: 'model',
          parts: [{ text: msg.content }]
        });
      }
    });

    // Combinar system prompt con el primer mensaje del usuario
    if (systemPrompt && conversationParts.length > 0) {
      conversationParts[0].parts[0].text = systemPrompt + conversationParts[0].parts[0].text;
    }

    return conversationParts;
  }

  /**
   * Enviar prompt a un provider específico
   */
  async sendPrompt(provider, params) {
    const providerInstance = this.providers[provider];
    
    if (!providerInstance) {
      throw new Error(`Provider ${provider} no está disponible o configurado`);
    }

    return await providerInstance.sendPrompt(params);
  }

  /**
   * Enviar prompt con auto-selección de provider
   */
  async sendPromptAuto(params) {
    const { provider = null, ...restParams } = params;

    // Si se especifica provider, usarlo
    if (provider && this.providers[provider]) {
      return await this.sendPrompt(provider, restParams);
    }

    // Si no, usar el primero disponible (prioridad: OpenAI > Anthropic > Google)
    const priorityOrder = [
      AI_PROVIDERS.OPENAI,
      AI_PROVIDERS.ANTHROPIC,
      AI_PROVIDERS.GOOGLE
    ];

    for (const prov of priorityOrder) {
      if (this.providers[prov]) {
        console.log(`Auto-seleccionado provider: ${prov}`);
        return await this.sendPrompt(prov, restParams);
      }
    }

    throw new Error('No hay providers disponibles');
  }

  /**
   * Obtener lista de providers disponibles
   */
  getAvailableProviders() {
    return Object.keys(this.providers);
  }

  /**
   * Verificar si un provider está disponible
   */
  isProviderAvailable(provider) {
    return !!this.providers[provider];
  }

  /**
   * Contar tokens aproximadamente (sin llamar a la API)
   */
  estimateTokens(text) {
    // Aproximación simple: ~4 caracteres = 1 token
    return Math.ceil(text.length / 4);
  }

  /**
   * Contar tokens de un array de mensajes
   */
  estimateMessagesTokens(messages) {
    let total = 0;
    messages.forEach(msg => {
      total += this.estimateTokens(msg.content);
      total += 4; // Overhead por mensaje
    });
    return total;
  }
}

// Singleton instance
let instance = null;

module.exports = {
  AIProviderService,
  getInstance: () => {
    if (!instance) {
      instance = new AIProviderService();
    }
    return instance;
  }
};
