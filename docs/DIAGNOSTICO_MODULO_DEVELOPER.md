# 📊 DIAGNÓSTICO MÓDULO DEVELOPER - AppScrum

## 🎯 Objetivo
Analizar el estado actual del módulo de developers para identificar consultas innecesarias, duplicadas, falta de caché y oportunidades de optimización, siguiendo las mejoras implementadas en Scrum Master y Product Owner.

---

## 📁 Estructura Actual del Módulo

### Backend
- **Route**: `backend/routes/developers.js` (1387 líneas)
- **Service**: `backend/services/developersService.js` (906 líneas)
- **Middlewares**: `backend/middleware/validation/developersValidation.js`

### Frontend
- **Componentes**: `src/components/developers/`
  - `MyTasks.jsx` (553 líneas)
  - `Projects.jsx` (434 líneas)
  - `SprintBoard.jsx` (378 líneas)
  - `BugReports.jsx` (255 líneas)
  - `TimeTracking.jsx`
  - `BugReportCard.jsx`
  - `BugReportDetail.jsx`
  - Otros componentes auxiliares

- **Hooks**: 
  - `src/hooks/useDeveloperTasks.js`
  - `src/hooks/useSprintBoard.js`
  - `src/hooks/useBugReports.js`
  - `src/hooks/useTimeTracking.js`

- **Servicio API**: `src/services/developersApiService.js` (475 líneas)

---

## 🔍 ANÁLISIS DE PROBLEMAS DETECTADOS

### 1. ❌ AUSENCIA TOTAL DE CACHÉ
**Severidad**: CRÍTICA

**Problema**: A diferencia de Scrum Master y Product Owner, el módulo Developer NO implementa ningún sistema de caché.

**Endpoints afectados**:
```javascript
// NO hay uso de cache en ningún endpoint
GET /api/developers/dashboard          ❌ Sin caché
GET /api/developers/tasks               ❌ Sin caché
GET /api/developers/sprints             ❌ Sin caché
GET /api/developers/sprint-board        ❌ Sin caché
GET /api/developers/time-tracking       ❌ Sin caché
GET /api/developers/time-tracking/stats ❌ Sin caché
GET /api/developers/bug-reports         ❌ Sin caché
GET /api/developers/timer/active        ❌ Sin caché
```

**Impacto**:
- Consultas repetidas a BD en cada request
- Alto consumo de recursos de BD
- Tiempos de respuesta lentos
- Experiencia de usuario degradada

---

### 2. 🔄 CONSULTAS DUPLICADAS Y REDUNDANTES

#### 2.1 Endpoint `/tasks` - Lógica Compleja y Múltiples Queries

**Ubicación**: `routes/developers.js` líneas 67-173

**Problema**: El endpoint hace 3 tipos de consultas diferentes:
```javascript
// 1️⃣ CONSULTA: Tasks regulares
const tasks = await Task.find(taskFilters)
  .populate('sprint', 'nombre estado fecha_inicio fecha_fin')
  .populate('reporter', 'firstName lastName email nombre_negocio')
  .populate('assignee', 'firstName lastName email nombre_negocio')
  .populate('backlogItem', 'titulo')
  .sort({ updatedAt: -1 });

// 2️⃣ CONSULTA: BacklogItems asignados
const backlogItems = await BacklogItem.find(backlogFilters)
  .populate('sprint', 'nombre estado fecha_inicio fecha_fin')
  .populate('asignado_a', 'firstName lastName email nombre_negocio')
  .populate('historia_padre', 'titulo')
  .sort({ updatedAt: -1 });

// 3️⃣ CONSULTA: Time Tracking por cada tarea (en loop)
const tasksWithTime = await Promise.all(paginatedTasks.map(async (task) => {
  if (task.type === 'task') {
    const timeTracking = await TimeTracking.aggregate([
      { $match: { task: task._id, endTime: { $ne: null } } },
      { $group: { _id: null, totalMinutes: { $sum: '$duration' } } }
    ]);
    // ...
  }
}));
```

**Impacto**:
- 3+ consultas por request (puede ser N+1 con time tracking)
- Conversión manual de datos (BacklogItem → Task)
- Sin caché
- Filtros aplicados después de traer todos los datos

