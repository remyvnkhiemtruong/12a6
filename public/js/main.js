// Main client-side utilities
const socket = io();

// Feature 28: Dark mode toggle
function initDarkMode() {
  const toggle = document.getElementById('theme-toggle');
  const isDark = localStorage.getItem('darkMode') === 'true' || 
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (isDark) document.documentElement.classList.add('dark');
  
  toggle?.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', document.documentElement.classList.contains('dark'));
  });
}

// Feature 191: Currency formatter
function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// Feature 259: Real-time clock
function initClock() {
  const clockEl = document.getElementById('clock');
  if (!clockEl) return;
  
  function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  updateClock();
  setInterval(updateClock, 1000);
}

// Feature 201: Toast notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `fixed top-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-lg z-50 animate-bounce-in ${
    type === 'success' ? 'bg-green-500 text-white' :
    type === 'error' ? 'bg-red-500 text-white' :
    type === 'warning' ? 'bg-yellow-500 text-black' :
    'bg-gray-800 text-white'
  }`;
  toast.innerHTML = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Cart utilities (LocalStorage)
const Cart = {
  KEY: 'pos_cart',
  
  get() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch (e) {
      return [];
    }
  },
  
  set(items) {
    localStorage.setItem(this.KEY, JSON.stringify(items));
    this.updateBadge();
  },
  
  add(item) {
    const items = this.get();
    // Check if same item with same options exists
    const existingIndex = items.findIndex(i => 
      i.productId === item.productId &&
      i.size?.name === item.size?.name &&
      JSON.stringify(i.toppings) === JSON.stringify(item.toppings)
    );
    
    if (existingIndex >= 0) {
      items[existingIndex].quantity += item.quantity || 1;
    } else {
      items.push({ ...item, quantity: item.quantity || 1 });
    }
    
    this.set(items);
    showToast('🛒 Đã thêm vào giỏ hàng!', 'success');
    return items;
  },
  
  remove(index) {
    const items = this.get();
    items.splice(index, 1);
    this.set(items);
    return items;
  },
  
  updateQuantity(index, quantity) {
    const items = this.get();
    if (quantity <= 0) {
      items.splice(index, 1);
    } else {
      items[index].quantity = quantity;
    }
    this.set(items);
    return items;
  },
  
  clear() {
    localStorage.removeItem(this.KEY);
    this.updateBadge();
  },
  
  getTotal() {
    return this.get().reduce((sum, item) => {
      let itemPrice = item.price;
      if (item.size?.priceAdd) itemPrice += item.size.priceAdd;
      if (item.toppings) {
        itemPrice += item.toppings.reduce((s, t) => s + (t.price || 0), 0);
      }
      return sum + (itemPrice * item.quantity);
    }, 0);
  },
  
  getCount() {
    return this.get().reduce((sum, item) => sum + item.quantity, 0);
  },
  
  updateBadge() {
    const badge = document.getElementById('cart-badge');
    const count = this.getCount();
    if (badge) {
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
    }
    
    // Update floating cart
    const summary = document.getElementById('cart-summary');
    const countEl = document.getElementById('cart-count');
    const totalEl = document.getElementById('cart-total');
    
    if (summary && countEl && totalEl) {
      countEl.textContent = count;
      totalEl.textContent = formatCurrency(this.getTotal());
      summary.classList.toggle('hidden', count === 0);
    }
  }
};

// Socket.io connection status
socket.on('connect', () => {
  console.log('Socket connected:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Socket disconnected');
  showToast('⚠️ Mất kết nối với server', 'warning');
});

socket.on('reconnect', () => {
  showToast('✅ Đã kết nối lại', 'success');
});

// Feature 74: Play notification sound
function playSound(soundId = 'notification-sound') {
  const audio = document.getElementById(soundId);
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }
}

// Feature 55: Download QR image
async function downloadQR(qrUrl, filename) {
  try {
    const response = await fetch(qrUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'qr-payment.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showToast('✅ Đã tải QR code', 'success');
  } catch (e) {
    showToast('❌ Không thể tải QR', 'error');
  }
}

// Copy to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('📋 Đã sao chép!', 'success');
  } catch (e) {
    showToast('❌ Không thể sao chép', 'error');
  }
}

// Feature 290: Greeting by time
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 10) return 'Chào buổi sáng';
  if (hour < 12) return 'Chào buổi trưa';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initDarkMode();
  initClock();
  Cart.updateBadge();
});

// Logout handler
document.getElementById('logout-btn')?.addEventListener('click', async () => {
  if (!confirm('Bạn có chắc muốn đăng xuất?')) return;
  
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  } catch (e) {
    showToast('❌ Lỗi đăng xuất', 'error');
  }
});

// Export utilities
window.Utils = {
  formatCurrency,
  showToast,
  playSound,
  downloadQR,
  copyToClipboard,
  getGreeting
};
window.Cart = Cart;
