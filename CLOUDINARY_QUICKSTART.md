# 📸 Cloudinary Integration - Quick Start Guide

Sistema de gestión de imágenes con Cloudinary para AppScrum.

## 🚀 Inicio Rápido

### 1. Configurar Credenciales

Añade a tu archivo `.env`:

```env
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

### 2. Obtener Credenciales

1. Crea cuenta en [Cloudinary](https://cloudinary.com/)
2. Copia credenciales del Dashboard
3. Pega en `.env`

### 3. Verificar Instalación

```bash
npm start
```

Deberías ver:
```
☁️  Cloudinary: Connected
```

## 📋 Scripts Disponibles

```bash
# Migrar archivos locales a Cloudinary (dry-run)
npm run cloudinary:migrate:dry

# Migrar archivos locales a Cloudinary (real)
npm run cloudinary:migrate

# Limpiar archivos huérfanos (dry-run)
npm run cloudinary:clean:dry

# Limpiar archivos huérfanos (real)
npm run cloudinary:clean
```

## 📝 Uso en el Código

### Backend - Subir Archivo

```javascript
const uploadService = require('./services/uploadService');

// Subir un archivo
const result = await uploadService.uploadFile(file, {
  folder: 'appscrum/mi-carpeta',
  tags: ['mi-tag'],
  resourceType: 'auto'
});

console.log(result.url); // URL de Cloudinary
console.log(result.publicId); // ID para operaciones
```

### Backend - Eliminar Archivo

```javascript
await uploadService.deleteFile(publicId, 'image');
```

### Frontend - Mostrar Imagen Optimizada

```jsx
<img 
  src={attachment.cloudinaryData?.url || attachment.url}
  alt={attachment.originalName}
  loading="lazy"
/>
```

## 🔧 Endpoints Actualizados

### Bug Reports
```http
POST /api/bug-reports
Content-Type: multipart/form-data

Body:
- attachments: File[] (máx 5, 10MB c/u)
```

### Logos
```http
POST /api/system-config/upload-logo
Content-Type: multipart/form-data

Body:
- logo: File (máx 5MB)
- logoType: "main" | "small"
```

## 📚 Características

✅ **Automáticas**:
- Transformación a WebP
- Compresión inteligente
- CDN global
- Múltiples versiones (thumbnail, medium, large)

✅ **Seguridad**:
- Validación de tipos de archivo
- Límites de tamaño
- URLs firmadas disponibles

✅ **Mantenimiento**:
- Limpieza de archivos huérfanos
- Migración de archivos locales
- Logs detallados

## 🆘 Troubleshooting

### No se conecta a Cloudinary
- Verifica credenciales en `.env`
- Verifica conectividad a internet

### Archivos no se suben
- Verifica límites de tamaño (10MB bug reports, 5MB logos)
- Verifica tipo de archivo permitido
- Revisa logs: `logs/error.log`

### Imágenes no se muestran
- Verifica que `cloudinaryData.url` exista
- Abre la URL en navegador para verificar acceso
- Verifica CORS en Cloudinary Dashboard

## 📖 Documentación Completa

Ver: [`docs/CLOUDINARY_IMPLEMENTATION.md`](./CLOUDINARY_IMPLEMENTATION.md)

## 🎯 Próximos Pasos

1. ✅ Configura credenciales
2. ✅ Verifica conexión (`npm start`)
3. 📋 Migra archivos existentes (`npm run cloudinary:migrate:dry`)
4. 🧹 Limpia archivos huérfanos (`npm run cloudinary:clean`)
5. 🚀 ¡Listo para usar!

---

**Soporte**: Ver documentación completa o revisar logs en `logs/`
