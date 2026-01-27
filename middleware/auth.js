/**
 * Authentication Middleware
 * Features: 149 (Role-based access), 151 (Account status)
 */

// Check if user is logged in
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  
  // Check if API request
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ error: true, message: 'Vui lòng đăng nhập' });
  }
  
  // Redirect to login
  req.session.returnTo = req.originalUrl;
  return res.redirect('/login');
};

// Check if user has specific role
const hasRole = (...roles) => {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ error: true, message: 'Vui lòng đăng nhập' });
      }
      return res.redirect('/login');
    }
    
    const userRole = req.session.user.role;
    const additionalRoles = req.session.user.additionalRoles || [];
    
    // Check if user has any of the required roles
    const hasRequiredRole = roles.some(role => 
      userRole === role || additionalRoles.includes(role) || userRole === 'admin'
    );
    
    if (!hasRequiredRole) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({ error: true, message: 'Không có quyền truy cập' });
      }
      return res.status(403).render('errors/403', {
        title: 'Không có quyền',
        message: 'Bạn không có quyền truy cập trang này'
      });
    }
    
    next();
  };
};

// Check if account is active (not locked)
const isActive = async (req, res, next) => {
  if (!req.session || !req.session.user) {
    return next();
  }
  
  const User = require('../models/User');
  
  try {
    const user = await User.findById(req.session.user._id);
    
    if (!user || !user.status.isActive || user.status.isLocked) {
      // Clear session
      req.session.destroy();
      
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({ 
          error: true, 
          message: 'Tài khoản đã bị khóa hoặc vô hiệu hóa' 
        });
      }
      
      return res.redirect('/login?error=account_locked');
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

// Optional authentication - doesn't require login but passes user info if available
const optionalAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    res.locals.currentUser = req.session.user;
  }
  next();
};

// Role shortcuts
const isCashier = hasRole('cashier', 'admin');
const isKitchen = hasRole('kitchen', 'admin');
const isShipper = hasRole('shipper', 'admin');
const isAdmin = hasRole('admin');

module.exports = {
  isAuthenticated,
  hasRole,
  isActive,
  optionalAuth,
  isCashier,
  isKitchen,
  isShipper,
  isAdmin
};
