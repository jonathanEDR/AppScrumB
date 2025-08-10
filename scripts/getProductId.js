const mongoose = require('mongoose');
const Product = require('../models/Product');
require('dotenv').config();

async function getProductId() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
    
    const product = await Product.findOne({ nombre: 'Repositorios GitHub' });
    
    if (product) {
      console.log('🆔 ID del producto:', product._id.toString());
    } else {
      console.log('❌ Producto no encontrado');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit();
  }
}

getProductId();
