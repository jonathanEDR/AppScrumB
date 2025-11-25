/**
 * ProductService - Servicio para gestión de Productos
 * Contiene toda la lógica de negocio relacionada con productos
 * Puede ser usado tanto por rutas HTTP como por agentes AI
 */

const Product = require('../models/Product');
const BacklogItem = require('../models/BacklogItem');
const User = require('../models/User');
const { Sprint, Release } = require('../models/Sprint');

class ProductService {
  /**
   * Obtener todos los productos con filtros y paginación
   */
  static async getProducts(filters = {}, pagination = {}) {
    try {
      const {
        search,
        page = 1,
        limit = 10
      } = { ...filters, ...pagination };

      const skip = (page - 1) * limit;
      let filter = {};

      // Búsqueda por texto
      if (search) {
        filter.$or = [
          { nombre: { $regex: search, $options: 'i' } },
          { descripcion: { $regex: search, $options: 'i' } }
        ];
      }

      const [products, total] = await Promise.all([
        Product.find(filter)
          .populate('responsable', 'nombre_negocio email')
          .populate('created_by', 'nombre_negocio email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Product.countDocuments(filter)
      ]);

      return {
        success: true,
        products,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / limit),
          total_items: total,
          per_page: parseInt(limit)
        }
      };
    } catch (error) {
      console.error('ProductService.getProducts error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener un producto por ID
   */
  static async getProductById(productId) {
    try {
      const product = await Product.findById(productId)
        .populate('responsable', 'nombre_negocio email')
        .populate('created_by', 'nombre_negocio email')
        .lean();

      if (!product) {
        return {
          success: false,
          error: 'Producto no encontrado'
        };
      }

      return {
        success: true,
        product
      };
    } catch (error) {
      console.error('ProductService.getProductById error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Crear un nuevo producto
   */
  static async createProduct(productData, userId) {
    try {
      const { nombre, descripcion, responsable, fecha_fin } = productData;

      // Validaciones
      if (!nombre || !descripcion || !responsable) {
        return {
          success: false,
          error: 'Nombre, descripción y responsable son requeridos'
        };
      }

      // Verificar que el responsable existe y es válido
      const responsableUser = await User.findById(responsable);
      if (!responsableUser) {
        return {
          success: false,
          error: 'El usuario responsable no existe'
        };
      }

      // Crear el producto
      const nuevoProducto = new Product({
        nombre,
        descripcion,
        responsable,
        fecha_fin,
        created_by: userId,
        updated_by: userId
      });

      await nuevoProducto.save();
      await nuevoProducto.populate('responsable', 'nombre_negocio email');

      return {
        success: true,
        producto: nuevoProducto,
        message: 'Producto creado exitosamente'
      };
    } catch (error) {
      console.error('ProductService.createProduct error:', error);
      
      // Manejo de error de duplicado
      if (error.code === 11000) {
        return {
          success: false,
          error: 'Ya existe un producto con ese nombre'
        };
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Actualizar un producto
   */
  static async updateProduct(productId, updates, userId) {
    try {
      const finalUpdates = { ...updates, updated_by: userId };

      // Si se actualiza el responsable, verificar que existe
      if (finalUpdates.responsable) {
        const responsableUser = await User.findById(finalUpdates.responsable);
        if (!responsableUser) {
          return {
            success: false,
            error: 'El usuario responsable no existe'
          };
        }
      }

      const producto = await Product.findByIdAndUpdate(
        productId,
        finalUpdates,
        { new: true, runValidators: true }
      ).populate('responsable', 'nombre_negocio email');

      if (!producto) {
        return {
          success: false,
          error: 'Producto no encontrado'
        };
      }

      return {
        success: true,
        producto,
        message: 'Producto actualizado exitosamente'
      };
    } catch (error) {
      console.error('ProductService.updateProduct error:', error);
      
      // Manejo de error de duplicado
      if (error.code === 11000) {
        return {
          success: false,
          error: 'Ya existe un producto con ese nombre'
        };
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Eliminar un producto
   */
  static async deleteProduct(productId) {
    try {
      // Verificar si el producto tiene items en el backlog
      const backlogItems = await BacklogItem.countDocuments({ producto: productId });
      if (backlogItems > 0) {
        return {
          success: false,
          error: 'No se puede eliminar el producto porque tiene items en el backlog',
          backlog_items_count: backlogItems
        };
      }

      // Verificar si tiene sprints
      const sprints = await Sprint.countDocuments({ product_id: productId });
      if (sprints > 0) {
        return {
          success: false,
          error: 'No se puede eliminar el producto porque tiene sprints asociados',
          sprints_count: sprints
        };
      }

      const producto = await Product.findByIdAndDelete(productId);
      if (!producto) {
        return {
          success: false,
          error: 'Producto no encontrado'
        };
      }

      return {
        success: true,
        message: 'Producto eliminado exitosamente',
        deleted_product: {
          id: producto._id,
          nombre: producto.nombre
        }
      };
    } catch (error) {
      console.error('ProductService.deleteProduct error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener usuarios disponibles para asignar como responsables
   */
  static async getUsersForAssignment() {
    try {
      const users = await User.find({
        role: { $in: ['product_owner', 'scrum_master', 'developers', 'user'] },
        is_active: true
      })
        .select('_id nombre_negocio email role')
        .sort({ nombre_negocio: 1, email: 1 })
        .lean();

      return {
        success: true,
        users,
        total: users.length
      };
    } catch (error) {
      console.error('ProductService.getUsersForAssignment error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener estadísticas de un producto
   */
  static async getProductStats(productId) {
    try {
      const [
        backlogCount,
        sprintsCount,
        releasesCount,
        backlogStats
      ] = await Promise.all([
        BacklogItem.countDocuments({ producto: productId }),
        Sprint.countDocuments({ product_id: productId }),
        Release.countDocuments({ product_id: productId }),
        BacklogItem.aggregate([
          { $match: { producto: productId } },
          {
            $group: {
              _id: null,
              total_puntos: { $sum: '$puntos_historia' },
              por_estado: {
                $push: {
                  estado: '$estado',
                  count: 1
                }
              },
              por_tipo: {
                $push: {
                  tipo: '$tipo',
                  count: 1
                }
              }
            }
          }
        ])
      ]);

      return {
        success: true,
        stats: {
          total_backlog_items: backlogCount,
          total_sprints: sprintsCount,
          total_releases: releasesCount,
          backlog_details: backlogStats[0] || {
            total_puntos: 0,
            por_estado: [],
            por_tipo: []
          }
        }
      };
    } catch (error) {
      console.error('ProductService.getProductStats error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener el backlog completo de un producto
   */
  static async getProductBacklog(productId, filters = {}) {
    try {
      const BacklogService = require('./BacklogService');
      
      return await BacklogService.getBacklogItems({
        producto: productId,
        ...filters
      });
    } catch (error) {
      console.error('ProductService.getProductBacklog error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validar datos de producto
   */
  static validateProductData(productData) {
    const errors = [];

    if (!productData.nombre || productData.nombre.trim() === '') {
      errors.push('El nombre del producto es requerido');
    }

    if (productData.nombre && productData.nombre.length < 3) {
      errors.push('El nombre del producto debe tener al menos 3 caracteres');
    }

    if (!productData.descripcion || productData.descripcion.trim() === '') {
      errors.push('La descripción del producto es requerida');
    }

    if (!productData.responsable) {
      errors.push('El responsable del producto es requerido');
    }

    return {
      is_valid: errors.length === 0,
      errors
    };
  }
}

module.exports = ProductService;
