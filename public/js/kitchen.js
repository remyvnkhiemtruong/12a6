// Kitchen KDS real-time logic
document.addEventListener('DOMContentLoaded', () => {
  // Join kitchen room
  socket.emit('join_room', { role: 'kitchen' });
  
  // Feature 74: New order notification
  socket.on('order_confirmed', (order) => {
    playSound();
    showToast(`📋 Đơn mới: #${order.shortId}`, 'info');
    setTimeout(() => location.reload(), 1000);
  });
  
  // Feature 104: Zone filter
  document.getElementById('zone-filter')?.addEventListener('change', (e) => {
    const zone = e.target.value;
    window.location.href = zone === 'all' ? '/kitchen' : `/kitchen?zone=${zone}`;
  });
  
  // Feature 102: View toggle
  document.querySelectorAll('.view-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      
      document.querySelectorAll('.view-toggle').forEach(b => {
        b.classList.remove('bg-orange-500', 'text-white');
        b.classList.add('bg-gray-700');
      });
      btn.classList.remove('bg-gray-700');
      btn.classList.add('bg-orange-500', 'text-white');
      
      document.getElementById('orders-view').classList.toggle('hidden', view !== 'orders');
      document.getElementById('aggregated-view').classList.toggle('hidden', view !== 'aggregated');
    });
  });
  
  // Feature 105: Mark item cooking
  document.querySelectorAll('.mark-cooking').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const orderId = btn.dataset.order;
      const itemIndex = btn.dataset.index;
      
      try {
        socket.emit('item_cooking', { orderId, itemIndex });
        
        // Update UI immediately
        const itemEl = btn.closest('.kitchen-item');
        itemEl.classList.remove('bg-gray-700');
        itemEl.classList.add('bg-yellow-900/30');
        
        btn.outerHTML = `
          <button class="mark-done px-3 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-400 transition-colors" data-order="${orderId}" data-index="${itemIndex}">
            ✅ Xong
          </button>
        `;
        
        // Re-attach listener
        attachMarkDoneListeners();
        
        showToast('🍳 Bắt đầu nấu', 'info');
      } catch (e) {
        showToast('Lỗi cập nhật', 'error');
      }
    });
  });
  
  // Feature 106: Mark item done
  function attachMarkDoneListeners() {
    document.querySelectorAll('.mark-done').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const orderId = btn.dataset.order;
        const itemIndex = btn.dataset.index;
        
        try {
          socket.emit('item_done', { orderId, itemIndex });
          
          // Update UI immediately
          const itemEl = btn.closest('.kitchen-item');
          itemEl.classList.remove('bg-yellow-900/30');
          itemEl.classList.add('bg-green-900/30', 'opacity-50');
          
          btn.outerHTML = `
            <button class="mark-undo px-3 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-500 transition-colors" data-order="${orderId}" data-index="${itemIndex}">
              ↩️
            </button>
          `;
          
          showToast('✅ Món đã xong!', 'success');
        } catch (e) {
          showToast('Lỗi cập nhật', 'error');
        }
      });
    });
  }
  
  attachMarkDoneListeners();
  
  // Feature 107: Complete entire order
  document.querySelectorAll('.complete-order').forEach(btn => {
    btn.addEventListener('click', async () => {
      const orderId = btn.dataset.id;
      
      try {
        socket.emit('kitchen_done', { orderId });
        
        // Remove card
        btn.closest('.order-card')?.remove();
        
        showToast('✅ Đơn hàng đã hoàn tất!', 'success');
        playSound();
      } catch (e) {
        showToast('Lỗi hoàn tất đơn', 'error');
      }
    });
  });
  
  // Feature 108-109: Stock management modal
  document.getElementById('stock-btn')?.addEventListener('click', () => {
    document.getElementById('stock-modal').classList.remove('hidden');
  });
  
  document.querySelectorAll('.toggle-availability').forEach(btn => {
    btn.addEventListener('click', async () => {
      const productId = btn.dataset.id;
      const currentlyAvailable = btn.dataset.available === 'true';
      
      try {
        socket.emit('toggle_product_availability', { 
          productId, 
          isAvailable: !currentlyAvailable 
        });
        
        // Toggle UI
        btn.dataset.available = (!currentlyAvailable).toString();
        if (currentlyAvailable) {
          btn.classList.remove('bg-green-600', 'hover:bg-green-500');
          btn.classList.add('bg-red-600', 'hover:bg-red-500');
          btn.textContent = '❌ Hết hàng';
        } else {
          btn.classList.remove('bg-red-600', 'hover:bg-red-500');
          btn.classList.add('bg-green-600', 'hover:bg-green-500');
          btn.textContent = '✅ Còn hàng';
        }
        
        showToast('✅ Đã cập nhật trạng thái', 'success');
      } catch (e) {
        showToast('Lỗi cập nhật', 'error');
      }
    });
  });
  
  // Feature 113: Call for help
  document.querySelectorAll('.call-help').forEach(btn => {
    btn.addEventListener('click', () => {
      playSound();
      socket.emit('staff_chat', {
        message: `🆘 Bếp cần hỗ trợ đơn #${btn.dataset.id}`,
        from: 'kitchen'
      });
      showToast('🆘 Đã gọi hỗ trợ!', 'warning');
    });
  });
  
  // Feature 115: Fullscreen toggle
  document.getElementById('fullscreen-btn')?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  });
});