**Consultas similares en**:
- `getSprintBoardData()` en service (líneas 147-407)
- `getDashboardMetrics()` en service (líneas 33-95)

---

#### 2.2 Dashboard - Múltiples Consultas Independientes

**Ubicación**: `services/developersService.js` líneas 33-95

**Problema**: 6 consultas separadas para métricas:
```javascript
// 1. Tareas asignadas activas
const assignedTasks = await Task.countDocuments({ 
  assignee: userId,
  status: { $ne: 'done' }
});

// 2. Tareas completadas hoy
const completedToday = await Task.countDocuments({
  assignee: userId,
  status: 'done',
  updatedAt: { $gte: startOfDay }
});

// 3. Bugs resueltos esta semana
const bugsResolvedThisWeek = await BugReport.countDocuments({
  assignedTo: userId,
  status: 'resolved',
  resolvedAt: { $gte: startOfWeek }
});

// 4. Time entries (horas trabajadas)
const timeEntries = await TimeTracking.find({
  user: userId,
  date: { $gte: startOfWeek }
});

// 5. Tareas recientes
const recentTasks = await Task.find({
  assignee: userId
})
.sort({ updatedAt: -1 })
.limit(5)
.populate('sprint', 'name')
.select('title status priority storyPoints updatedAt sprint');
```

**Optimización posible**: Usar aggregation pipeline única + caché

---

#### 2.3 Sprint Board - Consultas Duplicadas

**Ubicación**: `services/developersService.js` líneas 147-407

**Problema**:
```javascript
// 1️⃣ Buscar sprint (lógica compleja de fallback)
sprint = await Sprint.findOne({ estado: 'activo' });
if (!sprint) {
  sprint = await Sprint.findOne({
    fecha_inicio: { $lte: now },
    fecha_fin: { $gte: now }
  }).sort({ fecha_inicio: -1 });
}
if (!sprint) {
  sprint = await Sprint.findOne().sort({ fecha_inicio: -1 });
}

// 2️⃣ Tareas del developer
developerTasks = await Task.find({ assignee: userId })
  .populate('assignee', 'firstName lastName')
  .populate('sprint', 'nombre estado')
  .sort({ priority: -1, createdAt: -1 });

// 3️⃣ Items técnicos (BacklogItems)
technicalItems = await BacklogItem.find(backlogQuery)
  .populate('asignado_a', 'firstName lastName nombre_negocio email')
  .populate('sprint', 'nombre estado')
  .populate('historia_padre', 'titulo')
  .sort({ prioridad: -1, createdAt: -1 });

// 4️⃣ Conversión manual de BacklogItem → Task (mapeo)
const convertedTechnicalItems = technicalItems.map(item => {
  // Lógica de mapeo manual...
});
```

**Duplicación**: La lógica de "buscar sprint activo" se repite en:
- `getSprintBoardData()`
- `POST /backlog/:itemId/take` (líneas 1164-1195)

---

#### 2.4 Time Tracking Stats - Consultas Redundantes

**Ubicación**: `services/developersService.js` líneas 442-567

**Problema**: Múltiples consultas similares para diferentes períodos:
```javascript
// Helper que se llama 3 veces con diferentes períodos
const getSecondsForPeriod = async (daysBack) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const entries = await TimeTracking.find({
    user: userId,
    date: { $gte: startDate },
    endTime: { $ne: null }
  });
  return entries.reduce((total, entry) => total + (entry.duration || 0), 0);
};

// Llamadas:
const totalSecondsToday = ... // Query 1
const totalSecondsWeek = await getSecondsForPeriod(7);   // Query 2
const totalSecondsMonth = await getSecondsForPeriod(30); // Query 3

// Y otra query más:
const timeEntries = await TimeTracking.find({
  user: userId,
  date: { $gte: weekAgo },
  endTime: { $ne: null }
}).populate('task', 'title tipo type');
```

**Optimización posible**: Una sola query con aggregation pipeline

---

### 3. 🔄 CONSULTAS EN LOOPS (N+1)

#### 3.1 Time Tracking por Tarea
**Ubicación**: `routes/developers.js` líneas 159-173

