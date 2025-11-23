/**
 * Script de migración para actualizar roles de usuarios existentes
 * Ejecutar con: node scripts/migrate-user-roles.js
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const { RolePermissionsService } = require('../services/rolePermissionsService');
require('dotenv').config();

async function migrateUserRoles() {
  try {
    console.log('🚀 Iniciando migración de roles...\n');

    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URL);
    console.log('✅ Conectado a MongoDB\n');

    // Obtener todos los usuarios
    const users = await User.find({});
    console.log(`📊 Usuarios encontrados: ${users.length}\n`);

    let updated = 0;
    let unchanged = 0;
    let errors = 0;

    for (const user of users) {
      try {
        const oldRole = user.role;
        
        // Normalizar el rol usando el servicio
        const normalizedRole = RolePermissionsService.normalizeRole(oldRole);

        // Si el rol cambió, actualizar
        if (oldRole !== normalizedRole) {
          user.role = normalizedRole;
          await user.save();
          
          console.log(`✅ Usuario actualizado:`);
          console.log(`   Email: ${user.email}`);
          console.log(`   Rol anterior: ${oldRole}`);
          console.log(`   Rol nuevo: ${normalizedRole}\n`);
          
          updated++;
        } else {
          // Validar que el rol es válido
          if (!RolePermissionsService.isValidRole(user.role)) {
            console.warn(`⚠️  Usuario con rol inválido:`);
            console.warn(`   Email: ${user.email}`);
            console.warn(`   Rol: ${user.role}`);
            console.warn(`   Asignando rol 'user' por defecto\n`);
            
            user.role = 'user';
            await user.save();
            updated++;
          } else {
            unchanged++;
          }
        }
      } catch (error) {
        console.error(`❌ Error al procesar usuario ${user.email}:`, error.message);
        errors++;
      }
    }

    // Resumen
    console.log('\n' + '='.repeat(50));
    console.log('📋 RESUMEN DE MIGRACIÓN');
    console.log('='.repeat(50));
    console.log(`✅ Usuarios actualizados: ${updated}`);
    console.log(`⏸️  Usuarios sin cambios: ${unchanged}`);
    console.log(`❌ Errores: ${errors}`);
    console.log(`📊 Total procesado: ${users.length}`);
    console.log('='.repeat(50) + '\n');

    // Mostrar distribución de roles actualizada
    const roleDistribution = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    console.log('📊 DISTRIBUCIÓN DE ROLES ACTUALIZADA:');
    console.log('='.repeat(50));
    roleDistribution.forEach(({ _id, count }) => {
      const roleInfo = RolePermissionsService.getRoleInfo(_id);
      console.log(`${roleInfo.name.padEnd(20)} : ${count} usuarios`);
    });
    console.log('='.repeat(50) + '\n');

    console.log('✅ Migración completada exitosamente!\n');

  } catch (error) {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

// Ejecutar migración
if (require.main === module) {
  migrateUserRoles()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = migrateUserRoles;
