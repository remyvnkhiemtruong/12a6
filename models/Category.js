const mongoose = require('mongoose');

// Feature 140: Category management
const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên danh mục là bắt buộc'],
    trim: true,
    maxlength: [50, 'Tên danh mục không quá 50 ký tự']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    maxlength: [200, 'Mô tả không quá 200 ký tự']
  },
  icon: {
    type: String, // Emoji or icon class
    default: '🍽️'
  },
  image: {
    type: String // URL to category image
  },
  displayOrder: {
    type: Number,
    default: 0 // Feature 139: Sort order
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Feature 104: Kitchen zone assignment
  kitchenZone: {
    type: String,
    enum: ['hot_kitchen', 'cold_kitchen', 'beverage', 'dessert'],
    default: 'hot_kitchen'
  }
}, {
  timestamps: true
});

// Auto-generate slug from name
categorySchema.pre('save', function(next) {
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

module.exports = mongoose.model('Category', categorySchema);
