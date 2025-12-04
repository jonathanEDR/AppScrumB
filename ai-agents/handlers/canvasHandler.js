/**
 * Canvas Handler - Gestión de Canvas para visualización de datos
 * 
 * Contiene los patrones de detección y funciones para consultar datos
 * del sistema (productos, backlog, sprints, tareas, equipo, arquitectura)
 * 
 * @module ai-agents/handlers/canvasHandler
 */

// Modelos
const Product = require('../../models/Product');
const Sprint = require('../../models/Sprint');
const BacklogItem = require('../../models/BacklogItem');
const Task = require('../../models/Task');
const TeamMember = require('../../models/TeamMember');
const ProjectArchitecture = require('../../models/ProjectArchitecture');

/**
 * Patrones regex para detectar intents de canvas
 */
const CANVAS_PATTERNS = {
  products: [
    /(?:qu[eé]\s+)?productos?\s+(?:tenemos|hay|existen|disponibles|registrados)/i,
    /(?:lista|listar|mostrar|ver)\s+(?:los\s+)?productos/i,
    /(?:muestra|muestrame|dame|muéstrame)\s+(?:los\s+)?productos/i,
    /productos\s+(?:del\s+sistema|actuales)/i,
    /(?:cu[aá]les|cuantos)\s+productos/i,
    /muéstrame.*productos/i,
    /dame.*productos/i
  ],
  backlog: [
    /(?:qu[eé]\s+)?(?:hay\s+en\s+el\s+)?backlog/i,
    /(?:lista|listar|mostrar|ver)\s+(?:el\s+)?backlog/i,
    /(?:muestra|muestrame|dame)\s+(?:el\s+)?backlog/i,
    /historias\s+de\s+usuario/i,
    /items?\s+del\s+backlog/i,
    /(?:qu[eé]\s+)?historias\s+(?:tenemos|hay|existen)/i,
    /product\s*backlog/i
  ],
  sprints: [
    /(?:qu[eé]\s+)?sprints?\s+(?:tenemos|hay|existen|activos|planificados)/i,
    /(?:lista|listar|mostrar|ver)\s+(?:los\s+)?sprints/i,
    /(?:muestra|muestrame|dame)\s+(?:los\s+)?sprints/i,
    /sprint\s+(?:actual|activo)/i,
    /(?:cu[aá]les|cuantos)\s+sprints/i,
    /iteraciones\s+(?:tenemos|hay)/i
  ],
  tasks: [
    /(?:qu[eé]\s+)?tareas?\s+(?:tenemos|hay|existen|pendientes)/i,
    /(?:lista|listar|mostrar|ver)\s+(?:las\s+)?tareas/i,
    /(?:muestra|muestrame|dame)\s+(?:las\s+)?tareas/i,
    /tareas\s+del\s+sprint/i,
    /(?:cu[aá]les|cuantas)\s+tareas/i,
    /trabajo\s+pendiente/i
  ],
  team: [
    /(?:qu[ié][eé]?n(?:es)?\s+)?(?:est[aá]n?|forma(?:n)?|son)\s+(?:en\s+)?(?:el\s+)?equipo/i,
    /(?:lista|listar|mostrar|ver)\s+(?:el\s+)?equipo/i,
    /(?:muestra|muestrame|dame)\s+(?:el\s+)?equipo/i,
    /miembros\s+del\s+equipo/i,
    /(?:cu[aá]ntos|cu[aá]les)\s+(?:desarrolladores|miembros)/i,
    /team\s+members/i,
    /integrantes/i
  ],
  architecture: [
    /(?:muestra|muestrame|mostrar|ver)\s+(?:la\s+)?arquitectura/i,
    /(?:qu[eé]\s+)?arquitectura\s+(?:tenemos|tiene|hay|del\s+proyecto|del\s+producto)/i,
    /(?:cual|como)\s+es\s+la\s+arquitectura/i,
    /estructura\s+t[eé]cnica/i,
    /tech\s+stack/i,
    /stack\s+tecnol[oó]gico/i,
    /m[oó]dulos\s+del\s+sistema/i,
    /componentes\s+(?:del\s+sistema|t[eé]cnicos)/i,
    /diagrama\s+de\s+arquitectura/i
  ],
  createArchitecture: [
    /(?:crea|crear|define|definir|diseña|diseñar|genera|generar)\s+(?:una?\s+)?(?:la\s+)?arquitectura/i,
    /ayuda\s+(?:a\s+)?(?:crear|definir|diseñar|generar)\s+(?:la\s+)?(?:arquitectura|estructura)/i,
    /quiero\s+(?:crear|definir|generar)\s+(?:una?\s+)?(?:la\s+)?arquitectura/i,
    /necesito\s+(?:crear|definir|generar)\s+(?:una?\s+)?(?:la\s+)?arquitectura/i,
    /(?:vamos|empecemos)\s+(?:a\s+)?(?:crear|definir|generar)\s+(?:la\s+)?arquitectura/i,
    /estructura\s+(?:técnica|t[eé]cnica|del\s+proyecto)/i,
    /tech\s+stack\s+(?:para|del)/i,
    /propón.*arquitectura/i,
    /proponer.*arquitectura/i,
    /sugiere.*arquitectura/i,
    /sugerir.*arquitectura/i,
    /(?:arma|armar|construir|construye)\s+(?:la\s+)?arquitectura/i,
    /nueva\s+arquitectura/i,
    /definamos\s+(?:la\s+)?arquitectura/i,
    /hagamos\s+(?:la\s+)?arquitectura/i,
    /empezar\s+(?:la\s+)?arquitectura/i,
    /iniciar\s+(?:la\s+)?arquitectura/i
  ],
  // Patrones para EDITAR arquitectura existente
  editArchitecture: [
    /(?:editar|edita|modificar|modifica|mejorar|mejora|actualizar|actualiza)\s+(?:la\s+)?arquitectura/i,
    /(?:trabajar|trabajo)\s+(?:en|con)\s+(?:la\s+)?arquitectura/i,
    /(?:cambiar|cambios)\s+(?:en\s+)?(?:la\s+)?arquitectura/i,
    /(?:agregar|añadir|agregar|añade)\s+(?:a\s+)?(?:la\s+)?arquitectura/i,
    /quiero\s+(?:editar|modificar|mejorar|trabajar)\s+(?:en\s+)?(?:la\s+)?arquitectura/i,
    /necesito\s+(?:editar|modificar|mejorar|actualizar)\s+(?:la\s+)?arquitectura/i,
    /(?:ajustar|ajusta)\s+(?:la\s+)?arquitectura/i,
    /(?:revisar|revisa)\s+(?:la\s+)?arquitectura/i
  ],
  // Patrones para editar SECCIONES específicas
  editStructure: [
    /(?:editar|modificar|agregar|cambiar|mejorar)\s+(?:la\s+)?(?:estructura|carpetas|folders|directorios)/i,
    /(?:agregar|añadir)\s+(?:carpetas?|folders?|directorios?)/i,
    /(?:nueva|nuevas)\s+(?:carpetas?|estructura)/i,
    /(?:organizar|reorganizar)\s+(?:las?\s+)?(?:carpetas?|estructura)/i,
    /^1️⃣?\s*(?:estructura|structure)/i,
    /opci[oó]n\s*1/i,
    /^1\s*[-.]?\s*estructura/i
  ],
  editDatabase: [
    /(?:editar|modificar|agregar|cambiar|mejorar)\s+(?:la\s+)?(?:base\s+de\s+datos|bd|database|tablas?|entidades?|schema)/i,
    /(?:agregar|añadir|crear|nueva)\s+(?:tablas?|entidades?|colecciones?|campos?)/i,
    /(?:nueva|nuevas)\s+(?:tablas?|entidades?)/i,
    /(?:modificar|cambiar)\s+(?:campos?|fields?)/i,
    /schema\s+(?:de\s+)?(?:la\s+)?(?:base|bd|database)/i,
    /^2️⃣?\s*(?:base\s+de\s+datos|database)/i,
    /opci[oó]n\s*2/i,
    /^2\s*[-.]?\s*base\s+de\s+datos/i
  ],
  editEndpoints: [
    /(?:editar|modificar|agregar|cambiar|mejorar)\s+(?:los?\s+)?(?:endpoints?|apis?|rutas?|routes?)/i,
    /(?:agregar|añadir|crear|nuevo|nueva)\s+(?:endpoints?|apis?|rutas?)/i,
    /(?:nuevos?|nuevas?)\s+(?:endpoints?|apis?|rutas?)/i,
    /(?:modificar|cambiar)\s+(?:endpoints?|apis?)/i,
    /^3️⃣?\s*(?:api|endpoints?)/i,
    /opci[oó]n\s*3/i,
    /^3\s*[-.]?\s*(?:api|endpoints?)/i
  ],
  editModules: [
    /(?:editar|modificar|agregar|cambiar|mejorar)\s+(?:los?\s+)?(?:m[oó]dulos?|componentes?)/i,
    /(?:agregar|añadir|crear|nuevo|nueva)\s+(?:m[oó]dulos?|componentes?)/i,
    /(?:nuevos?|nuevas?)\s+(?:m[oó]dulos?|componentes?)/i,
    /^4️⃣?\s*(?:m[oó]dulos?)/i,
    /opci[oó]n\s*4/i,
    /^4\s*[-.]?\s*m[oó]dulos?/i
  ]
};

