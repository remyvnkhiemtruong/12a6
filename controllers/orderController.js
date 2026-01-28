/**
 * Order Controller
 * Features: 41, 43-70, 73-94, 244-250
 */

const { Order, Product, User, Voucher, SystemConfig } = require('../models');
const { formatCurrency, validatePhone, capitalizeWords } = require('../utils/helpers');
const { generateOrderQR } = require('../utils/qrGenerator');

// Create new order
exports.createOrder = async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    
    // Feature 154: Check if orders are enabled
    if (config.operations.stopOnlineOrders) {
      return res.status(503).json({
        error: true,
        message: config.operations.stopOnlineReason || 'Quán tạm ngưng nhận đơn online'
      });
    }
    
    const { customer, items, orderType, deliveryLocation, tableNumber, isGift, giftMessage, hideGiftSender, voucherCode } = req.body;
    
    // Validate customer info - Feature 60, 289
    if (!customer?.name || !customer?.phone) {
      return res.status(400).json({
        error: true,
        message: 'Vui lòng nhập đầy đủ thông tin khách hàng'
      });
    }
    
    if (!validatePhone(customer.phone)) {
      return res.status(400).json({
        error: true,
        message: 'Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)'
      });
    }
    
    // Feature 185: Check blacklist
    const existingCustomer = await User.findOne({ 
      'customerProfile.phone': customer.phone,
      'customerProfile.isBlacklisted': true 
    });
    
    if (existingCustomer) {
      return res.status(403).json({
        error: true,
        message: 'Số điện thoại này đã bị hạn chế đặt hàng'
      });
    }
    
    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({
        error: true,
        message: 'Giỏ hàng trống'
      });
    }
    
    // Feature 293: Check max items
    if (items.length > config.orderSettings.maxItemsPerOrder) {
      return res.status(400).json({
        error: true,
        message: `Tối đa ${config.orderSettings.maxItemsPerOrder} món mỗi đơn`
      });
    }
    
    // Process items and calculate totals
    let subtotal = 0;
    const processedItems = [];
    
    for (const item of items) {
      const product = await Product.findById(item.productId);
      
      if (!product) {
        return res.status(400).json({
          error: true,
          message: `Món "${item.productName || 'Unknown'}" không tồn tại`
        });
      }
      
      // Feature 41: Check stock
      if (!product.inventory.isAvailable) {
        return res.status(400).json({
          error: true,
          message: `Món "${product.name}" đã hết`
        });
      }
      
      if (product.inventory.currentStock < item.quantity) {
        return res.status(400).json({
          error: true,
          message: `Món "${product.name}" chỉ còn ${product.inventory.currentStock}`
        });
      }
      
      // Feature 293: Check max quantity per item
      if (item.quantity > config.orderSettings.maxQuantityPerItem) {
        return res.status(400).json({
          error: true,
          message: `Tối đa ${config.orderSettings.maxQuantityPerItem} phần mỗi món`
        });
      }
      
      // Calculate item price
      let itemPrice = product.getCurrentPrice();
      
      // Add size modifier
      if (item.size && item.size.priceModifier) {
        itemPrice += item.size.priceModifier;
      }
      
      // Add toppings
      let toppingsTotal = 0;
      if (item.selectedToppings && item.selectedToppings.length > 0) {
        toppingsTotal = item.selectedToppings.reduce((sum, t) => sum + (t.price || 0), 0);
      }
      
      // Add required option modifier
      if (item.selectedOption && item.selectedOption.priceModifier) {
        itemPrice += item.selectedOption.priceModifier;
      }
      
      const itemTotal = (itemPrice + toppingsTotal) * item.quantity;
      subtotal += itemTotal;
      
      processedItems.push({
        product: product._id,
        productName: product.name,
        productPrice: product.price,
        quantity: item.quantity,
        size: item.size,
        sugarLevel: item.sugarLevel,
        iceLevel: item.iceLevel,
        selectedToppings: item.selectedToppings,
        selectedOption: item.selectedOption,
        note: item.note?.substring(0, 200), // Feature 288
        kitchenZone: product.kitchenZone,
        itemTotal
      });
      
      // Decrease stock (will be confirmed after order is finalized)
      product.inventory.currentStock -= item.quantity;
      product.inventory.soldCount += item.quantity;
      
      // Feature 10: Mark as limited stock if low
      if (product.inventory.currentStock <= product.inventory.lowStockThreshold) {
        product.labels.isLimitedStock = true;
      }
      
      await product.save();
    }
    
    // Apply voucher - Features 47-48
    let voucherDiscount = 0;
    let appliedVoucher = null;
    
    if (voucherCode) {
      const voucher = await Voucher.findOne({ code: voucherCode.toUpperCase() });
      
      if (voucher) {
        const canUse = voucher.canUse(req.session?.user?._id, customer.phone);
        
        if (canUse.valid) {
          const discountResult = voucher.calculateDiscount(subtotal);
          
          if (discountResult.discount > 0) {
            voucherDiscount = discountResult.discount;
            appliedVoucher = {
              code: voucher.code,
              discount: voucherDiscount,
              type: voucher.discountType
            };
            
            // Record usage
            voucher.usedCount++;
            voucher.usedBy.push({
              user: req.session?.user?._id,
              phone: customer.phone,
              usedAt: new Date()
            });
            await voucher.save();
          }
        }
      }
    }
    
    const total = subtotal - voucherDiscount;
    
    // Feature 292: Prevent 0 value orders (unless gift)
    if (total <= 0 && !isGift) {
      return res.status(400).json({
        error: true,
        message: 'Giá trị đơn hàng phải lớn hơn 0'
      });
    }
    
    // Create order
    const order = new Order({
      customer: {
        name: capitalizeWords(customer.name), // Feature 291
        phone: customer.phone,
        class: customer.class,
        userId: req.session?.user?._id
      },
      items: processedItems,
      orderType: orderType || 'delivery',
      deliveryLocation: deliveryLocation,
      tableNumber: tableNumber,
      isGift: isGift || false,
      giftMessage: giftMessage,
      hideGiftSender: hideGiftSender || false,
      pricing: {
        subtotal,
        voucher: appliedVoucher,
        total
      },
      status: 'pending',
      auditLog: [{
        action: 'created',
        performedAt: new Date(),
        note: 'Đơn hàng được tạo từ web'
      }]
    });
    
    // Calculate estimated time - Feature 65
    await order.calculateEstimatedTime();
    
    await order.save();
    
    // Generate QR for payment - Feature 54
    const qrData = generateOrderQR(config, order);
    
    // Emit socket event for cashier
    const io = req.app.get('io');
    io.to('cashier').emit('order_created', {
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        shortId: order.shortId,
        customer: order.customer,
        items: order.items,
        pricing: order.pricing,
        orderType: order.orderType,
        deliveryLocation: order.deliveryLocation,
        createdAt: order.createdAt
      },
      playSound: true
    });
    
    res.status(201).json({
      success: true,
      message: 'Đặt hàng thành công!',
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        shortId: order.shortId,
        status: order.status,
        pricing: order.pricing,
        estimatedReadyTime: order.estimatedReadyTime
      },
      payment: qrData
    });
    
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể tạo đơn hàng. Vui lòng thử lại!'
    });
  }
};

