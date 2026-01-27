// Shipper app real-time logic
document.addEventListener('DOMContentLoaded', () => {
  // Join shipper room
  socket.emit('join_room', { role: 'shipper' });
  
  // Tab switching
  const tabs = document.querySelectorAll('.shipper-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      tabs.forEach(t => {
        t.classList.remove('border-purple-500', 'text-purple-600');
        t.classList.add('border-transparent', 'text-gray-500');
      });
      tab.classList.remove('border-transparent', 'text-gray-500');
      tab.classList.add('border-purple-500', 'text-purple-600');
      
      document.getElementById('available-orders').classList.toggle('hidden', targetTab !== 'available');
      document.getElementById('my-orders').classList.toggle('hidden', targetTab !== 'my-orders');
    });
  });
  
  // Feature 117: Grab order
  document.querySelectorAll('.grab-order').forEach(btn => {
    btn.addEventListener('click', async () => {
      const orderId = btn.dataset.id;
      
      try {
        const res = await fetch(`/api/orders/${orderId}/assign-shipper`, {
          method: 'POST'
        });
        
        if (res.ok) {
          socket.emit('shipper_grab', { orderId });
          showToast('✅ Đã nhận đơn!', 'success');
          location.reload();
        } else {
          const data = await res.json();
          showToast(data.message || 'Không thể nhận đơn', 'error');
        }
      } catch (e) {
        showToast('Lỗi nhận đơn', 'error');
      }
    });
  });
  
  // Feature 118: Start delivery
  document.querySelectorAll('.start-delivery').forEach(btn => {
    btn.addEventListener('click', async () => {
      const orderId = btn.dataset.id;
      
      try {
        socket.emit('shipper_departed', { orderId });
        
        await fetch(`/api/orders/${orderId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'delivering' })
        });
        
        showToast('🛵 Bắt đầu giao hàng!', 'success');
        location.reload();
      } catch (e) {
        showToast('Lỗi bắt đầu giao', 'error');
      }
    });
  });
  
  // Feature 123: Arrived at location
  document.querySelectorAll('.arrived').forEach(btn => {
    btn.addEventListener('click', () => {
      const orderId = btn.dataset.id;
      socket.emit('shipper_arrived', { orderId });
      showToast('📍 Đã thông báo khách!', 'success');
    });
  });
  
  // Feature 124: No answer
  document.querySelectorAll('.no-answer').forEach(btn => {
    btn.addEventListener('click', () => {
      const orderId = btn.dataset.id;
      socket.emit('staff_chat', {
        message: `📵 Đơn #${orderId.slice(-6)} - Khách không nghe máy!`,
        from: 'shipper'
      });
      showToast('📵 Đã báo thu ngân!', 'warning');
    });
  });
  
  // Feature 125: Delivery failed
  document.querySelectorAll('.delivery-failed').forEach(btn => {
    btn.addEventListener('click', async () => {
      const orderId = btn.dataset.id;
      const reason = prompt('Lý do giao thất bại:');
      if (!reason) return;
      
      try {
        socket.emit('staff_chat', {
          message: `❌ Đơn #${orderId.slice(-6)} giao thất bại: ${reason}`,
          from: 'shipper'
        });
        
        showToast('❌ Đã báo giao thất bại', 'error');
      } catch (e) {
        showToast('Lỗi báo cáo', 'error');
      }
    });
  });
  
  // Feature 74: New order notification
  socket.on('kitchen_done', (data) => {
    playSound();
    document.getElementById('available-count').textContent = 
      parseInt(document.getElementById('available-count').textContent) + 1;
    showToast(`📦 Có đơn mới sẵn sàng: #${data.shortId}`, 'success');
  });
});
