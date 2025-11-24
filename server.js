require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

// Suprimir temporalmente stderr para evitar warning de Clerk en producción
const originalStderrWrite = process.stderr.write.bind(process.stderr);
if (process.env.NODE_ENV === 'production') {
  process.stderr.write = (chunk, encoding, callback) => {
    if (chunk.toString().includes('Node SDK is entering a three-month notice')) {
      // Silenciar solo el warning de migración de Clerk
      if (callback) callback();
      return true;
    }
    return originalStderrWrite(chunk, encoding, callback);
  };
}

const { clerkClient } = require('@clerk/clerk-sdk-node');

// Restaurar stderr después de cargar Clerk
if (process.env.NODE_ENV === 'production') {
  process.stderr.write = originalStderrWrite;
}

const compression = require('compression');
const helmet = require('helmet');

// Configuración de Mongoose
mongoose.set('strictQuery', false);

// Importar logger y configuraciones de optimización
const logger = require('./config/logger');
const smartRateLimiter = require('./middleware/smartRateLimiter'); // ✅ NUEVO: Rate limiter inteligente
const cacheControl = require('./middleware/cacheControl'); // ✅ NUEVO: Cache-Control headers
const { addDatabaseIndexes } = require('./config/databaseOptimization');
const { verifyCloudinaryConfig } = require('./config/cloudinaryConfig');

// Importar y ejecutar la conexión a MongoDB
const connectDB = require('./config/database');
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
const diagnosticsRoutes = require('./routes/diagnostics');  // Rutas de diagnóstico
const systemConfigRoutes = require('./routes/systemConfig');  // Rutas de configuración del sistema
const cloudinaryRoutes = require('./routes/cloudinary');  // Rutas de gestión de Cloudinary
const profileRoutes = require('./routes/profile');  // Rutas de perfil/CV
const scrumMasterRoutes = require('./routes/scrumMaster');  // Rutas de Scrum Master (Dashboard consolidado)

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

// Función para iniciar el servidor después de conectar a MongoDB
const startServer = async () => {
  try {
    // Esperar a que MongoDB se conecte
    await connectDB();

    // Crear índices de base de datos para optimización
    await addDatabaseIndexes();

    // Verificar configuración de Cloudinary
    const cloudinaryReady = await verifyCloudinaryConfig();

    // Una vez conectado, iniciar el servidor
    server.listen(port, '0.0.0.0', () => {
      logger.info('Server started successfully', {
        context: 'Server',
        port,
        environment: process.env.NODE_ENV || 'development',
        mongoStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        cloudinaryStatus: cloudinaryReady ? 'configured' : 'not configured',
        corsOrigins: corsOrigins.join(', ')
      });
      
      console.log(`\n✅ AppScrum Backend Server`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🚀 Status: Running`);
      console.log(`📡 Port: ${port}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 MongoDB: Connected`);
      console.log(`☁️  Cloudinary: ${cloudinaryReady ? 'Connected' : 'Not Configured'}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    });
  } catch (error) {
    logger.error('Failed to start server', { 
      context: 'Server', 
      error: error.message,
      stack: error.stack 
    });
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

// Forzar el puerto correcto en Render
if (process.env.NODE_ENV === 'production') {
  // Silencioso en producción - logs manejados por Winston
}

// ============= MIDDLEWARE DE SEGURIDAD Y OPTIMIZACIÓN =============

// Helmet - Seguridad con headers HTTP
app.use(helmet({
  contentSecurityPolicy: false, // Deshabilitado para APIs
  crossOriginEmbedderPolicy: false
}));

// Compression - Compresión gzip de responses
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6 // Balance entre velocidad y compresión
}));

// ✅ OPTIMIZADO: Rate limiting inteligente (GET más permisivo, POST/PUT/DELETE más estricto)
app.use('/api/', smartRateLimiter);

// ✅ OPTIMIZADO: Cache-Control headers para optimizar cacheo en navegador/CDN
app.use('/api/', cacheControl);

// Logger middleware para requests HTTP
app.use(logger.expressMiddleware);

// Logging de peticiones entrantes (útil para depuración en Render)
app.use((req, res, next) => {
  try {
    console.log('<< Incoming request >>', req.method, req.url, 'Origin:', req.headers.origin || 'none');
  } catch (e) {
    // no bloquear la aplicación por un fallo de logging
  }
  next();
});

// Configuración de CORS con función para depuración (muestra si el origen es aceptado/rechazado)
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g., server-to-server) where origin is undefined
    if (!origin) return callback(null, true);
    // Exact match
    if (corsOrigins.includes(origin)) {
      console.log('CORS allow origin (exact):', origin);
      return callback(null, true);
    }

    // Allow localhost variations for dev
    if (/localhost(:[0-9]+)?$/.test(origin)) {
      console.log('CORS allow origin (localhost):', origin);
      return callback(null, true);
    }

    // Allow vercel subdomains (frontend often hosted in vercel)
    try {
      const urlObj = new URL(origin);
      if (urlObj.hostname.endsWith('.vercel.app')) {
        console.log('CORS allow origin (vercel):', origin);
        return callback(null, true);
      }
    } catch (e) {
      // ignore URL parse errors
    }

    console.warn('CORS reject origin:', origin);
    // Instead of throwing an Error (which can break preflight), deny gracefully
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'Cache-Control'],
  optionsSuccessStatus: 200
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
app.use('/api/admin/diagnostics', diagnosticsRoutes);  // Rutas de diagnóstico (Super Admin)
app.use('/api/system-config', systemConfigRoutes);  // Rutas de configuración del sistema
app.use('/api/cloudinary', cloudinaryRoutes);  // Rutas de gestión de Cloudinary
app.use('/api/profile', profileRoutes);  // Rutas de perfil/CV
app.use('/api/scrum-master', scrumMasterRoutes);  // ✅ NUEVO: Dashboard consolidado Scrum Master

// NOTA: Ya no servimos archivos estáticos locales, todo está en Cloudinary

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

// Iniciar el servidor (MOVIDO AL FINAL)
startServer();