/**
 * Detecta si el mensaje requiere mostrar un canvas
 * @param {string} message - Mensaje del usuario
 * @returns {Object|null} Intent detectado o null
 */
function detectCanvasIntent(message) {
  const lowerMessage = message.toLowerCase();
  
  // Primero verificar intents de edición específicos (más específicos primero)
  const editSectionPatterns = {
    editStructure: { type: 'architecture', action: 'edit', section: 'structure' },
    editDatabase: { type: 'architecture', action: 'edit', section: 'database' },
    editEndpoints: { type: 'architecture', action: 'edit', section: 'endpoints' },
    editModules: { type: 'architecture', action: 'edit', section: 'modules' }
  };
  
  for (const [patternKey, result] of Object.entries(editSectionPatterns)) {
    const patterns = CANVAS_PATTERNS[patternKey];
    if (patterns) {
      for (const pattern of patterns) {
        if (pattern.test(lowerMessage)) {
          return result;
        }
      }
    }
  }
  
  // Luego verificar edición general de arquitectura
  if (CANVAS_PATTERNS.editArchitecture) {
    for (const pattern of CANVAS_PATTERNS.editArchitecture) {
      if (pattern.test(lowerMessage)) {
        return { type: 'architecture', action: 'edit', section: null };
      }
    }
  }
  
  // Finalmente verificar otros patrones
  for (const [type, patterns] of Object.entries(CANVAS_PATTERNS)) {
    // Saltar los patrones de edición ya procesados
    if (type.startsWith('edit')) continue;
    
    for (const pattern of patterns) {
      if (pattern.test(lowerMessage)) {
        // Si es crear arquitectura, retornar action 'create'
        if (type === 'createArchitecture') {
          return { type: 'architecture', action: 'create' };
        }
        return { type, action: 'list' };
      }
    }
  }
  
  return null;
}

