require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const { clerkClient } = require('@clerk/clerk-sdk-node');

// Configuración de Mongoose
mongoose.set('strictQuery', false);

// Importar y ejecutar la conexión a MongoDB
const connectDB = require('./config/database');

// Función para iniciar el servidor después de conectar a MongoDB
const startServer = async () => {
  try {
    // Esperar a que MongoDB se conecte
    await connectDB();

    // Una vez conectado, iniciar el servidor
    server.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Servidor corriendo en el puerto ${port}`);
      console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📡 Puerto: ${port}`);
      console.log(`🔗 MongoDB: ${mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado'}`);
      console.log(`🔧 CORS Origins: ${corsOrigins.join(', ')}`);
      console.log('✅ Servidor listo para recibir conexiones');
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

// Iniciar el servidor
startServer();
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
const corsOrigins = process.env.CORS_ORIGINS ?
  process.env.CORS_ORIGINS.split(',') :
  ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://appscrumb-nine.vercel.app'];

// Forzar el puerto correcto en Render
if (process.env.NODE_ENV === 'production') {
  console.log('🚀 Running in production mode');
  console.log('📡 Using port:', port);
  console.log('🌐 CORS origins:', corsOrigins);
  console.log('🔧 Environment variables check:');
  console.log('   - MONGODB_URI:', process.env.MONGODB_URI ? '✅ configured' : '❌ missing');
  console.log('   - CLERK_SECRET_KEY:', process.env.CLERK_SECRET_KEY ? '✅ configured' : '❌ missing');
  console.log('   - CORS_ORIGINS:', process.env.CORS_ORIGINS ? '✅ configured' : '❌ using defaults');
}

// Configuración de CORS
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With']
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
  res.json({
    message: 'Backend server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: port
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Endpoint de diagnóstico detallado
app.get('/api/diagnostic', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: port,
    mongodb_uri: process.env.MONGODB_URI ? 'configured' : 'not configured',
    clerk_secret: process.env.CLERK_SECRET_KEY ? 'configured' : 'not configured',
    cors_origins: process.env.CORS_ORIGINS || 'default',
    mongodb_state: mongoose.connection.readyState
  });
});

// Endpoint de prueba sin autenticación
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});
