require('dotenv').config();
const express = require('express');
const cors = require('cors');  // Middleware para CORS
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

// Configuración de Mongoose para usar las nuevas versiones de URL Parser y Topology
mongoose.set('strictQuery', false);
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

// Configuración de MongoDB
const connectDB = async () => {
  try {
    const mongoOptions = {
      serverSelectionTimeoutMS: 5000,  // Tiempo de espera para selección de servidor
      socketTimeoutMS: 45000,          // Tiempo de espera para operaciones
      family: 4,                       // Usar IPv4, evita problemas con IPv6
      retryWrites: true,              // Reintentar operaciones de escritura
      w: 'majority',                  // Esperar confirmación de la mayoría de réplicas
      maxPoolSize: 10,                // Máximo de conexiones simultáneas
      minPoolSize: 5,                 // Mínimo de conexiones mantenidas
      connectTimeoutMS: 10000,        // Tiempo máximo para conectar
      retryWrites: true,
      w: 'majority'
    };

    await mongoose.connect(process.env.MONGODB_URI, mongoOptions);
    console.log('✅ Conexión a MongoDB establecida correctamente');
    
    // Manejador de eventos de conexión
    mongoose.connection.on('error', err => {
      console.error('❌ Error en la conexión de MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB desconectado. Intentando reconectar...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconectado exitosamente');
    });

  } catch (error) {
    console.error('❌ Error al conectar con MongoDB:', error);
    process.exit(1);
  }
};

// Iniciar conexión a MongoDB
connectDB();

// Iniciar el servidor en el puerto definido
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
