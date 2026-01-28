const { Order, User, Product, SystemConfig } = require('../models');

/**
 * Socket.io Configuration and Event Handlers
 * Covers Features: 62-63, 67, 74-75, 101-115, 116-131, 178, 189, 215, 224-226
 */

// Track online users - Feature 215
const onlineUsers = new Map();
const roomUsers = {
  customer: new Set(),
  cashier: new Set(),
  kitchen: new Set(),
  shipper: new Set(),
  admin: new Set()
};

const configureSocket = (io) => {
  
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);
    
    // ============================================
    // ROOM MANAGEMENT - Join role-based rooms
    // ============================================
    
    socket.on('join_room', async (data) => {
      const { role, userId, username } = data;
      
      if (!role) {
        socket.emit('error', { message: 'Role is required' });
        return;
      }
      
      // Join role-specific room
      socket.join(role);
      roomUsers[role]?.add(socket.id);
      
      // Track user info
      onlineUsers.set(socket.id, {
        id: socket.id,
        role,
        userId,
        username,
        joinedAt: new Date()
      });
      
      // Update user's socket ID in database if logged in
      if (userId) {
        try {
          await User.findByIdAndUpdate(userId, {
            currentSocketId: socket.id,
            lastActive: new Date()
          });
        } catch (err) {
          console.error('Error updating user socket ID:', err);
        }
      }
      
      // Broadcast online count to all (Feature 215)
      io.emit('online_count', {
        total: onlineUsers.size,
        byRole: {
          customer: roomUsers.customer.size,
          cashier: roomUsers.cashier.size,
          kitchen: roomUsers.kitchen.size,
          shipper: roomUsers.shipper.size
        }
      });
      
      console.log(`👤 User joined room: ${role} (${socket.id})`);
      socket.emit('joined_room', { room: role, socketId: socket.id });
    });
    
    // ============================================
    // ORDER EVENTS - Real-time order updates
    // ============================================
    
    // New order created (from customer) - Feature 74-75
    socket.on('new_order', async (orderData) => {
      try {
        // Emit to cashier room with notification sound trigger
        io.to('cashier').emit('order_created', {
          order: orderData,
          playSound: true, // Feature 74: Ting ting sound
          showPopup: true  // Feature 75: Popup notification
        });
        
        // Also notify kitchen for awareness
        io.to('kitchen').emit('order_incoming', {
          orderId: orderData._id,
          itemCount: orderData.items?.length || 0
        });
        
        // Confirm to customer
        socket.emit('order_submitted', {
          success: true,
          orderId: orderData._id,
          orderNumber: orderData.orderNumber,
          shortId: orderData.shortId
        });
        
        console.log(`📦 New order: ${orderData.orderNumber}`);
      } catch (error) {
        console.error('Error handling new order:', error);
        socket.emit('error', { message: 'Failed to process order' });
      }
    });
    
    // Order confirmed by cashier - sent to kitchen (Feature 77)
    socket.on('order_confirmed', async (data) => {
      const { orderId, processedBy } = data;
      
      try {
        const order = await Order.findById(orderId)
          .populate('items.product');
        
        if (!order) {
          socket.emit('error', { message: 'Order not found' });
          return;
        }
        
        // Emit to kitchen room - Feature 101
        io.to('kitchen').emit('new_kitchen_order', {
          order,
          playSound: true
        });
        
        // Notify customer of confirmation - Feature 63
        const customerSocket = order.customer?.userId 
          ? (await User.findById(order.customer.userId))?.currentSocketId
          : null;
        
        if (customerSocket) {
          io.to(customerSocket).emit('order_status_update', {
            orderId: order._id,
            status: 'confirmed',
            message: 'Đơn hàng đã được xác nhận! Đang chuyển đến bếp...',
            estimatedTime: order.estimatedReadyTime
          });
        }
        
        // Broadcast to all cashiers to update their view
        io.to('cashier').emit('order_updated', {
          orderId,
          status: 'confirmed'
        });
        
        console.log(`✅ Order confirmed: ${order.orderNumber}`);
      } catch (error) {
        console.error('Error confirming order:', error);
        socket.emit('error', { message: 'Failed to confirm order' });
      }
    });
    
    // ============================================
    // KITCHEN EVENTS - KDS updates (Features 101-115)
    // ============================================
    
    // Kitchen marks item as cooking (Feature 105)
    socket.on('item_cooking', async (data) => {
      const { orderId, itemIndex } = data;
      
      io.to('cashier').emit('kitchen_update', {
        orderId,
        itemIndex,
        status: 'cooking'
      });
      
      console.log(`🍳 Cooking item ${itemIndex} of order ${orderId}`);
    });
    
    // Kitchen marks item as done (Feature 106)
    socket.on('item_done', async (data) => {
      const { orderId, itemIndex } = data;
      
      io.to('cashier').emit('kitchen_update', {
        orderId,
        itemIndex,
        status: 'done'
      });
    });
    
    // Kitchen marks entire order as done (Feature 107)
    socket.on('kitchen_done', async (data) => {
      const { orderId, completedBy } = data;
      
      try {
        const order = await Order.findById(orderId);
        if (!order) return;
        
        // Notify cashier
        io.to('cashier').emit('order_ready', {
          orderId,
          orderNumber: order.orderNumber,
          shortId: order.shortId,
          orderType: order.orderType,
          playSound: true
        });
        
        // Notify shippers if delivery order (Feature 116)
        if (order.orderType === 'delivery') {
          io.to('shipper').emit('order_ready_for_pickup', {
            orderId,
            orderNumber: order.orderNumber,
            shortId: order.shortId,
            deliveryLocation: order.deliveryLocation,
            customerName: order.customer.name,
            customerPhone: order.customer.phone,
            playSound: true
          });
        }
        
        // Feature 133: Notify pass station for dine-in
        if (order.orderType === 'dine_in') {
          io.to('pass').emit('order_ready_for_pass', {
            orderId,
            shortId: order.shortId,
            tableNumber: order.tableNumber
          });
        }
        
        // Notify customer
        const customerSocket = order.customer?.userId 
          ? (await User.findById(order.customer.userId))?.currentSocketId
          : null;
        
        if (customerSocket) {
          io.to(customerSocket).emit('order_status_update', {
            orderId: order._id,
            status: 'ready',
            message: order.orderType === 'delivery' 
              ? 'Đơn hàng đã xong! Shipper đang đến lấy...'
              : 'Đơn hàng đã sẵn sàng! Vui lòng đến quầy nhận.',
            playSound: true, // Feature 195: Confetti effect
            showConfetti: true
          });
        }
        
        console.log(`✅ Kitchen done: ${order.orderNumber}`);
      } catch (error) {
        console.error('Error handling kitchen done:', error);
      }
    });
    
    // Feature 108-109: Product availability toggle
    socket.on('toggle_product_availability', async (data) => {
      const { productId, isAvailable } = data;
      
      try {
        await Product.findByIdAndUpdate(productId, {
          'inventory.isAvailable': isAvailable
        });
        
        // Broadcast to all customers
        io.to('customer').emit('product_availability_changed', {
          productId,
          isAvailable
        });
        
        // Also notify cashier
        io.to('cashier').emit('product_availability_changed', {
          productId,
          isAvailable
        });
        
        console.log(`📦 Product ${productId} availability: ${isAvailable}`);
      } catch (error) {
        console.error('Error toggling product availability:', error);
      }
    });
    
    // ============================================
    // SHIPPER EVENTS (Features 116-131)
    // ============================================
    
    // Shipper grabs an order (Feature 117)
    socket.on('shipper_grab', async (data) => {
      const { orderId, shipperId } = data;
      
      try {
        const order = await Order.findById(orderId);
        const shipper = await User.findById(shipperId);
        
        if (!order || !shipper) {
          socket.emit('error', { message: 'Order or shipper not found' });
          return;
        }
        
        // Notify cashier
        io.to('cashier').emit('order_assigned_to_shipper', {
          orderId,
          orderNumber: order.orderNumber,
          shipperId,
          shipperName: shipper.displayName
        });
        
        // Remove from other shippers' available list
        io.to('shipper').emit('order_taken', {
          orderId,
          takenBy: shipper.displayName
        });
        
        // Confirm to the shipper who grabbed it
        socket.emit('order_grabbed_success', {
          orderId,
          order
        });
        
        console.log(`🚴 Shipper ${shipper.displayName} grabbed order ${order.orderNumber}`);
      } catch (error) {
        console.error('Error handling shipper grab:', error);
      }
    });
    
    // Shipper started delivery (Feature 123)
    socket.on('shipper_departed', async (data) => {
      const { orderId, shipperId } = data;
      
      try {
        const order = await Order.findById(orderId);
        
        // Notify customer that shipper is coming
        const customerSocket = order.customer?.userId 
          ? (await User.findById(order.customer.userId))?.currentSocketId
          : null;
        
        if (customerSocket) {
          io.to(customerSocket).emit('order_status_update', {
            orderId,
            status: 'delivering',
            message: 'Shipper đang trên đường giao hàng cho bạn! 🛵'
          });
        }
        
        // Notify cashier
        io.to('cashier').emit('order_updated', {
          orderId,
          status: 'delivering'
        });
      } catch (error) {
        console.error('Error handling shipper departed:', error);
      }
    });
    
    // Shipper arrived at location (Feature 123)
    socket.on('shipper_arrived', async (data) => {
      const { orderId, shipperId } = data;
      
      try {
        const order = await Order.findById(orderId);
        
        // Notify customer to come out
        const customerSocket = order.customer?.userId 
          ? (await User.findById(order.customer.userId))?.currentSocketId
          : null;
        
        if (customerSocket) {
          io.to(customerSocket).emit('order_status_update', {
            orderId,
            status: 'arrived',
            message: 'Shipper đã đến! Vui lòng ra lấy hàng 📍',
            playSound: true
          });
        }
      } catch (error) {
        console.error('Error handling shipper arrived:', error);
      }
    });
    
    // Delivery completed (Feature 127)
    socket.on('delivery_completed', async (data) => {
      const { orderId, shipperId, paymentCollected } = data;
      
      try {
        const order = await Order.findById(orderId);
        const shipper = await User.findById(shipperId);
        
        // Notify cashier
        io.to('cashier').emit('order_completed', {
          orderId,
          orderNumber: order.orderNumber,
          shipperId,
          shipperName: shipper.displayName,
          paymentCollected
        });
        
        // Notify customer with confetti (Feature 195)
        const customerSocket = order.customer?.userId 
          ? (await User.findById(order.customer.userId))?.currentSocketId
          : null;
        
        if (customerSocket) {
          io.to(customerSocket).emit('order_status_update', {
            orderId,
            status: 'completed',
            message: 'Giao hàng thành công! Cảm ơn bạn đã ủng hộ! 🎉',
            showConfetti: true, // Feature 284
            pointsEarned: order.pointsEarned
          });
        }
        
        console.log(`✅ Delivery completed: ${order.orderNumber}`);
      } catch (error) {
        console.error('Error handling delivery completed:', error);
      }
    });
    
    // ============================================
    // PAYMENT EVENTS (Features 54-61, 87-91, 127)
    // ============================================
    
    // Customer claims payment made (Feature 59)
    socket.on('payment_claimed', async (data) => {
      const { orderId, customerPhone } = data;
      
      // Notify cashier to verify
      io.to('cashier').emit('payment_claim_received', {
        orderId,
        customerPhone,
        claimedAt: new Date(),
        playSound: true
      });
      
      console.log(`💳 Payment claimed for order ${orderId}`);
    });
    
    // Cashier confirms payment (Feature 89)
    socket.on('payment_confirmed', async (data) => {
      const { orderId, confirmedBy } = data;
      
      try {
        const order = await Order.findById(orderId);
        
        // Notify customer
        const customerSocket = order.customer?.userId 
          ? (await User.findById(order.customer.userId))?.currentSocketId
          : null;
        
        if (customerSocket) {
          io.to(customerSocket).emit('payment_status_update', {
            orderId,
            status: 'confirmed',
            message: 'Thanh toán đã được xác nhận! ✅',
            showConfetti: true // Feature 284
          });
        }
        
        // Update all views
        io.to('cashier').emit('order_updated', { orderId, paymentStatus: 'confirmed' });
        io.to('kitchen').emit('order_payment_confirmed', { orderId });
        
        console.log(`✅ Payment confirmed for order ${orderId}`);
      } catch (error) {
        console.error('Error confirming payment:', error);
      }
    });
    
    // ============================================
    // INTERNAL CHAT (Features 224-226)
    // ============================================
    
    // Staff chat message (Feature 224-225)
    socket.on('staff_chat', async (data) => {
      const { from, to, message, fromName } = data;
      
      // Send to specific room or broadcast
      if (to === 'all') {
        // Feature 226: Broadcast to all staff
        io.to('cashier').to('kitchen').to('shipper').emit('staff_message', {
          from,
          fromName,
          message,
          timestamp: new Date(),
          isBroadcast: true
        });
      } else {
        // Direct message to room
        io.to(to).emit('staff_message', {
          from,
          fromName,
          message,
          timestamp: new Date()
        });
      }
    });
    
    // ============================================
    // SYSTEM EVENTS (Features 154, 230, 232)
    // ============================================
    
    // Feature 154: Panic button - stop all orders
    socket.on('stop_orders', async (data) => {
      const { reason, stoppedBy } = data;
      
      // Broadcast to all customers
      io.to('customer').emit('system_announcement', {
        type: 'warning',
        message: reason || 'Quán tạm ngưng nhận đơn. Vui lòng quay lại sau!',
        timestamp: new Date()
      });
      
      // Notify all staff
      io.to('cashier').to('kitchen').to('shipper').emit('system_status_changed', {
        ordersEnabled: false,
        reason
      });
    });
    
    // Feature 232: Maintenance mode
    socket.on('maintenance_mode', async (data) => {
      const { enabled, message } = data;
      
      io.emit('system_maintenance', {
        enabled,
        message: message || 'Hệ thống đang bảo trì, vui lòng quay lại sau!'
      });
    });
    
    // Feature 230: Force sync request
    socket.on('force_sync', async (data) => {
      const { userId, role } = data;
      
      // Send fresh data to the requesting client
      socket.emit('sync_data', {
        timestamp: new Date(),
        success: true
      });
    });
    
    // ============================================
    // DISCONNECT HANDLING
    // ============================================
    
    socket.on('disconnect', async () => {
      const user = onlineUsers.get(socket.id);
      
      if (user) {
        roomUsers[user.role]?.delete(socket.id);
        onlineUsers.delete(socket.id);
        
        // Update user's socket ID in database
        if (user.userId) {
          try {
            await User.findByIdAndUpdate(user.userId, {
              currentSocketId: null,
              lastActive: new Date()
            });
          } catch (err) {
            console.error('Error updating user on disconnect:', err);
          }
        }
        
        // Broadcast updated online count
        io.emit('online_count', {
          total: onlineUsers.size,
          byRole: {
            customer: roomUsers.customer.size,
            cashier: roomUsers.cashier.size,
            kitchen: roomUsers.kitchen.size,
            shipper: roomUsers.shipper.size
          }
        });
      }
      
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
    
  });
  
  return io;
};

// Helper to get online stats
const getOnlineStats = () => ({
  total: onlineUsers.size,
  byRole: {
    customer: roomUsers.customer.size,
    cashier: roomUsers.cashier.size,
    kitchen: roomUsers.kitchen.size,
    shipper: roomUsers.shipper.size
  },
  users: Array.from(onlineUsers.values())
});

module.exports = { configureSocket, getOnlineStats };
