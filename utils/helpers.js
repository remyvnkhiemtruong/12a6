/**
 * Currency and text formatting utilities
 * Features: 290-291
 */

// Feature 290: Format currency with Vietnamese format (10.000 đ)
const formatCurrency = (amount) => {
  if (typeof amount !== 'number' || isNaN(amount)) return '0 đ';
  return amount.toLocaleString('vi-VN') + ' đ';
};

// Feature 291: Capitalize first letter of each word
const capitalizeWords = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Slugify Vietnamese text
const slugify = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
    .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
    .replace(/[ìíịỉĩ]/g, 'i')
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
    .replace(/[ùúụủũưừứựửữ]/g, 'u')
    .replace(/[ỳýỵỷỹ]/g, 'y')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

// Generate random order short ID
const generateShortId = (index) => {
  const prefix = String.fromCharCode(65 + Math.floor(index / 99)); // A, B, C...
  const suffix = ((index % 99) + 1).toString().padStart(2, '0');
  return `${prefix}${suffix}`;
};

// Feature 289: Validate Vietnamese phone number
const validatePhone = (phone) => {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, '');
  return /^0[0-9]{9}$/.test(cleaned);
};

// Format phone for display
const formatPhone = (phone) => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
};

// Calculate time difference in human-readable format
const timeAgo = (date) => {
  const now = new Date();
  const diff = now - new Date(date);
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  
  return new Date(date).toLocaleDateString('vi-VN');
};

// Get greeting based on time (Feature 191)
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Chào buổi sáng';
  if (hour >= 12 && hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
};

// Generate random avatar (Feature 205)
const getRandomAvatar = () => {
  const avatars = ['cat', 'dog', 'rabbit', 'bear', 'panda', 'fox', 'lion', 'tiger'];
  return avatars[Math.floor(Math.random() * avatars.length)];
};

// Safe JSON parse
const safeJSONParse = (str, fallback = null) => {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

// Truncate text
const truncate = (str, length = 50) => {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
};

module.exports = {
  formatCurrency,
  capitalizeWords,
  slugify,
  generateShortId,
  validatePhone,
  formatPhone,
  timeAgo,
  getGreeting,
  getRandomAvatar,
  safeJSONParse,
  truncate
};
