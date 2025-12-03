/**
 * Architect Agent Prompts
 * System prompts especializados para el agente arquitecto
 */

const ARCHITECT_SYSTEM_PROMPT = `Eres un Arquitecto de Software experto, especializado en diseño de sistemas y arquitectura de aplicaciones.

## Tu Rol
Ayudas a equipos de desarrollo a definir, documentar y mantener la arquitectura técnica de sus proyectos de software.

## Tus Capacidades
1. **Definir Arquitectura**: Crear la estructura técnica inicial de un proyecto nuevo
2. **Analizar Proyectos**: Evaluar y documentar la arquitectura de proyectos existentes
3. **Sugerir Tech Stack**: Recomendar tecnologías apropiadas según los requerimientos
4. **Diseñar Módulos**: Estructurar los componentes/módulos del sistema
5. **Planificar Roadmap**: Crear planes técnicos por fases
6. **Documentar Decisiones**: Registrar ADRs (Architecture Decision Records)
7. **Estimar Complejidad**: Evaluar la complejidad técnica de features

## Principios de Arquitectura
- **SOLID**: Aplicar principios de diseño orientado a objetos
- **DRY**: No repetir código, abstraer funcionalidades comunes
- **KISS**: Mantener soluciones simples
- **YAGNI**: No sobrediseñar, implementar solo lo necesario
- **Separation of Concerns**: Separar responsabilidades claramente

## Formatos de Respuesta
Cuando definas arquitectura, usa este formato estructurado:

### Para Tech Stack:
\`\`\`
📦 STACK TECNOLÓGICO
├── Frontend: [Framework + Language + UI Library]
├── Backend: [Framework + Language + ORM]
├── Database: [Primary + Cache]
└── Hosting: [Frontend + Backend]
\`\`\`

### Para Módulos:
\`\`\`
📁 MÓDULOS DEL SISTEMA
├── 🔐 [Nombre] - [Descripción breve]
│   ├── Tipo: frontend/backend/shared
│   ├── Complejidad: baja/media/alta
│   └── Dependencias: [otros módulos]
└── ...
\`\`\`

### Para Decisiones:
\`\`\`
📋 DECISIÓN DE ARQUITECTURA
├── Título: [Nombre de la decisión]
├── Contexto: [Por qué es necesaria]
├── Decisión: [Qué se decidió]
└── Consecuencias: [Impacto positivo y negativo]
\`\`\`

## Reglas
1. Siempre pregunta sobre el contexto del proyecto antes de sugerir arquitectura
2. Considera escalabilidad, mantenibilidad y seguridad
3. Adapta las recomendaciones al tamaño del equipo y experiencia
4. Prioriza tecnologías probadas sobre las más nuevas para MVPs
5. Documenta las razones detrás de cada decisión
6. Sugiere alternativas cuando sea apropiado

## Contexto Actual
{context}`;

const DEFINE_ARCHITECTURE_PROMPT = `Basándome en la información proporcionada, voy a definir la arquitectura técnica del proyecto.

## Información del Proyecto
- **Nombre**: {project_name}
- **Descripción**: {project_description}
- **Tipo**: {project_type}
- **Escala esperada**: {scale}
- **Usuarios iniciales**: {expected_users}

## Mi Análisis

### 1. Stack Tecnológico Recomendado
Considerando los requerimientos, sugiero:

{tech_stack_analysis}

### 2. Módulos Principales
El sistema se estructurará en los siguientes módulos:

{modules_analysis}

### 3. Patrones de Arquitectura
Recomiendo aplicar:

{patterns_analysis}

### 4. Roadmap Técnico Sugerido
Para una implementación ordenada:

{roadmap_analysis}

### 5. Consideraciones de Seguridad

{security_analysis}

¿Quieres que guarde esta arquitectura o prefieres ajustar algo?`;

const ANALYZE_ARCHITECTURE_PROMPT = `Voy a analizar la arquitectura actual del proyecto.

## Estado Actual
{current_state}

## Análisis

### Fortalezas
{strengths}

### Áreas de Mejora
{improvements}

### Recomendaciones
{recommendations}

### Deuda Técnica Identificada
{technical_debt}`;

const SUGGEST_TECH_STACK_PROMPT = `Basándome en los requerimientos, voy a sugerir el stack tecnológico más apropiado.

## Requerimientos
{requirements}

## Opciones Analizadas

### Opción A: {option_a_name}
{option_a_details}

### Opción B: {option_b_name}
{option_b_details}

## Mi Recomendación
{recommendation}

## Justificación
{justification}`;

const CREATE_MODULE_PROMPT = `Voy a definir un nuevo módulo para el sistema.

## Módulo: {module_name}

### Descripción
{description}

### Responsabilidades
{responsibilities}

### Interfaces
{interfaces}

### Dependencias
{dependencies}

### Historias de Usuario Relacionadas
{related_stories}

### Estimación
- **Complejidad**: {complexity}
- **Horas estimadas**: {estimated_hours}
- **Sprint sugerido**: {suggested_sprint}`;

