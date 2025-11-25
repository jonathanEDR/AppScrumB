# 🚀 GUÍA RÁPIDA DE INICIO - AI Agents Module

## ✅ FASE 1 COMPLETADA

¡El módulo de AI Agents está completamente implementado y listo para usar!

---

## 📋 CHECKLIST PRE-INICIO

### 1. ✅ Verificar Dependencias Instaladas

Las siguientes dependencias ya fueron instaladas:
- `openai` (SDK de OpenAI)
- `@anthropic-ai/sdk` (SDK de Anthropic/Claude)
- `@google/generative-ai` (SDK de Google Gemini)

### 2. ⚙️ Configurar Variables de Entorno

**IMPORTANTE:** Necesitas al menos una API key de un proveedor de AI.

#### Opción A: OpenAI (Recomendado para empezar)

1. Ve a https://platform.openai.com/api-keys
2. Crea una API key
3. Agrega a tu `.env`:

```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx
```

#### Opción B: Anthropic (Claude)

1. Ve a https://console.anthropic.com/
2. Crea una API key
3. Agrega a tu `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
```

#### Opción C: Google AI (Gemini) - MÁS ECONÓMICO

1. Ve a https://makersuite.google.com/app/apikey
2. Crea una API key
3. Agrega a tu `.env`:

```env
GOOGLE_AI_API_KEY=AIzaxxxxxxxxxxxxxxxxx
```

---

## 🎬 PASOS PARA INICIAR

### Paso 1: Inicializar Agentes del Sistema

```bash
npm run init:agents
```

**Esto creará:**
- Agente "Product Owner AI" listo para usar
- Configuración base con capacidades predefinidas
- System prompt optimizado para gestión de backlog

**Output esperado:**
```
🚀 Iniciando creación de agentes del sistema...
📦 Conectando a MongoDB...
✅ Conectado a MongoDB
🤖 Creando/Actualizando Product Owner AI...
✅ Product Owner AI creado exitosamente
```

### Paso 2: Iniciar el Servidor

```bash
npm start
```

**Verifica que veas:**
```
✅ AppScrum Backend Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Status: Running
🌐 Port: 5000
🔗 MongoDB: connected
```

### Paso 3: Verificar que el Módulo Está Activo

Abre tu navegador o Postman y prueba:

```
GET http://localhost:5000/api/health
```

**Deberías ver:**
```json
{
  "status": "OK",
  "timestamp": "...",
  "mongodb": "connected"
}
```

---

## 🧪 PRUEBAS BÁSICAS CON POSTMAN/CURL

### 1. Autenticarse

Necesitas un token de Clerk. Si tienes el frontend corriendo, autentícate y copia el token.

Para las siguientes pruebas, reemplaza `<CLERK_TOKEN>` con tu token real.

### 2. Listar Agentes Disponibles

```bash
GET http://localhost:5000/api/ai-agents/agents
Authorization: Bearer <CLERK_TOKEN>
```

**Respuesta esperada:**
```json
{
  "status": "success",
  "agents": [
    {
      "_id": "...",
      "name": "product-owner-ai",
      "display_name": "Product Owner AI",
      "type": "product_owner",
      "description": "Agente AI especializado en gestión de producto...",
      "status": "active",
      "has_active_delegation": false
    }
  ],
  "total": 1
}
```

### 3. Ver Detalles del Agente

```bash
GET http://localhost:5000/api/ai-agents/agents/<AGENT_ID>
Authorization: Bearer <CLERK_TOKEN>
```

### 4. Delegar Permisos al Agente

**IMPORTANTE:** Solo usuarios con rol `product_owner` o `super_admin` pueden hacer esto.

```bash
POST http://localhost:5000/api/ai-agents/delegate
Authorization: Bearer <CLERK_TOKEN>
Content-Type: application/json

{
  "agent_id": "<AGENT_ID>",
  "permissions": [
    "canCreateBacklogItems",
    "canEditBacklogItems",
    "canPrioritizeBacklog",
    "canViewMetrics"
  ],
  "scope": {
    "all_products": true,
    "max_actions_per_hour": 50,
    "max_actions_per_day": 200,
    "max_cost_per_day": 5,
    "can_create": true,
    "can_edit": true,
    "can_delete": false
  }
}
```

**Respuesta esperada:**
```json
{
  "status": "success",
  "message": "Delegación creada exitosamente",
  "delegation": {
    "_id": "...",
    "user_id": "...",
    "agent_id": "...",
    "delegated_permissions": [...],
    "status": "active"
  }
}
```

### 5. Ver Mis Delegaciones

```bash
GET http://localhost:5000/api/ai-agents/my-delegations
Authorization: Bearer <CLERK_TOKEN>
```

### 6. Ver Permisos Disponibles para Product Owner

```bash
GET http://localhost:5000/api/ai-agents/available-permissions/product_owner
Authorization: Bearer <CLERK_TOKEN>
```

---

## 🎯 ESTADOS POSIBLES

### ✅ Todo Funciona
- Servidor inicia sin errores
- MongoDB conectado
- Puedes listar agentes
- Puedes crear delegaciones

### ⚠️ Posibles Problemas

#### Error: "No hay ningún proveedor de AI configurado"

**Solución:**
```bash
# Verifica que tienes al menos una API key en .env
OPENAI_API_KEY=sk-...
```

#### Error: "Usuario no autenticado"

**Solución:**
- Asegúrate de enviar el header `Authorization: Bearer <token>`
- Verifica que el token de Clerk sea válido

#### Error: "No tienes permiso para ver este agente"

**Solución:**
- Solo usuarios con roles específicos pueden usar agentes
- Verifica tu rol en la base de datos

#### Error: "Ya existe una delegación activa"

**Solución:**
- Solo puedes tener una delegación activa por agente
- Revoca la anterior primero: `DELETE /api/ai-agents/delegate/:id`

---

## 📚 PRÓXIMOS PASOS

Una vez que hayas completado estos pasos y todo funcione:

### FASE 2: Implementar Orquestador
- Sistema de clasificación de intenciones
- Coordinación de múltiples agentes
- Context builder dinámico

### FASE 3: Product Owner AI - Funcional
- Endpoints para crear historias
- Priorización de backlog
- Análisis de valor de negocio
- Generación de reportes

---

## 📞 SOPORTE

Si encuentras algún problema:

1. Revisa los logs del servidor
2. Verifica que MongoDB esté conectado
3. Asegúrate de tener la API key configurada
4. Revisa que el usuario tenga el rol correcto

---

## 🎉 ¡ÉXITO!

Si llegaste hasta aquí y todo funciona:

✅ Módulo de AI Agents instalado  
✅ Agente Product Owner AI creado  
✅ Sistema de delegación funcionando  
✅ API endpoints disponibles  

**¡Estás listo para la FASE 2!** 🚀

---

**Última actualización:** 24 de Noviembre, 2025
