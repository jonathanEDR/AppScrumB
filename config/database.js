const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Sanear el valor de la variable de entorno para evitar saltos de línea u espacios
        const ATLAS_URI = (process.env.MONGODB_URI || '').trim();
        const NODE_ENV = process.env.NODE_ENV || 'development';

        const mongoOptions = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10
        };

        console.log(`MongoDB connect - NODE_ENV=${NODE_ENV} - ATLAS_URI configured=${!!ATLAS_URI}`);

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
        console.error('❌ Error al conectar a MongoDB:', error && error.message ? error.message : error);
        console.log('\n💡 Verifica que:');
        console.log('1. MongoDB está corriendo localmente (mongod) si no estás en producción');
        console.log('2. El puerto 27017 está disponible (local)');
        console.log('3. La variable de entorno MONGODB_URI está correctamente configurada en el entorno de despliegue');
        console.log('4. La cadena de conexión no contiene saltos de línea o espacios adicionales');
        
        // Intentar reconectar con backoff simple
        setTimeout(() => {
            connectDB();
        }, 5000);
    }
};

module.exports = connectDB;
