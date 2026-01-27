const mongoose = require('mongoose');

// Comprehensive Product Schema covering Features: 8-12, 20-26, 31-34, 41, 108-109, 137-144
const productSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Tên món ăn là bắt buộc'],
    trim: true,
    maxlength: [100, 'Tên món không quá 100 ký tự']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    maxlength: [500, 'Mô tả không quá 500 ký tự']
  },
  // Feature 138: Product images
  images: [{
    url: String,
    alt: String,
    isPrimary: { type: Boolean, default: false }
  }],
  
  // Pricing - Feature 25, 141
  price: {
    type: Number,
    required: [true, 'Giá món ăn là bắt buộc'],
    min: [0, 'Giá không thể âm']
  },
  originalPrice: {
    type: Number, // Feature 25: Original price for showing discount
    min: [0, 'Giá gốc không thể âm']
  },
  // Feature 141: Happy Hour pricing
  happyHourPrice: {
    price: Number,
    startTime: String, // "10:00"
    endTime: String,   // "12:00"
    isActive: { type: Boolean, default: false }
  },
  
  // Category Reference
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Danh mục là bắt buộc']
  },
  
  // Feature 139: Display order
  displayOrder: {
    type: Number,
    default: 0
  },
  
  // Labels/Badges - Features 8-11
  labels: {
    isNew: { type: Boolean, default: false },        // Feature 8
    isBestSeller: { type: Boolean, default: false }, // Feature 9
    isLimitedStock: { type: Boolean, default: false }, // Feature 10
    isVegetarian: { type: Boolean, default: false }  // Feature 11
  },
  
  // Inventory - Features 41, 142-143
  inventory: {
    initialStock: { type: Number, default: 100 },    // Feature 142
    currentStock: { type: Number, default: 100 },
    lowStockThreshold: { type: Number, default: 10 },
    soldCount: { type: Number, default: 0 },         // Feature 12
    isAvailable: { type: Boolean, default: true }    // Feature 108-109
  },
  
  // Customization Options - Features 31-34
  // Feature 31: Size options
  sizes: [{
    name: { type: String }, // "Nhỏ", "Vừa", "Lớn"
    priceModifier: { type: Number, default: 0 }, // Additional price
    isDefault: { type: Boolean, default: false }
  }],
  
  // Feature 32: Sugar/Ice levels (for beverages)
  customizations: {
    sugarLevels: {
      enabled: { type: Boolean, default: false },
      options: [{ type: String }] // ["0%", "30%", "50%", "70%", "100%"]
    },
    iceLevels: {
      enabled: { type: Boolean, default: false },
      options: [{ type: String }] // ["Không đá", "Ít đá", "Bình thường", "Nhiều đá"]
    }
  },
  
  // Feature 33: Toppings (multiple choice)
  toppings: [{
    name: String,
    price: { type: Number, default: 0 },
    isAvailable: { type: Boolean, default: true }
  }],
  
  // Feature 34: Required options (single choice - e.g., sauce type)
  requiredOptions: [{
    groupName: String, // "Chọn loại sốt"
    options: [{
      name: String,
      priceModifier: { type: Number, default: 0 }
    }]
  }],
  
  // Feature 20: Upsell suggestions
  upsellProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  
  // Feature 144: Combo configuration
  combo: {
    isCombo: { type: Boolean, default: false },
    items: [{
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      quantity: { type: Number, default: 1 }
    }],
    discount: { type: Number, default: 0 } // Percentage or fixed amount
  },
  
  // Feature 114: Recipe for kitchen
  recipe: {
    type: String,
    maxlength: [2000, 'Công thức không quá 2000 ký tự']
  },
  
  // Feature 104: Kitchen zone
  kitchenZone: {
    type: String,
    enum: ['hot_kitchen', 'cold_kitchen', 'beverage', 'dessert'],
    default: 'hot_kitchen'
  },
  
  // Preparation time (for Feature 65: estimated time)
  prepTime: {
    type: Number, // in minutes
    default: 5
  },
  
  // Cost tracking for Feature 219-220
  cost: {
    type: Number,
    default: 0
  },
  
  // Metadata
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for profit calculation (Feature 220)
productSchema.virtual('profit').get(function() {
  return this.price - (this.cost || 0);
});

// Virtual for discount percentage
productSchema.virtual('discountPercent').get(function() {
  if (this.originalPrice && this.originalPrice > this.price) {
    return Math.round((1 - this.price / this.originalPrice) * 100);
  }
  return 0;
});

// Check if happy hour is active
productSchema.methods.getCurrentPrice = function() {
  if (this.happyHourPrice && this.happyHourPrice.isActive) {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    if (currentTime >= this.happyHourPrice.startTime && currentTime <= this.happyHourPrice.endTime) {
      return this.happyHourPrice.price;
    }
  }
  return this.price;
};

// Auto-generate slug from name
productSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
      .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
      .replace(/[ìíịỉĩ]/g, 'i')
      .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
      .replace(/[ùúụủũưừứựửữ]/g, 'u')
      .replace(/[ỳýỵỷỹ]/g, 'y')
      .replace(/đ/g, 'd')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }
  next();
});

// Index for search (Feature 3)
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1, displayOrder: 1 });
productSchema.index({ 'inventory.isAvailable': 1 });

module.exports = mongoose.model('Product', productSchema);
