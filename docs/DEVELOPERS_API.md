# 📚 API Documentation - Developers Module

**Módulo:** Developers  
**Base URL:** `/api/developers`  
**Autenticación:** Requerida (Clerk JWT Token)  
**Roles permitidos:** `developer`, `developers`, `scrum_master`, `super_admin`

---

## 📋 Tabla de Contenidos

1. [Dashboard](#-dashboard)
2. [Tareas (Tasks)](#-tareas-tasks)
3. [Sprints](#-sprints)
4. [Time Tracking](#-time-tracking)
5. [Bug Reports](#-bug-reports)
6. [Comentarios](#-comentarios)
7. [Backlog](#-backlog)

---

## 🏠 Dashboard

### GET /api/developers/dashboard

Obtiene métricas y resumen del dashboard personal del desarrollador.

**Autenticación:** Requerida  
**Rol:** Developer o superior

#### Response Success (200)

```json
{
  "success": true,
  "data": {
    "tasksStats": {
      "total": 15,
      "byStatus": {
        "todo": 5,
        "in_progress": 3,
        "code_review": 2,
        "testing": 1,
        "done": 4
      },
      "byPriority": {
        "critical": 1,
        "high": 4,
        "medium": 6,
        "low": 4
      }
    },
    "currentSprint": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Sprint 10",
      "startDate": "2025-11-15T00:00:00.000Z",
      "endDate": "2025-11-29T00:00:00.000Z",
      "status": "active"
    },
    "recentTasks": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "title": "Implementar autenticación OAuth",
        "status": "in_progress",
        "priority": "high",
        "estimatedHours": 8,
        "spentHours": 5.5,
        "sprint": {
          "name": "Sprint 10"
        }
      }
    ],
    "timeTrackingToday": {
      "totalMinutes": 360,
      "totalHours": 6.0,
      "sessions": 4
    },
    "activeTimer": {
      "_id": "507f1f77bcf86cd799439013",
      "task": {
        "title": "Implementar autenticación OAuth"
      },
      "startTime": "2025-11-22T10:00:00.000Z",
      "elapsedMinutes": 120
    },
    "bugReportsStats": {
      "reported": 12,
      "assigned": 8,
      "byStatus": {
        "open": 3,
        "in_progress": 2,
        "resolved": 6,
        "closed": 9
      }
    }
  }
}
```

---

## ✅ Tareas (Tasks)

### GET /api/developers/tasks

Obtiene las tareas asignadas al desarrollador con filtros avanzados, búsqueda y paginación.

**Autenticación:** Requerida  
**Rol:** Developer o superior

#### Query Parameters

| Parámetro | Tipo | Descripción | Ejemplo |
|-----------|------|-------------|---------|
| `status` | String | Filtrar por estado (acepta múltiples separados por coma) | `todo`, `in_progress,testing` |
| `priority` | String | Filtrar por prioridad (acepta múltiples separados por coma) | `high`, `high,critical` |
| `sprint` | ObjectId | Filtrar por sprint específico | `507f1f77bcf86cd799439011` |
| `search` | String | Búsqueda por texto en título, descripción y tags | `OAuth` |
| `sortBy` | String | Ordenamiento | `-createdAt`, `priority`, `-updatedAt` |
| `page` | Number | Número de página | `1`, `2`, `3` |
| `limit` | Number | Resultados por página (1-100) | `20`, `50` |

#### Estados disponibles

- `todo` - Por hacer
- `in_progress` - En progreso
- `code_review` - En revisión de código
- `testing` - En pruebas
- `done` - Completado
- `blocked` - Bloqueado

#### Prioridades disponibles

- `critical` - Crítica
- `high` - Alta
- `medium` - Media
- `low` - Baja

#### Request Example

```bash
GET /api/developers/tasks?status=in_progress,testing&priority=high&search=auth&page=1&limit=20
```

#### Response Success (200)

```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "title": "Implementar autenticación OAuth",
        "description": "Integrar OAuth 2.0 con Google y GitHub",
        "status": "in_progress",
        "priority": "high",
        "estimatedHours": 8,
        "spentHours": 5.5,
        "tags": ["auth", "security", "backend"],
        "assignedTo": {
          "_id": "507f1f77bcf86cd799439014",
          "name": "Juan Pérez",
          "email": "juan@example.com",
          "avatar": "https://..."
        },
        "sprint": {
          "_id": "507f1f77bcf86cd799439011",
          "name": "Sprint 10",
          "startDate": "2025-11-15T00:00:00.000Z",
          "endDate": "2025-11-29T00:00:00.000Z",
          "status": "active"
        },
        "backlogItem": {
          "_id": "507f1f77bcf86cd799439015",
          "title": "Sistema de Autenticación",
          "priority": "alta",
          "type": "feature"
        },
        "createdAt": "2025-11-20T10:00:00.000Z",
        "updatedAt": "2025-11-22T14:30:00.000Z"
      }
    ],
    "stats": {
      "total": 15,
      "byStatus": [
        { "_id": "in_progress", "count": 3 },
        { "_id": "todo", "count": 5 },
        { "_id": "done", "count": 7 }
      ],
      "byPriority": [
        { "_id": "high", "count": 4 },
        { "_id": "medium", "count": 6 },
        { "_id": "low", "count": 5 }
      ]
    },
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "pages": 1
    }
  }
}
```

---

### PUT /api/developers/tasks/:id/status

Actualiza el estado de una tarea y sincroniza con el BacklogItem relacionado.

**Autenticación:** Requerida  
**Rol:** Developer o superior

#### Request Body

```json
{
  "status": "in_progress"
}
```

#### Response Success (200)

```json
{
  "success": true,
  "message": "Estado actualizado exitosamente",
  "data": {
    "task": {
      "_id": "507f1f77bcf86cd799439012",
      "title": "Implementar autenticación OAuth",
      "status": "in_progress",
      "updatedAt": "2025-11-22T15:00:00.000Z"
    }
  }
}
```

---

## 🏃 Sprints

### GET /api/developers/sprints

Obtiene la lista de sprints disponibles.

**Autenticación:** Requerida  
**Rol:** Developer o superior

#### Response Success (200)

```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Sprint 10",
      "goal": "Implementar módulo de autenticación",
      "startDate": "2025-11-15T00:00:00.000Z",
      "endDate": "2025-11-29T00:00:00.000Z",
      "status": "active",
      "team": ["507f1f77bcf86cd799439014", "507f1f77bcf86cd799439016"]
    }
  ]
}
```

---

### GET /api/developers/sprint-board

Obtiene la vista kanban del sprint actual con métricas.

**Autenticación:** Requerida  
**Rol:** Developer o superior

#### Query Parameters

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sprintId` | ObjectId | ID del sprint (opcional, por defecto el activo) |

#### Response Success (200)

```json
{
  "success": true,
  "data": {
    "sprint": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Sprint 10",
      "startDate": "2025-11-15T00:00:00.000Z",
      "endDate": "2025-11-29T00:00:00.000Z"
    },
    "board": {
      "todo": [
        {
          "_id": "507f1f77bcf86cd799439012",
          "title": "Implementar API de usuarios",
          "priority": "high",
          "estimatedHours": 6
        }
      ],
      "in_progress": [
        {
          "_id": "507f1f77bcf86cd799439013",
          "title": "Diseñar base de datos",
          "priority": "critical",
          "estimatedHours": 4,
          "spentHours": 2.5
        }
      ],
      "code_review": [],
      "testing": [],
      "done": []
    },
    "metrics": {
      "totalTasks": 8,
      "completed": 3,
      "inProgress": 2,
      "blocked": 0,
      "completionPercentage": 37.5,
      "totalEstimatedHours": 48,
      "totalSpentHours": 28.5
    }
  }
}
```

---

## ⏱️ Time Tracking

### GET /api/developers/time-tracking/stats

Obtiene estadísticas de tiempo trabajado.

**Autenticación:** Requerida  
**Rol:** Developer o superior

#### Query Parameters

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `period` | String | Período: `today`, `week`, `month`, `custom` |
| `startDate` | Date | Fecha inicio (para `custom`) |
| `endDate` | Date | Fecha fin (para `custom`) |

#### Response Success (200)

```json
{
  "success": true,
  "data": {
    "period": "week",
    "totalMinutes": 2400,
    "totalHours": 40.0,
    "sessions": 25,
    "byTask": [
      {
        "task": {
          "_id": "507f1f77bcf86cd799439012",
          "title": "Implementar autenticación OAuth"
        },
        "minutes": 480,
        "hours": 8.0,
        "sessions": 6
      }
    ],
    "byDay": [
      {
        "date": "2025-11-18",
        "minutes": 480,
        "hours": 8.0
      },
      {
        "date": "2025-11-19",
        "minutes": 465,
        "hours": 7.75
      }
    ]
  }
}
```

---

### GET /api/developers/time-tracking

Obtiene el historial de registros de tiempo.

**Autenticación:** Requerida  
**Rol:** Developer o superior

#### Query Parameters

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `task` | ObjectId | Filtrar por tarea específica |
| `startDate` | Date | Fecha inicio |
| `endDate` | Date | Fecha fin |
| `page` | Number | Página |
| `limit` | Number | Límite |

#### Response Success (200)

```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439020",
      "task": {
        "_id": "507f1f77bcf86cd799439012",
        "title": "Implementar autenticación OAuth"
      },
      "user": {
        "_id": "507f1f77bcf86cd799439014",
        "name": "Juan Pérez"
      },
      "startTime": "2025-11-22T09:00:00.000Z",
      "endTime": "2025-11-22T11:30:00.000Z",
      "duration": 150,
      "description": "Implementación de OAuth con Google",
      "createdAt": "2025-11-22T09:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

---

### POST /api/developers/time-tracking

Crea un registro manual de tiempo.

**Autenticación:** Requerida  
**Rol:** Developer o superior

#### Request Body

```json
{
  "task": "507f1f77bcf86cd799439012",
  "startTime": "2025-11-22T09:00:00.000Z",
  "endTime": "2025-11-22T11:30:00.000Z",
  "description": "Implementación de OAuth con Google"
}
```

#### Response Success (201)

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439020",
    "task": "507f1f77bcf86cd799439012",
    "user": "507f1f77bcf86cd799439014",
    "startTime": "2025-11-22T09:00:00.000Z",
    "endTime": "2025-11-22T11:30:00.000Z",
    "duration": 150,
    "description": "Implementación de OAuth con Google"
  },
  "message": "Registro de tiempo creado correctamente"
}
```

---

### PUT /api/developers/time-tracking/:id

Actualiza un registro de tiempo existente.

**Autenticación:** Requerida  
**Rol:** Developer o superior

#### Request Body

```json
{
  "endTime": "2025-11-22T12:00:00.000Z",
  "description": "Implementación y testing de OAuth con Google"
}
```

#### Response Success (200)

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439020",
    "duration": 180,
    "description": "Implementación y testing de OAuth con Google",
    "updatedAt": "2025-11-22T15:00:00.000Z"
  },
  "message": "Registro de tiempo actualizado correctamente"
}
```

---

### DELETE /api/developers/time-tracking/:id

Elimina un registro de tiempo.

**Autenticación:** Requerida  
**Rol:** Developer o superior

#### Response Success (200)

```json
{
  "success": true,
  "message": "Registro de tiempo eliminado correctamente"
}
```

---

### POST /api/developers/timer/start

Inicia un timer para una tarea.

**Autenticación:** Requerida  
**Rol:** Developer o superior

#### Request Body

```json
{
  "task": "507f1f77bcf86cd799439012",
  "description": "Trabajando en OAuth"
}
```

#### Response Success (201)

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439021",
    "task": {
      "_id": "507f1f77bcf86cd799439012",
      "title": "Implementar autenticación OAuth"
    },
    "startTime": "2025-11-22T14:00:00.000Z",
    "isRunning": true
  },
  "message": "Timer iniciado correctamente"
}
```

---

### POST /api/developers/timer/stop

Detiene el timer activo.

**Autenticación:** Requerida  
**Rol:** Developer o superior

#### Response Success (200)

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439021",
    "task": "507f1f77bcf86cd799439012",
    "startTime": "2025-11-22T14:00:00.000Z",
    "endTime": "2025-11-22T16:30:00.000Z",
    "duration": 150
  },
  "message": "Timer detenido. Tiempo registrado: 2.5 horas"
}
```

---

### GET /api/developers/timer/active

Obtiene el timer activo del usuario.

**Autenticación:** Requerida  
**Rol:** Developer o superior

#### Response Success (200)

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439021",
    "task": {
      "_id": "507f1f77bcf86cd799439012",
      "title": "Implementar autenticación OAuth",
      "priority": "high"
    },
    "startTime": "2025-11-22T14:00:00.000Z",
    "elapsedMinutes": 90,
    "description": "Trabajando en OAuth"
  }
}
```

#### Response No Timer (200)

```json
{
  "success": true,
  "data": null
}
```

---

## 🐛 Bug Reports

### GET /api/developers/bug-reports

Obtiene la lista de bug reports con filtros.

**Autenticación:** Requerida  
**Rol:** Developer o superior

#### Query Parameters

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `status` | String | `open`, `in_progress`, `resolved`, `closed`, `reopened` |
| `severity` | String | `low`, `medium`, `high`, `critical` |
| `priority` | String | `low`, `medium`, `high`, `urgent` |
| `type` | String | `bug`, `defect`, `error`, `crash`, `performance`, `security`, `ui`, `other` |
| `reporter` | ObjectId | Filtrar por quien reportó |
| `assignedTo` | ObjectId | Filtrar por asignado |
| `search` | String | Búsqueda por texto |
| `page` | Number | Página |
| `limit` | Number | Límite |

#### Response Success (200)

```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439030",
      "title": "Error en login con credenciales incorrectas",
      "description": "El sistema no muestra mensaje de error cuando las credenciales son incorrectas",
      "severity": "high",
      "priority": "high",
      "status": "open",
      "type": "bug",
      "environment": "Production - Chrome 120",
      "reporter": {
        "_id": "507f1f77bcf86cd799439014",
        "name": "Juan Pérez",
        "email": "juan@example.com"
      },
      "assignedTo": null,
      "stepsToReproduce": [
        "Ir a /login",
        "Ingresar credenciales incorrectas",
        "Click en 'Iniciar Sesión'"
      ],
      "expectedBehavior": "Debe mostrar mensaje 'Credenciales incorrectas'",
      "actualBehavior": "No muestra ningún mensaje",
      "attachments": [],
      "tags": ["login", "security", "ui"],
      "createdAt": "2025-11-22T10:00:00.000Z",
      "updatedAt": "2025-11-22T10:00:00.000Z"
    }
  ]
}
```

---

### GET /api/developers/bug-reports/:id

Obtiene un bug report específico con todos sus detalles.

**Autenticación:** Requerida  
**Rol:** Developer o superior

#### Response Success (200)

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439030",
    "title": "Error en login con credenciales incorrectas",
    "description": "El sistema no muestra mensaje de error...",
    "severity": "high",
    "priority": "high",
    "status": "in_progress",
    "type": "bug",
    "environment": "Production - Chrome 120",
    "reporter": {
      "_id": "507f1f77bcf86cd799439014",
      "name": "Juan Pérez",
      "email": "juan@example.com",
      "avatar": "https://...",
      "role": "developer"
    },
    "assignedTo": {
      "_id": "507f1f77bcf86cd799439015",
      "name": "María García",
      "email": "maria@example.com",
      "avatar": "https://...",
      "role": "developer"
    },
    "relatedTask": {
      "_id": "507f1f77bcf86cd799439012",
      "title": "Fix login validation",
      "status": "in_progress",
      "priority": "high"
    },
    "relatedSprint": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Sprint 10",
      "startDate": "2025-11-15T00:00:00.000Z",
      "endDate": "2025-11-29T00:00:00.000Z"
    },
    "stepsToReproduce": [
      "Ir a /login",
      "Ingresar credenciales incorrectas",
      "Click en 'Iniciar Sesión'"
    ],
    "expectedBehavior": "Debe mostrar mensaje 'Credenciales incorrectas'",
    "actualBehavior": "No muestra ningún mensaje",
    "attachments": [
      {
        "filename": "bug-1234567890-screenshot.png",
        "originalName": "error-screenshot.png",
        "mimetype": "image/png",
        "size": 125430,
        "path": "uploads/bug-reports/bug-1234567890-screenshot.png",
        "uploadedAt": "2025-11-22T10:05:00.000Z"
      }
    ],
    "tags": ["login", "security", "ui"],
    "createdAt": "2025-11-22T10:00:00.000Z",
    "updatedAt": "2025-11-22T11:30:00.000Z"
  }
}
```

