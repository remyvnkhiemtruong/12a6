// Cashier dashboard real-time logic
document.addEventListener('DOMContentLoaded', () => {
  // Join cashier room
  socket.emit('join_room', { role: 'cashier' });
  
  // Feature 74: New order notification
  socket.on('new_order', (order) => {
    playSound();
    showToast(`🔔 Đơn mới: #${order.shortId}`, 'info');
    // Reload to show new order (or dynamically add)
    setTimeout(() => location.reload(), 1000);
  });
  
  socket.on('order_confirmed', (data) => {
    updateOrderCard(data.orderId, 'confirmed');
  });
  
  socket.on('kitchen_done', (data) => {
    updateOrderCard(data.orderId, 'ready');
    playSound();
    showToast(`✅ Đơn #${data.shortId} đã xong!`, 'success');
  });
  
  socket.on('delivery_completed', (data) => {
    updateOrderCard(data.orderId, 'completed');
  });
  
  // Feature 77-78: Quick confirm/cancel
  document.querySelectorAll('.quick-confirm').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const orderId = btn.dataset.id;
      
      try {
        const res = await fetch(`/api/orders/${orderId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'confirmed' })
        });
        
        if (res.ok) {
          showToast('✅ Đã duyệt đơn', 'success');
          updateOrderCard(orderId, 'confirmed');
        }
      } catch (e) {
        showToast('Lỗi duyệt đơn', 'error');
      }
    });
  });
  
  document.querySelectorAll('.quick-cancel').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const orderId = btn.dataset.id;
      
      const reason = prompt('Lý do hủy đơn:');
      if (!reason) return;
      
      try {
        const res = await fetch(`/api/orders/${orderId}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason })
        });
        
        if (res.ok) {
          showToast('❌ Đã hủy đơn', 'warning');
          document.querySelector(`.order-card[data-id="${orderId}"]`)?.remove();
        }
      } catch (e) {
        showToast('Lỗi hủy đơn', 'error');
      }
    });
  });
  
  // Order card click - view detail
  document.querySelectorAll('.order-card').forEach(card => {
    card.addEventListener('click', () => {
      const orderId = card.dataset.id;
      window.location.href = `/cashier/order/${orderId}`;
    });
  });
  
  // Feature 84: Search orders
  document.getElementById('search-orders')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    document.querySelectorAll('.order-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.classList.toggle('hidden', query && !text.includes(query));
    });
  });
  
  // Feature 85: Status filter
  document.getElementById('status-filter')?.addEventListener('change', (e) => {
    const status = e.target.value;
    document.querySelectorAll('.order-card').forEach(card => {
      const cardStatus = card.dataset.status;
      card.classList.toggle('hidden', status !== 'all' && cardStatus !== status);
    });
  });
  
  function updateOrderCard(orderId, newStatus) {
    const card = document.querySelector(`.order-card[data-id="${orderId}"]`);
    if (!card) return;
    
    card.dataset.status = newStatus;
    
    // Update border color
    card.classList.remove('border-orange-500', 'border-blue-500', 'border-green-500', 'border-purple-500');
    switch (newStatus) {
      case 'pending': card.classList.add('border-orange-500'); break;
      case 'confirmed':
      case 'cooking': card.classList.add('border-blue-500'); break;
      case 'ready': card.classList.add('border-green-500'); break;
      case 'delivering': card.classList.add('border-purple-500'); break;
      case 'completed': card.remove(); break;
    }
  }
  
  // Feature 215: Online count update
  socket.on('online_stats', (stats) => {
    document.getElementById('online-count').textContent = stats.total;
  });
});