// Get order by ID or order number
exports.getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    
    let order = await Order.findById(id)
      .populate('items.product', 'name images')
      .populate('shipper.assignedTo', 'displayName phone');
    
    if (!order) {
      order = await Order.findOne({ orderNumber: id })
        .populate('items.product', 'name images')
        .populate('shipper.assignedTo', 'displayName phone');
    }
    
    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Không tìm thấy đơn hàng'
      });
    }
    
    // Generate fresh QR if payment pending
    let paymentQR = null;
    if (order.payment.status === 'pending') {
      const config = await SystemConfig.getConfig();
      paymentQR = generateOrderQR(config, order);
    }
    
    res.json({
      success: true,
      order,
      payment: paymentQR
    });
    
  } catch (error) {
    console.error('Error getting order:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể lấy thông tin đơn hàng'
    });
  }
};

// Get order status (for tracking)
exports.getOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const order = await Order.findById(id)
      .select('orderNumber shortId status payment.status estimatedReadyTime estimatedDeliveryTime shipper.assignedTo createdAt')
      .populate('shipper.assignedTo', 'displayName phone');
    
    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Không tìm thấy đơn hàng'
      });
    }
    
    res.json({
      success: true,
      status: order.status,
      paymentStatus: order.payment.status,
      orderNumber: order.orderNumber,
      shortId: order.shortId,
      estimatedReadyTime: order.estimatedReadyTime,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
      shipper: order.shipper.assignedTo ? {
        name: order.shipper.assignedTo.displayName,
        phone: order.shipper.assignedTo.phone
      } : null,
      createdAt: order.createdAt
    });
    
  } catch (error) {
    console.error('Error getting order status:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể lấy trạng thái đơn hàng'
    });
  }
};