---

### POST /api/developers/bug-reports

Crea un nuevo bug report.

**Autenticación:** Requerida  
**Rol:** Developer o superior

#### Request Body

```json
{
  "title": "Error en login con credenciales incorrectas",
  "description": "El sistema no muestra mensaje de error cuando las credenciales son incorrectas. El usuario no sabe si ingresó mal la contraseña o si hay un problema del sistema.",
  "severity": "high",
  "priority": "high",
  "type": "bug",
  "environment": "Production - Chrome 120 on Windows 11",
  "stepsToReproduce": [
    "Navegar a /login",
    "Ingresar email válido",
    "Ingresar contraseña incorrecta",
    "Click en 'Iniciar Sesión'",
    "Observar que no hay feedback visual"
  ],
  "expectedBehavior": "Debe mostrar mensaje de error 'Credenciales incorrectas' y resaltar los campos en rojo",
  "actualBehavior": "No muestra ningún mensaje y los campos permanecen sin cambios",
  "relatedTask": "507f1f77bcf86cd799439012",
  "relatedSprint": "507f1f77bcf86cd799439011",
  "tags": ["login", "security", "ui", "validation"]
}
```

#### Validation

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `title` | String | ✅ | 5-200 caracteres |
| `description` | String | ✅ | 10-5000 caracteres |
| `severity` | String | ❌ | `low`, `medium`, `high`, `critical` |
| `priority` | String | ❌ | `low`, `medium`, `high`, `urgent` |
| `type` | String | ❌ | `bug`, `defect`, `error`, `crash`, `performance`, `security`, `ui`, `other` |
| `environment` | String | ❌ | Max 500 caracteres |
| `stepsToReproduce` | Array | ❌ | Array de strings (1-1000 chars cada uno) |
| `expectedBehavior` | String | ❌ | Max 2000 caracteres |
| `actualBehavior` | String | ❌ | Max 2000 caracteres |
| `relatedTask` | ObjectId | ❌ | ID válido |
| `relatedSprint` | ObjectId | ❌ | ID válido |
| `tags` | Array | ❌ | Array de strings (1-50 chars cada uno) |

