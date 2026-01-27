/**
 * Product Controller
 * Features: 3-16, 20-26, 108-109, 137-144
 */

const { Product, Category } = require('../models');

// Get all products for menu (customer view) - Features 3-16
exports.getMenu = async (req, res) => {
  try {
    const { category, search, sort, view } = req.query;
    
    const query = {
      isActive: true,
      'inventory.isAvailable': true
    };
    
    // Feature 5: Filter by category
    if (category) {
      const cat = await Category.findOne({ slug: category });
      if (cat) {
        query.category = cat._id;
      }
    }
    
    // Feature 3: Search
    if (search) {
      query.$text = { $search: search };
    }
    
    // Build sort option - Feature 6
    let sortOption = { displayOrder: 1, 'labels.isBestSeller': -1 };
    if (sort === 'price_asc') {
      sortOption = { price: 1 };
    } else if (sort === 'price_desc') {
      sortOption = { price: -1 };
    } else if (sort === 'popular') {
      sortOption = { 'inventory.soldCount': -1 };
    }
    
    const products = await Product.find(query)
      .sort(sortOption)
      .populate('category', 'name slug icon')
      .select('-recipe -createdBy'); // Don't expose recipe to customers
    
    // Get all categories for filter tabs
    const categories = await Category.find({ isActive: true })
      .sort({ displayOrder: 1 });
    
    res.json({
      success: true,
      count: products.length,
      products,
      categories
    });
    
  } catch (error) {
    console.error('Error getting menu:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể tải menu'
    });
  }
};

// Get single product details - Feature 15
exports.getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findById(id)
      .populate('category', 'name')
      .populate('upsellProducts', 'name price images'); // Feature 20
    
    if (!product) {
      return res.status(404).json({
        error: true,
        message: 'Không tìm thấy món ăn'
      });
    }
    
    res.json({
      success: true,
      product
    });
    
  } catch (error) {
    console.error('Error getting product:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể tải thông tin món ăn'
    });
  }
};

// Get best sellers - Feature 9
exports.getBestSellers = async (req, res) => {
  try {
    const products = await Product.find({
      isActive: true,
      'inventory.isAvailable': true,
      'labels.isBestSeller': true
    })
      .sort({ 'inventory.soldCount': -1 })
      .limit(10)
      .select('name price originalPrice images labels inventory.soldCount');
    
    res.json({
      success: true,
      products
    });
    
  } catch (error) {
    console.error('Error getting best sellers:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể tải danh sách bán chạy'
    });
  }
};

// Get random product - Feature 24
exports.getRandomProduct = async (req, res) => {
  try {
    const count = await Product.countDocuments({
      isActive: true,
      'inventory.isAvailable': true
    });
    
    const random = Math.floor(Math.random() * count);
    
    const product = await Product.findOne({
      isActive: true,
      'inventory.isAvailable': true
    })
      .skip(random)
      .select('name price images description');
    
    res.json({
      success: true,
      product
    });
    
  } catch (error) {
    console.error('Error getting random product:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể chọn món ngẫu nhiên'
    });
  }
};

// Toggle product availability (kitchen) - Features 108-109
exports.toggleAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { isAvailable } = req.body;
    
    const product = await Product.findByIdAndUpdate(
      id,
      { 'inventory.isAvailable': isAvailable },
      { new: true }
    );
    
    if (!product) {
      return res.status(404).json({
        error: true,
        message: 'Không tìm thấy món ăn'
      });
    }
    
    // Emit socket event
    const io = req.app.get('io');
    io.to('customer').emit('product_availability_changed', {
      productId: id,
      productName: product.name,
      isAvailable
    });
    
    res.json({
      success: true,
      message: isAvailable ? 'Đã mở bán món' : 'Đã tắt món',
      product: {
        _id: product._id,
        name: product.name,
        isAvailable
      }
    });
    
  } catch (error) {
    console.error('Error toggling availability:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể cập nhật trạng thái món'
    });
  }
};

// ADMIN FUNCTIONS - Features 137-144

// Create product
exports.createProduct = async (req, res) => {
  try {
    const productData = req.body;
    productData.createdBy = req.session.user._id;
    
    const product = await Product.create(productData);
    
    res.status(201).json({
      success: true,
      message: 'Thêm món thành công',
      product
    });
    
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể thêm món ăn'
    });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const product = await Product.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });
    
    if (!product) {
      return res.status(404).json({
        error: true,
        message: 'Không tìm thấy món ăn'
      });
    }
    
    res.json({
      success: true,
      message: 'Cập nhật thành công',
      product
    });
    
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể cập nhật món ăn'
    });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Soft delete - just mark inactive
    const product = await Product.findByIdAndUpdate(id, { isActive: false });
    
    if (!product) {
      return res.status(404).json({
        error: true,
        message: 'Không tìm thấy món ăn'
      });
    }
    
    res.json({
      success: true,
      message: 'Đã xóa món ăn'
    });
    
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể xóa món ăn'
    });
  }
};

// Update stock - Feature 143
exports.updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, action } = req.body; // action: 'set', 'add', 'subtract'
    
    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({
        error: true,
        message: 'Không tìm thấy món ăn'
      });
    }
    
    if (action === 'set') {
      product.inventory.currentStock = quantity;
    } else if (action === 'add') {
      product.inventory.currentStock += quantity;
    } else if (action === 'subtract') {
      product.inventory.currentStock = Math.max(0, product.inventory.currentStock - quantity);
    }
    
    // Update limited stock label
    product.labels.isLimitedStock = product.inventory.currentStock <= product.inventory.lowStockThreshold;
    
    await product.save();
    
    res.json({
      success: true,
      message: 'Cập nhật kho thành công',
      stock: product.inventory.currentStock
    });
    
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể cập nhật kho'
    });
  }
};

// Get all categories
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find()
      .sort({ displayOrder: 1 });
    
    res.json({
      success: true,
      categories
    });
    
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể tải danh mục'
    });
  }
};

// Create category
exports.createCategory = async (req, res) => {
  try {
    const category = await Category.create(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Thêm danh mục thành công',
      category
    });
    
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể thêm danh mục'
    });
  }
};

// Update category
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    const category = await Category.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });
    
    if (!category) {
      return res.status(404).json({
        error: true,
        message: 'Không tìm thấy danh mục'
      });
    }
    
    res.json({
      success: true,
      message: 'Cập nhật danh mục thành công',
      category
    });
    
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể cập nhật danh mục'
    });
  }
};
