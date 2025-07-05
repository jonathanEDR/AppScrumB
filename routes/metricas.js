const express = require('express');
const router = express.Router();
const Sprint = require('../models/Sprint');
const BacklogItem = require('../models/BacklogItem');
const Release = require('../models/Release');
const Product = require('../models/Product');

// GET /api/metricas/dashboard/:producto_id - Dashboard de métricas principales
router.get('/dashboard/:producto_id', async (req, res) => {
  try {
    const { producto_id } = req.params;
    const { periodo = '30' } = req.query; // días
    
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - parseInt(periodo));

    // Obtener datos básicos
    const [sprints, historias, releases, producto] = await Promise.all([
      Sprint.find({ 
        producto: producto_id,
        fecha_inicio: { $gte: fechaInicio }
      }).sort({ fecha_inicio: -1 }),
      
      BacklogItem.find({ 
        producto: producto_id,
        created_at: { $gte: fechaInicio }
      }),
      
      Release.find({ 
        producto: producto_id,
        created_at: { $gte: fechaInicio }
      }),
      
      Product.findById(producto_id)
    ]);

    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Calcular métricas principales
    const sprintsCompletados = sprints.filter(s => s.estado === 'completado');
    const historiasCompletadas = historias.filter(h => h.estado === 'hecho');
    
    const metricas = {
      // Velocidad del equipo
      velocidad: {
        promedio: sprintsCompletados.length > 0 ? 
          sprintsCompletados.reduce((sum, s) => sum + (s.velocidad_real || 0), 0) / sprintsCompletados.length : 0,
        ultimo_sprint: sprintsCompletados.length > 0 ? sprintsCompletados[0].velocidad_real || 0 : 0,
        tendencia: calcularTendenciaVelocidad(sprintsCompletados)
      },

      // Progreso general
      progreso: {
        historias_completadas: historiasCompletadas.length,
        historias_totales: historias.length,
        porcentaje: historias.length > 0 ? (historiasCompletadas.length / historias.length) * 100 : 0
      },

      // Burndown del sprint activo
      burndown: await calcularBurndown(producto_id),

      // Calidad y entregas
      calidad: {
        precision_estimacion: calcularPrecisionEstimacion(sprintsCompletados),
        releases_exitosos: releases.filter(r => r.estado === 'lanzado').length,
        releases_retrasados: releases.filter(r => r.esta_retrasado).length
      },

      // Distribución de trabajo
      distribucion: {
        por_estado: calcularDistribucionEstados(historias),
        por_prioridad: calcularDistribucionPrioridad(historias),
        por_puntos: calcularDistribucionPuntos(historias)
      }
    };

    res.json(metricas);
  } catch (error) {
    console.error('Error al obtener dashboard de métricas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/metricas/burndown/:sprint_id - Gráfico burndown de sprint específico
router.get('/burndown/:sprint_id', async (req, res) => {
  try {
    const sprint = await Sprint.findById(req.params.sprint_id);
    if (!sprint) {
      return res.status(404).json({ error: 'Sprint no encontrado' });
    }

    const historias = await BacklogItem.find({ sprint: req.params.sprint_id })
      .select('puntos_historia estado updated_at created_at');

    const burndownData = calcularDatosBurndown(sprint, historias);
    res.json(burndownData);
  } catch (error) {
    console.error('Error al calcular burndown:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/metricas/velocity/:producto_id - Histórico de velocidad
router.get('/velocity/:producto_id', async (req, res) => {
  try {
    const { limite = 10 } = req.query;
    
    const sprints = await Sprint.find({ 
      producto: req.params.producto_id,
      estado: 'completado'
    })
    .sort({ fecha_fin: -1 })
    .limit(parseInt(limite))
    .select('nombre velocidad_planificada velocidad_real fecha_inicio fecha_fin');

    const velocityData = {
      sprints: sprints.reverse(), // Orden cronológico
      promedio: sprints.length > 0 ? 
        sprints.reduce((sum, s) => sum + (s.velocidad_real || 0), 0) / sprints.length : 0,
      tendencia: calcularTendenciaVelocidad(sprints)
    };

    res.json(velocityData);
  } catch (error) {
    console.error('Error al obtener datos de velocidad:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/metricas/cumulative-flow/:producto_id - Diagrama de flujo acumulativo
router.get('/cumulative-flow/:producto_id', async (req, res) => {
  try {
    const { dias = 30 } = req.query;
    
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - parseInt(dias));

    const historias = await BacklogItem.find({ 
      producto: req.params.producto_id,
      created_at: { $gte: fechaInicio }
    }).select('estado created_at updated_at');

    const cumulativeFlowData = calcularFlujoAcumulativo(historias, parseInt(dias));
    res.json(cumulativeFlowData);
  } catch (error) {
    console.error('Error al calcular flujo acumulativo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/metricas/export/:producto_id - Exportar métricas
router.get('/export/:producto_id', async (req, res) => {
  try {
    const { formato = 'json', periodo = '30' } = req.query;
    
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - parseInt(periodo));

    // Obtener todos los datos relevantes
    const [producto, sprints, historias, releases] = await Promise.all([
      Product.findById(req.params.producto_id),
      Sprint.find({ 
        producto: req.params.producto_id,
        fecha_inicio: { $gte: fechaInicio }
      }),
      BacklogItem.find({ 
        producto: req.params.producto_id,
        created_at: { $gte: fechaInicio }
      }),
      Release.find({ 
        producto: req.params.producto_id,
        created_at: { $gte: fechaInicio }
      })
    ]);

    const datosExport = {
      producto: producto.nombre,
      periodo: `${periodo} días`,
      fecha_generacion: new Date().toISOString(),
      resumen: {
        sprints_total: sprints.length,
        sprints_completados: sprints.filter(s => s.estado === 'completado').length,
        historias_total: historias.length,
        historias_completadas: historias.filter(h => h.estado === 'hecho').length,
        releases_total: releases.length,
        releases_lanzados: releases.filter(r => r.estado === 'lanzado').length
      },
      sprints: sprints.map(s => ({
        nombre: s.nombre,
        estado: s.estado,
        fecha_inicio: s.fecha_inicio,
        fecha_fin: s.fecha_fin,
        velocidad_planificada: s.velocidad_planificada,
        velocidad_real: s.velocidad_real
      })),
      historias: historias.map(h => ({
        titulo: h.titulo,
        estado: h.estado,
        prioridad: h.prioridad,
        puntos_historia: h.puntos_historia,
        fecha_creacion: h.created_at,
        fecha_actualizacion: h.updated_at
      })),
      releases: releases.map(r => ({
        nombre: r.nombre,
        version: r.version,
        estado: r.estado,
        fecha_objetivo: r.fecha_objetivo,
        fecha_lanzamiento: r.fecha_lanzamiento,
        progreso: r.progreso
      }))
    };

    if (formato === 'csv') {
      // Convertir a CSV (implementación básica)
      const csv = convertirACSV(datosExport);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="metricas-${producto.nombre}-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } else {
      // Retornar JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="metricas-${producto.nombre}-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(datosExport);
    }
  } catch (error) {
    console.error('Error al exportar métricas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Funciones auxiliares
function calcularTendenciaVelocidad(sprints) {
  if (sprints.length < 2) return 'estable';
  
  const velocidades = sprints.map(s => s.velocidad_real || 0);
  const promedioPrimera = velocidades.slice(0, Math.ceil(velocidades.length / 2))
    .reduce((sum, v) => sum + v, 0) / Math.ceil(velocidades.length / 2);
  const promedioSegunda = velocidades.slice(Math.floor(velocidades.length / 2))
    .reduce((sum, v) => sum + v, 0) / Math.floor(velocidades.length / 2);
  
  const diferencia = ((promedioSegunda - promedioPrimera) / promedioPrimera) * 100;
  
  if (diferencia > 10) return 'creciente';
  if (diferencia < -10) return 'decreciente';
  return 'estable';
}

function calcularPrecisionEstimacion(sprints) {
  if (sprints.length === 0) return 0;
  
  const diferencias = sprints.map(s => {
    if (s.velocidad_planificada === 0) return 0;
    return Math.abs(s.velocidad_real - s.velocidad_planificada) / s.velocidad_planificada;
  });
  
  return Math.max(0, 1 - (diferencias.reduce((sum, d) => sum + d, 0) / diferencias.length));
}

function calcularDistribucionEstados(historias) {
  const estados = ['pendiente', 'en_progreso', 'en_revision', 'hecho'];
  return estados.map(estado => ({
    estado,
    cantidad: historias.filter(h => h.estado === estado).length
  }));
}

function calcularDistribucionPrioridad(historias) {
  const prioridades = ['baja', 'media', 'alta', 'critica'];
  return prioridades.map(prioridad => ({
    prioridad,
    cantidad: historias.filter(h => h.prioridad === prioridad).length
  }));
}

function calcularDistribucionPuntos(historias) {
  const rangos = ['1-3', '4-8', '9-13', '14+'];
  return [
    { rango: '1-3', cantidad: historias.filter(h => h.puntos_historia >= 1 && h.puntos_historia <= 3).length },
    { rango: '4-8', cantidad: historias.filter(h => h.puntos_historia >= 4 && h.puntos_historia <= 8).length },
    { rango: '9-13', cantidad: historias.filter(h => h.puntos_historia >= 9 && h.puntos_historia <= 13).length },
    { rango: '14+', cantidad: historias.filter(h => h.puntos_historia >= 14).length }
  ];
}

async function calcularBurndown(producto_id) {
  const sprintActivo = await Sprint.findOne({ 
    producto: producto_id, 
    estado: 'activo' 
  });
  
  if (!sprintActivo) {
    return { sprint: null, datos: [] };
  }

  const historias = await BacklogItem.find({ sprint: sprintActivo._id });
  return calcularDatosBurndown(sprintActivo, historias);
}

function calcularDatosBurndown(sprint, historias) {
  const puntosIniciales = historias.reduce((sum, h) => sum + (h.puntos_historia || 0), 0);
  const diasSprint = Math.ceil((sprint.fecha_fin - sprint.fecha_inicio) / (1000 * 60 * 60 * 24));
  
  const datos = [];
  const fechaActual = new Date();
  
  for (let i = 0; i <= diasSprint; i++) {
    const fecha = new Date(sprint.fecha_inicio);
    fecha.setDate(fecha.getDate() + i);
    
    // Línea ideal
    const puntos_ideales = puntosIniciales - (puntosIniciales * i / diasSprint);
    
    // Puntos reales (solo para días pasados)
    let puntos_reales = puntosIniciales;
    if (fecha <= fechaActual) {
      const historiasCompletadas = historias.filter(h => 
        h.estado === 'hecho' && new Date(h.updated_at) <= fecha
      );
      const puntosCompletados = historiasCompletadas.reduce((sum, h) => sum + (h.puntos_historia || 0), 0);
      puntos_reales = puntosIniciales - puntosCompletados;
    } else {
      puntos_reales = null; // No mostrar datos futuros
    }
    
    datos.push({
      dia: i,
      fecha: fecha.toISOString().split('T')[0],
      puntos_ideales: Math.round(puntos_ideales),
      puntos_reales
    });
  }
  
  return {
    sprint: {
      nombre: sprint.nombre,
      fecha_inicio: sprint.fecha_inicio,
      fecha_fin: sprint.fecha_fin,
      puntos_totales: puntosIniciales
    },
    datos
  };
}

function calcularFlujoAcumulativo(historias, dias) {
  const datos = [];
  const estados = ['pendiente', 'en_progreso', 'en_revision', 'hecho'];
  
  for (let i = 0; i < dias; i++) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - (dias - 1 - i));
    
    const datosEstados = {};
    estados.forEach(estado => {
      datosEstados[estado] = historias.filter(h => {
        return h.created_at <= fecha && (h.estado === estado || 
          (estado === 'hecho' && h.estado === 'hecho' && h.updated_at <= fecha));
      }).length;
    });
    
    datos.push({
      fecha: fecha.toISOString().split('T')[0],
      ...datosEstados
    });
  }
  
  return datos;
}

function convertirACSV(datos) {
  // Implementación básica de conversión a CSV
  let csv = 'Tipo,Nombre,Estado,Fecha\n';
  
  datos.sprints.forEach(sprint => {
    csv += `Sprint,"${sprint.nombre}","${sprint.estado}","${sprint.fecha_inicio}"\n`;
  });
  
  datos.historias.forEach(historia => {
    csv += `Historia,"${historia.titulo}","${historia.estado}","${historia.fecha_creacion}"\n`;
  });
  
  return csv;
}

module.exports = router;
