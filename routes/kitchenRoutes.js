const express = require('express');
const router = express.Router();
const { isKitchen } = require('../middleware/auth');
const { Order, Product, SystemConfig, Category } = require('../models');

// Apply auth middleware
router.use(isKitchen);

// KDS Main View - Features 101-115
router.get('/', async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    const { zone } = req.query;
    
    // Get orders that need kitchen attention
    const orders = await Order.find({
      status: { $in: ['confirmed', 'cooking'] }
    })
      .sort({ 'priority.priorityScore': -1, createdAt: 1 })
      .populate('items.product', 'name recipe prepTime');
    
    // Filter by zone if specified
    let filteredOrders = orders;
    if (zone) {
      filteredOrders = orders.map(order => ({
        ...order.toObject(),
        items: order.items.filter(item => item.kitchenZone === zone)
      })).filter(order => order.items.length > 0);
    }
    
    // Feature 102: Aggregate items for efficient cooking
    const aggregatedItems = {};
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        if (item.kitchenStatus !== 'done') {
          const key = `${item.productName}|${item.size?.name || ''}|${item.sugarLevel || ''}|${item.iceLevel || ''}`;
          if (!aggregatedItems[key]) {
            aggregatedItems[key] = {
              productName: item.productName,
              size: item.size?.name,
              sugarLevel: item.sugarLevel,
              iceLevel: item.iceLevel,
              totalQuantity: 0,
              orders: []
            };
          }
          aggregatedItems[key].totalQuantity += item.quantity;
          aggregatedItems[key].orders.push({
            orderId: order._id,
            shortId: order.shortId,
            quantity: item.quantity,
            note: item.note,
            createdAt: order.createdAt
          });
        }
      });
    });
    
    // Get categories for zone filtering
    const categories = await Category.find({ isActive: true });
    
    // Get products for out-of-stock management
    const products = await Product.find({ isActive: true })
      .select('name inventory.isAvailable inventory.currentStock')
      .sort({ name: 1 });
    
    res.render('kitchen/kds', {
      title: 'Bếp - ' + config.store.name,
      config,
      orders: filteredOrders,
      aggregatedItems: Object.values(aggregatedItems),
      categories,
      products,
      currentZone: zone || 'all',
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading KDS:', error);
    res.status(500).render('errors/500', { title: 'Lỗi', message: error.message });
  }
});

// Full screen mode
router.get('/fullscreen', async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    const { zone } = req.query;
    
    const orders = await Order.find({
      status: { $in: ['confirmed', 'cooking'] }
    })
      .sort({ 'priority.priorityScore': -1, createdAt: 1 })
      .populate('items.product', 'name');
    
    res.render('kitchen/fullscreen', {
      title: 'KDS - Toàn màn hình',
      config,
      orders,
      currentZone: zone || 'all',
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading fullscreen KDS:', error);
    res.status(500).render('errors/500', { title: 'Lỗi', message: error.message });
  }
});

module.exports = router;
