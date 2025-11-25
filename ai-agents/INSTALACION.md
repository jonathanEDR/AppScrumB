# 🚀 Instalación y Setup - Sistema AI Agents

## Requisitos Previos

- Node.js 18+ 
- MongoDB 6+
- Redis 6+ (opcional, pero recomendado para production)
- OpenAI API Key (personal account)
- Clerk account configurado

---

## 1. Instalación de Dependencias

```bash
npm install
```

**Paquetes instalados para AI Agents:**
- `openai` - Cliente oficial de OpenAI
- `node-cache` - Cache en memoria para contexto
- `express-rate-limit` - Rate limiting
- `rate-limit-mongo` - Store de rate limits en MongoDB
- `bull` - Sistema de colas con Redis

---

## 2. Configuración de Variables de Entorno

Copia el archivo `.env.example` a `.env` y configura:

```bash
# MongoDB
MONGODB_URI=mongodb://localhost:27017/AppScrum

# Puerto del servidor
PORT=5000

# Clerk Authentication
CLERK_SECRET_KEY=sk_test_YOUR_CLERK_SECRET

# OpenAI (API Key Personal - NO organización)
OPENAI_API_KEY=sk-svcacct-YOUR_OPENAI_API_KEY

# Redis (opcional - para queue system y rate limiting)
# Si no se configura, usará localhost por defecto
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=your_redis_password (si aplica)

# Cloudinary (para imágenes)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Cómo obtener las credenciales:

#### OpenAI API Key
1. Ve a https://platform.openai.com/api-keys
2. Crea un nuevo **Service Account key** (prefijo `sk-svcacct-`)
3. **NO uses** organization key
4. Copia la key completa (391 caracteres)

#### Clerk Secret Key
1. Ve a tu dashboard de Clerk
2. Busca **API Keys** en configuración
3. Copia el **Secret Key** (comienza con `sk_test_`)

---

## 3. Instalación de Redis (Opcional pero Recomendado)

### Windows:
```powershell
# Usando Chocolatey
choco install redis-64

# O descarga desde:
# https://github.com/microsoftarchive/redis/releases
```

### Linux/Mac:
```bash
# Ubuntu/Debian
sudo apt-get install redis-server

# MacOS
brew install redis

# Iniciar Redis
redis-server
```

### Alternativa: Redis Cloud (Gratis)
Si no quieres instalar Redis localmente:
1. Ve a https://redis.com/try-free/
2. Crea cuenta gratuita
3. Obtén tu connection string
4. Configura en `.env`: `REDIS_URL=redis://...`

---

## 4. Setup Inicial de la Base de Datos

```bash
# Asegúrate que MongoDB esté corriendo
# Windows: mongod debería estar en servicios
# Linux/Mac: sudo systemctl start mongodb

# Crear agente inicial y delegación
node scripts/createTestDelegation.js
```

Esto creará:
- ✅ Agente `product-owner-ai` en la BD
- ✅ Delegación con permisos para tu usuario
- ✅ Colecciones necesarias

---

## 5. Verificación de Instalación

### Test 1: Health Check
```bash
curl http://localhost:5000/api/ai-agents/orchestrator/health
```

Debería retornar:
```json
{
  "status": "healthy",
  "components": ["intent_classification", "context_building", "agent_selection", "task_execution"],
  "phase": "FASE 3 - Production Ready"
}
```

### Test 2: Test con OpenAI Real
```bash
node scripts/testOrchestratorWithAI.js
```

Debería:
1. ✅ Clasificar intent correctamente
2. ✅ Seleccionar agente ProductOwner
3. ✅ Construir contexto con cache
4. ✅ Llamar a OpenAI GPT-4
5. ✅ Crear 2 historias en MongoDB
6. ✅ Mostrar costos y tokens

**Output esperado:**
```
✅ PASO 1: Intent clasificado (create_user_story)
✅ PASO 2: Agente seleccionado (product-owner-ai)
✅ PASO 3: Contexto construido
✅ PASO 4: Agente ejecutado
✅ Tokens usados: ~1,400 tokens
✅ Costo estimado: $0.028
```

### Test 3: Verificar Cache
```bash
# Primera ejecución (cache MISS)
node scripts/testOrchestratorWithAI.js

# Segunda ejecución (cache HIT - menos tokens)
node scripts/testOrchestratorWithAI.js
```

Deberías ver en logs:
```
Primera: 🔍 [Cache MISS] Product context
Segunda: 📦 [Cache HIT] Product context
```

---

## 6. Estructura de Archivos Generada

Después de la instalación, tendrás:

