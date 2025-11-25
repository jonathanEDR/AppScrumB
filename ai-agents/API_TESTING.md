# 🧪 PRUEBAS DE API - AI Agents System

## ✅ Estado Actual
- ✅ Servidor corriendo en puerto 5000
- ✅ MongoDB conectado
- ✅ Product Owner AI inicializado
- ✅ Módulo ai-agents cargado correctamente

## 📡 Endpoints Disponibles

### 1. Listar Agentes Disponibles
```bash
GET /api/ai-agents/agents
```
**Requiere:** Autenticación (Bearer token de Clerk)

**Respuesta esperada:**
```json
{
  "status": "success",
  "count": 1,
  "agents": [
    {
      "_id": "...",
      "name": "product-owner-ai",
      "display_name": "Product Owner AI",
      "type": "product_owner",
      "description": "Asistente AI especializado en gestión de producto...",
      "status": "active",
      "capabilities": [
        {
          "name": "create_user_stories",
          "description": "Crear historias de usuario...",
          "required_permissions": ["canCreateBacklogItems"]
        },
        // ... más capacidades
      ]
    }
  ]
}
```

### 2. Ver Detalles de un Agente
```bash
GET /api/ai-agents/agents/:id
```

### 3. Delegar Permisos a un Agente
```bash
POST /api/ai-agents/delegate
Content-Type: application/json
Authorization: Bearer YOUR_CLERK_TOKEN

{
  "agent_id": "product-owner-ai-id-here",
  "permissions": [
    "canViewBacklog",
    "canCreateBacklogItems",
    "canEditBacklogItems",
    "canPrioritizeBacklog"
  ],
  "scope": {
    "products": ["product-id-1", "product-id-2"],
    "all_products": false
  },
  "limitations": {
    "max_actions_per_hour": 50,
    "max_actions_per_day": 200,
    "max_cost_per_day": 5.00
  },
  "expires_at": "2025-12-31T23:59:59Z"
}
```

**Respuesta esperada:**
```json
{
  "status": "success",
  "delegation": {
    "_id": "...",
    "user_id": "...",
    "agent_id": "...",
    "status": "active",
    "delegated_permissions": [...],
    "created_at": "2025-11-24T...",
    "expires_at": "2025-12-31T23:59:59Z"
  }
}
```

### 4. Ver Mis Delegaciones
```bash
GET /api/ai-agents/my-delegations
Authorization: Bearer YOUR_CLERK_TOKEN
```

### 5. Ver Acciones Ejecutadas
```bash
GET /api/ai-agents/actions/my-actions?status=success&limit=20
Authorization: Bearer YOUR_CLERK_TOKEN
```

### 6. Ver Métricas de Uso
```bash
GET /api/ai-agents/metrics/my-usage
Authorization: Bearer YOUR_CLERK_TOKEN
```

**Respuesta esperada:**
```json
{
  "status": "success",
  "metrics": {
    "total_actions": 150,
    "success_rate": 95.5,
    "total_tokens": 45000,
    "total_cost": 1.23,
    "actions_by_type": {
      "create_backlog_item": 50,
      "prioritize_backlog": 30,
      "refine_user_story": 40,
      "analyze_backlog": 30
    },
    "usage_limits": {
      "current_hour_actions": 5,
      "current_day_actions": 45,
      "current_day_cost": 0.85,
      "limits": {
        "max_actions_per_hour": 50,
        "max_actions_per_day": 200,
        "max_cost_per_day": 5.00
      }
    }
  }
}
```

### 7. Suspender Delegación
```bash
PUT /api/ai-agents/delegate/:id/suspend
Authorization: Bearer YOUR_CLERK_TOKEN
```

### 8. Reactivar Delegación
```bash
PUT /api/ai-agents/delegate/:id/reactivate
Authorization: Bearer YOUR_CLERK_TOKEN
```

### 9. Revocar Delegación
```bash
DELETE /api/ai-agents/delegate/:id
Authorization: Bearer YOUR_CLERK_TOKEN
```

## 🔑 Obtener Token de Clerk

Para probar estos endpoints, necesitas un token de Clerk. Puedes obtenerlo de dos formas:

### Opción 1: Desde el Frontend
```javascript
// En tu aplicación React con Clerk
import { useAuth } from '@clerk/clerk-react';

const { getToken } = useAuth();
const token = await getToken();
```

### Opción 2: Usando el Dashboard de Clerk
1. Ve a [Clerk Dashboard](https://dashboard.clerk.com/)
2. Selecciona tu aplicación
3. Ve a "Users" → Selecciona un usuario
4. Copia el "Session Token"

## 🧪 Pruebas con Postman / Thunder Client

### Configuración Base
- **Base URL:** `http://localhost:5000/api/ai-agents`
- **Headers:**
  ```
  Authorization: Bearer YOUR_CLERK_TOKEN_HERE
  Content-Type: application/json
  ```

### Flujo de Prueba Recomendado

1. **Listar agentes disponibles**
   ```
   GET /agents
   ```

2. **Ver detalles del Product Owner AI**
   ```
   GET /agents/{agent_id}
   ```

3. **Delegar permisos al agente**
   ```
   POST /delegate
   Body: { agent_id, permissions, scope }
   ```

4. **Ver mis delegaciones activas**
   ```
   GET /my-delegations
   ```

5. **[FASE 3] Crear historia de usuario con el agente**
   ```
   POST /product-owner/create-story
   Body: { input: "...", product_id: "..." }
   ```

6. **Ver acciones ejecutadas**
   ```
   GET /actions/my-actions
   ```

7. **Ver métricas de uso**
   ```
   GET /metrics/my-usage
   ```

## 🚨 Códigos de Error Comunes

- **401 Unauthorized:** Token no proporcionado o inválido
- **403 Forbidden:** Usuario no tiene permisos necesarios
- **404 Not Found:** Agente no encontrado
- **400 Bad Request:** Datos inválidos en la petición
- **429 Too Many Requests:** Se excedieron los límites de rate limiting

## 📊 Validaciones de Seguridad

Cada petición pasa por estas validaciones:

1. ✅ **Autenticación:** Token de Clerk válido
2. ✅ **Rol del Usuario:** Debe ser product_owner o super_admin
3. ✅ **Delegación Activa:** Debe existir y estar activa
4. ✅ **Permisos Específicos:** Usuario debe haber delegado el permiso necesario
5. ✅ **Alcance (Scope):** Acción debe estar dentro de los productos permitidos
6. ✅ **Rate Limiting:** No exceder límites de acciones/hora, tokens/día, costo/día
7. ✅ **Auditoría:** Toda acción queda registrada en AgentAction

## 🎯 Próximos Pasos (FASE 2 y FASE 3)

- [ ] Implementar OrchestratorService
- [ ] Crear ProductOwnerAgent con capacidades reales
- [ ] Integrar con OpenAI/Anthropic/Google AI
- [ ] Implementar endpoints funcionales:
  - POST /product-owner/create-story
  - POST /product-owner/refine-story
  - POST /product-owner/prioritize-backlog
  - POST /product-owner/analyze-backlog
  - POST /product-owner/generate-criteria
  - POST /product-owner/suggest-sprint-goal

---

**Nota:** Este documento se actualizará conforme avancemos en las fases 2 y 3.
