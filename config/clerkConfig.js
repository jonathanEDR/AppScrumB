// config/clerkConfig.js
const { Clerk } = require('@clerk/clerk-sdk-node');
require('dotenv').config();

// Inicializar Clerk con tolerancia para clock skew
const clerkClient = new Clerk({
  secretKey: process.env.CLERK_SECRET_KEY,
  // Agregar tolerancia de 10 segundos para desincronización de reloj
  clockSkewLeewayMS: 10000
});

// Exportar la instancia inicializada
module.exports = clerkClient;