#### Response Success (201)

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439030",
    "title": "Error en login con credenciales incorrectas",
    "status": "open",
    "reporter": "507f1f77bcf86cd799439014",
    "createdAt": "2025-11-22T10:00:00.000Z"
  },
  "message": "Reporte de bug creado correctamente"
}
```

---

### PUT /api/developers/bug-reports/:id

Actualiza un bug report existente.

**Autenticación:** Requerida  
**Rol:** Developer o superior (debe ser reporter, asignado, o admin)

#### Request Body

```json
{
  "title": "Error en login con credenciales incorrectas (ACTUALIZADO)",
  "description": "Descripción actualizada con más detalles...",
  "severity": "critical",
  "tags": ["login", "security", "ui", "validation", "production"]
}
```

#### Response Success (200)

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439030",
    "title": "Error en login con credenciales incorrectas (ACTUALIZADO)",
    "updatedAt": "2025-11-22T12:00:00.000Z"
  },
  "message": "Bug report actualizado correctamente"
}
```

---

### PATCH /api/developers/bug-reports/:id/status

Cambia el estado de un bug report.

**Autenticación:** Requerida  
**Rol:** Developer o superior

#### Request Body

```json
{
  "status": "resolved",
  "resolution": "fixed",
  "comment": "Se agregó validación de credenciales y mensajes de error en el frontend"
}
```

