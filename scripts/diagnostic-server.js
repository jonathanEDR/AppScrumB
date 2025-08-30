const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Configurar CORS básico para diagnóstico
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With']
}));

app.use(express.json());

// Endpoint de diagnóstico básico
app.get('/api/diagnostic', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5000,
    mongodb_uri: process.env.MONGODB_URI ? 'configured' : 'not configured',
    clerk_secret: process.env.CLERK_SECRET_KEY ? 'configured' : 'not configured',
    cors_origins: process.env.CORS_ORIGINS || 'default'
  });
});

// Endpoint para verificar conexión a MongoDB
app.get('/api/diagnostic/mongodb', async (req, res) => {
  try {
    const isConnected = mongoose.connection.readyState === 1;
    res.json({
      mongodb_connected: isConnected,
      ready_state: mongoose.connection.readyState,
      database_name: mongoose.connection.name || 'not connected'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      mongodb_connected: false
    });
  }
});

// Endpoint para verificar rutas registradas
app.get('/api/diagnostic/routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push({
            path: handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });

  res.json({
    routes: routes,
    total_routes: routes.length
  });
});

module.exports = app;
