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
const metricasRoutes = require('./routes/metricas');  // Rutas de métricas


const app = express();
const port = process.env.PORT || 5000;  // Usar el puerto de la variable de entorno o el 5000 por defecto

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
app.use('/api', productsRoutes);  // Rutas de productos
app.use('/api', backlogRoutes);  // Rutas de backlog
app.use('/api/releases', releasesRoutes);  // Rutas de releases
app.use('/api/sprints', sprintsRoutes);  // Rutas de sprints
app.use('/api/metricas', metricasRoutes);  // Rutas de métricas

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
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Conexión a MongoDB exitosa'))  // Mensaje en caso de éxito
  .catch((err) => {
    console.error('Error en la conexión a MongoDB', err);  // Manejo de errores de conexión
    process.exit(1);  // Finaliza el proceso si la conexión falla
  });

// Iniciar el servidor en el puerto definido
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