const GENERATE_ROADMAP_PROMPT = `Voy a generar el roadmap técnico del proyecto.

## Proyecto: {project_name}

### Fase 1: MVP
{mvp_phase}

### Fase 2: v1.0
{v1_phase}

### Fase 3: v2.0
{v2_phase}

## Timeline Sugerido
{timeline}

## Dependencias entre Fases
{phase_dependencies}`;

const QUESTIONS_FOR_NEW_PROJECT = [
  "¿Qué tipo de aplicación será? (web, móvil, API, desktop)",
  "¿Cuántos usuarios esperan tener inicialmente y en un año?",
  "¿El equipo tiene experiencia con alguna tecnología en particular?",
  "¿Hay restricciones de presupuesto para hosting/infraestructura?",
  "¿Se requieren integraciones con servicios externos? (pagos, email, etc.)",
  "¿Hay requerimientos específicos de seguridad o compliance?",
  "¿Cuál es el timeline esperado para el MVP?"
];

const TECH_STACK_RECOMMENDATIONS = {
  web_app_small: {
    frontend: { framework: 'React', language: 'JavaScript', ui: 'Tailwind CSS' },
    backend: { framework: 'Express.js', language: 'Node.js', orm: 'Mongoose' },
    database: { primary: 'MongoDB' },
    hosting: { frontend: 'Vercel', backend: 'Render' }
  },
  web_app_medium: {
    frontend: { framework: 'Next.js', language: 'TypeScript', ui: 'Tailwind CSS' },
    backend: { framework: 'NestJS', language: 'Node.js', orm: 'Prisma' },
    database: { primary: 'PostgreSQL', cache: 'Redis' },
    hosting: { frontend: 'Vercel', backend: 'AWS/Railway' }
  },
  web_app_large: {
    frontend: { framework: 'Next.js', language: 'TypeScript', ui: 'Tailwind + Radix' },
    backend: { framework: 'NestJS', language: 'TypeScript', orm: 'Prisma' },
    database: { primary: 'PostgreSQL', cache: 'Redis', search: 'Elasticsearch' },
    hosting: { frontend: 'AWS CloudFront', backend: 'AWS ECS' }
  },
  api_only: {
    backend: { framework: 'Express.js', language: 'Node.js', orm: 'Mongoose' },
    database: { primary: 'MongoDB' },
    hosting: { backend: 'Railway/Render' }
  },
  mobile_app: {
    mobile: { framework: 'React Native', language: 'TypeScript' },
    backend: { framework: 'Express.js', language: 'Node.js', orm: 'Mongoose' },
    database: { primary: 'MongoDB', realtime: 'Firebase' },
    hosting: { backend: 'Render', mobile: 'App Store/Play Store' }
  }
};

const COMMON_MODULES = {
  auth: {
    name: 'Autenticación',
    description: 'Gestión de usuarios, login, registro, recuperación de contraseña',
    type: 'backend',
    complexity: 'medium',
    features: ['Login', 'Registro', 'Reset Password', 'JWT', 'OAuth']
  },
  users: {
    name: 'Gestión de Usuarios',
    description: 'CRUD de usuarios, perfiles, roles y permisos',
    type: 'backend',
    complexity: 'medium',
    features: ['Perfiles', 'Roles', 'Permisos', 'Configuración']
  },
  dashboard: {
    name: 'Dashboard',
    description: 'Panel principal con métricas y accesos rápidos',
    type: 'frontend',
    complexity: 'medium',
    features: ['Métricas', 'Gráficos', 'Widgets', 'Accesos rápidos']
  },
  notifications: {
    name: 'Notificaciones',
    description: 'Sistema de notificaciones in-app, email y push',
    type: 'shared',
    complexity: 'medium',
    features: ['In-app', 'Email', 'Push', 'Preferencias']
  },
  file_storage: {
    name: 'Almacenamiento de Archivos',
    description: 'Subida, gestión y servicio de archivos',
    type: 'backend',
    complexity: 'medium',
    features: ['Upload', 'Download', 'Thumbnails', 'CDN']
  },
  payments: {
    name: 'Pagos',
    description: 'Integración con pasarela de pagos',
    type: 'backend',
    complexity: 'high',
    features: ['Checkout', 'Suscripciones', 'Facturas', 'Reembolsos']
  },
  analytics: {
    name: 'Analytics',
    description: 'Tracking de eventos y métricas de uso',
    type: 'shared',
    complexity: 'medium',
    features: ['Eventos', 'Métricas', 'Reportes', 'Dashboards']
  },
  admin: {
    name: 'Administración',
    description: 'Panel de administración del sistema',
    type: 'frontend',
    complexity: 'high',
    features: ['Gestión usuarios', 'Configuración', 'Logs', 'Métricas']
  }
};

module.exports = {
  ARCHITECT_SYSTEM_PROMPT,
  DEFINE_ARCHITECTURE_PROMPT,
  ANALYZE_ARCHITECTURE_PROMPT,
  SUGGEST_TECH_STACK_PROMPT,
  CREATE_MODULE_PROMPT,
  GENERATE_ROADMAP_PROMPT,
  QUESTIONS_FOR_NEW_PROJECT,
  TECH_STACK_RECOMMENDATIONS,
  COMMON_MODULES
};
