const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Category, Product, SystemConfig } = require('../models');

const seedData = async () => {
  console.log('🌱 Bắt đầu seed dữ liệu...');
  
  try {
    // Clear existing data
    await Promise.all([
      User.deleteMany({ role: { $ne: 'customer' } }),
      Category.deleteMany({}),
      Product.deleteMany({})
    ]);
    
    // Create default users
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    const users = await User.insertMany([
      { username: 'admin', password: await bcrypt.hash('admin123', 10), displayName: 'Admin', role: 'admin' },
      { username: 'cashier', password: await bcrypt.hash('cashier123', 10), displayName: 'Thu Ngân 1', role: 'cashier' },
      { username: 'cashier2', password: hashedPassword, displayName: 'Thu Ngân 2', role: 'cashier' },
      { username: 'kitchen', password: await bcrypt.hash('kitchen123', 10), displayName: 'Bếp Chính', role: 'kitchen' },
      { username: 'kitchen2', password: hashedPassword, displayName: 'Pha Chế', role: 'kitchen' },
      { username: 'shipper', password: await bcrypt.hash('shipper123', 10), displayName: 'Shipper 1', role: 'shipper', phone: '0901234567' },
      { username: 'shipper2', password: hashedPassword, displayName: 'Shipper 2', role: 'shipper', phone: '0901234568' }
    ]);
    console.log(`✅ Đã tạo ${users.length} tài khoản`);
    
    // Create categories
    const categories = await Category.insertMany([
      { name: 'Đồ ăn chính', slug: 'do-an-chinh', icon: '🍜', kitchenZone: 'hot_kitchen', displayOrder: 1 },
      { name: 'Đồ ăn vặt', slug: 'do-an-vat', icon: '🍟', kitchenZone: 'hot_kitchen', displayOrder: 2 },
      { name: 'Nước uống', slug: 'nuoc-uong', icon: '🧃', kitchenZone: 'beverage', displayOrder: 3 },
      { name: 'Trà sữa', slug: 'tra-sua', icon: '🧋', kitchenZone: 'beverage', displayOrder: 4 },
      { name: 'Tráng miệng', slug: 'trang-mieng', icon: '🍰', kitchenZone: 'dessert', displayOrder: 5 }
    ]);
    console.log(`✅ Đã tạo ${categories.length} danh mục`);
    
    // Create sample products
    const products = await Product.insertMany([
      // Đồ ăn chính
      {
        name: 'Mì xào hải sản',
        slug: 'mi-xao-hai-san',
        category: categories[0]._id,
        price: 35000,
        description: 'Mì xào với tôm, mực, rau củ tươi ngon',
        images: [{ url: '/images/products/mi-xao.jpg' }],
        labels: { isBestSeller: true },
        inventory: { currentStock: 50 },
        prepTime: 10
      },
      {
        name: 'Cơm chiên dương châu',
        slug: 'com-chien-duong-chau',
        category: categories[0]._id,
        price: 30000,
        description: 'Cơm chiên với trứng, xúc xích, đậu hà lan',
        images: [{ url: '/images/products/com-chien.jpg' }],
        inventory: { currentStock: 50 },
        prepTime: 8
      },
      {
        name: 'Phở bò',
        slug: 'pho-bo',
        category: categories[0]._id,
        price: 40000,
        description: 'Phở bò truyền thống với nước dùng đậm đà',
        images: [{ url: '/images/products/pho-bo.jpg' }],
        labels: { isNew: true },
        inventory: { currentStock: 30 },
        prepTime: 12
      },
      
      // Đồ ăn vặt
      {
        name: 'Khoai tây chiên',
        slug: 'khoai-tay-chien',
        category: categories[1]._id,
        price: 20000,
        description: 'Khoai tây chiên giòn rụm',
        images: [{ url: '/images/products/khoai-tay.jpg' }],
        labels: { isBestSeller: true },
        inventory: { currentStock: 100 },
        sizes: [
          { name: 'Nhỏ', priceAdd: 0 },
          { name: 'Vừa', priceAdd: 5000 },
          { name: 'Lớn', priceAdd: 10000 }
        ],
        prepTime: 5
      },
      {
        name: 'Xúc xích nướng',
        slug: 'xuc-xich-nuong',
        category: categories[1]._id,
        price: 15000,
        description: 'Xúc xích nướng thơm ngon',
        images: [{ url: '/images/products/xuc-xich.jpg' }],
        inventory: { currentStock: 80 },
        prepTime: 5
      },
      {
        name: 'Bánh tráng trộn',
        slug: 'banh-trang-tron',
        category: categories[1]._id,
        price: 18000,
        description: 'Bánh tráng trộn chua cay, đầy đủ topping',
        images: [{ url: '/images/products/banh-trang.jpg' }],
        labels: { isVegetarian: true },
        inventory: { currentStock: 50 },
        prepTime: 3
      },
      
      // Nước uống
      {
        name: 'Nước cam ép',
        slug: 'nuoc-cam-ep',
        category: categories[2]._id,
        price: 15000,
        description: 'Nước cam tươi ép tại chỗ',
        images: [{ url: '/images/products/nuoc-cam.jpg' }],
        inventory: { currentStock: 100 },
        customizations: {
          sugarLevels: ['Không đường', 'Ít đường', '50%', '70%', '100%'],
          iceLevels: ['Không đá', 'Ít đá', 'Bình thường', 'Nhiều đá']
        },
        prepTime: 3
      },
      {
        name: 'Coca Cola',
        slug: 'coca-cola',
        category: categories[2]._id,
        price: 12000,
        images: [{ url: '/images/products/coca.jpg' }],
        inventory: { currentStock: 200 },
        prepTime: 1
      },
      
      // Trà sữa
      {
        name: 'Trà sữa truyền thống',
        slug: 'tra-sua-truyen-thong',
        category: categories[3]._id,
        price: 25000,
        description: 'Trà sữa thơm ngon, béo ngậy',
        images: [{ url: '/images/products/tra-sua.jpg' }],
        labels: { isBestSeller: true },
        inventory: { currentStock: 100 },
        sizes: [
          { name: 'M', priceAdd: 0 },
          { name: 'L', priceAdd: 5000 }
        ],
        toppings: [
          { name: 'Trân châu đen', price: 5000 },
          { name: 'Trân châu trắng', price: 5000 },
          { name: 'Pudding', price: 7000 },
          { name: 'Thạch dừa', price: 5000 }
        ],
        customizations: {
          sugarLevels: ['Không đường', '30%', '50%', '70%', '100%'],
          iceLevels: ['Không đá', 'Ít đá', 'Bình thường', 'Nhiều đá']
        },
        prepTime: 5
      },
      {
        name: 'Trà đào cam sả',
        slug: 'tra-dao-cam-sa',
        category: categories[3]._id,
        price: 28000,
        description: 'Trà đào thơm mát, thanh nhiệt',
        images: [{ url: '/images/products/tra-dao.jpg' }],
        labels: { isNew: true },
        inventory: { currentStock: 80 },
        sizes: [
          { name: 'M', priceAdd: 0 },
          { name: 'L', priceAdd: 5000 }
        ],
        customizations: {
          sugarLevels: ['Không đường', '30%', '50%', '70%', '100%'],
          iceLevels: ['Không đá', 'Ít đá', 'Bình thường', 'Nhiều đá']
        },
        prepTime: 5
      },
      
      // Tráng miệng
      {
        name: 'Bánh flan',
        slug: 'banh-flan',
        category: categories[4]._id,
        price: 15000,
        description: 'Bánh flan mịn màng, thơm caramel',
        images: [{ url: '/images/products/flan.jpg' }],
        inventory: { currentStock: 40 },
        prepTime: 2
      },
      {
        name: 'Chè đậu đỏ',
        slug: 'che-dau-do',
        category: categories[4]._id,
        price: 18000,
        description: 'Chè đậu đỏ nước cốt dừa',
        images: [{ url: '/images/products/che.jpg' }],
        labels: { isVegetarian: true },
        inventory: { currentStock: 30 },
        prepTime: 3
      }
    ]);
    console.log(`✅ Đã tạo ${products.length} sản phẩm`);
    
    // Initialize system config
    await SystemConfig.getConfig(); // Creates default if not exists
    console.log('✅ Đã khởi tạo cấu hình hệ thống');
    
    console.log('🎉 Seed dữ liệu hoàn tất!');
    console.log('\n📋 Tài khoản đăng nhập:');
    console.log('  - Admin: admin / admin123');
    console.log('  - Thu ngân: cashier / cashier123');
    console.log('  - Bếp: kitchen / kitchen123');
    console.log('  - Shipper: shipper / shipper123');
    
  } catch (error) {
    console.error('❌ Lỗi seed dữ liệu:', error);
    throw error;
  }
};

// Run if called directly
if (require.main === module) {
  require('dotenv').config();
  const connectDB = require('../config/db');
  
  connectDB()
    .then(() => seedData())
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = seedData;