```javascript
// ⚠️ CONSULTA EN LOOP - PROBLEMA N+1
const tasksWithTime = await Promise.all(paginatedTasks.map(async (task) => {
  if (task.type === 'task') {
    const timeTracking = await TimeTracking.aggregate([
      { $match: { task: task._id, endTime: { $ne: null } } },
      { $group: { _id: null, totalMinutes: { $sum: '$duration' } } }
    ]);
    return {
      ...task,
      spentHours: Math.round((timeTracking[0]?.totalMinutes || 0) / 60 * 100) / 100
    };
  }
  return task;
}));
```

**Impacto**: Si hay 20 tareas paginadas, son 20 consultas adicionales de TimeTracking.

**Solución**: 
- Usar `$lookup` en aggregation pipeline
- O traer todos los TimeTracking de una vez y agrupar en memoria

---

### 4. 📦 POBLACIONES (POPULATES) EXCESIVAS

#### 4.1 Bug Reports
**Ubicación**: `routes/developers.js` línea 648

```javascript
const bugReport = await BugReport.findById(id)
  .populate('reportedBy', 'firstName lastName email role')
  .populate('assignedTo', 'firstName lastName email role')
  .populate('project', 'nombre')
  .populate('sprint', 'nombre startDate endDate')
  .populate('relatedTasks', 'titulo title status priority')
  .lean();
```

**Problema**: 5 populates en una sola query, algunos pueden no ser necesarios.

---

### 5. 🔍 FALTA DE ÍNDICES EN CONSULTAS FRECUENTES

**Consultas sin índices optimizados**:
```javascript
// Filtros frecuentes sin índices compuestos:
Task.find({ assignee: userId, status: 'done' })
Task.find({ assignee: userId, sprint: sprintId })
TimeTracking.find({ user: userId, date: { $gte: startDate } })
BugReport.find({ reportedBy: userId, status: 'open' })
```

**Sugerencia**: Índices compuestos necesarios:
- `Task`: `{ assignee: 1, status: 1 }`
- `Task`: `{ assignee: 1, sprint: 1 }`
- `TimeTracking`: `{ user: 1, date: -1 }`
- `TimeTracking`: `{ user: 1, endTime: 1 }`
- `BugReport`: `{ reportedBy: 1, status: 1 }`

---

### 6. 🔄 LÓGICA DUPLICADA EN FRONTEND Y BACKEND

#### 6.1 Mapeo de Estados/Prioridades
**Duplicado en múltiples lugares**:

Backend:
- `routes/developers.js` líneas 121-137
- `services/developersService.js` líneas 268-301
- `routes/developers.js` líneas 1214-1243 (POST /backlog/:itemId/take)

Frontend:
- Cada componente hace su propio mapeo

**Solución**: Centralizar en `utils/taskMappings.js` (ya existe pero no se usa consistentemente)

---

### 7. ⏱️ TIMER ACTIVO - CONSULTAS FRECUENTES

#### 7.1 Frontend Polling
**Ubicación**: `hooks/useTimeTracking.js`

**Problema potencial**: Si el frontend hace polling frecuente de timer activo:
```javascript
GET /api/developers/timer/active  // Sin caché, consulta BD cada vez
```

**Impacto**: Si se consulta cada 5 segundos, son 12 consultas/minuto/usuario.

---

### 8. 📊 PROBLEMAS DE ARQUITECTURA

#### 8.1 Conversión Manual BacklogItem → Task
**Ubicación**: Múltiples lugares

**Problema**: La conversión se hace manualmente en cada endpoint:
- `GET /tasks` (líneas 119-156)
- `getSprintBoardData()` (líneas 243-327)
- `POST /backlog/:itemId/take` (líneas 1214-1243)

**Solución**: Crear un helper centralizado o usar Virtual/Schema methods

---

#### 8.2 Sprint Selection Logic Duplicada
**Duplicado en**:
- `getSprintBoardData()` líneas 152-183
- `POST /backlog/:itemId/take` líneas 1164-1195

```javascript
// MISMA LÓGICA EN 2 LUGARES
let activeSprint = await Sprint.findOne({ estado: 'activo' });
if (!activeSprint) {
  const now = new Date();
  activeSprint = await Sprint.findOne({
    fecha_inicio: { $lte: now },
    fecha_fin: { $gte: now }
  }).sort({ fecha_inicio: -1 });
}
if (!activeSprint) {
  activeSprint = await Sprint.findOne().sort({ fecha_inicio: -1 });
}
```