// Update order status (for staff) - Features 77-78, 105-107
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const userId = req.session.user._id;
    
    const order = await Order.findById(id);
    
    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Không tìm thấy đơn hàng'
      });
    }
    
    const previousStatus = order.status;
    order.status = status;
    
    // Add audit log
    order.addAuditLog('status_changed', userId, previousStatus, status, note);
    
    // Update timestamps
    if (status === 'confirmed') {
      order.processedBy = userId;
      order.processedAt = new Date();
    }
    
    await order.save();
    
    // Emit socket events
    const io = req.app.get('io');
    
    // Notify based on status
    switch (status) {
      case 'confirmed':
        io.to('kitchen').emit('new_kitchen_order', { order, playSound: true });
        break;
      case 'ready':
        io.to('shipper').emit('order_ready_for_pickup', {
          orderId: order._id,
          shortId: order.shortId,
          orderType: order.orderType
        });
        break;
      case 'completed':
        io.to('cashier').emit('order_completed', { orderId: order._id });
        break;
    }
    
    // Always update cashier view
    io.to('cashier').emit('order_updated', { orderId: order._id, status });
    
    res.json({
      success: true,
      message: 'Cập nhật trạng thái thành công',
      order: {
        _id: order._id,
        status: order.status
      }
    });
    
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể cập nhật trạng thái'
    });
  }
};

// Cancel order - Feature 68, 78
exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.session?.user?._id;
    
    const order = await Order.findById(id);
    
    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Không tìm thấy đơn hàng'
      });
    }
    
    // Feature 68: Only allow cancel if pending
    if (order.status !== 'pending' && !req.session?.user?.role === 'admin') {
      return res.status(400).json({
        error: true,
        message: 'Chỉ có thể hủy đơn khi đang chờ duyệt'
      });
    }
    
    // Restore stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: {
          'inventory.currentStock': item.quantity,
          'inventory.soldCount': -item.quantity
        }
      });
    }
    
    order.status = 'cancelled';
    order.cancellation = {
      cancelledBy: userId,
      cancelledAt: new Date(),
      reason: reason || 'Khách hủy đơn'
    };
    
    order.addAuditLog('cancelled', userId, 'pending', 'cancelled', reason);
    
    await order.save();
    
    // Emit socket event
    const io = req.app.get('io');
    io.to('cashier').emit('order_cancelled', { orderId: order._id });
    io.to('kitchen').emit('order_cancelled', { orderId: order._id });
    
    res.json({
      success: true,
      message: 'Đã hủy đơn hàng'
    });
    
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể hủy đơn hàng'
    });
  }
};

