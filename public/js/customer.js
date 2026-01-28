// Customer menu page logic
document.addEventListener('DOMContentLoaded', () => {
  const productsGrid = document.getElementById('products-grid');
  const searchInput = document.getElementById('search-input');
  const categoryTabs = document.querySelectorAll('.category-tab');
  const sortSelect = document.getElementById('sort-select');
  const emptyState = document.getElementById('empty-state');
  const productModal = document.getElementById('product-modal');
  
  let currentCategory = 'all';
  let currentSearch = '';
  let currentSort = 'default';
  
  // Feature 3: Search functionality
  searchInput?.addEventListener('input', (e) => {
    currentSearch = e.target.value.toLowerCase().trim();
    filterProducts();
  });
  
  // Feature 5: Category filter
  categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      categoryTabs.forEach(t => {
        t.classList.remove('bg-primary-500', 'text-white');
        t.classList.add('bg-gray-100', 'dark:bg-gray-800');
      });
      tab.classList.remove('bg-gray-100', 'dark:bg-gray-800');
      tab.classList.add('bg-primary-500', 'text-white');
      
      currentCategory = tab.dataset.category;
      filterProducts();
    });
  });
  
  // Feature 6: Sort
  sortSelect?.addEventListener('change', (e) => {
    currentSort = e.target.value;
    filterProducts();
  });
  
  function filterProducts() {
    const cards = productsGrid?.querySelectorAll('.product-card') || [];
    let visibleCount = 0;
    
    // Convert to array for sorting
    const cardsArray = Array.from(cards);
    
    // Sort
    if (currentSort !== 'default') {
      cardsArray.sort((a, b) => {
        const priceA = parseInt(a.dataset.price);
        const priceB = parseInt(b.dataset.price);
        
        if (currentSort === 'price_asc') return priceA - priceB;
        if (currentSort === 'price_desc') return priceB - priceA;
        return 0;
      });
      
      // Reorder in DOM
      cardsArray.forEach(card => productsGrid.appendChild(card));
    }
    
    // Filter
    cardsArray.forEach(card => {
      const name = card.dataset.name || '';
      const category = card.dataset.category || '';
      
      const matchesSearch = !currentSearch || name.includes(currentSearch);
      const matchesCategory = currentCategory === 'all' || category === currentCategory;
      
      if (matchesSearch && matchesCategory) {
        card.classList.remove('hidden');
        visibleCount++;
      } else {
        card.classList.add('hidden');
      }
    });
    
    // Show/hide empty state
    emptyState?.classList.toggle('hidden', visibleCount > 0);
  }
  
  // Feature 4: Random product button
  document.getElementById('random-btn')?.addEventListener('click', () => {
    const visibleCards = [...productsGrid.querySelectorAll('.product-card:not(.hidden)')];
    if (visibleCards.length === 0) return;
    
    const randomCard = visibleCards[Math.floor(Math.random() * visibleCards.length)];
    randomCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    randomCard.classList.add('ring-2', 'ring-primary-500');
    setTimeout(() => randomCard.classList.remove('ring-2', 'ring-primary-500'), 2000);
  });
  
  // Feature 37: Quick add to cart
  document.querySelectorAll('.quick-add-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const productId = btn.dataset.id;
      const product = window.productsData?.find(p => p._id === productId);
      
      if (!product) return;
      
      // If product has required options, open modal
      if ((product.sizes?.length > 0) || product.requiredOptions?.length > 0) {
        openProductModal(productId);
        return;
      }
      
      // Feature 38: Add to cart with animation
      Cart.add({
        productId: product._id,
        name: product.name,
        price: product.price,
        image: product.images?.[0]?.url
      });
      
      // Fly animation
      const img = btn.closest('.product-card').querySelector('img');
      if (img) {
        const clone = img.cloneNode(true);
        clone.className = 'fixed w-16 h-16 rounded-full object-cover z-50 fly-to-cart';
        const rect = img.getBoundingClientRect();
        clone.style.left = rect.left + 'px';
        clone.style.top = rect.top + 'px';
        document.body.appendChild(clone);
        setTimeout(() => clone.remove(), 500);
      }
    });
  });
  
  // Feature 15: Product detail modal
  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => {
      openProductModal(card.dataset.id);
    });
  });
  
  function openProductModal(productId) {
    const product = window.productsData?.find(p => p._id === productId);
    if (!product) return;
    
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
      <div class="relative">
        <img src="${product.images?.[0]?.url || '/images/placeholder.jpg'}" alt="${product.name}" class="w-full aspect-video object-cover">
        <button id="close-modal" class="absolute top-4 right-4 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      
      <div class="p-4">
        <h2 class="font-display font-bold text-xl mb-1">${product.name}</h2>
        <p class="text-primary-500 font-bold text-lg mb-3">${Utils.formatCurrency(product.price)}</p>
        ${product.description ? `<p class="text-gray-500 text-sm mb-4">${product.description}</p>` : ''}
        
        <!-- Size selection - Feature 16 -->
        ${product.sizes?.length ? `
        <div class="mb-4">
          <h3 class="font-medium mb-2">Chọn size</h3>
          <div class="flex gap-2">
            ${product.sizes.map((size, i) => `
              <label class="cursor-pointer flex-1">
                <input type="radio" name="size" value="${i}" ${i === 0 ? 'checked' : ''} class="hidden peer">
                <div class="p-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-center peer-checked:border-primary-500 peer-checked:bg-primary-50 dark:peer-checked:bg-primary-900/20 transition-all">
                  <div class="font-medium">${size.name}</div>
                  ${size.priceAdd ? `<div class="text-xs text-primary-500">+${Utils.formatCurrency(size.priceAdd)}</div>` : ''}
                </div>
              </label>
            `).join('')}
          </div>
        </div>
        ` : ''}
        
        <!-- Sugar level - Feature 17 -->
        ${product.customizations?.sugarLevels?.length ? `
        <div class="mb-4">
          <h3 class="font-medium mb-2">Độ ngọt</h3>
          <div class="flex gap-2 flex-wrap">
            ${product.customizations.sugarLevels.map((level, i) => `
              <label class="cursor-pointer">
                <input type="radio" name="sugar" value="${level}" ${i === 2 ? 'checked' : ''} class="hidden peer">
                <div class="px-4 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-full text-sm peer-checked:border-primary-500 peer-checked:bg-primary-50 dark:peer-checked:bg-primary-900/20 transition-all">
                  ${level}
                </div>
              </label>
            `).join('')}
          </div>
        </div>
        ` : ''}
        
        <!-- Ice level - Feature 18 -->
        ${product.customizations?.iceLevels?.length ? `
        <div class="mb-4">
          <h3 class="font-medium mb-2">Độ đá</h3>
          <div class="flex gap-2 flex-wrap">
            ${product.customizations.iceLevels.map((level, i) => `
              <label class="cursor-pointer">
                <input type="radio" name="ice" value="${level}" ${i === 1 ? 'checked' : ''} class="hidden peer">
                <div class="px-4 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-full text-sm peer-checked:border-primary-500 peer-checked:bg-primary-50 dark:peer-checked:bg-primary-900/20 transition-all">
                  ${level}
                </div>
              </label>
            `).join('')}
          </div>
        </div>
        ` : ''}
        
        <!-- Toppings - Feature 19 -->
        ${product.toppings?.length ? `
        <div class="mb-4">
          <h3 class="font-medium mb-2">Topping</h3>
          <div class="space-y-2">
            ${product.toppings.map((topping, i) => `
              <label class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl cursor-pointer">
                <div class="flex items-center gap-3">
                  <input type="checkbox" name="topping" value="${i}" class="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-500">
                  <span>${topping.name}</span>
                </div>
                <span class="text-primary-500 font-medium">+${Utils.formatCurrency(topping.price)}</span>
              </label>
            `).join('')}
          </div>
        </div>
        ` : ''}
        
        <!-- Feature 20: Note -->
        <div class="mb-4">
          <h3 class="font-medium mb-2">Ghi chú</h3>
          <input type="text" id="item-note" placeholder="VD: Ít đường, thêm nước..." class="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl border-none text-sm">
        </div>
        
        <!-- Quantity & Add to cart -->
        <div class="flex gap-3">
          <div class="flex items-center bg-gray-100 dark:bg-gray-700 rounded-xl">
            <button id="qty-minus" class="w-12 h-12 text-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 rounded-l-xl transition-colors">-</button>
            <span id="qty-value" class="w-12 text-center font-bold">1</span>
            <button id="qty-plus" class="w-12 h-12 text-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 rounded-r-xl transition-colors">+</button>
          </div>
          <button id="add-to-cart" class="flex-1 bg-gradient-to-r from-primary-500 to-primary-600 text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all">
            Thêm vào giỏ
          </button>
        </div>
      </div>
    `;
    
    productModal.classList.remove('hidden');
    
    // Quantity controls
    let quantity = 1;
    document.getElementById('qty-minus')?.addEventListener('click', () => {
      if (quantity > 1) {
        quantity--;
        document.getElementById('qty-value').textContent = quantity;
      }
    });
    document.getElementById('qty-plus')?.addEventListener('click', () => {
      quantity++;
      document.getElementById('qty-value').textContent = quantity;
    });
    
    // Close modal
    document.getElementById('close-modal')?.addEventListener('click', () => {
      productModal.classList.add('hidden');
    });
    document.getElementById('modal-backdrop')?.addEventListener('click', () => {
      productModal.classList.add('hidden');
    });
    
    // Add to cart
    document.getElementById('add-to-cart')?.addEventListener('click', () => {
      const sizeIndex = document.querySelector('input[name="size"]:checked')?.value;
      const sugar = document.querySelector('input[name="sugar"]:checked')?.value;
      const ice = document.querySelector('input[name="ice"]:checked')?.value;
      const toppingIndexes = [...document.querySelectorAll('input[name="topping"]:checked')].map(el => el.value);
      const note = document.getElementById('item-note')?.value;
      
      const selectedSize = sizeIndex !== undefined ? product.sizes[sizeIndex] : null;
      const selectedToppings = toppingIndexes.map(i => product.toppings[i]);
      
      Cart.add({
        productId: product._id,
        name: product.name,
        price: product.price,
        image: product.images?.[0]?.url,
        size: selectedSize,
        toppings: selectedToppings,
        sugarLevel: sugar,
        iceLevel: ice,
        note: note,
        quantity: quantity
      });
      
      productModal.classList.add('hidden');
    });
  }
  
  // Feature 21: Favorite toggle
  document.querySelectorAll('.favorite-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const productId = btn.dataset.id;
      const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
      const index = favorites.indexOf(productId);
      
      if (index >= 0) {
        favorites.splice(index, 1);
        btn.querySelector('svg').classList.remove('fill-red-500', 'text-red-500');
        btn.querySelector('svg').classList.add('text-gray-400');
      } else {
        favorites.push(productId);
        btn.querySelector('svg').classList.add('fill-red-500', 'text-red-500');
        btn.querySelector('svg').classList.remove('text-gray-400');
      }
      
      localStorage.setItem('favorites', JSON.stringify(favorites));
    });
  });
  
  // Initialize favorites
  const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
  favorites.forEach(id => {
    const btn = document.querySelector(`.favorite-btn[data-id="${id}"]`);
    if (btn) {
      btn.querySelector('svg').classList.add('fill-red-500', 'text-red-500');
      btn.querySelector('svg').classList.remove('text-gray-400');
    }
  });
});
