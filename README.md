# AppScrum Backend

> API y backend para la plataforma AppScrum, gestionando autenticación, usuarios, notas y lógica de negocio bajo la metodología Scrum.

## Tabla de Contenidos
- [Descripción](#descripción)
- [Características](#características)
- [Tecnologías](#tecnologías)
- [Instalación](#instalación)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Uso](#uso)
- [Contribución](#contribución)
- [Licencia](#licencia)

## Descripción
Este backend provee servicios RESTful para la aplicación AppScrum, permitiendo la gestión de usuarios, autenticación, roles y notas, integrando seguridad y buenas prácticas para equipos ágiles.

## Características
- API REST con Express 5.1
- Autenticación y autorización por roles (Clerk)
- Gestión completa de proyectos Scrum
  - Product Backlog
  - Sprint Planning y Tracking
  - Time Tracking para developers
  - Bug Reports
  - Métricas y estadísticas
- Middleware de seguridad y validación
- Estructura modular y escalable
- **Nota:** La integración con Git/GitHub ha sido removida en v2.0

## Tecnologías
- Node.js v18+
- Express 5.1.0
- MongoDB (Mongoose 8.14.0)
- Clerk (autenticación y autorización)

## Instalación

### Requisitos previos
- Node.js >= 18.x
- npm >= 9.x

### Clonar el repositorio
```bash
# Desde la raíz del proyecto principal
cd backend
```

### Instalación de dependencias
```bash
npm install
```

### Variables de entorno
Crea un archivo `.env` en el directorio `backend/` y configura las variables necesarias (ver ejemplo en `.env.example` si existe).

## Ejecución
```bash
npm start
```
El servidor se ejecutará en el puerto definido en tu archivo `.env` (por defecto 3000).

## Estructura del Proyecto
```
backend/
  ├── config/         # Configuración y variables de entorno
  ├── middleware/     # Middlewares personalizados
  ├── models/         # Modelos de datos
  ├── routes/         # Rutas de la API
  ├── services/       # Lógica de negocio y servicios
  ├── utils/          # Utilidades
  ├── server.js       # Punto de entrada principal
  └── package.json    # Configuración de dependencias
```

## Uso
1. Inicia el backend con `npm start`.
2. Utiliza herramientas como Postman o Insomnia para probar los endpoints.
3. Integra el frontend conectando a la URL y puerto configurados.

## Contribución
Las contribuciones son bienvenidas. Abre un issue o pull request para sugerencias, mejoras o correcciones.

## Licencia
Este proyecto está bajo la licencia MIT.