// Claim payment made - Feature 59
exports.claimPayment = async (req, res) => {
  try {
    const { id } = req.params;
    
    const order = await Order.findById(id);
    
    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Không tìm thấy đơn hàng'
      });
    }
    
    order.payment.customerClaimedPaid = true;
    order.payment.claimedAt = new Date();
    order.payment.status = 'processing';
    
    order.addAuditLog('payment_claimed', null, 'pending', 'processing', 'Khách báo đã chuyển khoản');
    
    await order.save();
    
    // Notify cashier
    const io = req.app.get('io');
    io.to('cashier').emit('payment_claim_received', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      shortId: order.shortId,
      customerPhone: order.customer.phone,
      amount: order.pricing.total,
      claimedAt: order.payment.claimedAt,
      playSound: true
    });
    
    res.json({
      success: true,
      message: 'Đã gửi thông báo. Vui lòng chờ xác nhận!'
    });
    
  } catch (error) {
    console.error('Error claiming payment:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể gửi thông báo'
    });
  }
};

// Confirm payment (cashier) - Feature 89
exports.confirmPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { transactionId, note } = req.body;
    const userId = req.session.user._id;
    
    const order = await Order.findById(id);
    
    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Không tìm thấy đơn hàng'
      });
    }
    
    order.payment.status = 'confirmed';
    order.payment.confirmedBy = userId;
    order.payment.confirmedAt = new Date();
    order.payment.transactionId = transactionId;
    
    order.addAuditLog('payment_confirmed', userId, 'processing', 'confirmed', note);
    
    await order.save();
    
    // Emit socket events
    const io = req.app.get('io');
    io.to('cashier').emit('order_updated', { orderId: order._id, paymentStatus: 'confirmed' });
    io.to('kitchen').emit('order_payment_confirmed', { orderId: order._id });
    
    res.json({
      success: true,
      message: 'Đã xác nhận thanh toán'
    });
    
  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể xác nhận thanh toán'
    });
  }
};

// Get orders by status (for cashier dashboard) - Feature 73
exports.getOrdersByStatus = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    const orders = await Order.find(query)
      .sort({ 'priority.priorityScore': -1, createdAt: -1 })
      .limit(100)
      .populate('items.product', 'name')
      .populate('shipper.assignedTo', 'displayName');
    
    res.json({
      success: true,
      count: orders.length,
      orders
    });
    
  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể lấy danh sách đơn hàng'
    });
  }
};

// Get orders for kitchen (grouped by zone) - Feature 102-104
exports.getKitchenOrders = async (req, res) => {
  try {
    const { zone } = req.query;
    
    const query = {
      status: { $in: ['confirmed', 'cooking'] }
    };
    
    const orders = await Order.find(query)
      .sort({ 'priority.priorityScore': -1, createdAt: 1 }) // Oldest first
      .populate('items.product', 'name recipe');
    
    // Feature 102: Aggregate items by product for efficiency
    const aggregatedItems = {};
    
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.kitchenStatus !== 'done' && (!zone || item.kitchenZone === zone)) {
          const key = `${item.productName}-${item.size?.name || 'default'}-${item.sugarLevel || ''}-${item.iceLevel || ''}`;
          
          if (!aggregatedItems[key]) {
            aggregatedItems[key] = {
              productName: item.productName,
              size: item.size?.name,
              sugarLevel: item.sugarLevel,
              iceLevel: item.iceLevel,
              quantity: 0,
              orders: []
            };
          }
          
          aggregatedItems[key].quantity += item.quantity;
          aggregatedItems[key].orders.push({
            orderId: order._id,
            shortId: order.shortId,
            itemIndex: order.items.indexOf(item),
            note: item.note
          });
        }
      });
    });
    
    res.json({
      success: true,
      orders,
      aggregatedItems: Object.values(aggregatedItems)
    });
    
  } catch (error) {
    console.error('Error getting kitchen orders:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể lấy danh sách món cần làm'
    });
  }
};

