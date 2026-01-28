const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Comprehensive User Schema covering Features: 148-151, 160, 227, 279
const userSchema = new mongoose.Schema({
  // Authentication
  username: {
    type: String,
    required: [true, 'Tên đăng nhập là bắt buộc'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'Tên đăng nhập tối thiểu 3 ký tự'],
    maxlength: [30, 'Tên đăng nhập tối đa 30 ký tự']
  },
  password: {
    type: String,
    required: [true, 'Mật khẩu là bắt buộc'],
    minlength: [4, 'Mật khẩu tối thiểu 4 ký tự'],
    select: false // Don't include in queries by default
  },
  
  // Profile Information
  displayName: {
    type: String,
    required: [true, 'Tên hiển thị là bắt buộc'],
    trim: true,
    maxlength: [50, 'Tên hiển thị tối đa 50 ký tự']
  },
  phone: {
    type: String,
    match: [/^0[0-9]{9}$/, 'Số điện thoại không hợp lệ']
  },
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  // Feature 279: Avatar selection
  avatar: {
    type: String,
    default: 'avatar_1' // Default avatar from predefined list
  },
  
  // Role-based access - Feature 149
  role: {
    type: String,
    enum: ['customer', 'cashier', 'kitchen', 'shipper', 'admin', 'pass'], // Feature 132-135: Pass role
    default: 'customer'
  },
  
  // Multiple roles support (e.g., admin can also be cashier)
  additionalRoles: [{
    type: String,
    enum: ['cashier', 'kitchen', 'shipper', 'pass']
  }],
  
  // Account Status - Feature 151
  status: {
    isActive: { type: Boolean, default: true },
    isLocked: { type: Boolean, default: false },
    lockedReason: String,
    lockedAt: Date,
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  
  // Customer-specific fields
  customerProfile: {
    class: String, // e.g., "12A6"
    // Feature 166: Loyalty points
    loyaltyPoints: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    orderCount: { type: Number, default: 0 },
    // Feature 21-22: Favorites
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    // Feature 51: Saved delivery locations
    savedLocations: [{
      name: String, // "Lớp học", "Sân trường"
      location: String
    }],
    // Feature 167: Leaderboard rank
    rank: { type: Number, default: 0 },
    // Feature 227: Internal notes (visible to staff only)
    internalNotes: [{
      note: String,
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date, default: Date.now }
    }],
    // Feature 185: Blacklist for spam
    isBlacklisted: { type: Boolean, default: false },
    blacklistReason: String
  },
  
  // Shipper-specific fields - Features 116-131, 160
  shipperProfile: {
    // Currently assigned orders
    currentOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    maxConcurrentOrders: { type: Number, default: 5 },
    // Performance metrics - Feature 160
    completedDeliveries: { type: Number, default: 0 },
    totalDeliveryTime: { type: Number, default: 0 }, // Total minutes
    averageDeliveryTime: { type: Number, default: 0 },
    rating: { type: Number, default: 5.0 },
    // Money handling - Features 129-130
    cashOnHand: { type: Number, default: 0 }, // Cash collected from deliveries
    lastCashSubmission: Date,
    // Status
    isOnDuty: { type: Boolean, default: false },
    currentLocation: String, // Last known location in school
    // Feature 126: Personal QR code
    personalQRCode: String
  },
  
  // Kitchen staff fields
  kitchenProfile: {
    assignedZone: {
      type: String,
      enum: ['hot_kitchen', 'cold_kitchen', 'beverage', 'dessert', 'all'],
      default: 'all'
    },
    completedItems: { type: Number, default: 0 }
  },
  
  // Cashier fields
  cashierProfile: {
    totalProcessed: { type: Number, default: 0 },
    shiftStartTime: Date,
    currentShiftTotal: { type: Number, default: 0 }
  },
  
  // Session management
  lastLogin: Date,
  lastActive: Date,
  currentSocketId: String, // For real-time features
  
  // Feature 152: Audit trail
  loginHistory: [{
    loginAt: Date,
    logoutAt: Date,
    ipAddress: String,
    userAgent: String
  }],
  
  // Password reset
  passwordResetToken: String,
  passwordResetExpires: Date

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if user has a specific role
userSchema.methods.hasRole = function(role) {
  return this.role === role || this.additionalRoles.includes(role);
};

// Virtual for shipper stats
userSchema.virtual('shipperStats').get(function() {
  if (this.role !== 'shipper') return null;
  return {
    avgDeliveryTime: this.shipperProfile.completedDeliveries > 0 
      ? Math.round(this.shipperProfile.totalDeliveryTime / this.shipperProfile.completedDeliveries)
      : 0,
    ordersToday: this.shipperProfile.currentOrders.length
  };
});

// Get avatar URL
userSchema.methods.getAvatarUrl = function() {
  const avatars = {
    'avatar_1': '/images/avatars/cat.png',
    'avatar_2': '/images/avatars/dog.png',
    'avatar_3': '/images/avatars/rabbit.png',
    'avatar_4': '/images/avatars/bear.png',
    'avatar_5': '/images/avatars/panda.png',
    'avatar_6': '/images/avatars/fox.png',
    'avatar_7': '/images/avatars/lion.png',
    'avatar_8': '/images/avatars/tiger.png'
  };
  return avatars[this.avatar] || avatars['avatar_1'];
};

// Indexes
userSchema.index({ role: 1, 'status.isActive': 1 });
userSchema.index({ 'customerProfile.phone': 1 });

module.exports = mongoose.model('User', userSchema);
