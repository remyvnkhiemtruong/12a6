// Cart page logic
document.addEventListener('DOMContentLoaded', () => {
  const cartItemsEl = document.getElementById('cart-items');
  const emptyCart = document.getElementById('empty-cart');
  const checkoutFooter = document.getElementById('checkout-footer');
  const voucherSection = document.getElementById('voucher-section');
  const orderTypeSection = document.getElementById('order-type-section');
  const customerFormSection = document.getElementById('customer-form-section');
  const giftSection = document.getElementById('gift-section');
  
  let appliedVoucher = null;
  let currentDiscount = 0;
  
  function renderCart() {
    const items = Cart.get();
    
    if (items.length === 0) {
      cartItemsEl.innerHTML = '';
      emptyCart.classList.remove('hidden');
      checkoutFooter?.classList.add('hidden');
      voucherSection?.classList.add('hidden');
      orderTypeSection?.classList.add('hidden');
      customerFormSection?.classList.add('hidden');
      giftSection?.classList.add('hidden');
      return;
    }
    
    emptyCart.classList.add('hidden');
    checkoutFooter?.classList.remove('hidden');
    voucherSection?.classList.remove('hidden');
    orderTypeSection?.classList.remove('hidden');
    customerFormSection?.classList.remove('hidden');
    giftSection?.classList.remove('hidden');
    
    cartItemsEl.innerHTML = items.map((item, index) => {
      let itemPrice = item.price;
      if (item.size?.priceAdd) itemPrice += item.size.priceAdd;
      if (item.toppings) {
        itemPrice += item.toppings.reduce((s, t) => s + (t.price || 0), 0);
      }
      const totalPrice = itemPrice * item.quantity;
      
      return `
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
          <div class="flex gap-4">
            <img src="${item.image || '/images/placeholder.jpg'}" alt="${item.name}" class="w-20 h-20 rounded-xl object-cover">
            <div class="flex-1">
              <h3 class="font-medium mb-1">${item.name}</h3>
              <div class="text-xs text-gray-500 space-y-0.5">
                ${item.size ? `<p>Size: ${item.size.name}</p>` : ''}
                ${item.sugarLevel ? `<p>Đường: ${item.sugarLevel}</p>` : ''}
                ${item.iceLevel ? `<p>Đá: ${item.iceLevel}</p>` : ''}
                ${item.toppings?.length ? `<p>Topping: ${item.toppings.map(t => t.name).join(', ')}</p>` : ''}
                ${item.note ? `<p class="text-orange-500">📝 ${item.note}</p>` : ''}
              </div>
            </div>
            <button class="remove-item text-gray-400 hover:text-red-500 transition-colors" data-index="${index}">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
          <div class="flex items-center justify-between mt-3">
            <div class="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg">
              <button class="qty-change w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 rounded-l-lg" data-index="${index}" data-action="minus">-</button>
              <span class="w-8 text-center font-medium">${item.quantity}</span>
              <button class="qty-change w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 rounded-r-lg" data-index="${index}" data-action="plus">+</button>
            </div>
            <p class="font-bold text-primary-500">${Utils.formatCurrency(totalPrice)}</p>
          </div>
        </div>
      `;
    }).join('');
    
    // Attach event listeners
    document.querySelectorAll('.remove-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        Cart.remove(index);
        renderCart();
      });
    });
    
    document.querySelectorAll('.qty-change').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        const action = btn.dataset.action;
        const items = Cart.get();
        const newQty = items[index].quantity + (action === 'plus' ? 1 : -1);
        Cart.updateQuantity(index, newQty);
        renderCart();
      });
    });
    
    updateTotals();
  }
  
  function updateTotals() {
    const subtotal = Cart.getTotal();
    const total = subtotal - currentDiscount;
    
    document.getElementById('subtotal').textContent = Utils.formatCurrency(subtotal);
    document.getElementById('total').textContent = Utils.formatCurrency(total);
    
    if (currentDiscount > 0) {
      document.getElementById('discount-row').classList.remove('hidden');
      document.getElementById('discount-amount').textContent = `-${Utils.formatCurrency(currentDiscount)}`;
    } else {
      document.getElementById('discount-row').classList.add('hidden');
    }
  }
  
  // Feature 47: Voucher validation
  document.getElementById('apply-voucher')?.addEventListener('click', async () => {
    const code = document.getElementById('voucher-input').value.trim();
    if (!code) {
      showToast('Vui lòng nhập mã voucher', 'warning');
      return;
    }
    
    try {
      const response = await fetch('/api/validate-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code, 
          orderTotal: Cart.getTotal() 
        })
      });
      
      const data = await response.json();
      
      const resultEl = document.getElementById('voucher-result');
      resultEl.classList.remove('hidden');
      
      if (data.success) {
        appliedVoucher = data.voucher;
        currentDiscount = data.voucher.discount;
        resultEl.className = 'mt-2 text-sm text-green-600';
        resultEl.textContent = `✅ Đã áp dụng mã "${data.voucher.code}" - Giảm ${Utils.formatCurrency(currentDiscount)}`;
        updateTotals();
      } else {
        resultEl.className = 'mt-2 text-sm text-red-600';
        resultEl.textContent = `❌ ${data.message}`;
      }
    } catch (error) {
      showToast('Không thể kiểm tra voucher', 'error');
    }
  });
  
  // Feature 50: Order type toggle
  document.querySelectorAll('input[name="orderType"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isDelivery = radio.value === 'delivery';
      document.getElementById('delivery-location-field').classList.toggle('hidden', !isDelivery);
    });
  });
  
  // Feature 208: Gift toggle
  document.getElementById('is-gift')?.addEventListener('change', (e) => {
    document.getElementById('gift-fields').classList.toggle('hidden', !e.target.checked);
  });
  
  // Feature 54: Checkout
  document.getElementById('checkout-btn')?.addEventListener('click', async () => {
    const items = Cart.get();
    if (items.length === 0) {
      showToast('Giỏ hàng trống', 'warning');
      return;
    }
    
    // Validate form
    const name = document.getElementById('customer-name').value.trim();
    const phone = document.getElementById('customer-phone').value.trim();
    const customerClass = document.getElementById('customer-class').value.trim();
    const orderType = document.querySelector('input[name="orderType"]:checked')?.value || 'dine_in';
    const deliveryLocation = document.getElementById('delivery-location').value;
    const isGift = document.getElementById('is-gift')?.checked;
    const giftMessage = document.getElementById('gift-message')?.value;
    
    if (!name || name.length < 2) {
      showToast('Vui lòng nhập tên của bạn', 'warning');
      return;
    }
    
    if (!phone || !/^0\d{9}$/.test(phone)) {
      showToast('Vui lòng nhập số điện thoại hợp lệ (10 số)', 'warning');
      return;
    }
    
    if (orderType === 'delivery' && !deliveryLocation) {
      showToast('Vui lòng chọn địa điểm giao hàng', 'warning');
      return;
    }
    
    // Create order
    const orderData = {
      customer: { name, phone, class: customerClass },
      orderType,
      deliveryLocation: orderType === 'delivery' ? deliveryLocation : undefined,
      items: items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        size: item.size,
        selectedToppings: item.toppings,
        sugarLevel: item.sugarLevel,
        iceLevel: item.iceLevel,
        note: item.note
      })),
      voucherCode: appliedVoucher?.code,
      isGift,
      giftMessage
    };
    
    try {
      document.getElementById('checkout-btn').disabled = true;
      document.getElementById('checkout-btn').textContent = 'Đang xử lý...';
      
      const response = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Clear cart
        Cart.clear();
        
        // Show payment modal
        const modal = document.getElementById('payment-modal');
        document.getElementById('order-id').textContent = data.order.shortId;
        document.getElementById('qr-image').src = data.qrUrl;
        document.getElementById('qr-amount').textContent = Utils.formatCurrency(data.order.pricing.total);
        document.getElementById('track-order').href = `/tracking/${data.order._id}`;
        
        // Copy buttons
        document.getElementById('copy-account').onclick = () => Utils.copyToClipboard(window.storeConfig.accountNumber);
        document.getElementById('copy-content').onclick = () => Utils.copyToClipboard(`${window.storeConfig.transferTemplate} ${data.order.shortId}`);
        document.getElementById('download-qr').onclick = () => Utils.downloadQR(data.qrUrl, `QR_${data.order.shortId}.png`);
        
        // Feature 59: Claim payment
        document.getElementById('claim-payment').onclick = async () => {
          try {
            await fetch(`/api/orders/${data.order._id}/claim-payment`, { method: 'POST' });
            showToast('✅ Đã ghi nhận! Đang chờ xác nhận từ thu ngân.', 'success');
            window.location.href = `/tracking/${data.order._id}`;
          } catch (e) {
            showToast('Lỗi ghi nhận thanh toán', 'error');
          }
        };
        
        modal.classList.remove('hidden');
      } else {
        showToast(data.message || 'Không thể tạo đơn hàng', 'error');
      }
    } catch (error) {
      showToast('Lỗi kết nối server', 'error');
    } finally {
      document.getElementById('checkout-btn').disabled = false;
      document.getElementById('checkout-btn').textContent = 'Đặt hàng';
    }
  });
  
  // Initialize
  renderCart();
});
