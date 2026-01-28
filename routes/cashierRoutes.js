const express = require('express');
const router = express.Router();
const { isCashier } = require('../middleware/auth');
const { Order, Product, SystemConfig } = require('../models');
const { formatCurrency } = require('../utils/helpers');
const { getOnlineStats } = require('../config/socket');

// Apply auth middleware to all routes
router.use(isCashier);

// Dashboard
router.get('/', async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    
    // Get order counts by status
    const [pending, confirmed, cooking, ready, delivering, completed] = await Promise.all([
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: 'confirmed' }),
      Order.countDocuments({ status: 'cooking' }),
      Order.countDocuments({ status: 'ready' }),
      Order.countDocuments({ status: 'delivering' }),
      Order.countDocuments({ 
        status: 'completed',
        createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
      })
    ]);
    
    // Get today's revenue
    const todayOrders = await Order.find({
      status: 'completed',
      createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
    });
    
    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.pricing?.total || 0), 0);
    
    // Get pending orders
    const pendingOrders = await Order.find({ status: 'pending' })
      .sort({ 'priority.priorityScore': -1, createdAt: 1 })
      .limit(50)
      .populate('items.product', 'name');
    
    // Get all active orders (not completed/cancelled)
    const activeOrders = await Order.find({
      status: { $nin: ['completed', 'cancelled'] }
    })
      .sort({ 'priority.priorityScore': -1, createdAt: -1 })
      .populate('items.product', 'name');
    
    // Get products for quick order
    const products = await Product.find({ isActive: true })
      .populate('category')
      .sort({ 'inventory.soldCount': -1 });
    
    // Online stats
    const onlineStats = getOnlineStats();
    
    res.render('cashier/dashboard', {
      title: 'Thu Ngân - ' + config.store.name,
      config,
      stats: { pending, confirmed, cooking, ready, delivering, completed, todayRevenue },
      pendingOrders,
      activeOrders,
      products,
      onlineStats,
      formatCurrency,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading cashier dashboard:', error);
    res.status(500).render('errors/500', { title: 'Lỗi', message: error.message });
  }
});

// POS Mode - Feature 95
router.get('/pos', async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    const products = await Product.find({ isActive: true, 'inventory.isAvailable': true })
      .populate('category')
      .sort({ 'inventory.soldCount': -1 });
    const categories = await Category.find({ isActive: true }).sort({ displayOrder: 1 });
    
    res.render('cashier/pos', {
      title: 'POS - ' + config.store.name,
      config,
      products,
      categories,
      formatCurrency,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading POS:', error);
    res.status(500).render('errors/500', { title: 'Lỗi', message: error.message });
  }
});

// Order detail
router.get('/order/:id', async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    const order = await Order.findById(req.params.id)
      .populate('items.product')
      .populate('shipper.assignedTo', 'displayName phone')
      .populate('processedBy', 'displayName')
      .populate('auditLog.performedBy', 'displayName');
    
    if (!order) {
      return res.status(404).render('errors/404', {
        title: 'Không tìm thấy đơn hàng'
      });
    }
    
    res.render('cashier/order-detail', {
      title: `Đơn ${order.shortId} - Thu Ngân`,
      config,
      order,
      formatCurrency,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading order detail:', error);
    res.status(500).render('errors/500', { title: 'Lỗi', message: error.message });
  }
});

module.exports = router;
