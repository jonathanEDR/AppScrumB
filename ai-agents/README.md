# 🤖 AI Agents Module - AppScrum Backend

## 📋 Descripción

Módulo completamente independiente que implementa un sistema de **Agentes AI autónomos** para ayudar a gestionar proyectos Scrum de manera efectiva.

## 🎯 Características Principales

- **Sistema de Delegación de Permisos**: Los usuarios delegan permisos específicos a los agentes
- **Ejecución de Acciones Reales**: Los agentes pueden crear, modificar y gestionar elementos del sistema
- **Auditoría Completa**: Registro detallado de todas las acciones ejecutadas por agentes
- **Multi-Provider**: Soporte para OpenAI, Anthropic (Claude), Google (Gemini)
- **Rate Limiting**: Control de costos y uso mediante límites configurables
- **Orquestador Inteligente**: Sistema que coordina múltiples agentes según la tarea

## 🏗️ Arquitectura

```
ai-agents/
├── config/           # Configuración de AI providers
├── models/           # Modelos de datos (Agent, AgentSession, etc.)
├── services/         # Lógica de negocio
│   ├── agents/       # Implementación de agentes específicos
│   ├── AIProviderService.js
│   └── AgentPermissionService.js
├── middleware/       # Autenticación y validación
├── routes/           # API endpoints
├── prompts/          # Templates de prompts por agente
└── utils/            # Utilidades compartidas
```

## 🚀 Instalación

### 1. Instalar dependencias

```bash
npm install openai @anthropic-ai/sdk @google/generative-ai
```

### 2. Configurar variables de entorno

Copia `.env.example` a `.env` y configura al menos un proveedor de AI:

```env
# OpenAI (Recomendado para empezar)
OPENAI_API_KEY=sk-...

# Opcional: Otros providers
ANTHROPIC_API_KEY=...
GOOGLE_AI_API_KEY=...
```

### 3. Inicializar agentes del sistema

```bash
npm run init:agents
```

Este script creará el agente Product Owner AI por defecto.

## 📚 Uso Básico

### 1. Listar Agentes Disponibles

```bash
GET /api/ai-agents/agents
Authorization: Bearer <clerk_token>
```

### 2. Delegar Permisos a un Agente

```bash
POST /api/ai-agents/delegate
Authorization: Bearer <clerk_token>
Content-Type: application/json

{
  "agent_id": "...",
  "permissions": [
    "canCreateBacklogItems",
    "canEditBacklogItems",
    "canPrioritizeBacklog"
  ],
  "scope": {
    "all_products": true,
    "max_actions_per_hour": 50,
    "max_cost_per_day": 5
  }
}
```

### 3. Ver Mis Delegaciones

```bash
GET /api/ai-agents/my-delegations
Authorization: Bearer <clerk_token>
```

### 4. Revocar una Delegación

```bash
DELETE /api/ai-agents/delegate/:delegation_id
Authorization: Bearer <clerk_token>
```

## 🤖 Agentes Disponibles

### Product Owner AI

**Tipo:** `product_owner`  
**Capacidades:**
- ✅ Crear y refinar historias de usuario
- ✅ Generar criterios de aceptación
- ✅ Priorizar backlog
- ✅ Analizar valor de negocio
- ✅ Sugerir objetivos de sprint
- ✅ Generar reportes para stakeholders

**Endpoints:**
```
POST /api/ai-agents/product-owner/create-story
POST /api/ai-agents/product-owner/prioritize
POST /api/ai-agents/product-owner/analyze-backlog
```

### Scrum Master AI (Próximamente)

**Tipo:** `scrum_master`  
**Capacidades:**
- Facilitar ceremonias
- Identificar impedimentos
- Sugerir mejoras de proceso
- Analizar métricas de equipo

### Developer AI (Próximamente)

**Tipo:** `developer`  
**Capacidades:**
- Asistencia técnica
- Generación de subtareas
- Estimación de esfuerzo
- Sugerencias de implementación

## 🔒 Seguridad y Permisos

### Sistema de Delegación

1. **Usuario autentica** con Clerk
2. **Usuario delega permisos** específicos al agente
3. **Agente ejecuta acciones** EN NOMBRE del usuario
4. **Sistema registra** todas las acciones en auditoría

### Permisos Disponibles

