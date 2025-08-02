# 👨‍💻 API Developers - Documentación

## 📋 Tabla de Contenidos
- [Descripción](#descripción)
- [Autenticación](#autenticación)
- [Endpoints](#endpoints)
- [Modelos de Datos](#modelos-de-datos)
- [Códigos de Error](#códigos-de-error)
- [Ejemplos de Uso](#ejemplos-de-uso)

## 📖 Descripción

La API de Developers proporciona endpoints para que los desarrolladores gestionen sus tareas, tiempo de trabajo, reportes de bugs y repositorios de código.

**Base URL:** `/api/developers`

## 🔐 Autenticación

Todos los endpoints requieren autenticación Bearer Token con rol `developer`, `scrum_master` o `super_admin`.

```
Authorization: Bearer <token>
```

## 🛠️ Endpoints

### 📊 Dashboard

#### `GET /dashboard`
Obtiene las métricas del dashboard del developer.

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "assignedTasks": 5,
      "completedToday": 2,
      "bugsResolvedThisWeek": 1,
      "commitsThisWeek": 8,
      "hoursWorkedThisWeek": 32.5,
      "activePRs": 2
    },
    "recentTasks": [...]
  }
}
```

---

### 📋 Tareas

#### `GET /tasks`
Obtiene las tareas asignadas al developer.

**Parámetros de consulta:**
- `status` (opcional): `todo`, `in_progress`, `code_review`, `testing`, `done`
- `priority` (opcional): `low`, `medium`, `high`, `critical`
- `sprint` (opcional): ID del sprint
- `search` (opcional): Texto de búsqueda
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Elementos por página (default: 20)

**Ejemplo:**
```
GET /api/developers/tasks?status=in_progress&priority=high
```

#### `PUT /tasks/:id/status`
Actualiza el estado de una tarea.

**Body:**
```json
{
  "status": "in_progress"
}
```

**Estados válidos:** `todo`, `in_progress`, `code_review`, `testing`, `done`

---

### 🏃 Sprint Board

#### `GET /sprint-board`
Obtiene datos del sprint board.

**Parámetros de consulta:**
- `sprintId` (opcional): ID del sprint específico

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "sprint": {
      "name": "Sprint 2025-01",
      "startDate": "2025-01-01",
      "endDate": "2025-01-14",
      "progress": 65
    },
    "tasks": [...],
    "metrics": {
      "totalPoints": 50,
      "completedPoints": 32,
      "sprintProgress": 65
    }
  }
}
```

---

### ⏱️ Time Tracking

#### `GET /time-tracking/stats`
Obtiene estadísticas de time tracking.

**Parámetros de consulta:**
- `period` (opcional): `week`, `month`, `quarter`, `year` (default: `week`)

#### `GET /time-tracking`
Obtiene entradas de time tracking.

**Parámetros de consulta:**
- `taskId` (opcional): ID de la tarea
- `date` (opcional): Fecha específica (YYYY-MM-DD)
- `startDate` & `endDate` (opcional): Rango de fechas

#### `POST /time-tracking`
Crea una nueva entrada de tiempo.

**Body:**
```json
{
  "taskId": "676b1234567890abcdef1234",
  "startTime": "2025-01-15T09:00:00Z",
  "endTime": "2025-01-15T11:30:00Z",
  "date": "2025-01-15",
  "description": "Implementación de validaciones"
}
```

#### `PUT /time-tracking/:id`
Actualiza una entrada de tiempo.

#### `DELETE /time-tracking/:id`
Elimina una entrada de tiempo.

---

### ⏰ Timer

#### `GET /timer/active`
Obtiene el timer activo del usuario.

#### `POST /timer/start`
Inicia un timer para una tarea.

**Body:**
```json
{
  "taskId": "676b1234567890abcdef1234"
}
```

#### `POST /timer/stop`
Detiene el timer activo.

**Body:**
```json
{
  "description": "Descripción del trabajo realizado"
}
```

---

### 🐛 Bug Reports

#### `GET /bug-reports`
Obtiene reportes de bugs del developer.

**Parámetros de consulta:**
- `status` (opcional): `open`, `in_progress`, `resolved`, `closed`
- `priority` (opcional): `low`, `medium`, `high`, `critical`
- `project` (opcional): ID del proyecto

#### `POST /bug-reports`
Crea un nuevo reporte de bug.

**Body:**
```json
{
  "title": "Error en validación de formulario",
  "description": "El formulario no valida correctamente los emails",
  "priority": "high",
  "type": "bug",
  "stepsToReproduce": "1. Abrir formulario...",
  "expectedBehavior": "Debería validar el email",
  "actualBehavior": "No valida nada",
  "environment": "Chrome 120, Windows 11",
  "project": "676b1234567890abcdef1234"
}
```

---

### 📂 Repositorios

#### `GET /repositories`
Obtiene repositorios asociados al developer.

#### `GET /commits`
Obtiene historial de commits.

**Parámetros de consulta:**
- `repository` (opcional): ID del repositorio
- `branch` (opcional): Nombre de la rama
- `startDate` & `endDate` (opcional): Rango de fechas

#### `GET /pull-requests`
Obtiene pull requests del developer.

**Parámetros de consulta:**
- `status` (opcional): `draft`, `open`, `merged`, `closed`
- `repository` (opcional): ID del repositorio

---

## 📋 Modelos de Datos

### Task
```json
{
  "_id": "676b1234567890abcdef1234",
  "title": "Implementar autenticación JWT",
  "description": "Configurar sistema de autenticación",
  "status": "in_progress",
  "priority": "high",
  "storyPoints": 8,
  "assignee": "user_id",
  "sprint": "sprint_id",
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T10:00:00Z"
}
```

### TimeTracking
```json
{
  "_id": "676b1234567890abcdef1234",
  "user": "user_id",
  "task": "task_id",
  "date": "2025-01-15T00:00:00Z",
  "startTime": "2025-01-15T09:00:00Z",
  "endTime": "2025-01-15T11:30:00Z",
  "duration": 150,
  "description": "Trabajo realizado",
  "type": "manual"
}
```

### BugReport
```json
{
  "_id": "676b1234567890abcdef1234",
  "title": "Error en validación",
  "description": "Descripción detallada",
  "priority": "high",
  "type": "bug",
  "status": "open",
  "reporter": "user_id",
  "project": "project_id",
  "createdAt": "2025-01-15T10:00:00Z"
}
```

---

## ⚠️ Códigos de Error

| Código | Descripción |
|--------|-------------|
| 400 | Bad Request - Datos inválidos |
| 401 | Unauthorized - Token inválido |
| 403 | Forbidden - Sin permisos |
| 404 | Not Found - Recurso no encontrado |
| 500 | Internal Server Error - Error del servidor |

### Ejemplos de Respuestas de Error

```json
{
  "success": false,
  "error": "Datos de entrada inválidos",
  "details": [
    "El título es requerido",
    "La fecha de fin debe ser posterior a la fecha de inicio"
  ]
}
```

---

## 💡 Ejemplos de Uso

### Flujo Típico de Time Tracking

1. **Iniciar timer:**
```bash
curl -X POST /api/developers/timer/start \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"taskId": "676b1234567890abcdef1234"}'
```

2. **Verificar timer activo:**
```bash
curl -X GET /api/developers/timer/active \
  -H "Authorization: Bearer <token>"
```

3. **Detener timer:**
```bash
curl -X POST /api/developers/timer/stop \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"description": "Implementé la validación de formularios"}'
```

### Flujo de Reporte de Bug

1. **Crear reporte:**
```bash
curl -X POST /api/developers/bug-reports \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Error en validación de email",
    "description": "El formulario no valida emails correctamente",
    "priority": "high",
    "type": "bug",
    "stepsToReproduce": "1. Abrir formulario de registro...",
    "expectedBehavior": "Debería mostrar error si el email es inválido",
    "actualBehavior": "Acepta cualquier texto como email válido"
  }'
```

2. **Obtener mis bugs:**
```bash
curl -X GET "/api/developers/bug-reports?status=open" \
  -H "Authorization: Bearer <token>"
```

---

## 🧪 Testing

Para probar las APIs, ejecuta:

```bash
cd backend
node test-developers-api.js
```

Este script ejecutará todas las pruebas automáticamente y mostrará un reporte de resultados.

---

## 📝 Notas Importantes

1. **Validaciones:** Todos los endpoints tienen validaciones robustas
2. **Permisos:** Solo se pueden modificar recursos propios del usuario
3. **Paginación:** Los endpoints que retornan listas soportan paginación
4. **Filtros:** La mayoría de endpoints GET soportan filtros
5. **Fechas:** Usar formato ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)
6. **IDs:** Todos los IDs deben ser ObjectIds válidos de MongoDB

---

*✨ La API está completamente implementada y lista para uso en producción sin datos de prueba.*
