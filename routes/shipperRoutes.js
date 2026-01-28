const express = require('express');
const router = express.Router();
const { isShipper } = require('../middleware/auth');
const { Order, User, SystemConfig } = require('../models');
const { formatCurrency } = require('../utils/helpers');

// Apply auth middleware
router.use(isShipper);

// Shipper App - Features 116-131
router.get('/', async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    const shipperId = req.session.user._id;
    
    // Get shipper profile
    const shipper = await User.findById(shipperId);
    
    // Orders ready for pickup (not assigned)
    const availableOrders = await Order.find({
      status: 'ready',
      orderType: 'delivery',
      'shipper.assignedTo': null
    })
      .sort({ 'priority.priorityScore': -1, createdAt: 1 })
      .select('shortId customer deliveryLocation pricing.total createdAt priority');
    
    // Orders assigned to this shipper
    const myOrders = await Order.find({
      'shipper.assignedTo': shipperId,
      status: { $in: ['ready', 'delivering'] }
    })
      .sort({ status: 1, 'shipper.assignedAt': 1 })
      .populate('items.product', 'name');
    
    // Today's completed deliveries
    const completedToday = await Order.countDocuments({
      'shipper.assignedTo': shipperId,
      status: 'completed',
      'shipper.deliveredAt': { $gte: new Date().setHours(0, 0, 0, 0) }
    });
    
    res.render('shipper/app', {
      title: 'Shipper - ' + config.store.name,
      config,
      shipper,
      availableOrders,
      myOrders,
      completedToday,
      formatCurrency,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading shipper app:', error);
    res.status(500).render('errors/500', { title: 'Lỗi', message: error.message });
  }
});

// Order detail for shipper
router.get('/order/:id', async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'name images');
    
    if (!order) {
      return res.status(404).render('errors/404', {
        title: 'Không tìm thấy đơn hàng'
      });
    }
    
    // Generate QR for payment collection - Feature 126
    const qrUrl = config.payment.accountNumber ? 
      `https://img.vietqr.io/image/${config.payment.bankId}-${config.payment.accountNumber}-compact2.png?amount=${order.pricing.total}&addInfo=${encodeURIComponent(`${config.payment.transferTemplate} ${order.shortId}`)}&accountName=${encodeURIComponent(config.payment.accountName)}` 
      : null;
    
    res.render('shipper/order-detail', {
      title: `Đơn ${order.shortId} - Giao hàng`,
      config,
      order,
      qrUrl,
      formatCurrency,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading shipper order:', error);
    res.status(500).render('errors/500', { title: 'Lỗi', message: error.message });
  }
});

// Delivery history
router.get('/history', async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    const shipperId = req.session.user._id;
    
    const orders = await Order.find({
      'shipper.assignedTo': shipperId,
      status: 'completed'
    })
      .sort({ 'shipper.deliveredAt': -1 })
      .limit(50)
      .select('shortId customer deliveryLocation pricing.total shipper.deliveredAt');
    
    res.render('shipper/history', {
      title: 'Lịch sử giao hàng',
      config,
      orders,
      formatCurrency,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading shipper history:', error);
    res.status(500).render('errors/500', { title: 'Lỗi', message: error.message });
  }
});

module.exports = router;