/**
 * Obtiene los datos para el canvas según el tipo
 * @param {string} type - Tipo de canvas
 * @param {string} userId - ID del usuario
 * @param {Object} context - Contexto adicional
 * @returns {Object|null} Datos del canvas
 */
async function getCanvasData(type, userId, context = {}) {
  try {
    switch (type) {
      case 'products':
        return await getProductsData();
      
      case 'backlog':
        return await getBacklogData(context);
      
      case 'sprints':
        return await getSprintsData(context);

      case 'tasks':
        return await getTasksData(context);

      case 'architecture':
        return await getArchitectureData(context);

      case 'team':
        return await getTeamData();
      
      default:
        return null;
    }
  } catch (error) {
    console.error('Error fetching canvas data:', error.message);
    return null;
  }
}

/**
 * Obtiene datos de productos
 */
async function getProductsData() {
  const products = await Product.find({})
    .populate('responsable', 'firstName lastName email profile.photo')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  
  return {
    type: 'products',
    title: 'Productos',
    data: products.map(p => ({
      ...p,
      responsable_nombre: p.responsable ? 
        `${p.responsable.firstName || ''} ${p.responsable.lastName || ''}`.trim() || p.responsable.email : 
        'Sin asignar',
      responsable_email: p.responsable?.email,
      responsable_avatar: p.responsable?.profile?.photo
    })),
    metadata: {
      count: products.length,
      updatedAt: new Date().toISOString()
    }
  };
}