```
backend/
├── ai-agents/
│   ├── models/
│   │   ├── Agent.js
│   │   ├── AgentDelegation.js
│   │   ├── AgentAction.js
│   │   └── AgentSession.js
│   ├── services/
│   │   ├── IntentClassifier.js
│   │   ├── ContextBuilder.js
│   │   ├── ContextCache.js ✅ NEW
│   │   ├── AgentSelector.js
│   │   ├── OrchestratorService.js
│   │   ├── QueueService.js ✅ NEW
│   │   └── agents/
│   │       └── ProductOwnerAgent.js
│   └── routes/
│       ├── agents.js
│       └── orchestrator.js
├── middleware/
│   ├── authenticate.js
│   └── aiRateLimiter.js ✅ NEW
├── scripts/
│   ├── createTestDelegation.js
│   └── testOrchestratorWithAI.js
└── .env
```

---

## 7. Troubleshooting

### Error: OpenAI API 401 Unauthorized
- ✅ Verifica que `OPENAI_API_KEY` esté completa (391 chars)
- ✅ NO uses organization key
- ✅ Usa Service Account key (prefijo `sk-svcacct-`)

### Error: MongoDB connection failed
```bash
# Verificar que MongoDB esté corriendo
mongo --eval "db.adminCommand('ping')"

# O si usas mongosh:
mongosh --eval "db.adminCommand('ping')"
```

### Error: Redis connection failed
```bash
# Verificar que Redis esté corriendo
redis-cli ping
# Debería retornar: PONG

# Si no tienes Redis, el sistema funcionará pero sin:
# - Queue system (solo ejecución síncrona)
# - Rate limiting persistente (usará memoria)
```

### Error: Rate limit exceeded inmediatamente
- El rate limiter detecta que eres el mismo usuario por IP
- Solución: Espera 1 hora o borra la colección:
```javascript
db.ai_rate_limits.deleteMany({})
db.ai_daily_rate_limits.deleteMany({})
```

---

## 8. Endpoints Disponibles

### Ejecución
- `POST /api/ai-agents/orchestrator/execute` - Síncrona
- `POST /api/ai-agents/orchestrator/execute-async` - Asíncrona
- `POST /api/ai-agents/orchestrator/chat` - Conversación

### Queue Management
- `GET /api/ai-agents/orchestrator/status/:job_id` - Estado de tarea
- `DELETE /api/ai-agents/orchestrator/tasks/:job_id` - Cancelar tarea
- `GET /api/ai-agents/orchestrator/queue/stats` - Estadísticas de cola

### Cache Management
- `GET /api/ai-agents/orchestrator/cache/stats` - Estadísticas de cache
- `POST /api/ai-agents/orchestrator/cache/invalidate` - Invalidar cache

### Monitoring
- `GET /api/ai-agents/orchestrator/health` - Health check

---

## 9. Configuración para Production

### Variables de entorno adicionales:
```bash
NODE_ENV=production

# Rate limiting más estricto (opcional)
AI_RATE_LIMIT_HOURLY=5  # default: 10
AI_RATE_LIMIT_DAILY=25   # default: 50

# Cache TTL (opcional)
CACHE_TTL_SECONDS=300    # default: 300 (5 minutos)
```

### Recomendaciones:
1. ✅ Usa Redis en producción (no solo localhost)
2. ✅ Configura backups de MongoDB
3. ✅ Monitorea costos de OpenAI
4. ✅ Configura alertas de rate limiting
5. ✅ Usa HTTPS en todos los endpoints

---

## 10. Siguiente Paso: Integración Frontend

El backend está listo. Para integrar desde el frontend:

```javascript
// React/Next.js example
const createStories = async (input, productId) => {
  const response = await fetch('http://localhost:5000/api/ai-agents/orchestrator/execute', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${clerkToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: input,
      context: { product_id: productId }
    })
  });

  const result = await response.json();
  
  if (result.status === 'success') {
    console.log('Historias creadas:', result.result.stories);
  }
};

// Uso
createStories("Crear 3 historias para módulo de reportes", "688e4f88e8620a705fbebd6a");
```

---

## 📞 Soporte

Si encuentras problemas:
1. Revisa los logs del servidor: `npm start`
2. Verifica health check: `/api/ai-agents/orchestrator/health`
3. Consulta cache stats: `/api/ai-agents/orchestrator/cache/stats`
4. Revisa queue stats: `/api/ai-agents/orchestrator/queue/stats`

---

**🎉 ¡Sistema listo para usar!**

El sistema AI Agents está completamente configurado y production-ready. Ahora puedes integrar desde el frontend usando los endpoints documentados.
