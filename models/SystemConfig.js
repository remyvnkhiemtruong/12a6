const mongoose = require('mongoose');

// System Configuration Schema - Features 145-157, 280
const systemConfigSchema = new mongoose.Schema({
  // Only one config document should exist
  configType: {
    type: String,
    default: 'main',
    unique: true
  },
  
  // Store Information - Feature 145
  store: {
    name: {
      type: String,
      default: 'Quán Ăn 12A6 - Hội Trại Xuân'
    },
    slogan: {
      type: String,
      default: 'Ăn ngon, Giá hời, Ship tận nơi! 🎉'
    },
    logo: String,
    // Feature 297: WiFi info
    wifiName: String,
    wifiPassword: String,
    wifiQRCode: String,
    // Contact info
    hotline: String, // Feature 201
    address: String,
    // Feature 212: Slogan on bill
    billSlogan: {
      type: String,
      default: 'Cảm ơn quý khách! - Lớp 12A6 THPT Võ Văn Kiệt 💖'
    }
  },
  
  // Bank/Payment Configuration - Features 146-147
  payment: {
    bankId: {
      type: String,
      default: '970422' // MB Bank
    },
    bankName: {
      type: String,
      default: 'MB Bank'
    },
    accountNumber: {
      type: String,
      required: true
    },
    accountName: {
      type: String,
      required: true
    },
    // Feature 147: Transfer template
    transferTemplate: {
      type: String,
      default: 'LOP12A6' // Will be: LOP12A6 [OrderID]
    },
    // VietQR template
    vietQRTemplate: {
      type: String,
      default: 'compact2' // compact, compact2, qr_only, print
    }
  },
  
  // Operating Status - Features 153-154, 280
  operations: {
    // Feature 280: Open/Close status
    isOpen: {
      type: Boolean,
      default: true
    },
    openTime: {
      type: String,
      default: '07:00'
    },
    closeTime: {
      type: String,
      default: '17:00'
    },
    // Feature 153: Delivery only mode
    deliveryOnly: {
      type: Boolean,
      default: false
    },
    // Feature 154: Panic button - stop online orders
    stopOnlineOrders: {
      type: Boolean,
      default: false
    },
    stopOnlineReason: String,
    // Feature 232: Maintenance mode
    maintenanceMode: {
      type: Boolean,
      default: false
    },
    maintenanceMessage: {
      type: String,
      default: 'Hệ thống đang bảo trì, vui lòng quay lại sau!'
    }
  },
  
  // Order Settings
  orderSettings: {
    // Feature 293: Max quantity per item
    maxQuantityPerItem: {
      type: Number,
      default: 20
    },
    // Max items per order
    maxItemsPerOrder: {
      type: Number,
      default: 50
    },
    // Feature 94: Payment timeout warning (minutes)
    paymentTimeoutMinutes: {
      type: Number,
      default: 15
    },
    // Estimated prep time buffer (minutes)
    prepTimeBuffer: {
      type: Number,
      default: 5
    },
    // Feature 211: Allow pre-orders
    allowPreOrders: {
      type: Boolean,
      default: false
    }
  },
  
  // Delivery Settings - Feature 52
  delivery: {
    // List of delivery zones/locations
    zones: [{
      name: String, // "Dãy A", "Sân trường"
      description: String,
      isActive: { type: Boolean, default: true }
    }],
    // Feature 120: Delivery priority areas
    priorityZones: [String],
    // Estimated delivery time (minutes)
    estimatedDeliveryTime: {
      type: Number,
      default: 10
    }
  },
  
  // Notification Settings - Features 74-75, 267-268
  notifications: {
    soundEnabled: {
      type: Boolean,
      default: true
    },
    soundVolume: {
      type: Number,
      default: 80,
      min: 0,
      max: 100
    },
    // Feature 268: Custom notification sounds
    newOrderSound: {
      type: String,
      default: 'ting.mp3'
    },
    successSound: {
      type: String,
      default: 'success.mp3'
    },
    errorSound: {
      type: String,
      default: 'error.mp3'
    },
    // Push notification settings
    pushEnabled: {
      type: Boolean,
      default: true
    }
  },
  
  // UI/Theme Settings - Features 27-29
  theme: {
    // Feature 28: Default theme
    defaultMode: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light'
    },
    // Feature 29: Theme color
    primaryColor: {
      type: String,
      default: '#f83b3b'
    },
    secondaryColor: {
      type: String,
      default: '#eab308'
    },
    // Feature 27: Festive effects
    festiveMode: {
      enabled: { type: Boolean, default: true },
      effect: { type: String, default: 'tet' } // tet, christmas, halloween
    },
    // Feature 30: Marquee message
    marqueeMessage: {
      enabled: { type: Boolean, default: true },
      message: {
        type: String,
        default: '🎊 Chào mừng đến với Hội Trại Xuân 12A6! 🎊 Đặt món ngay để nhận ưu đãi! 🔥'
      }
    }
  },
  
  // Feature 165: Lucky wheel configuration
  luckyWheel: {
    enabled: { type: Boolean, default: true },
    prizes: [{
      name: String,
      probability: Number, // Percentage
      type: { type: String, enum: ['voucher', 'points', 'free_item', 'nothing'] },
      value: mongoose.Schema.Types.Mixed // voucher code, points amount, product id
    }]
  },
  
  // Feature 166: Loyalty configuration
  loyalty: {
    enabled: { type: Boolean, default: true },
    pointsPerVND: { type: Number, default: 0.01 }, // 1 point per 100 VND
    pointRedemptionRate: { type: Number, default: 100 } // 100 points = 1000 VND
  },
  
  // Credits - Feature 300
  credits: {
    teamName: {
      type: String,
      default: 'Lớp 12A6 - THPT Võ Văn Kiệt'
    },
    developers: [{
      name: String,
      role: String
    }],
    version: {
      type: String,
      default: '1.0.0'
    }
  },
  
  // Feature 155-157: Backup settings
  backup: {
    lastBackup: Date,
    autoBackupEnabled: {
      type: Boolean,
      default: true
    },
    backupFrequency: {
      type: String,
      default: 'daily'
    }
  }

}, {
  timestamps: true
});

// Static method to get the config (creates if not exists)
systemConfigSchema.statics.getConfig = async function() {
  let config = await this.findOne({ configType: 'main' });
  if (!config) {
    config = await this.create({
      configType: 'main',
      payment: {
        accountNumber: '0123456789',
        accountName: 'LOP 12A6 VVK'
      }
    });
  }
  return config;
};

// Method to check if store is currently open
systemConfigSchema.methods.isCurrentlyOpen = function() {
  if (!this.operations.isOpen) return false;
  if (this.operations.maintenanceMode) return false;
  if (this.operations.stopOnlineOrders) return false;
  
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  return currentTime >= this.operations.openTime && currentTime <= this.operations.closeTime;
};

// Generate VietQR Data
systemConfigSchema.methods.generateVietQRData = function(amount, orderId) {
  const content = `${this.payment.transferTemplate} ${orderId}`;
  return {
    bankId: this.payment.bankId,
    accountNumber: this.payment.accountNumber,
    accountName: this.payment.accountName,
    amount: amount,
    description: content,
    template: this.payment.vietQRTemplate,
    // VietQR URL format
    qrUrl: `https://img.vietqr.io/image/${this.payment.bankId}-${this.payment.accountNumber}-${this.payment.vietQRTemplate}.png?amount=${amount}&addInfo=${encodeURIComponent(content)}&accountName=${encodeURIComponent(this.payment.accountName)}`
  };
};

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
