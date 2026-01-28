require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

const connectDB = require('./config/db');
const { configureSocket } = require('./config/socket');

// Initialize Express
const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? false 
      : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Feature 229: Low bandwidth mode support
  pingTimeout: 60000,
  pingInterval: 25000
});

// Make io accessible to routes
app.set('io', io);

// ============================================
// MIDDLEWARE CONFIGURATION
// ============================================

// Security headers (Feature 183: SSL/HTTPS ready)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdn.tailwindcss.com", "cdn.socket.io"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdn.tailwindcss.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "img.vietqr.io", "*.unsplash.com"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Compression for performance (Feature 180)
app.use(compression());

// Request logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting (Feature 184: DDoS protection)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: { error: 'Quá nhiều request, vui lòng thử lại sau!' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Stricter rate limit for order creation
const orderLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Max 10 orders per minute
  message: { error: 'Bạn đang gửi quá nhiều đơn hàng!' }
});
app.use('/api/orders/create', orderLimiter);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files with cache headers
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true
}));

// ============================================
// VIEW ENGINE SETUP
// ============================================

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ============================================
// SESSION CONFIGURATION
// ============================================

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'spring_fair_secret_2024',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/spring_fair_pos',
    ttl: 24 * 60 * 60 // 1 day
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
});

app.use(sessionMiddleware);

// Share session with Socket.io
io.engine.use(sessionMiddleware);

// ============================================
// GLOBAL TEMPLATE VARIABLES
// ============================================

app.use(async (req, res, next) => {
  // Feature 191: Greeting based on time of day
  const hour = new Date().getHours();
  let greeting = 'Xin chào';
  if (hour >= 5 && hour < 12) greeting = 'Chào buổi sáng';
  else if (hour >= 12 && hour < 18) greeting = 'Chào buổi chiều';
  else greeting = 'Chào buổi tối';
  
  res.locals.greeting = greeting;
  res.locals.currentUser = req.session.user || null;
  res.locals.currentPath = req.path;
  // Feature 200, 294: Version display
  res.locals.appVersion = '1.0.0';
  
  next();
});

// ============================================
// ROUTES
// ============================================

// Import routes
const customerRoutes = require('./routes/customerRoutes');
const orderRoutes = require('./routes/orderRoutes');
const productRoutes = require('./routes/productRoutes');
const authRoutes = require('./routes/authRoutes');
const cashierRoutes = require('./routes/cashierRoutes');
const kitchenRoutes = require('./routes/kitchenRoutes');
const shipperRoutes = require('./routes/shipperRoutes');
const adminRoutes = require('./routes/adminRoutes');
const apiRoutes = require('./routes/apiRoutes');

// Customer-facing routes (public)
app.use('/', customerRoutes);

// API routes
app.use('/api', apiRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);

// Staff routes (protected)
app.use('/cashier', cashierRoutes);
app.use('/kitchen', kitchenRoutes);
app.use('/shipper', shipperRoutes);
app.use('/admin', adminRoutes);

// ============================================
// SERVICE WORKER FOR PWA (Feature 176)
// ============================================

app.get('/sw.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

app.get('/manifest.json', (req, res) => {
  res.json({
    name: 'Quán Ăn 12A6 - Hội Trại Xuân',
    short_name: '12A6 POS',
    description: 'Hệ thống đặt món Hội Trại Xuân',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#f83b3b',
    icons: [
      { src: '/images/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/images/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 Handler (Feature 199)
app.use((req, res, next) => {
  res.status(404).render('errors/404', {
    title: 'Lạc đường rồi! 🗺️',
    message: 'Trang bạn tìm không tồn tại. Hay là quay lại đặt món đi!'
  });
});

// Global error handler (Feature 231)
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  
  // Log error to a file in production
  if (process.env.NODE_ENV === 'production') {
    const fs = require('fs');
    const logPath = path.join(__dirname, 'logs', 'errors.log');
    const logEntry = `[${new Date().toISOString()}] ${err.stack}\n`;
    fs.appendFileSync(logPath, logEntry);
  }
  
  const statusCode = err.status || 500;
  
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(statusCode).json({
      error: true,
      message: process.env.NODE_ENV === 'production' 
        ? 'Đã xảy ra lỗi, vui lòng thử lại sau!'
        : err.message
    });
  }
  
  res.status(statusCode).render('errors/500', {
    title: 'Lỗi hệ thống',
    message: process.env.NODE_ENV === 'production'
      ? 'Đã xảy ra lỗi, vui lòng thử lại sau!'
      : err.message
  });
});

// ============================================
// SERVER STARTUP
// ============================================

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Configure Socket.io events
    configureSocket(io);
    
    // Seed initial data if needed
    await seedInitialData();
    
    // Start server
    server.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🎉 SPRING FAIR POS SYSTEM - 12A6 VÕ VĂN KIỆT 🎉        ║
║                                                            ║
║   Server running on: http://localhost:${PORT}               ║
║   Environment: ${process.env.NODE_ENV || 'development'}                             ║
║                                                            ║
║   Customer Menu: http://localhost:${PORT}/                  ║
║   Cashier:       http://localhost:${PORT}/cashier           ║
║   Kitchen:       http://localhost:${PORT}/kitchen           ║
║   Shipper:       http://localhost:${PORT}/shipper           ║
║   Admin:         http://localhost:${PORT}/admin             ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Seed initial data function
async function seedInitialData() {
  const { SystemConfig, Category, User } = require('./models');
  
  // Ensure system config exists
  const config = await SystemConfig.getConfig();
  if (!config.payment.accountNumber || config.payment.accountNumber === '0123456789') {
    console.log('⚠️ Please update payment configuration in Admin panel!');
  }
  
  // Fix: Cleanup broken categories from previous failed seeds
  await Category.deleteMany({ slug: null });

  // Create default categories if none exist
  const categoryCount = await Category.countDocuments();
  if (categoryCount === 0) {
    await Category.insertMany([
      { name: 'Món Mặn', slug: 'mon-man', icon: '🍜', displayOrder: 1, kitchenZone: 'hot_kitchen' },
      { name: 'Ăn Vặt', slug: 'an-vat', icon: '🍿', displayOrder: 2, kitchenZone: 'hot_kitchen' },
      { name: 'Nước Uống', slug: 'nuoc-uong', icon: '🧃', displayOrder: 3, kitchenZone: 'beverage' },
      { name: 'Tráng Miệng', slug: 'trang-mieng', icon: '🍰', displayOrder: 4, kitchenZone: 'dessert' }
    ]);
    console.log('✅ Default categories created');
  }
  
  // Create default admin if none exists
  const adminExists = await User.findOne({ role: 'admin' });
  if (!adminExists) {
    await User.create({
      username: 'admin',
      password: 'admin123', // Will be hashed by pre-save hook
      displayName: 'Quản lý',
      role: 'admin'
    });
    console.log('✅ Default admin created (username: admin, password: admin123)');
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Start the server
startServer();

module.exports = { app, server, io };