#### Estados disponibles

- `open` - Abierto
- `in_progress` - En progreso
- `resolved` - Resuelto
- `closed` - Cerrado
- `reopened` - Reabierto

#### Resoluciones disponibles

- `fixed` - Corregido
- `wont_fix` - No se va a corregir
- `duplicate` - Duplicado
- `cannot_reproduce` - No se puede reproducir
- `works_as_designed` - Funciona según diseño

#### Response Success (200)

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439030",
    "status": "resolved",
    "resolution": "fixed",
    "resolvedAt": "2025-11-22T16:00:00.000Z",
    "resolvedBy": "507f1f77bcf86cd799439014"
  },
  "message": "Estado actualizado a resolved"
}
```

---

### PATCH /api/developers/bug-reports/:id/assign

Asigna un bug a un desarrollador.

**Autenticación:** Requerida  
**Rol:** Scrum Master o Super Admin

#### Request Body

```json
{
  "assignedTo": "507f1f77bcf86cd799439015"
}
```

#### Response Success (200)

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439030",
    "assignedTo": "507f1f77bcf86cd799439015",
    "updatedAt": "2025-11-22T11:00:00.000Z"
  },
  "message": "Bug asignado correctamente"
}
```

---

### POST /api/developers/bug-reports/:id/attachments