| Permiso | Descripción |
|---------|-------------|
| `canCreateBacklogItems` | Crear items en el backlog |
| `canEditBacklogItems` | Editar items existentes |
| `canDeleteBacklogItems` | Eliminar items |
| `canPrioritizeBacklog` | Cambiar orden de prioridades |
| `canCreateSprints` | Crear nuevos sprints |
| `canEditSprints` | Modificar sprints |
| `canViewMetrics` | Ver métricas y reportes |

### Limitaciones Configurables

```javascript
{
  max_actions_per_hour: 50,
  max_actions_per_day: 200,
  max_cost_per_day: 5,  // USD
  can_create: true,
  can_edit: true,
  can_delete: false,
  requires_approval: false
}
```

## 📊 Auditoría

Todas las acciones ejecutadas por agentes quedan registradas en `AgentAction`:

```javascript
{
  agent_id: ObjectId,
  user_id: ObjectId,
  action_type: 'create_backlog_item',
  input: { user_prompt: "...", context: {...} },
  ai_response: { parsed_response: {...}, reasoning: "..." },
  result: {
    status: 'success',
    items_affected: [{ collection: 'BacklogItem', item_id: ... }]
  },
  metrics: {
    tokens_used: { total_tokens: 1500 },
    cost: 0.03,
    execution_time_ms: 2340
  }
}
```

### Ver Mis Acciones

```bash
GET /api/ai-agents/actions/my-actions
Authorization: Bearer <clerk_token>
```

### Ver Métricas de Uso

```bash
GET /api/ai-agents/metrics/my-usage?period=30d
Authorization: Bearer <clerk_token>
```

## 💰 Costos Estimados

### Uso Moderado (50 acciones/día)

| Provider | Modelo | Costo/día | Costo/mes |
|----------|--------|-----------|-----------|
| OpenAI | GPT-4 Turbo | $2-5 | $60-150 |
| OpenAI | GPT-4o | $1-3 | $30-90 |
| OpenAI | GPT-3.5 Turbo | $0.50-1 | $15-30 |
| Anthropic | Claude 3.5 Sonnet | $1.50-4 | $45-120 |
| Google | Gemini 1.5 Flash | $0.10-0.50 | $3-15 |

**Recomendación inicial:** Gemini 1.5 Flash o GPT-4o para balance costo/calidad.

## 🛠️ Desarrollo

### Agregar un Nuevo Agente

1. Crear implementación en `services/agents/`:

```javascript
// services/agents/ScrumMasterAgent.js
class ScrumMasterAgent {
  async facilitatePlanning(sprintId, context) {
    // Implementación
  }
}
```

2. Registrar en la base de datos:

```javascript
const agent = new Agent({
  name: 'scrum-master-ai',
  display_name: 'Scrum Master AI',
  type: 'scrum_master',
  description: '...',
  system_prompt: '...',
  capabilities: [...]
});
```

3. Crear endpoints en `routes/`:

```javascript
router.post('/scrum-master/facilitate-planning', 
  agentFullAuth('plan_sprint'),
  async (req, res) => { ... }
);
```

### Testing

```bash
npm test -- ai-agents
```

## 🐛 Troubleshooting

### Error: "No hay ningún proveedor de AI configurado"

**Solución:** Configura al menos `OPENAI_API_KEY` en tu `.env`:
```env
OPENAI_API_KEY=sk-...
```

### Error: "No hay una delegación activa"

**Solución:** Debes delegar permisos primero:
```bash
POST /api/ai-agents/delegate
```

### Error: "Límite de acciones alcanzado"

**Solución:** Ajusta los límites en tu delegación o espera a que se reseteen (por hora/día).

## 📝 Próximas Funcionalidades

- [ ] Streaming de respuestas para UX mejorada
- [ ] Fine-tuning de modelos con datos históricos
- [ ] Sistema de aprobación para acciones críticas
- [ ] Dashboard de métricas y costos
- [ ] Integración con Slack/Teams para notificaciones
- [ ] RAG (Retrieval Augmented Generation) con vectores
- [ ] Agentes colaborativos (múltiples agentes trabajando juntos)

## 🤝 Contribución

Este módulo es parte del proyecto AppScrum. Para contribuir:

1. Crea un branch desde `main`
2. Implementa tu feature
3. Asegúrate de que los tests pasen
4. Crea un Pull Request

## 📄 Licencia

MIT License - Ver LICENSE en la raíz del proyecto
