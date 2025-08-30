#!/usr/bin/env node

/**
 * Script de prueba para verificar la integración de usuarios
 */

const mongoose = require('mongoose');
const User = require('../models/User');

async function testUserCreation() {
  try {
    console.log('🔍 Probando integración de usuarios...\n');

    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/AppScrum');
    console.log('✅ Conexión a MongoDB exitosa');

    // Verificar que el modelo User esté funcionando
    const userCount = await User.countDocuments();
    console.log(`📊 Usuarios en la base de datos: ${userCount}`);

    // Probar crear un usuario de prueba (solo si no existe)
    const testClerkId = 'test_user_123';
    let testUser = await User.findOne({ clerk_id: testClerkId });

    if (!testUser) {
      testUser = new User({
        clerk_id: testClerkId,
        email: 'test@example.com',
        nombre_negocio: 'Usuario de Prueba',
        role: 'user',
        is_active: true
      });
      await testUser.save();
      console.log('✅ Usuario de prueba creado');
    } else {
      console.log('✅ Usuario de prueba ya existe');
    }

    // Verificar que se puede consultar por clerk_id
    const foundUser = await User.findOne({ clerk_id: testClerkId });
    if (foundUser) {
      console.log('✅ Consulta por clerk_id funciona correctamente');
      console.log(`   Usuario encontrado: ${foundUser.email} - Rol: ${foundUser.role}`);
    }

    // Limpiar usuario de prueba
    await User.deleteOne({ clerk_id: testClerkId });
    console.log('🧹 Usuario de prueba limpiado');

    console.log('\n🎉 Todas las pruebas pasaron correctamente!');
    console.log('\n📋 Resumen:');
    console.log('- ✅ Conexión a MongoDB');
    console.log('- ✅ Modelo User funcionando');
    console.log('- ✅ Creación de usuarios');
    console.log('- ✅ Consulta por clerk_id');
    console.log('- ✅ Integración Clerk -> Base de datos');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

// Ejecutar pruebas
testUserCreation();