// Get orders for shipper - Feature 116-118
exports.getShipperOrders = async (req, res) => {
  try {
    const shipperId = req.session.user._id;
    
    // Orders ready for pickup (not assigned)
    const availableOrders = await Order.find({
      status: 'ready',
      orderType: 'delivery',
      'shipper.assignedTo': null
    })
      .sort({ 'priority.priorityScore': -1, createdAt: 1 })
      .select('shortId customer.name customer.class deliveryLocation pricing.total createdAt');
    
    // Orders assigned to this shipper
    const myOrders = await Order.find({
      status: { $in: ['ready', 'delivering'] },
      'shipper.assignedTo': shipperId
    })
      .sort({ 'shipper.assignedAt': 1 });
    
    res.json({
      success: true,
      available: availableOrders,
      myOrders
    });
    
  } catch (error) {
    console.error('Error getting shipper orders:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể lấy danh sách đơn giao'
    });
  }
};

// Assign shipper to order - Feature 117
exports.assignShipper = async (req, res) => {
  try {
    const { id } = req.params;
    const shipperId = req.session.user._id;
    
    const order = await Order.findById(id);
    
    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Không tìm thấy đơn hàng'
      });
    }
    
    if (order.shipper.assignedTo) {
      return res.status(400).json({
        error: true,
        message: 'Đơn hàng đã được nhận bởi shipper khác'
      });
    }
    
    order.shipper.assignedTo = shipperId;
    order.shipper.assignedAt = new Date();
    
    order.addAuditLog('shipper_assigned', shipperId, null, shipperId, 'Shipper nhận đơn');
    
    await order.save();
    
    // Update shipper's current orders
    await User.findByIdAndUpdate(shipperId, {
      $push: { 'shipperProfile.currentOrders': order._id }
    });
    
    // Emit socket events
    const io = req.app.get('io');
    const shipper = await User.findById(shipperId);
    
    io.to('cashier').emit('order_assigned_to_shipper', {
      orderId: order._id,
      shipperName: shipper.displayName
    });
    
    io.to('shipper').emit('order_taken', {
      orderId: order._id,
      takenBy: shipper.displayName
    });
    
    res.json({
      success: true,
      message: 'Đã nhận đơn thành công!'
    });
    
  } catch (error) {
    console.error('Error assigning shipper:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể nhận đơn'
    });
  }
};

// Complete delivery - Feature 127
exports.completeDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentCollected, note } = req.body;
    const shipperId = req.session.user._id;
    
    const order = await Order.findById(id);
    
    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Không tìm thấy đơn hàng'
      });
    }
    
    order.status = 'completed';
    order.shipper.deliveredAt = new Date();
    order.shipper.paymentCollected = paymentCollected;
    order.shipper.paymentCollectedAt = paymentCollected ? new Date() : null;
    
    if (paymentCollected) {
      order.payment.status = 'confirmed';
      order.payment.confirmedAt = new Date();
    }
    
    order.addAuditLog('delivery_completed', shipperId, 'delivering', 'completed', note);
    
    await order.save();
    
    // Update shipper stats
    await User.findByIdAndUpdate(shipperId, {
      $pull: { 'shipperProfile.currentOrders': order._id },
      $inc: { 'shipperProfile.completedDeliveries': 1 }
    });
    
    // Emit socket events
    const io = req.app.get('io');
    io.to('cashier').emit('order_completed', {
      orderId: order._id,
      shipperId,
      paymentCollected
    });
    
    res.json({
      success: true,
      message: 'Giao hàng thành công!'
    });
    
  } catch (error) {
    console.error('Error completing delivery:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể hoàn tất giao hàng'
    });
  }
};

// Get customer order history - Feature 70
exports.getCustomerHistory = async (req, res) => {
  try {
    const { phone } = req.query;
    
    if (!phone) {
      return res.status(400).json({
        error: true,
        message: 'Số điện thoại là bắt buộc'
      });
    }
    
    const orders = await Order.find({ 'customer.phone': phone })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('orderNumber shortId status pricing.total createdAt items');
    
    res.json({
      success: true,
      orders
    });
    
  } catch (error) {
    console.error('Error getting customer history:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể lấy lịch sử đơn hàng'
    });
  }
};
