const express = require('express');
const router = express.Router();
const { Product, Category, SystemConfig, Order } = require('../models');
const { formatCurrency } = require('../utils/helpers');

// Homepage - Customer menu
router.get('/', async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    const categories = await Category.find({ isActive: true }).sort({ displayOrder: 1 });
    const products = await Product.find({ isActive: true, 'inventory.isAvailable': true })
      .populate('category')
      .sort({ displayOrder: 1, 'labels.isBestSeller': -1 });
    
    const bestSellers = products.filter(p => p.labels.isBestSeller).slice(0, 6);
    
    res.render('customer/menu', {
      title: config.store.name,
      config,
      categories,
      products,
      bestSellers,
      formatCurrency
    });
  } catch (error) {
    console.error('Error loading menu:', error);
    res.status(500).render('errors/500', { title: 'Lỗi', message: error.message });
  }
});

// Cart page
router.get('/cart', async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    
    res.render('customer/cart', {
      title: 'Giỏ hàng - ' + config.store.name,
      config,
      formatCurrency
    });
  } catch (error) {
    console.error('Error loading cart:', error);
    res.status(500).render('errors/500', { title: 'Lỗi', message: error.message });
  }
});

// Order tracking page
router.get('/tracking/:id', async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    const order = await Order.findById(req.params.id)
      .populate('items.product')
      .populate('shipper.assignedTo', 'displayName phone');
    
    if (!order) {
      return res.status(404).render('errors/404', {
        title: 'Không tìm thấy đơn hàng',
        message: 'Đơn hàng không tồn tại hoặc đã bị xóa'
      });
    }
    
    res.render('customer/tracking', {
      title: `Đơn hàng ${order.shortId} - ${config.store.name}`,
      config,
      order,
      formatCurrency
    });
  } catch (error) {
    console.error('Error loading tracking:', error);
    res.status(500).render('errors/500', { title: 'Lỗi', message: error.message });
  }
});

// Login page
router.get('/login', (req, res) => {
  if (req.session.user) {
    // Already logged in, redirect based on role
    const role = req.session.user.role;
    switch (role) {
      case 'admin': return res.redirect('/admin');
      case 'cashier': return res.redirect('/cashier');
      case 'kitchen': return res.redirect('/kitchen');
      case 'shipper': return res.redirect('/shipper');
      default: return res.redirect('/');
    }
  }
  
  res.render('auth/login', {
    title: 'Đăng nhập',
    error: req.query.error
  });
});

module.exports = router;
