/**
 * Middleware para agregar headers Cache-Control apropiados
 * Optimiza el cacheo en navegador y CDN para reducir peticiones al servidor
 */

/**
 * Middleware que agrega headers Cache-Control según el tipo de endpoint
 * 
 * Estrategia de cacheo:
 * - Datos estáticos (productos, usuarios): 5 minutos
 * - Datos dinámicos (backlog, sprints): 2 minutos  
 * - Datos frecuentes (métricas): 1 minuto
 * - Escritura (POST/PUT/DELETE): No cachear
 */
const cacheControl = (req, res, next) => {
  // Solo cachear GET requests
  if (req.method !== 'GET') {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    return next();
  }

  const path = req.path.toLowerCase();

  // Datos relativamente estáticos - cachear 5 minutos
  if (
    path.includes('/products') ||
    path.includes('/users') ||
    path.includes('/team/members')
  ) {
    res.set({
      'Cache-Control': 'public, max-age=300', // 5 minutos
      'Vary': 'Authorization' // Importante para autenticación
    });
    return next();
  }

  // Datos dinámicos medios - cachear 2 minutos
  if (
    path.includes('/sprints') ||
    path.includes('/releases') ||
    path.includes('/backlog')
  ) {
    res.set({
      'Cache-Control': 'public, max-age=120', // 2 minutos
      'Vary': 'Authorization'
    });
    return next();
  }

  // Datos muy dinámicos - cachear 1 minuto
  if (
    path.includes('/metricas') ||
    path.includes('/metrics') ||
    path.includes('/dashboard')
  ) {
    res.set({
      'Cache-Control': 'public, max-age=60', // 1 minuto
      'Vary': 'Authorization'
    });
    return next();
  }

  // Endpoints de autenticación y configuración - no cachear
  if (
    path.includes('/auth') ||
    path.includes('/config') ||
    path.includes('/profile')
  ) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    return next();
  }

  // Default para otros GET - cachear 30 segundos
  res.set({
    'Cache-Control': 'public, max-age=30',
    'Vary': 'Authorization'
  });
  next();
};

module.exports = cacheControl;
