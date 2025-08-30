#!/usr/bin/env node

/**
 * Script de verificación de despliegue
 * Ejecutar antes del despliegue para verificar configuración
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuración de despliegue...\n');

// Verificar archivos de configuración del frontend
const frontendDir = path.join(__dirname, '..', '..', 'AppScrum');
const frontendEnvPath = path.join(frontendDir, '.env');

console.log('📁 Frontend:');
if (fs.existsSync(frontendEnvPath)) {
  const envContent = fs.readFileSync(frontendEnvPath, 'utf8');
  const hasClerkKey = envContent.includes('VITE_CLERK_PUBLISHABLE_KEY=');
  const hasApiUrl = envContent.includes('VITE_API_URL=');
  const usesProductionUrl = envContent.includes('appscrum-backend.onrender.com');

  console.log(`  ✅ .env existe`);
  console.log(`  ${hasClerkKey ? '✅' : '❌'} VITE_CLERK_PUBLISHABLE_KEY configurado`);
  console.log(`  ${hasApiUrl ? '✅' : '❌'} VITE_API_URL configurado`);
  console.log(`  ${usesProductionUrl ? '✅' : '❌'} URL de producción configurada`);
} else {
  console.log(`  ❌ .env no encontrado`);
}

// Verificar archivos de configuración del backend
const backendDir = path.join(__dirname, '..');
const backendEnvPath = path.join(backendDir, '.env');

console.log('\n📁 Backend:');
if (fs.existsSync(backendEnvPath)) {
  const envContent = fs.readFileSync(backendEnvPath, 'utf8');
  const hasMongoUri = envContent.includes('MONGODB_URI=');
  const hasClerkSecret = envContent.includes('CLERK_SECRET_KEY=');
  const hasCorsOrigins = envContent.includes('CORS_ORIGINS=');

  console.log(`  ✅ .env existe`);
  console.log(`  ${hasMongoUri ? '✅' : '❌'} MONGODB_URI configurado`);
  console.log(`  ${hasClerkSecret ? '✅' : '❌'} CLERK_SECRET_KEY configurado`);
  console.log(`  ${hasCorsOrigins ? '✅' : '❌'} CORS_ORIGINS configurado`);
} else {
  console.log(`  ❌ .env no encontrado`);
}

// Verificar dependencias
console.log('\n📦 Dependencias:');
const frontendPackagePath = path.join(frontendDir, 'package.json');
const backendPackagePath = path.join(backendDir, 'package.json');

if (fs.existsSync(frontendPackagePath)) {
  const packageContent = JSON.parse(fs.readFileSync(frontendPackagePath, 'utf8'));
  const hasClerkReact = packageContent.dependencies && packageContent.dependencies['@clerk/clerk-react'];
  console.log(`  ✅ Frontend package.json existe`);
  console.log(`  ${hasClerkReact ? '✅' : '❌'} @clerk/clerk-react instalado`);
} else {
  console.log(`  ❌ Frontend package.json no encontrado`);
}

if (fs.existsSync(backendPackagePath)) {
  const packageContent = JSON.parse(fs.readFileSync(backendPackagePath, 'utf8'));
  const hasClerkSdk = packageContent.dependencies && packageContent.dependencies['@clerk/clerk-sdk-node'];
  const hasMongoose = packageContent.dependencies && packageContent.dependencies['mongoose'];
  console.log(`  ✅ Backend package.json existe`);
  console.log(`  ${hasClerkSdk ? '✅' : '❌'} @clerk/clerk-sdk-node instalado`);
  console.log(`  ${hasMongoose ? '✅' : '❌'} mongoose instalado`);
} else {
  console.log(`  ❌ Backend package.json no encontrado`);
}

console.log('\n🚀 Recomendaciones:');
console.log('1. Asegúrate de que todas las variables de entorno estén configuradas');
console.log('2. Verifica que las URLs de CORS estén actualizadas');
console.log('3. Confirma que las claves de Clerk sean las correctas');
console.log('4. Revisa que MongoDB Atlas esté accesible');
console.log('5. Ejecuta npm install en ambos directorios antes del despliegue');
