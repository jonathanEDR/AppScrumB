# Configuración de Variables de Entorno para Producción

## Para Render.com

1. Ve a tu servicio en Render Dashboard
2. Settings → Environment
3. Añade estas variables:

```
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

## Para Vercel

1. Ve a tu proyecto en Vercel Dashboard
2. Settings → Environment Variables
3. Añade las mismas variables:

```
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

## Obtener Credenciales

1. Inicia sesión en https://cloudinary.com/console
2. En el Dashboard, copia:
   - Cloud Name
   - API Key
   - API Secret

## Verificar en Producción

Después de configurar, verifica los logs de tu aplicación.
Deberías ver:
```
☁️  Cloudinary: Connected
```

Si ves:
```
☁️  Cloudinary: Not Configured
```
Verifica que las variables estén correctamente configuradas en tu plataforma.

## Notas Importantes

- ⚠️ **NUNCA** commitees las credenciales reales en git
- ✅ Usa variables de entorno en todas las plataformas
- ✅ Regenera las credenciales si se exponen accidentalmente
- ✅ Usa diferentes cuentas/carpetas para dev/staging/prod

## Plan Gratuito de Cloudinary

El plan gratuito incluye:
- 25 créditos mensuales
- 25GB de almacenamiento
- 25GB de ancho de banda
- Suficiente para la mayoría de aplicaciones pequeñas/medianas

Monitorea el uso en: https://cloudinary.com/console/usage
