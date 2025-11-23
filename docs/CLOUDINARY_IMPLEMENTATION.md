# 📸 Sistema de Gestión de Imágenes con Cloudinary

Documentación completa del sistema de gestión de imágenes implementado con Cloudinary para AppScrum.

## 📋 Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Configuración](#configuración)
3. [Arquitectura](#arquitectura)
4. [API Endpoints](#api-endpoints)
5. [Uso en Frontend](#uso-en-frontend)
6. [Scripts de Mantenimiento](#scripts-de-mantenimiento)
7. [Migraciones](#migraciones)
8. [Optimizaciones](#optimizaciones)
9. [Troubleshooting](#troubleshooting)

---

## 📝 Descripción General

El sistema de gestión de imágenes de AppScrum utiliza **Cloudinary** como servicio de almacenamiento y CDN para todos los archivos multimedia. Esto garantiza:

- ✅ **Persistencia**: Los archivos no se pierden en redeployments
- ✅ **Escalabilidad**: CDN global con carga rápida
- ✅ **Optimización**: Transformaciones automáticas (WebP, resize, quality)
- ✅ **Seguridad**: URLs firmadas y validaciones robustas
- ✅ **Gestión centralizada**: Un único servicio para todos los archivos

### Tipos de archivos soportados

#### Bug Reports
- **Imágenes**: JPG, PNG, GIF, WebP
- **Documentos**: PDF, TXT, LOG, JSON, DOC, DOCX
- **Límite**: 10MB por archivo, máximo 5 archivos
- **Ubicación**: `appscrum/bug-reports/{bugId}/`

#### Logos y Branding
- **Imágenes**: JPG, PNG, SVG, WebP
- **Límite**: 5MB por archivo
- **Ubicación**: `appscrum/branding/`
- **Transformaciones**: Automáticas (thumbnails, optimización)

---

## ⚙️ Configuración

### 1. Variables de Entorno

Añade estas variables en `.env`:

```env
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
```

### 2. Obtener Credenciales de Cloudinary

1. Crea una cuenta en [Cloudinary](https://cloudinary.com/)
2. Ve al Dashboard
3. Copia tus credenciales:
   - Cloud Name
   - API Key
   - API Secret

### 3. Instalación de Dependencias

Las dependencias ya están instaladas:

```bash
npm install cloudinary multer-storage-cloudinary
```

---

## 🏗️ Arquitectura

### Estructura de Archivos

```
backend/
├── config/
│   └── cloudinaryConfig.js       # Configuración de Cloudinary
├── services/
│   └── uploadService.js          # Servicio centralizado de uploads
├── middleware/
│   └── imageValidation.js        # Validaciones de archivos
├── routes/
│   ├── bugReports.js             # Endpoints de bug reports (usa Cloudinary)
│   ├── developers.js             # Endpoints de developers (usa Cloudinary)
│   └── systemConfig.js           # Endpoints de logos (usa Cloudinary)
├── models/
│   ├── BugReport.js              # Modelo con campos de Cloudinary
│   └── SystemConfig.js           # Modelo con campos de Cloudinary
└── scripts/
    ├── cleanCloudinary.js        # Limpieza de archivos huérfanos
    └── migrateToCloudinary.js    # Migración de archivos locales
```

### Componentes Principales

#### 1. **cloudinaryConfig.js**
Configura Cloudinary y define storages específicos:
- `bugReportsStorage`: Para archivos de bug reports
- `brandingStorage`: Para logos y branding
- `generalStorage`: Para otros archivos

#### 2. **uploadService.js**
Servicio centralizado con métodos:
- `uploadFile()`: Subir un archivo
- `uploadMultipleFiles()`: Subir múltiples archivos
- `deleteFile()`: Eliminar un archivo
- `deleteMultipleFiles()`: Eliminar múltiples archivos
- `getFileInfo()`: Obtener información de un archivo
- `listFiles()`: Listar archivos en una carpeta
- `cleanOrphanedFiles()`: Limpiar archivos huérfanos
- `generateSignedUrl()`: Generar URL firmada
- `getOptimizedImageUrl()`: Obtener URL optimizada
- `getImageVersions()`: Obtener todas las versiones de una imagen

#### 3. **imageValidation.js**
Middleware de validación con:
- Validación de tipos de archivo
- Validación de tamaños
- Validación de dimensiones
- Configuraciones predefinidas para cada tipo de upload

---

## 🔌 API Endpoints

### Bug Reports

#### Crear Bug Report con Archivos
```http
POST /api/bug-reports
Content-Type: multipart/form-data
Authorization: Bearer {token}

Body (FormData):
{
  "title": "Bug en login",
  "description": "Descripción del bug",
  "actualBehavior": "No se puede iniciar sesión",
  "priority": "high",
  "attachments": [File, File, ...]  // Máximo 5 archivos
}

Response:
{
  "success": true,
  "message": "Bug report creado exitosamente",
  "data": {
    "_id": "...",
    "title": "Bug en login",
    "attachments": [{
      "filename": "appscrum/bug-reports/{bugId}/attachment-123456.jpg",
      "originalName": "screenshot.jpg",
      "url": "https://res.cloudinary.com/...",
      "publicId": "appscrum/bug-reports/{bugId}/attachment-123456",
      "cloudinaryData": {
        "publicId": "...",
        "url": "...",
        "format": "jpg",
        "resourceType": "image"
      }
    }]
  }
}
```

### System Config (Logos)

#### Subir Logo
```http
POST /api/system-config/upload-logo
Content-Type: multipart/form-data
Authorization: Bearer {token} (Super Admin)

Body (FormData):
{
  "logo": File,
  "logoType": "main"  // "main" o "small"
}

Response:
{
  "status": "success",
  "message": "Logo subido exitosamente",
  "logoUrl": "https://res.cloudinary.com/...",
  "publicId": "appscrum/branding/logo-main-123456",
  "versions": {
    "original": "https://...",
    "thumbnail": "https://...",
    "medium": "https://...",
    "large": "https://..."
  }
}
```

#### Eliminar Logo
```http
DELETE /api/system-config/logo/:type
Authorization: Bearer {token} (Super Admin)

Params:
- type: "main" | "small"

Response:
{
  "status": "success",
  "message": "Logo eliminado exitosamente"
}
```

---

## 🎨 Uso en Frontend

### Mostrar Imágenes Optimizadas

```jsx
// En componentes React
const BugReportAttachment = ({ attachment }) => {
  // Usar versiones optimizadas si es imagen
  const imageUrl = attachment.cloudinaryData?.resourceType === 'image'
    ? attachment.cloudinaryData.url // URL optimizada automáticamente
    : attachment.url;

  return (
    <img 
      src={imageUrl} 
      alt={attachment.originalName}
      loading="lazy"  // Lazy loading
    />
  );
};
```

### Mostrar Logo con Versiones

```jsx
const Logo = ({ config }) => {
  // Usar versión thumbnail para preview, large para full
  const logoUrl = config.branding.logoVersions?.medium || config.branding.logo;
  
  return (
    <img 
      src={logoUrl}
      alt={config.branding.appName}
      loading="lazy"
    />
  );
};
```

### Transformaciones On-the-Fly

Cloudinary permite transformar imágenes en la URL:

```javascript
// Cambiar tamaño
const resizedUrl = attachment.url.replace('/upload/', '/upload/w_300,h_300,c_fill/');

// Convertir a WebP
const webpUrl = attachment.url.replace('/upload/', '/upload/f_webp/');

// Combinar transformaciones
const optimizedUrl = attachment.url.replace('/upload/', '/upload/w_300,h_300,c_fill,f_auto,q_auto/');
```

---

## 🛠️ Scripts de Mantenimiento

### 1. Limpiar Archivos Huérfanos

Elimina archivos en Cloudinary que no tienen referencia en la BD:

```bash
# Dry-run (no elimina, solo muestra)
node scripts/cleanCloudinary.js --dry-run

# Ejecutar limpieza real
node scripts/cleanCloudinary.js

# Limpiar carpeta específica
node scripts/cleanCloudinary.js --folder=appscrum/bug-reports
```

### 2. Migrar Archivos Locales

Migra archivos de `uploads/` local a Cloudinary:

```bash
# Dry-run (no migra, solo muestra)
node scripts/migrateToCloudinary.js --dry-run

# Ejecutar migración real
node scripts/migrateToCloudinary.js
```

### 3. Tarea Programada (Cron)

Recomendado ejecutar limpieza periódicamente:

```javascript
// En tu scheduler o cron
const cron = require('node-cron');
const { cleanFolder } = require('./scripts/cleanCloudinary');

// Limpiar cada domingo a las 2 AM
cron.schedule('0 2 * * 0', async () => {
  await cleanFolder('appscrum/bug-reports', validIds);
  await cleanFolder('appscrum/branding', validIds);
});
```

---

## 🔄 Migraciones

### Migración desde Almacenamiento Local

Si ya tienes archivos en `uploads/`, usa el script de migración:

1. **Backup**: Haz backup de la carpeta `uploads/`
2. **Dry-run**: Ejecuta `node scripts/migrateToCloudinary.js --dry-run`
3. **Migración**: Ejecuta `node scripts/migrateToCloudinary.js`
4. **Verificación**: Verifica que las URLs en BD sean de Cloudinary
5. **Limpieza**: Opcional - elimina archivos locales después de verificar

### Compatibilidad hacia atrás

Los modelos mantienen compatibilidad con archivos locales antiguos:
- El campo `path` sigue existiendo
- Si no hay `publicId`, se asume que es un archivo local
- Las migraciones detectan automáticamente qué archivos migrar

---

## ⚡ Optimizaciones

### Transformaciones Automáticas

Cloudinary aplica optimizaciones automáticas:

1. **Formato automático**: Convierte a WebP cuando el navegador lo soporta
2. **Calidad automática**: Ajusta la calidad según el contenido
3. **Lazy loading**: Compatible con loading="lazy"
4. **Responsive**: Genera múltiples tamaños automáticamente

### Configuraciones Predefinidas

```javascript
// En cloudinaryConfig.js
const imageTransformations = {
  thumbnail: { width: 100, height: 100, crop: 'fill' },
  medium: { width: 400, height: 400, crop: 'limit' },
  large: { width: 1200, crop: 'limit' },
  logo: { height: 200, crop: 'fit', background: 'transparent' }
};
```

### Cache del CDN

Cloudinary cachea automáticamente las imágenes en su CDN global, mejorando la velocidad de carga.

---

## 🔧 Troubleshooting

### Error: "Cloudinary credentials not configured"

**Solución**: Verifica que las variables de entorno estén configuradas correctamente en `.env`.

### Error: "File too large"

**Solución**: 
- Bug Reports: máximo 10MB
- Logos: máximo 5MB
- Ajusta los límites en `imageValidation.js` si es necesario

### Archivos no se eliminan de Cloudinary

**Solución**:
1. Verifica que el `publicId` esté guardado correctamente en MongoDB
2. Ejecuta `cleanCloudinary.js` para limpiar huérfanos
3. Verifica permisos en Cloudinary Dashboard

### Imágenes no se muestran en frontend

**Solución**:
1. Verifica que la URL sea accesible (abre en navegador)
2. Verifica CORS en Cloudinary Dashboard
3. Verifica que el campo `url` o `cloudinaryData.url` exista

### Migración falla

**Solución**:
1. Verifica que los archivos locales existan
2. Verifica credenciales de Cloudinary
3. Ejecuta con `--dry-run` primero para detectar problemas
4. Revisa logs en `logs/error.log`

---

## 📊 Monitoreo

### Logs

Todos los eventos se registran en Winston logger:

```javascript
// Revisar logs
tail -f logs/combined.log
tail -f logs/error.log
```

### Dashboard de Cloudinary

Monitorea uso y estadísticas en:
- https://cloudinary.com/console
- Media Library: Ver todos los archivos
- Usage: Ver ancho de banda y almacenamiento
- Transformations: Ver transformaciones aplicadas

---

## 🎯 Mejores Prácticas

1. **Ejecuta limpieza periódicamente**: Usa cron jobs para `cleanCloudinary.js`
2. **Usa versiones optimizadas**: Siempre usa `logoVersions.medium` en lugar de `logo` cuando sea posible
3. **Lazy loading**: Añade `loading="lazy"` a todas las imágenes
4. **Backup**: Haz backup de Cloudinary periódicamente
5. **Monitorea uso**: Revisa el dashboard de Cloudinary para no exceder límites

---

## 📚 Referencias

- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [Multer Storage Cloudinary](https://www.npmjs.com/package/multer-storage-cloudinary)
- [Image Transformations](https://cloudinary.com/documentation/image_transformations)

---

**Última actualización**: 2025-11-22  
**Versión**: 1.0.0  
**Autor**: AppScrum Development Team