Sube archivos adjuntos (capturas de pantalla, logs, etc.) a un bug report.

**Autenticación:** Requerida  
**Rol:** Developer o superior

#### Request (multipart/form-data)

```
POST /api/developers/bug-reports/507f1f77bcf86cd799439030/attachments
Content-Type: multipart/form-data

attachments: [archivo1.png, archivo2.log] (máximo 5 archivos)
```

#### Tipos de archivo permitidos

- Imágenes: `.jpeg`, `.jpg`, `.png`, `.gif`
- Documentos: `.pdf`, `.txt`, `.log`, `.json`
- Tamaño máximo: 5MB por archivo

#### Response Success (200)

```json
{
  "success": true,
  "data": {
    "bugReport": {
      "_id": "507f1f77bcf86cd799439030",
      "attachments": [
        {
          "filename": "bug-1234567890-screenshot.png",
          "originalName": "error-screenshot.png",
          "mimetype": "image/png",
          "size": 125430,
          "path": "uploads/bug-reports/bug-1234567890-screenshot.png",
          "uploadedAt": "2025-11-22T10:05:00.000Z"
        }
      ]
    },
    "uploadedFiles": 2
  },
  "message": "2 archivo(s) subido(s) correctamente"
}
```

#### Error Response (400)

```json
{
  "success": false,
  "error": "Tipo de archivo no permitido. Solo se aceptan imágenes, PDFs y archivos de texto."
}
```

