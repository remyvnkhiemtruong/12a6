const mongoose = require('mongoose');

// Comprehensive Order Schema covering Features: 43-70, 73-94, 116-131, 244-250
const orderSchema = new mongoose.Schema({
  // Order identification
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  shortId: {
    type: String, // Feature 64: Short display ID like "A01", "B15"
    required: true
  },

  // Customer Information - Features 50-53
  customer: {
    name: {
      type: String,
      required: [true, 'Tên khách hàng là bắt buộc'],
      trim: true,
      maxlength: [100, 'Tên không quá 100 ký tự']
    },
    phone: {
      type: String,
      required: [true, 'Số điện thoại là bắt buộc'],
      match: [/^0[0-9]{9}$/, 'Số điện thoại không hợp lệ'] // Feature 289
    },
    class: {
      type: String, // e.g., "12A1", "11B3"
      trim: true
    },
    // Feature 51: Auto-fill support
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },

  // Order Items - Features 31-35
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    productName: String, // Snapshot for history
    productPrice: Number, // Price at order time
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Số lượng tối thiểu là 1'],
      max: [50, 'Số lượng tối đa là 50'] // Feature 293
    },
    // Customizations
    size: {
      name: String,
      priceModifier: { type: Number, default: 0 }
    },
    sugarLevel: String,
    iceLevel: String,
    selectedToppings: [{
      name: String,
      price: Number
    }],
    selectedOption: { // For required single-choice options
      groupName: String,
      optionName: String,
      priceModifier: { type: Number, default: 0 }
    },
    note: {
      type: String, // Feature 35: Item note
      maxlength: [200, 'Ghi chú không quá 200 ký tự'] // Feature 288
    },
    // Kitchen tracking
    kitchenStatus: {
      type: String,
      enum: ['pending', 'cooking', 'done'],
      default: 'pending'
    },
    kitchenZone: String, // Reference from product
    // Calculated item total
    itemTotal: Number
  }],

  // Order Type - Features 49, 53, 208, 213
  orderType: {
    type: String,
    enum: ['dine_in', 'delivery', 'pickup'],
    default: 'delivery'
  },
  deliveryLocation: {
    type: String, // Class/Area in school
    trim: true
  },
  tableNumber: String, // Feature 213: QR table
  
  // Feature 208: Anonymous gift delivery
  isGift: {
    type: Boolean,
    default: false
  },
  giftMessage: String,
  hideGiftSender: {
    type: Boolean,
    default: false
  },

  // Order Status Workflow - Features 62-63, 85
  status: {
    type: String,
    enum: [
      'pending',      // Chờ duyệt - New order awaiting cashier approval
      'confirmed',    // Đã duyệt - Cashier confirmed, sent to kitchen
      'cooking',      // Đang làm - Kitchen is preparing
      'ready',        // Đã xong - Ready for pickup/delivery
      'delivering',   // Đang giao - Shipper is on the way
      'completed',    // Hoàn tất - Order completed
      'cancelled'     // Đã hủy - Order cancelled
    ],
    default: 'pending'
  },
  
  // Priority Flags - Features 82-83, 210
  priority: {
    isUrgent: { type: Boolean, default: false },     // Feature 82
    isVIP: { type: Boolean, default: false },        // Feature 83: Teacher
    isTeacher: { type: Boolean, default: false },    // Feature 210
    priorityScore: { type: Number, default: 0 }      // Higher = more priority
  },

  // Payment Information - Features 54-61, 87-94, 126-130
  payment: {
    method: {
      type: String,
      enum: ['bank_transfer', 'cash', 'free'], // Feature 292
      default: 'bank_transfer'
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'confirmed', 'failed', 'refunded'],
      default: 'pending'
    },
    // Feature 59: Customer claimed payment
    customerClaimedPaid: {
      type: Boolean,
      default: false
    },
    claimedAt: Date,
    // Cashier confirmation
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    confirmedAt: Date,
    // Feature 90: Payment screenshot (optional)
    screenshotUrl: String,
    // Transaction info
    transactionId: String,
    bankRef: String, // Bank reference number
    // Feature 233: Force complete bypass
    forceCompleted: {
      type: Boolean,
      default: false
    },
    forceCompletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    forceCompletedReason: String
  },

  // Pricing - Features 47-48, 246-249
  pricing: {
    subtotal: { type: Number, required: true },
    // Feature 47-48: Voucher
    voucher: {
      code: String,
      discount: { type: Number, default: 0 },
      type: { type: String, enum: ['percentage', 'fixed'] }
    },
    // Feature 246: Additional fees
    additionalFees: [{
      name: String, // "Phí hộp", "Phí dịch vụ"
      amount: Number
    }],
    // Feature 247-249: Discounts
    discount: {
      amount: { type: Number, default: 0 },
      reason: String,
      appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },
    total: { type: Number, required: true }
  },

  // Shipper Assignment - Features 116-125, 127-131
  shipper: {
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedAt: Date,
    pickedUpAt: Date, // When shipper took the order
    deliveredAt: Date,
    // Feature 128: Delivery proof
    deliveryProof: {
      photoUrl: String,
      note: String
    },
    // Feature 127: Shipper confirmed payment
    paymentCollected: {
      type: Boolean,
      default: false
    },
    paymentCollectedAt: Date,
    // Feature 125: Delivery failure
    deliveryAttempts: [{
      attemptedAt: Date,
      status: String, // 'no_answer', 'wrong_location', 'customer_unavailable'
      note: String
    }]
  },

  // Feature 244-245: Split/Merge orders
  splitMerge: {
    originalOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    splitFromOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    mergedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    isSplit: { type: Boolean, default: false },
    isMerged: { type: Boolean, default: false }
  },

  // Pre-order support - Feature 211
  scheduledFor: Date,
  isPreOrder: {
    type: Boolean,
    default: false
  },

  // Feature 68: Cancel reason
  cancellation: {
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: Date,
    reason: String,
    refundStatus: { type: String, enum: ['none', 'pending', 'completed'] }
  },

  // Feature 65: Estimated time
  estimatedReadyTime: Date,
  estimatedDeliveryTime: Date,

  // Feature 86, 152: Audit log
  auditLog: [{
    action: String, // 'created', 'confirmed', 'status_changed', 'payment_updated', etc.
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedAt: { type: Date, default: Date.now },
    previousValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    note: String
  }],

  // Feature 227: Internal notes about customer
  internalNotes: [{
    note: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }],

  // Processing metadata
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: Date,

  // Feature 166: Loyalty points earned
  pointsEarned: {
    type: Number,
    default: 0
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for order age (for Feature 110: warning old orders)
orderSchema.virtual('ageMinutes').get(function() {
  return Math.floor((Date.now() - this.createdAt) / 60000);
});

// Virtual for checking if order can be cancelled (Feature 68)
orderSchema.virtual('canCancel').get(function() {
  return this.status === 'pending';
});

// Generate order number and short ID before save
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Generate unique order number: ORD-YYYYMMDD-XXXX
    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(today.setHours(0, 0, 0, 0)),
        $lt: new Date(today.setHours(23, 59, 59, 999))
      }
    });
    
    this.orderNumber = `ORD-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;
    
    // Generate short ID for display: A01, A02... Z99, then AA01...
    const prefix = String.fromCharCode(65 + Math.floor(count / 99)); // A, B, C...
    const suffix = ((count % 99) + 1).toString().padStart(2, '0');
    this.shortId = `${prefix}${suffix}`;
  }
  next();
});

// Add audit log entry method
orderSchema.methods.addAuditLog = function(action, userId, previousValue, newValue, note) {
  this.auditLog.push({
    action,
    performedBy: userId,
    performedAt: new Date(),
    previousValue,
    newValue,
    note
  });
};

// Calculate estimated ready time based on items
orderSchema.methods.calculateEstimatedTime = async function() {
  await this.populate('items.product');
  let maxPrepTime = 0;
  this.items.forEach(item => {
    if (item.product && item.product.prepTime) {
      maxPrepTime = Math.max(maxPrepTime, item.product.prepTime * item.quantity);
    }
  });
  this.estimatedReadyTime = new Date(Date.now() + maxPrepTime * 60000);
  return this.estimatedReadyTime;
};

// Indexes for efficient queries
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'customer.phone': 1 });
orderSchema.index({ 'shipper.assignedTo': 1, status: 1 });
orderSchema.index({ shortId: 1 });
orderSchema.index({ 'payment.status': 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