**Solución**: Crear un método `Sprint.findActiveSprint()` reutilizable

---

### 9. 🔐 VALIDACIONES Y PERMISOS

#### 9.1 Validación de Ownership
**Patrón repetido**:
```javascript
// Se repite en múltiples endpoints
if (task.assignee.toString() !== userId.toString()) {
  return res.status(403).json({ error: 'No tienes permisos' });
}
```

**Ubicaciones**:
- `PUT /tasks/:id/status` (línea 1278)
- `DELETE /tasks/:id/unassign` (línea 1333)
- `updateTimeEntry()` (línea 739)
- `deleteTimeEntry()` (línea 772)

**Solución**: Middleware de autorización reutilizable

---

## 📈 COMPARACIÓN CON OTROS MÓDULOS

| Feature                | Scrum Master | Product Owner | Developer |
|------------------------|--------------|---------------|-----------|
| **Caché implementado** | ✅ Sí        | ✅ Sí         | ❌ NO     |
| **Índices optimizados**| ✅ Sí        | ✅ Sí         | ⚠️ Parcial|
| **Aggregations**       | ✅ Sí        | ✅ Sí         | ⚠️ Parcial|
| **Consultas N+1**      | ✅ Resueltas | ✅ Resueltas  | ❌ Existen|
| **Lógica centralizada**| ✅ Helpers   | ✅ Helpers    | ⚠️ Duplicada|

---

## 🎯 PLAN DE OPTIMIZACIÓN PROPUESTO

### FASE 1: IMPLEMENTAR CACHÉ (CRÍTICO)
**Prioridad**: ALTA

1. **Agregar middleware de caché a endpoints críticos**:
   ```javascript
   const { cacheMiddleware } = require('../middleware/cacheControl');
   
   // Endpoints a cachear con sus TTLs:
   router.get('/dashboard', cacheMiddleware('1m'), ...)          // 1 minuto
   router.get('/tasks', cacheMiddleware('30s'), ...)             // 30 segundos
   router.get('/sprints', cacheMiddleware('5m'), ...)            // 5 minutos
   router.get('/sprint-board', cacheMiddleware('1m'), ...)       // 1 minuto
   router.get('/time-tracking/stats', cacheMiddleware('2m'), ...)// 2 minutos
   router.get('/bug-reports', cacheMiddleware('1m'), ...)        // 1 minuto
   router.get('/timer/active', cacheMiddleware('10s'), ...)      // 10 segundos
   ```

2. **Invalidación de caché**: Limpiar caché en operaciones de escritura
   ```javascript
   await cacheService.clearPattern(`developer:${userId}:*`);
   ```

---

### FASE 2: OPTIMIZAR CONSULTAS (ALTO IMPACTO)

#### 2.1 Dashboard con Aggregation Pipeline
```javascript
async getDashboardMetrics(userId) {
  // UNA SOLA QUERY con aggregation
  const [metrics] = await Task.aggregate([
    {
      $facet: {
        assignedTasks: [
          { $match: { assignee: userId, status: { $ne: 'done' } } },
          { $count: 'count' }
        ],
        completedToday: [
          { $match: { assignee: userId, status: 'done', updatedAt: { $gte: startOfDay } } },
          { $count: 'count' }
        ],
        recentTasks: [
          { $match: { assignee: userId } },
          { $sort: { updatedAt: -1 } },
          { $limit: 5 },
          { $lookup: { from: 'sprints', localField: 'sprint', foreignField: '_id', as: 'sprint' } }
        ]
      }
    }
  ]);
  
  // Agregar time tracking y bug stats...
}
```

#### 2.2 Eliminar N+1 en Time Tracking
```javascript
// En lugar de loop, traer todo de una vez:
const taskIds = paginatedTasks.map(t => t._id);

const timeTrackingByTask = await TimeTracking.aggregate([
  { $match: { task: { $in: taskIds }, endTime: { $ne: null } } },
  { $group: { _id: '$task', totalMinutes: { $sum: '$duration' } } }
]);

// Mapear en memoria
const timeMap = new Map(timeTrackingByTask.map(t => [t._id.toString(), t.totalMinutes]));
const tasksWithTime = paginatedTasks.map(task => ({
  ...task,
  spentHours: Math.round((timeMap.get(task._id.toString()) || 0) / 60 * 100) / 100
}));
```