/**
 * Obtiene datos del backlog
 */
async function getBacklogData(context) {
  const backlogItems = await BacklogItem.find(
    context.product_id ? { producto: context.product_id } : {}
  )
    .sort({ prioridad: 1, createdAt: -1 })
    .limit(100)
    .lean();
  
  return {
    type: 'backlog',
    title: 'Product Backlog',
    data: backlogItems.map(item => ({
      _id: item._id,
      titulo: item.titulo,
      descripcion: item.descripcion,
      priority: item.prioridad || 'could',
      story_points: item.puntos_historia || item.storyPoints,
      status: item.estado || 'pending',
      acceptance_criteria: item.criterios_aceptacion
    })),
    metadata: {
      count: backlogItems.length,
      updatedAt: new Date().toISOString()
    }
  };
}

/**
 * Obtiene datos de sprints
 */
async function getSprintsData(context) {
  const sprints = await Sprint.find(
    context.product_id ? { producto: context.product_id } : {}
  )
    .populate('producto', 'nombre')
    .sort({ fecha_inicio: -1 })
    .limit(20)
    .lean();
  
  return {
    type: 'sprints',
    title: 'Sprints',
    data: sprints.map(s => ({
      _id: s._id,
      nombre: s.nombre,
      objetivo: s.objetivo,
      estado: s.estado,
      fecha_inicio: s.fecha_inicio,
      fecha_fin: s.fecha_fin,
      // Mantener el objeto producto completo para poder seleccionarlo
      producto: s.producto ? { 
        _id: s.producto._id, 
        nombre: s.producto.nombre 
      } : null,
      producto_nombre: s.producto?.nombre || 'Sin producto', // Para mostrar en UI
      progreso: s.progreso || 0,
      velocidad_planificada: s.velocidad_planificada,
      velocidad_real: s.velocidad_real
    })),
    metadata: {
      count: sprints.length,
      activos: sprints.filter(s => s.estado === 'activo').length,
      updatedAt: new Date().toISOString()
    }
  };
}

/**
 * Obtiene datos de tareas
 */
async function getTasksData(context) {
  const query = {};
  if (context.sprint_id) query.sprint = context.sprint_id;
  if (context.product_id) query.product = context.product_id;
  
  const tasks = await Task.find(query)
    .populate('assignee', 'firstName lastName email profile.photo')
    .populate('sprint', 'nombre')
    .sort({ priority: -1, createdAt: -1 })
    .limit(100)
    .lean();
  
  return {
    type: 'tasks',
    title: 'Tareas',
    data: tasks.map(t => {
      const assigneeName = t.assignee ? 
        `${t.assignee.firstName || ''} ${t.assignee.lastName || ''}`.trim() || t.assignee.email : 
        'Sin asignar';
      return {
        _id: t._id,
        titulo: t.title,
        descripcion: t.description,
        tipo: t.type,
        estado: t.status,
        prioridad: t.priority,
        puntos: t.storyPoints,
        asignado: assigneeName,
        asignado_avatar: t.assignee?.profile?.photo,
        sprint: t.sprint?.nombre || 'Sin sprint'
      };
    }),
    metadata: {
      count: tasks.length,
      pendientes: tasks.filter(t => t.status === 'todo').length,
      en_progreso: tasks.filter(t => t.status === 'in_progress').length,
      completadas: tasks.filter(t => t.status === 'done').length,
      updatedAt: new Date().toISOString()
    }
  };
}

