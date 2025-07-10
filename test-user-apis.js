// Archivo de prueba para las APIs del Panel de Usuario
// Este archivo puede ser usado para probar las endpoints con herramientas como Postman o Thunder Client

const API_BASE_URL = 'http://localhost:5000/api';

// Ejemplos de requests para el Panel de Usuario

/**
 * 1. Obtener Dashboard del Usuario
 * GET /api/users/dashboard/:userId
 */
const getUserDashboard = {
  method: 'GET',
  url: `${API_BASE_URL}/users/dashboard/USER_ID_HERE`,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  }
};

/**
 * 2. Obtener Proyectos del Usuario
 * GET /api/users/projects/:userId
 */
const getUserProjects = {
  method: 'GET',
  url: `${API_BASE_URL}/users/projects/USER_ID_HERE`,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  }
};

/**
 * 3. Obtener Actividades del Usuario
 * GET /api/users/activities/:userId
 */
const getUserActivities = {
  method: 'GET',
  url: `${API_BASE_URL}/users/activities/USER_ID_HERE?page=1&limit=10`,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  }
};

/**
 * 4. Obtener Perfil del Usuario
 * GET /api/users/profile/:userId
 */
const getUserProfile = {
  method: 'GET',
  url: `${API_BASE_URL}/users/profile/USER_ID_HERE`,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  }
};

/**
 * 5. Actualizar Perfil del Usuario
 * PUT /api/users/profile/:userId
 */
const updateUserProfile = {
  method: 'PUT',
  url: `${API_BASE_URL}/users/profile/USER_ID_HERE`,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  },
  body: JSON.stringify({
    nombre_negocio: 'Nuevo Nombre'
  })
};

// Estructura de respuesta esperada para el dashboard
const dashboardResponseExample = {
  user: {
    _id: "user_id",
    email: "user@example.com",
    nombre_negocio: "Usuario Test",
    role: "user"
  },
  metrics: {
    totalProjects: 3,
    pendingTasks: 5,
    weeklyHours: 32,
    hoursVariation: 5,
    hoursVariationPercent: 18.5,
    isIncrease: true
  },
  projects: [
    {
      _id: "project_id",
      nombre: "Sistema de Gestión CRM",
      descripcion: "Sistema CRM para la empresa",
      responsable: {
        _id: "user_id",
        email: "user@example.com",
        nombre_negocio: "Usuario Test"
      },
      estado: "activo",
      statusColor: "green",
      statusLabel: "Activo",
      progress: 75,
      fecha_fin: "2025-08-14T00:00:00.000Z",
      equipo: "Equipo Alpha"
    }
  ],
  recentTasks: [
    {
      _id: "task_id",
      title: "Implementar login",
      description: "Crear sistema de autenticación",
      type: "story",
      status: "in_progress",
      priority: "high"
    }
  ]
};

// Instrucciones para probar:
/*
1. Asegúrate de que el servidor backend esté corriendo en el puerto 5000
2. Reemplaza USER_ID_HERE con un ID de usuario válido
3. Reemplaza YOUR_TOKEN_HERE con un token de autenticación válido
4. Usa estas configuraciones en tu herramienta de prueba de APIs favorita

Endpoints disponibles:
- GET /api/users/dashboard/:userId - Obtiene métricas y datos del dashboard
- GET /api/users/projects/:userId - Obtiene lista de proyectos del usuario
- GET /api/users/activities/:userId - Obtiene actividades paginadas del usuario
- GET /api/users/profile/:userId - Obtiene perfil del usuario
- PUT /api/users/profile/:userId - Actualiza perfil del usuario

Todos los endpoints requieren autenticación mediante el middleware authenticate.
*/

module.exports = {
  getUserDashboard,
  getUserProjects,
  getUserActivities,
  getUserProfile,
  updateUserProfile,
  dashboardResponseExample
};
