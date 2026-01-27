const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/auth');
const { Order, Product, User, Category, Voucher, SystemConfig } = require('../models');
const { formatCurrency } = require('../utils/helpers');

// Apply auth middleware
router.use(isAdmin);

// Admin Dashboard - Features 158-164
router.get('/', async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    
    // Today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [
      todayOrders,
      totalProducts,
      totalStaff,
      totalCustomers
    ] = await Promise.all([
      Order.find({ createdAt: { $gte: today } }),
      Product.countDocuments({ isActive: true }),
      User.countDocuments({ role: { $ne: 'customer' } }),
      User.countDocuments({ role: 'customer' })
    ]);
    
    // Calculate revenue
    const completedOrders = todayOrders.filter(o => o.status === 'completed');
    const todayRevenue = completedOrders.reduce((sum, o) => sum + (o.pricing?.total || 0), 0);
    
    // Hourly revenue for chart - Feature 158
    const hourlyRevenue = Array(24).fill(0);
    completedOrders.forEach(order => {
      const hour = new Date(order.createdAt).getHours();
      hourlyRevenue[hour] += order.pricing?.total || 0;
    });
    
    // Top selling products - Feature 159
    const topProducts = await Product.find({ isActive: true })
      .sort({ 'inventory.soldCount': -1 })
      .limit(10)
      .select('name inventory.soldCount price');
    
    // Shipper performance - Feature 160
    const shippers = await User.find({ role: 'shipper' })
      .select('displayName shipperProfile.completedDeliveries shipperProfile.averageDeliveryTime');
    
    res.render('admin/dashboard', {
      title: 'Quản lý - ' + config.store.name,
      config,
      stats: {
        todayOrders: todayOrders.length,
        todayRevenue,
        completedOrders: completedOrders.length,
        totalProducts,
        totalStaff,
        totalCustomers
      },
      hourlyRevenue,
      topProducts,
      shippers,
      formatCurrency,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading admin dashboard:', error);
    res.status(500).render('errors/500', { title: 'Lỗi', message: error.message });
  }
});

// Menu Management - Features 137-144
router.get('/menu', async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    const categories = await Category.find().sort({ displayOrder: 1 });
    const products = await Product.find()
      .populate('category')
      .sort({ displayOrder: 1 });
    
    res.render('admin/menu', {
      title: 'Quản lý Menu',
      config,
      categories,
      products,
      formatCurrency,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading menu management:', error);
    res.status(500).render('errors/500', { title: 'Lỗi', message: error.message });
  }
});

// Staff Management - Features 148-151
router.get('/staff', async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    const staff = await User.find({ role: { $ne: 'customer' } })
      .sort({ role: 1, displayName: 1 });
    
    res.render('admin/staff', {
      title: 'Quản lý Nhân viên',
      config,
      staff,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading staff management:', error);
    res.status(500).render('errors/500', { title: 'Lỗi', message: error.message });
  }
});

// System Settings - Features 145-147, 153-157
router.get('/settings', async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    
    res.render('admin/settings', {
      title: 'Cài đặt Hệ thống',
      config,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading settings:', error);
    res.status(500).render('errors/500', { title: 'Lỗi', message: error.message });
  }
});

// Update settings
router.post('/settings', async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    const updates = req.body;
    
    // Update nested objects
    if (updates.store) Object.assign(config.store, updates.store);
    if (updates.payment) Object.assign(config.payment, updates.payment);
    if (updates.operations) Object.assign(config.operations, updates.operations);
    if (updates.orderSettings) Object.assign(config.orderSettings, updates.orderSettings);
    if (updates.notifications) Object.assign(config.notifications, updates.notifications);
    if (updates.theme) Object.assign(config.theme, updates.theme);
    if (updates.credits) Object.assign(config.credits, updates.credits);
    
    await config.save();
    
    res.json({ success: true, message: 'Lưu cài đặt thành công' });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: true, message: 'Không thể lưu cài đặt' });
  }
});

// Voucher Management
router.get('/vouchers', async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    const vouchers = await Voucher.find().sort({ createdAt: -1 });
    
    res.render('admin/vouchers', {
      title: 'Quản lý Voucher',
      config,
      vouchers,
      formatCurrency,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading vouchers:', error);
    res.status(500).render('errors/500', { title: 'Lỗi', message: error.message });
  }
});

// Reports - Features 158-164
router.get('/reports', async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date().setHours(0, 0, 0, 0);
    const end = endDate ? new Date(endDate) : new Date();
    
    const orders = await Order.find({
      createdAt: { $gte: start, $lte: end },
      status: 'completed'
    }).populate('items.product', 'name');
    
    // Calculate stats
    const totalRevenue = orders.reduce((sum, o) => sum + (o.pricing?.total || 0), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    
    // Product breakdown
    const productStats = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        const name = item.productName;
        if (!productStats[name]) {
          productStats[name] = { quantity: 0, revenue: 0 };
        }
        productStats[name].quantity += item.quantity;
        productStats[name].revenue += item.itemTotal || 0;
      });
    });
    
    res.render('admin/reports', {
      title: 'Báo cáo',
      config,
      orders,
      stats: { totalRevenue, totalOrders, avgOrderValue },
      productStats,
      startDate: start,
      endDate: end,
      formatCurrency,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading reports:', error);
    res.status(500).render('errors/500', { title: 'Lỗi', message: error.message });
  }
});

// System logs - Feature 152
router.get('/logs', async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    
    // Get recent order audit logs
    const recentOrders = await Order.find()
      .sort({ updatedAt: -1 })
      .limit(100)
      .select('orderNumber shortId auditLog')
      .populate('auditLog.performedBy', 'displayName');
    
    // Flatten audit logs
    const logs = [];
    recentOrders.forEach(order => {
      order.auditLog.forEach(log => {
        logs.push({
          orderNumber: order.orderNumber,
          shortId: order.shortId,
          ...log.toObject()
        });
      });
    });
    
    // Sort by date
    logs.sort((a, b) => new Date(b.performedAt) - new Date(a.performedAt));
    
    res.render('admin/logs', {
      title: 'Nhật ký Hệ thống',
      config,
      logs: logs.slice(0, 200),
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading logs:', error);
    res.status(500).render('errors/500', { title: 'Lỗi', message: error.message });
  }
});

module.exports = router;