#### 2.3 Consolidar Time Tracking Stats
```javascript
async getTimeTrackingStats(userId, period) {
  // UNA SOLA QUERY para todos los períodos
  const stats = await TimeTracking.aggregate([
    { $match: { user: userId, endTime: { $ne: null } } },
    {
      $facet: {
        today: [
          { $match: { date: { $gte: today } } },
          { $group: { _id: null, totalSeconds: { $sum: '$duration' } } }
        ],
        week: [
          { $match: { date: { $gte: weekAgo } } },
          { $group: { _id: null, totalSeconds: { $sum: '$duration' } } }
        ],
        month: [
          { $match: { date: { $gte: monthAgo } } },
          { $group: { _id: null, totalSeconds: { $sum: '$duration' } } }
        ],
        byType: [
          { $match: { date: { $gte: weekAgo } } },
          { $lookup: { from: 'tasks', localField: 'task', foreignField: '_id', as: 'task' } },
          { $group: { _id: '$task.type', totalSeconds: { $sum: '$duration' } } }
        ]
      }
    }
  ]);
}
```

---

### FASE 3: CENTRALIZAR LÓGICA COMÚN

#### 3.1 Helper para Sprint Activo
**Crear**: `services/SprintHelpers.js`
```javascript
class SprintHelpers {
  static async getActiveSprint() {
    let sprint = await Sprint.findOne({ estado: 'activo' });
    
    if (!sprint) {
      const now = new Date();
      sprint = await Sprint.findOne({
        fecha_inicio: { $lte: now },
        fecha_fin: { $gte: now }
      }).sort({ fecha_inicio: -1 });
    }
    
    if (!sprint) {
      sprint = await Sprint.findOne().sort({ fecha_inicio: -1 });
    }
    
    return sprint;
  }
}
```

#### 3.2 Usar TaskMappings Consistentemente
**Ya existe**: `utils/taskMappings.js`

**Usar en todos los lugares** donde se hace conversión BacklogItem ↔ Task

#### 3.3 Helper para BacklogItem → Task Conversion
```javascript
class BacklogItemHelpers {
  static convertToTaskFormat(backlogItem) {
    return {
      _id: backlogItem._id,
      title: backlogItem.titulo,
      description: backlogItem.descripcion,
      status: mapBacklogStatusToTaskStatus(backlogItem.estado),
      priority: mapBacklogPriorityToTaskPriority(backlogItem.prioridad),
      storyPoints: backlogItem.story_points || 0,
      type: 'technical',
      isBacklogItem: true,
      assignee: backlogItem.asignado_a,
      sprint: backlogItem.sprint,
      historia_padre: backlogItem.historia_padre,
      createdAt: backlogItem.createdAt,
      updatedAt: backlogItem.updatedAt,
      originalStatus: backlogItem.estado
    };
  }
}
```

---

### FASE 4: ÍNDICES DE BASE DE DATOS

**Agregar a models**:
```javascript
// Task.js
taskSchema.index({ assignee: 1, status: 1 });
taskSchema.index({ assignee: 1, sprint: 1 });
taskSchema.index({ assignee: 1, updatedAt: -1 });

// TimeTracking.js
timeTrackingSchema.index({ user: 1, date: -1 });
timeTrackingSchema.index({ user: 1, endTime: 1 });
timeTrackingSchema.index({ task: 1, endTime: 1 });

// BugReport.js
bugReportSchema.index({ reportedBy: 1, status: 1 });
bugReportSchema.index({ assignedTo: 1, status: 1 });
bugReportSchema.index({ reportedBy: 1, createdAt: -1 });

// BacklogItem.js
backlogItemSchema.index({ asignado_a: 1, estado: 1 });
backlogItemSchema.index({ asignado_a: 1, sprint: 1 });
```

---

### FASE 5: MIDDLEWARE DE AUTORIZACIÓN

**Crear**: `middleware/checkTaskOwnership.js`
```javascript
const checkTaskOwnership = async (req, res, next) => {
  try {
    const taskId = req.params.id;
    const userId = req.user.id;
    
    const task = await Task.findById(taskId);
    
    if (!task) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    
    if (task.assignee.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'No tienes permisos' });
    }
    
    req.task = task; // Pasar tarea al siguiente handler
    next();
  } catch (error) {
    res.status(500).json({ error: 'Error al verificar permisos' });
  }
};
```

