# Backend API - Módulo Scrum Master

Este backend proporciona APIs para la gestión de impedimentos y ceremonias del módulo Scrum Master.

## Configuración

### Variables de Entorno

Crear un archivo `.env` en la raíz del proyecto backend con las siguientes variables:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/appscrum
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
JWT_SECRET=your_jwt_secret_here
CLERK_SECRET_KEY=your_clerk_secret_key_here
```

### Instalación

```bash
# Instalar dependencias
npm install

# Crear datos de ejemplo (opcional)
npm run seed

# Iniciar servidor en modo desarrollo
npm run dev

# Iniciar servidor en modo producción
npm start
```

## APIs Disponibles

### Impedimentos

#### GET /api/impediments
Obtener todos los impedimentos con filtros opcionales.

**Query Parameters:**
- `status`: `open`, `in_progress`, `resolved`
- `priority`: `low`, `medium`, `high`
- `category`: `technical`, `requirements`, `external_dependency`, `resource`, `communication`
- `responsible`: busca por nombre del responsable

**Response:**
```json
{
  "impediments": [
    {
      "_id": "...",
      "title": "Dependencia con API externa",
      "description": "...",
      "responsible": "Carlos López",
      "status": "open",
      "priority": "high",
      "category": "external_dependency",
      "createdDate": "2025-01-03T...",
      "resolvedDate": null,
      "createdBy": { "firstName": "Scrum", "lastName": "Master" },
      "assignedTo": { "firstName": "Carlos", "lastName": "López" }
    }
  ],
  "total": 1
}
```

#### GET /api/impediments/:id
Obtener un impedimento específico por ID.

#### POST /api/impediments
Crear un nuevo impedimento.

**Body:**
```json
{
  "title": "Título del impedimento",
  "description": "Descripción detallada",
  "responsible": "Nombre del responsable",
  "priority": "high",
  "category": "technical",
  "assignedTo": "user_id_opcional"
}
```

#### PUT /api/impediments/:id
Actualizar un impedimento existente.

#### PUT /api/impediments/:id/status
Cambiar solo el estado de un impedimento.

**Body:**
```json
{
  "status": "resolved"
}
```

#### DELETE /api/impediments/:id
Eliminar un impedimento.

#### GET /api/impediments/stats/summary
Obtener estadísticas de impedimentos.

**Response:**
```json
{
  "total": 10,
  "open": 3,
  "inProgress": 2,
  "resolved": 5,
  "critical": 1,
  "avgResolutionTime": 3.5,
  "resolutionRate": 50
}
```

### Ceremonias

#### GET /api/ceremonies
Obtener todas las ceremonias con filtros opcionales.

**Query Parameters:**
- `type`: `sprint_planning`, `daily_standup`, `sprint_review`, `retrospective`
- `status`: `scheduled`, `in_progress`, `completed`, `cancelled`
- `date_from`: fecha en formato YYYY-MM-DD
- `date_to`: fecha en formato YYYY-MM-DD

#### GET /api/ceremonies/:id
Obtener una ceremonia específica por ID.

#### POST /api/ceremonies
Crear una nueva ceremonia.

**Body:**
```json
{
  "type": "sprint_planning",
  "title": "Sprint Planning - Sprint 23",
  "description": "Planificación del próximo sprint",
  "date": "2025-01-10",
  "startTime": "09:00",
  "duration": 120,
  "participants": [
    {
      "user": "user_id",
      "role": "facilitator"
    }
  ],
  "goals": ["Definir objetivos", "Estimar historias"],
  "notes": "Notas adicionales"
}
```

#### PUT /api/ceremonies/:id
Actualizar una ceremonia existente.

#### PUT /api/ceremonies/:id/status
Cambiar solo el estado de una ceremonia.

#### DELETE /api/ceremonies/:id
Eliminar una ceremonia.

#### GET /api/ceremonies/upcoming/list
Obtener las próximas 5 ceremonias programadas.

#### GET /api/ceremonies/stats/summary
Obtener estadísticas de ceremonias.

**Query Parameters:**
- `period`: número de días hacia atrás (default: 30)

## Modelos de Datos

### Impediment Schema
```javascript
{
  title: String, // requerido, máx 200 caracteres
  description: String, // requerido, máx 1000 caracteres
  responsible: String, // requerido
  status: String, // enum: 'open', 'in_progress', 'resolved'
  priority: String, // enum: 'low', 'medium', 'high'
  category: String, // enum: 'technical', 'requirements', 'external_dependency', 'resource', 'communication'
  createdDate: Date,
  resolvedDate: Date,
  createdBy: ObjectId, // referencia a User
  assignedTo: ObjectId // referencia a User (opcional)
}
```

### Ceremony Schema
```javascript
{
  type: String, // enum: 'sprint_planning', 'daily_standup', 'sprint_review', 'retrospective'
  title: String, // requerido, máx 200 caracteres
  description: String, // máx 1000 caracteres
  date: Date, // requerido
  startTime: String, // formato HH:MM, requerido
  duration: Number, // minutos, requerido, min: 5, max: 480
  status: String, // enum: 'scheduled', 'in_progress', 'completed', 'cancelled'
  participants: [{
    user: ObjectId, // referencia a User
    role: String, // enum: 'facilitator', 'participant', 'observer'
    attendance: String // enum: 'pending', 'attended', 'absent', 'late'
  }],
  notes: String,
  goals: [String],
  blockers: [String],
  createdBy: ObjectId // referencia a User
}
```

## Autenticación

Todas las APIs requieren autenticación. Incluir el token JWT en el header:

```
Authorization: Bearer <your_jwt_token>
```

## Códigos de Error

- `400`: Bad Request - Datos inválidos
- `401`: Unauthorized - Token inválido o faltante
- `404`: Not Found - Recurso no encontrado
- `500`: Internal Server Error - Error del servidor

## Desarrollo

### Estructura del Proyecto

```
backend/
├── config/
│   └── clerkConfig.js
├── middleware/
│   └── authenticate.js
├── models/
│   ├── Impediment.js
│   ├── Ceremony.js
│   └── User.js
├── routes/
│   ├── impediments.js
│   ├── ceremonies.js
│   └── ...
├── scripts/
│   └── seedData.js
├── server.js
└── package.json
```

### Comandos Útiles

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# Crear datos de ejemplo
npm run seed

# Verificar conexión a la base de datos
node -e "require('mongoose').connect(process.env.MONGODB_URI).then(() => console.log('OK')).catch(console.error)"
```