---

### DELETE /api/developers/bug-reports/:id

Elimina (soft delete) un bug report.

**Autenticación:** Requerida  
**Rol:** Developer (debe ser reporter), Scrum Master o Super Admin

#### Response Success (200)

```json
{
  "success": true,
  "message": "Bug report eliminado correctamente"
}
```

---

## 💬 Comentarios

### GET /api/developers/bug-reports/:id/comments

Obtiene los comentarios de un bug report con paginación.

**Autenticación:** Requerida  
**Rol:** Developer o superior

#### Query Parameters

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `page` | Number | Número de página (default: 1) |
| `limit` | Number | Comentarios por página (default: 20) |

#### Response Success (200)

```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439040",
      "resourceType": "BugReport",
      "resourceId": "507f1f77bcf86cd799439030",
      "author": {
        "_id": "507f1f77bcf86cd799439014",
        "name": "Juan Pérez",
        "email": "juan@example.com",
        "avatar": "https://...",
        "role": "developer"
      },
      "content": "Estoy trabajando en esto. Ya identifiqué el problema en el componente LoginForm.",
      "type": "comment",
      "isEdited": false,
      "mentions": [],
      "reactions": [
        {
          "user": "507f1f77bcf86cd799439015",
          "emoji": "👍",
          "createdAt": "2025-11-22T11:05:00.000Z"
        }
      ],
      "replies": [
        {
          "_id": "507f1f77bcf86cd799439041",
          "author": {
            "name": "María García"
          },
          "content": "Perfecto, si necesitas ayuda avísame",
          "createdAt": "2025-11-22T11:10:00.000Z"
        }
      ],
      "createdAt": "2025-11-22T11:00:00.000Z",
      "updatedAt": "2025-11-22T11:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  }
}
```

---

### POST /api/developers/bug-reports/:id/comments

Agrega un comentario a un bug report.

**Autenticación:** Requerida  
**Rol:** Developer o superior

#### Request Body

```json
{
  "content": "Estoy trabajando en esto. Ya identifiqué el problema en el componente LoginForm.",
  "parentComment": null
}
```