---

### FASE 6: OPTIMIZAR FRONTEND

#### 6.1 Reducir Frecuencia de Polling Timer
```javascript
// En lugar de cada 5s, cada 10-15s
useEffect(() => {
  const interval = setInterval(() => {
    fetchActiveTimer();
  }, 15000); // 15 segundos
}, []);
```

#### 6.2 Implementar React Query / SWR
- Caché en cliente
- Revalidación automática
- Deduplicación de requests

---

## 📊 IMPACTO ESPERADO

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| **Queries en Dashboard** | 6 | 2 | -67% |
| **Queries en /tasks** | 3 + N | 2 | -60% |
| **Tiempo respuesta /dashboard** | ~150ms | ~30ms | -80% |
| **Tiempo respuesta /tasks** | ~200ms | ~50ms | -75% |
| **Caché hit rate** | 0% | 70-80% | +80% |
| **Carga de BD** | Alta | Media-Baja | -60% |

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Fase 1: Caché (1-2 días)
- [ ] Importar middleware de caché
- [ ] Aplicar a endpoints principales
- [ ] Configurar TTLs apropiados
- [ ] Implementar invalidación en escrituras
- [ ] Testing de caché

### Fase 2: Optimización de Queries (2-3 días)
- [ ] Refactor dashboard con aggregation
- [ ] Eliminar N+1 en time tracking
- [ ] Consolidar time tracking stats
- [ ] Optimizar sprint board queries

### Fase 3: Centralización (1-2 días)
- [ ] Helper para sprint activo
- [ ] Helper para conversión BacklogItem
- [ ] Usar TaskMappings consistentemente
- [ ] Middleware de autorización

### Fase 4: Índices (1 día)
- [ ] Agregar índices a models
- [ ] Ejecutar migrations
- [ ] Verificar performance

### Fase 5: Testing (2 días)
- [ ] Tests unitarios de services
- [ ] Tests de integración
- [ ] Load testing
- [ ] Verificar caché

---

## 🎓 LECCIONES DE OTROS MÓDULOS

### ✅ Scrum Master implementó:
1. Caché con TTL de 2-5 minutos
2. Aggregation pipelines para métricas
3. Invalidación automática de caché
4. Índices compuestos

### ✅ Product Owner implementó:
1. Caché de backlog con 1 minuto
2. Virtual populations en lugar de populates múltiples
3. Consultas optimizadas con lean()
4. Helpers centralizados

### 📋 Developer debe implementar:
1. **TODO LO ANTERIOR** (actualmente no tiene nada)
2. Caché más agresivo (polling frecuente)
3. Optimización de time tracking (N+1)
4. Centralización de lógica duplicada

---

## 🚀 PRIORIDADES INMEDIATAS

### 🔴 CRÍTICO (Esta semana)
1. Implementar caché en endpoints principales
2. Resolver N+1 en time tracking
3. Optimizar dashboard queries

### 🟡 ALTO (Próxima semana)
4. Consolidar time tracking stats
5. Crear helpers centralizados
6. Agregar índices de BD

### 🟢 MEDIO (Siguientes sprints)
7. Middleware de autorización
8. Optimizaciones frontend
9. Testing exhaustivo

---

## 📝 NOTAS FINALES

- El módulo Developer está **significativamente menos optimizado** que Scrum Master y Product Owner
- La **ausencia de caché es el problema más crítico**
- Muchas **consultas duplicadas y lógica repetida**
- **N+1 queries** en time tracking afectan performance
- **Fácil de optimizar** siguiendo el patrón de otros módulos

**Recomendación**: Implementar Fase 1 (Caché) INMEDIATAMENTE, luego seguir con Fases 2-3 en paralelo.

---

## 🔗 Referencias
- Scrum Master optimizations: `backend/docs/SCRUM_MASTER_OPTIMIZATION.md`
- Product Owner optimizations: `backend/docs/PRODUCT_OWNER_OPTIMIZATION.md`
- Task Mappings: `backend/utils/taskMappings.js`
- Cache middleware: `backend/middleware/cacheControl.js`
