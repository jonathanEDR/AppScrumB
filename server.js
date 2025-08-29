require('dotenv').config();
const express = require('express');
const cors = require('cors');  // Middleware para CORS
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth');  // Importar las rutas de autenticación
const adminRoutes = require('./routes/admin');  // Importa las rutas de admin
const productsRoutes = require('./routes/products');  // Rutas de productos
const backlogRoutes = require('./routes/backlog');  // Rutas de backlog
const releasesRoutes = require('./routes/releases');  // Rutas de releases
const sprintsRoutes = require('./routes/sprints');  // Rutas de sprints
const metricasRoutes = require('./routes/metrics');  // Rutas de métricas
const impedimentsRoutes = require('./routes/impediments');  // Rutas de impedimentos
const ceremoniesRoutes = require('./routes/ceremonies');  // Rutas de ceremonias
const teamRoutes = require('./routes/team');  // Rutas de equipo
const developersRoutes = require('./routes/developers');  // Rutas de developers
const timeTrackingRoutes = require('./routes/timeTracking');  // Rutas de time tracking
const bugReportsRoutes = require('./routes/bugReports');  // Rutas de bug reports
const usersRoutes = require('./routes/users');  // Rutas de usuarios
const repositoriesRoutes = require('./routes/repositories');  // Rutas de repositorios
const repositoriesNewRoutes = require('./routes/repositoriesNew');  // Nuevas rutas de repositorios


const app = express();
const port = process.env.PORT || 5000;  // Usar el puerto de la variable de entorno o el 5000 por defecto

// Configurar timeouts del servidor
const server = require('http').createServer(app);
server.keepAliveTimeout = 120000; // 120 segundos
server.headersTimeout = 120000; // 120 segundos

// Leer orígenes de CORS desde .env y convertirlos en array
const corsOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:5173', 'http://127.0.0.1:5173'];

// Middleware para CORS y Body Parser
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(bodyParser.json());// Analizar solicitudes con cuerpo JSON

// Usar las rutas de autenticación
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);  // Añade las rutas de admin
app.use('/api/products', productsRoutes);  // Rutas de productos - CORREGIDO
app.use('/api', backlogRoutes);  // Rutas de backlog
app.use('/api/releases', releasesRoutes);  // Rutas de releases
app.use('/api/sprints', sprintsRoutes);  // Rutas de sprints
app.use('/api/metricas', metricasRoutes);  // Rutas de métricas
app.use('/api/impediments', impedimentsRoutes);  // Rutas de impedimentos
app.use('/api/ceremonies', ceremoniesRoutes);  // Rutas de ceremonias
app.use('/api/team', teamRoutes);  // Rutas de equipo
app.use('/api/developers', developersRoutes);  // Rutas de developers
app.use('/api/time-tracking', timeTrackingRoutes);  // Rutas de time tracking
app.use('/api/bug-reports', bugReportsRoutes);  // Rutas de bug reports
app.use('/api/users', usersRoutes);  // Rutas de usuarios
app.use('/api/repositories', repositoriesRoutes);  // Rutas de repositorios (legacy)
app.use('/api/repos', repositoriesNewRoutes);  // Nuevas rutas de repositorios optimizadas

// Rutas de prueba y health check
app.get('/', (req, res) => {
  res.json({ message: 'Backend server is running' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Conectar a MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Conexión a MongoDB exitosa'))  // Mensaje en caso de éxito
  .catch((err) => {
    console.error('Error en la conexión a MongoDB', err);  // Manejo de errores de conexión
    process.exit(1);  // Finaliza el proceso si la conexión falla
  });

// Iniciar el servidor en el puerto definido
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