Para responder a un comentario:

```json
{
  "content": "Perfecto, si necesitas ayuda avísame",
  "parentComment": "507f1f77bcf86cd799439040"
}
```

#### Menciones

Puedes mencionar usuarios usando el formato `@[userId]`:

```json
{
  "content": "Hey @[507f1f77bcf86cd799439015] ¿puedes revisar esto?"
}
```

#### Response Success (201)

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439040",
    "resourceType": "BugReport",
    "resourceId": "507f1f77bcf86cd799439030",
    "author": {
      "_id": "507f1f77bcf86cd799439014",
      "name": "Juan Pérez",
      "email": "juan@example.com",
      "avatar": "https://...",
      "role": "developer"
    },
    "content": "Estoy trabajando en esto. Ya identifiqué el problema en el componente LoginForm.",
    "type": "comment",
    "parentComment": null,
    "mentions": [],
    "createdAt": "2025-11-22T11:00:00.000Z"
  },
  "message": "Comentario agregado correctamente"
}
```

---

## 📝 Backlog

### POST /api/developers/backlog/:itemId/take

Auto-asigna un item del backlog al desarrollador, creando una tarea asociada.

**Autenticación:** Requerida  
**Rol:** Developer o superior

#### Response Success (201)

```json
{
  "success": true,
  "data": {
    "backlogItem": {
      "_id": "507f1f77bcf86cd799439050",
      "title": "Implementar búsqueda avanzada",
      "status": "en_progreso",
      "assignedTo": "507f1f77bcf86cd799439014"
    },
    "task": {
      "_id": "507f1f77bcf86cd799439051",
      "title": "Implementar búsqueda avanzada",
      "status": "in_progress",
      "assignedTo": "507f1f77bcf86cd799439014",
      "backlogItem": "507f1f77bcf86cd799439050"
    }
  },
  "message": "Tarea auto-asignada y creada exitosamente"
}
```

---

## 🚨 Errores Comunes

### 401 Unauthorized

```json
{
  "error": "No autorizado. Token inválido o expirado."
}
```

**Causa:** Token de autenticación inválido, expirado o ausente.

---

### 403 Forbidden

```json
{
  "error": "Acceso denegado. Se requiere rol de developer o superior."
}
```

**Causa:** Usuario no tiene el rol necesario para acceder al recurso.

---

### 404 Not Found

```json
{
  "success": false,
  "error": "Bug report no encontrado"
}
```

**Causa:** El recurso solicitado no existe.

---

### 400 Bad Request

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "title",
      "message": "El título debe tener entre 5 y 200 caracteres"
    }
  ]
}
```

**Causa:** Datos de entrada inválidos o faltantes.

---

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Error interno del servidor",
  "message": "Database connection timeout"
}
```

**Causa:** Error del servidor. Contactar al administrador.

---

## 📊 Códigos de Estado HTTP

| Código | Significado | Uso |
|--------|-------------|-----|
| 200 | OK | Solicitud exitosa |
| 201 | Created | Recurso creado exitosamente |
| 400 | Bad Request | Datos inválidos |
| 401 | Unauthorized | No autenticado |
| 403 | Forbidden | No autorizado |
| 404 | Not Found | Recurso no encontrado |
| 500 | Internal Server Error | Error del servidor |

---

## 🔐 Autenticación

Todos los endpoints requieren un token JWT de Clerk en el header:

```
Authorization: Bearer <your_clerk_jwt_token>
```

### Ejemplo con cURL

```bash
curl -X GET "http://localhost:5000/api/developers/dashboard" \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

### Ejemplo con JavaScript (fetch)

```javascript
const response = await fetch('http://localhost:5000/api/developers/dashboard', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${clerkToken}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
```

---

## 📈 Rate Limiting

- **Límite:** 100 requests por minuto por usuario
- **Header de respuesta:** `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## 🔄 Versionado

Esta es la versión `v1` de la API. Futuras versiones mantendrán compatibilidad hacia atrás cuando sea posible.

---

## 📞 Soporte

Para reportar bugs o solicitar features, crear un issue en el repositorio o contactar al equipo de desarrollo.

---

_Última actualización: 22 de Noviembre, 2025_
