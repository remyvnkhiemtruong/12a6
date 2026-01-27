// Export all models from a single entry point
const Category = require('./Category');
const Product = require('./Product');
const Order = require('./Order');
const User = require('./User');
const Voucher = require('./Voucher');
const SystemConfig = require('./SystemConfig');

module.exports = {
  Category,
  Product,
  Order,
  User,
  Voucher,
  SystemConfig
};