/**
 * Obtiene datos de arquitectura
 */
async function getArchitectureData(context) {
  console.log('🏗️ [ARCHITECTURE CANVAS] Starting query');
  
  const productId = context.product_id || context.products?.[0]?._id;
  console.log('🏗️ [ARCHITECTURE CANVAS] Product ID from context:', productId);
  
  if (!productId) {
    console.log('❌ [ARCHITECTURE CANVAS] No product ID found');
    return {
      type: 'architecture',
      title: 'Arquitectura del Proyecto',
      data: [],
      metadata: {
        count: 0,
        message: 'No hay producto seleccionado',
        updatedAt: new Date().toISOString()
      }
    };
  }
  
  console.log(`🔍 [ARCHITECTURE CANVAS] Querying for product: ${productId}`);
  const architecture = await ProjectArchitecture.findOne({ product: productId }).lean();
  console.log('🔍 [ARCHITECTURE CANVAS] Result:', architecture ? 'FOUND' : 'NOT FOUND');
  
  if (!architecture) {
    return {
      type: 'architecture',
      title: 'Arquitectura del Proyecto',
      data: [],
      metadata: {
        count: 0,
        message: 'Arquitectura no definida para este producto',
        productId: productId,
        updatedAt: new Date().toISOString()
      }
    };
  }
  
  return {
    type: 'architecture',
    title: 'Arquitectura del Proyecto',
    data: [architecture],
    metadata: {
      count: 1,
      totalModules: architecture.modules?.length || 0,
      totalEndpoints: architecture.api_endpoints?.length || 0,
      totalTables: architecture.database_schema?.length || 0,
      hasTechStack: !!(architecture.tech_stack),
      updatedAt: architecture.updatedAt || architecture.createdAt
    }
  };
}

/**
 * Obtiene datos del equipo
 */
