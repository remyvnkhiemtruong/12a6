// Order tracking real-time logic
document.addEventListener('DOMContentLoaded', () => {
  // Feature 62: Real-time status updates
  socket.on('order_status_updated', (data) => {
    if (data.orderId === orderId) {
      updateStatusUI(data.status);
      showToast(getStatusMessage(data.status), 'info');
    }
  });
  
  socket.on('shipper_departed', (data) => {
    if (data.orderId === orderId) {
      updateStatusUI('delivering');
      showToast('🛵 Shipper đang trên đường đến!', 'success');
    }
  });
  
  socket.on('shipper_arrived', (data) => {
    if (data.orderId === orderId) {
      showToast('📍 Shipper đã đến! Vui lòng ra nhận hàng.', 'success');
      Utils.playSound();
    }
  });
  
  socket.on('delivery_completed', (data) => {
    if (data.orderId === orderId) {
      updateStatusUI('completed');
      showToast('🎉 Đơn hàng hoàn tất! Cảm ơn bạn!', 'success');
    }
  });
  
  // Feature 59: Claim payment
  document.getElementById('claim-payment-btn')?.addEventListener('click', async () => {
    try {
      await fetch(`/api/orders/${orderId}/claim-payment`, { method: 'POST' });
      showToast('✅ Đã ghi nhận! Thu ngân sẽ xác nhận sớm.', 'success');
      location.reload();
    } catch (e) {
      showToast('Lỗi ghi nhận thanh toán', 'error');
    }
  });
  
  // Feature 68: Cancel order
  document.getElementById('cancel-order-btn')?.addEventListener('click', async () => {
    if (!confirm('Bạn có chắc muốn hủy đơn hàng này?')) return;
    
    const reason = prompt('Lý do hủy đơn (tùy chọn):') || 'Khách tự hủy';
    
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      
      if (res.ok) {
        showToast('❌ Đã hủy đơn hàng', 'warning');
        location.reload();
      } else {
        const data = await res.json();
        showToast(data.message || 'Không thể hủy đơn', 'error');
      }
    } catch (e) {
      showToast('Lỗi hủy đơn', 'error');
    }
  });
  
  function updateStatusUI(status) {
    // Update progress line
    const progressLine = document.getElementById('progress-line');
    const heightMap = {
      pending: '12%',
      confirmed: '28%',
      cooking: '44%',
      ready: '60%',
      delivering: '78%',
      completed: '100%'
    };
    
    if (progressLine && heightMap[status]) {
      progressLine.style.height = heightMap[status];
    }
    
    location.reload(); // Simplest way to update timeline
  }
  
  function getStatusMessage(status) {
    const messages = {
      pending: '⏳ Đơn hàng đang chờ xác nhận',
      confirmed: '✅ Đơn hàng đã được xác nhận',
      cooking: '🍳 Đang chế biến món của bạn',
      ready: '📦 Món đã xong, đang chờ giao',
      delivering: '🛵 Shipper đang trên đường',
      completed: '🎉 Đơn hàng hoàn tất!'
    };
    return messages[status] || 'Trạng thái cập nhật';
  }
  
  // Auto-refresh every 30 seconds for non-completed orders
  if (orderStatus !== 'completed' && orderStatus !== 'cancelled') {
    setInterval(() => {
      fetch(`/api/orders/${orderId}/status`)
        .then(res => res.json())
        .then(data => {
          if (data.status !== orderStatus) {
            location.reload();
          }
        })
        .catch(() => {});
    }, 30000);
  }
});
