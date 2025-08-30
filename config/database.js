const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const ATLAS_URI = process.env.MONGODB_URI;
        const NODE_ENV = process.env.NODE_ENV || 'development';

        const mongoOptions = {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10
        };

        // En producción, usar solo MongoDB Atlas
        if (NODE_ENV === 'production') {
            if (!ATLAS_URI) {
                throw new Error('MONGODB_URI es requerido en producción');
            }

            await mongoose.connect(ATLAS_URI, mongoOptions);
            console.log('✅ Conexión exitosa a MongoDB Atlas (Producción)');
        } else {
            // En desarrollo, intentar local primero, luego Atlas
            const LOCAL_URI = 'mongodb://localhost:27017/AppScrum';

            try {
                await mongoose.connect(LOCAL_URI, mongoOptions);
                console.log('✅ Conexión exitosa a MongoDB Local');
            } catch (localError) {
                console.log('⚠️  MongoDB local no disponible, intentando Atlas...');
                if (ATLAS_URI) {
                    await mongoose.connect(ATLAS_URI, mongoOptions);
                    console.log('✅ Conexión exitosa a MongoDB Atlas');
                } else {
                    throw new Error('No se pudo conectar a MongoDB Local ni Atlas');
                }
            }
        }

        // Configurar manejadores de eventos
        mongoose.connection.on('error', (err) => {
            console.error('❌ Error de MongoDB:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('❗ MongoDB desconectado');
        });

        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log('Conexión a MongoDB cerrada por terminación de la aplicación');
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Error al conectar a MongoDB:', error.message);
        console.log('\n💡 Verifica que:');
        console.log('1. MongoDB está corriendo localmente (mongod)');
        console.log('2. El puerto 27017 está disponible');
        console.log('3. Las credenciales de MongoDB Atlas son correctas (si usas Atlas)');
        
        // No cerramos el proceso, intentamos reconectar
        setTimeout(() => {
            connectDB();
        }, 5000);
    }
};

module.exports = connectDB;