async function getTeamData() {
  const members = await TeamMember.find({ status: 'active' })
    .populate('user', 'firstName lastName email profile.photo role clerk_id')
    .populate('currentSprint', 'nombre')
    .sort({ role: 1 })
    .lean();
  
  let clerkClient = null;
  try {
    const clerkModule = require('@clerk/clerk-sdk-node');
    clerkClient = clerkModule.clerkClient;
  } catch (e) {
    console.log('Clerk not available for avatar fetching');
  }
  
  const membersWithAvatars = await Promise.all(members.map(async (m) => {
    const fullName = m.user ? 
      `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() : 
      null;
    
    let avatar = m.user?.profile?.photo || null;
    
    if (!avatar && m.user?.clerk_id && clerkClient) {
      try {
        const clerkUser = await clerkClient.users.getUser(m.user.clerk_id);
        avatar = clerkUser?.imageUrl || null;
      } catch (err) {
        console.log(`No se pudo obtener imagen de Clerk para ${m.user?.email}`);
      }
    }
    
    return {
      _id: m._id,
      nombre: fullName || m.user?.email?.split('@')[0] || 'Usuario',
      email: m.user?.email,
      avatar: avatar,
      rol: m.role,
      rol_usuario: m.user?.role,
      team: m.team,
      estado: m.status,
      disponibilidad: m.availability,
      skills: m.skills,
      sprint_actual: m.currentSprint?.nombre || null,
      carga_trabajo: m.workload
    };
  }));
  
  return {
    type: 'team',
    title: 'Equipo',
    data: membersWithAvatars,
    metadata: {
      count: members.length,
      por_rol: {
        scrum_master: members.filter(m => m.role === 'scrum_master').length,
        product_owner: members.filter(m => m.role === 'product_owner').length,
        developers: members.filter(m => m.role === 'developers').length
      },
      updatedAt: new Date().toISOString()
    }
  };
}

/**
 * Formatea los datos de la BD en texto legible para el AI
 * @param {string} type - Tipo de datos
 * @param {Array} data - Datos a formatear
 * @returns {string} Texto formateado
 */
function formatDataForAI(type, data) {
  if (!data || data.length === 0) return '';

  switch (type) {
    case 'products': {
      const productList = data.map((p, i) => {
        const responsable = p.responsable_nombre || 'Sin asignar';
        const estado = p.estado || 'activo';
        const descripcion = p.descripcion ? ` - ${p.descripcion.substring(0, 100)}` : '';
        return `${i + 1}. **${p.nombre}** (${estado})${descripcion} | Responsable: ${responsable}`;
      }).join('\n');
      
      return `PRODUCTOS REGISTRADOS (${data.length} total):\n${productList}`;
    }

    case 'backlog': {
      const backlogList = data.map((item, i) => {
        const prioridad = item.prioridad || item.priority || 'sin prioridad';
        const puntos = item.puntos_historia || item.story_points || 'N/A';
        const estado = item.estado || item.status || 'pendiente';
        return `${i + 1}. [${prioridad.toUpperCase()}] ${item.titulo} (${puntos} pts) - Estado: ${estado}`;
      }).join('\n');
      
      return `ITEMS DEL BACKLOG (${data.length} total):\n${backlogList}`;
    }

    case 'sprints': {
      const sprintList = data.map((s, i) => {
        const estado = s.estado || 'planificado';
        const objetivo = s.objetivo ? ` - Objetivo: ${s.objetivo.substring(0, 80)}` : '';
        const fechas = s.fecha_inicio && s.fecha_fin ? 
          ` | ${new Date(s.fecha_inicio).toLocaleDateString('es-ES')} - ${new Date(s.fecha_fin).toLocaleDateString('es-ES')}` : '';
        const progreso = s.progreso ? ` | Progreso: ${s.progreso}%` : '';
        return `${i + 1}. Sprint "${s.nombre}" [${estado.toUpperCase()}]${objetivo}${fechas}${progreso}`;
      }).join('\n');
      
      return `SPRINTS (${data.length} total):\n${sprintList}`;
    }

    case 'tasks': {
      const taskList = data.map((t, i) => {
        const prioridad = t.prioridad || t.priority || 'media';
        const estado = t.estado || t.status || 'todo';
        const puntos = t.puntos || t.storyPoints || 'N/A';
        const asignado = t.asignado || 'Sin asignar';
        return `${i + 1}. [${prioridad.toUpperCase()}] ${t.titulo || t.title} (${puntos} pts) - ${estado} | Asignado: ${asignado}`;
      }).join('\n');
      
      return `TAREAS (${data.length} total):\n${taskList}`;
    }

    case 'team': {
      const rolLabels = {
        'scrum_master': 'Scrum Master',
        'product_owner': 'Product Owner',
        'developers': 'Developer',
        'tester': 'QA Tester',
        'designer': 'Designer',
        'analyst': 'Analyst',
        'super_admin': 'Super Admin'
      };
      
      const teamList = data.map((m, i) => {
        const rol = rolLabels[m.rol] || m.rol || 'Developer';
        const disponibilidad = m.disponibilidad !== undefined ? `${m.disponibilidad}%` : '100%';
        const skills = m.skills?.map(s => s.name).join(', ') || 'Sin skills registrados';
        const email = m.email ? ` (${m.email})` : '';
        const team = m.team ? ` | Equipo: ${m.team}` : '';
        return `${i + 1}. **${m.nombre}**${email} - ${rol} | Disponibilidad: ${disponibilidad}${team} | Skills: ${skills}`;
      }).join('\n');
      
      return `EQUIPO (${data.length} miembros):\n${teamList}`;
    }

    default:
      return JSON.stringify(data, null, 2);
  }
}

module.exports = {
  CANVAS_PATTERNS,
  detectCanvasIntent,
  getCanvasData,
  formatDataForAI,
  // Exportar funciones individuales para testing
  getProductsData,
  getBacklogData,
  getSprintsData,
  getTasksData,
  getArchitectureData,
  getTeamData
};
