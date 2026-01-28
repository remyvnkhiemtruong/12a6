const mongoose = require('mongoose');

// Voucher/Promo Code Schema - Features 47-48, 173-174
const voucherSchema = new mongoose.Schema({
  // Voucher identification
  code: {
    type: String,
    required: [true, 'Mã voucher là bắt buộc'],
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: [20, 'Mã voucher tối đa 20 ký tự']
  },
  name: {
    type: String,
    required: [true, 'Tên voucher là bắt buộc'],
    trim: true
  },
  description: String,
  
  // Discount configuration
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'], // Giảm % hoặc giảm số tiền cố định
    required: true
  },
  discountValue: {
    type: Number,
    required: true,
    min: [0, 'Giá trị giảm không thể âm']
  },
  maxDiscount: {
    type: Number, // Maximum discount amount for percentage type
    default: null
  },
  minOrderValue: {
    type: Number, // Minimum order value to apply voucher
    default: 0
  },
  
  // Usage limits
  usageLimit: {
    total: { type: Number, default: null }, // Total uses allowed (null = unlimited)
    perUser: { type: Number, default: 1 }   // Uses per customer
  },
  usedCount: {
    type: Number,
    default: 0
  },
  usedBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    phone: String, // For guest users
    usedAt: { type: Date, default: Date.now },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' }
  }],
  
  // Validity period
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: [true, 'Ngày hết hạn là bắt buộc']
  },
  
  // Feature 173: Flash sale configuration
  flashSale: {
    isFlashSale: { type: Boolean, default: false },
    flashStartTime: Date,
    flashEndTime: Date,
    flashQuantity: Number // Limited quantity for flash sale
  },
  
  // Feature 174: Combo/Group discounts
  comboRequirements: {
    isCombo: { type: Boolean, default: false },
    requiredProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    requiredQuantity: { type: Number, default: 1 },
    buyXGetY: {
      buyQuantity: Number,
      getQuantity: Number,
      getProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }
    }
  },
  
  // Target restrictions
  applicableTo: {
    type: String,
    enum: ['all', 'category', 'product', 'customer_type'],
    default: 'all'
  },
  applicableCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  applicableProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  applicableCustomerTypes: [{
    type: String,
    enum: ['new', 'returning', 'vip', 'teacher']
  }],
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual to check if voucher is currently valid
voucherSchema.virtual('isValid').get(function() {
  const now = new Date();
  return this.isActive && 
         now >= this.validFrom && 
         now <= this.validUntil &&
         (this.usageLimit.total === null || this.usedCount < this.usageLimit.total);
});

// Virtual to check if flash sale is active
voucherSchema.virtual('isFlashSaleActive').get(function() {
  if (!this.flashSale.isFlashSale) return false;
  const now = new Date();
  return now >= this.flashSale.flashStartTime && now <= this.flashSale.flashEndTime;
});

// Method to check if user can use this voucher
voucherSchema.methods.canUse = function(userId, phone) {
  // Check usage limit
  if (this.usageLimit.total !== null && this.usedCount >= this.usageLimit.total) {
    return { valid: false, message: 'Voucher đã hết lượt sử dụng' };
  }
  
  // Check per-user limit
  const userUsage = this.usedBy.filter(u => 
    (userId && u.user && u.user.toString() === userId.toString()) ||
    (phone && u.phone === phone)
  ).length;
  
  if (userUsage >= this.usageLimit.perUser) {
    return { valid: false, message: 'Bạn đã sử dụng voucher này rồi' };
  }
  
  // Check validity period
  const now = new Date();
  if (now < this.validFrom) {
    return { valid: false, message: 'Voucher chưa có hiệu lực' };
  }
  if (now > this.validUntil) {
    return { valid: false, message: 'Voucher đã hết hạn' };
  }
  
  if (!this.isActive) {
    return { valid: false, message: 'Voucher không còn hoạt động' };
  }
  
  return { valid: true };
};

// Method to calculate discount
voucherSchema.methods.calculateDiscount = function(orderTotal) {
  if (orderTotal < this.minOrderValue) {
    return { discount: 0, message: `Đơn hàng tối thiểu ${this.minOrderValue.toLocaleString('vi-VN')}đ` };
  }
  
  let discount = 0;
  if (this.discountType === 'percentage') {
    discount = Math.round(orderTotal * this.discountValue / 100);
    if (this.maxDiscount && discount > this.maxDiscount) {
      discount = this.maxDiscount;
    }
  } else {
    discount = this.discountValue;
  }
  
  // Can't discount more than order total
  if (discount > orderTotal) {
    discount = orderTotal;
  }
  
  return { discount, message: null };
};

// Indexes
voucherSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });
voucherSchema.index({ 'flashSale.isFlashSale': 1 });

module.exports = mongoose.model('Voucher', voucherSchema);
