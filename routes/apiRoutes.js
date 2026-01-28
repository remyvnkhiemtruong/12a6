const express = require('express');
const router = express.Router();
const { SystemConfig, Voucher } = require('../models');
const { getOnlineStats } = require('../config/socket');

// Get system config (public parts)
router.get('/config', async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    
    res.json({
      success: true,
      config: {
        store: {
          name: config.store.name,
          slogan: config.store.slogan,
          hotline: config.store.hotline
        },
        operations: {
          isOpen: config.operations.isOpen,
          stopOnlineOrders: config.operations.stopOnlineOrders,
          maintenanceMode: config.operations.maintenanceMode,
          maintenanceMessage: config.operations.maintenanceMessage
        },
        theme: config.theme,
        credits: config.credits
      }
    });
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({ error: true, message: 'Không thể tải cấu hình' });
  }
});

// Validate voucher
router.post('/validate-voucher', async (req, res) => {
  try {
    const { code, orderTotal, phone } = req.body;
    
    if (!code) {
      return res.status(400).json({
        error: true,
        message: 'Vui lòng nhập mã voucher'
      });
    }
    
    const voucher = await Voucher.findOne({ code: code.toUpperCase() });
    
    if (!voucher) {
      return res.status(404).json({
        error: true,
        message: 'Mã voucher không tồn tại'
      });
    }
    
    const canUse = voucher.canUse(null, phone);
    if (!canUse.valid) {
      return res.status(400).json({
        error: true,
        message: canUse.message
      });
    }
    
    const discountResult = voucher.calculateDiscount(orderTotal || 0);
    
    if (discountResult.message) {
      return res.status(400).json({
        error: true,
        message: discountResult.message
      });
    }
    
    res.json({
      success: true,
      voucher: {
        code: voucher.code,
        name: voucher.name,
        discount: discountResult.discount,
        discountType: voucher.discountType,
        discountValue: voucher.discountValue
      }
    });
    
  } catch (error) {
    console.error('Error validating voucher:', error);
    res.status(500).json({ error: true, message: 'Không thể kiểm tra voucher' });
  }
});

// Get online stats - Feature 215
router.get('/online-stats', (req, res) => {
  const stats = getOnlineStats();
  res.json({
    success: true,
    stats: {
      total: stats.total,
      byRole: stats.byRole
    }
  });
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
