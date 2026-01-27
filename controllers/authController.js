/**
 * Authentication Controller
 * Features: 148-151
 */

const { User } = require('../models');

// Login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        error: true,
        message: 'Vui lòng nhập tên đăng nhập và mật khẩu'
      });
    }
    
    // Find user with password
    const user = await User.findOne({ username: username.toLowerCase() }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        error: true,
        message: 'Tên đăng nhập hoặc mật khẩu không đúng'
      });
    }
    
    // Check if account is locked - Feature 151
    if (user.status.isLocked) {
      return res.status(403).json({
        error: true,
        message: `Tài khoản đã bị khóa: ${user.status.lockedReason || 'Liên hệ quản lý'}`
      });
    }
    
    if (!user.status.isActive) {
      return res.status(403).json({
        error: true,
        message: 'Tài khoản đã bị vô hiệu hóa'
      });
    }
    
    // Verify password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({
        error: true,
        message: 'Tên đăng nhập hoặc mật khẩu không đúng'
      });
    }
    
    // Update last login - Feature 152
    user.lastLogin = new Date();
    user.loginHistory.push({
      loginAt: new Date(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    // Keep only last 10 login records
    if (user.loginHistory.length > 10) {
      user.loginHistory = user.loginHistory.slice(-10);
    }
    
    await user.save();
    
    // Create session
    req.session.user = {
      _id: user._id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      additionalRoles: user.additionalRoles,
      avatar: user.avatar
    };
    
    // Determine redirect URL based on role
    let redirectUrl = '/';
    switch (user.role) {
      case 'admin':
        redirectUrl = '/admin';
        break;
      case 'cashier':
        redirectUrl = '/cashier';
        break;
      case 'kitchen':
        redirectUrl = '/kitchen';
        break;
      case 'shipper':
        redirectUrl = '/shipper';
        break;
    }
    
    // Use saved return URL if exists
    if (req.session.returnTo) {
      redirectUrl = req.session.returnTo;
      delete req.session.returnTo;
    }
    
    res.json({
      success: true,
      message: `Xin chào, ${user.displayName}!`,
      user: {
        _id: user._id,
        displayName: user.displayName,
        role: user.role
      },
      redirectUrl
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: true,
      message: 'Đã xảy ra lỗi. Vui lòng thử lại!'
    });
  }
};

// Logout
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({
        error: true,
        message: 'Không thể đăng xuất'
      });
    }
    
    res.json({
      success: true,
      message: 'Đăng xuất thành công',
      redirectUrl: '/'
    });
  });
};

// Get current user
exports.getCurrentUser = (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      error: true,
      message: 'Chưa đăng nhập'
    });
  }
  
  res.json({
    success: true,
    user: req.session.user
  });
};

// Register customer (optional - for loyalty features)
exports.registerCustomer = async (req, res) => {
  try {
    const { phone, name, class: studentClass } = req.body;
    
    if (!phone || !name) {
      return res.status(400).json({
        error: true,
        message: 'Vui lòng nhập đầy đủ thông tin'
      });
    }
    
    // Check if phone already registered
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({
        error: true,
        message: 'Số điện thoại đã được đăng ký'
      });
    }
    
    const user = await User.create({
      username: phone,
      password: phone.slice(-4), // Last 4 digits as password
      displayName: name,
      phone,
      role: 'customer',
      customerProfile: {
        class: studentClass
      }
    });
    
    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công!',
      user: {
        _id: user._id,
        displayName: user.displayName
      }
    });
    
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể đăng ký. Vui lòng thử lại!'
    });
  }
};

// ADMIN FUNCTIONS - Features 148-151

// Create staff account - Feature 148
exports.createStaff = async (req, res) => {
  try {
    const { username, password, displayName, role, additionalRoles, phone } = req.body;
    
    if (!username || !password || !displayName || !role) {
      return res.status(400).json({
        error: true,
        message: 'Vui lòng nhập đầy đủ thông tin'
      });
    }
    
    // Validate role
    const validRoles = ['cashier', 'kitchen', 'shipper', 'admin', 'pass'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: true,
        message: 'Role không hợp lệ'
      });
    }
    
    // Check if username exists
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        error: true,
        message: 'Tên đăng nhập đã tồn tại'
      });
    }
    
    const user = await User.create({
      username: username.toLowerCase(),
      password,
      displayName,
      role,
      additionalRoles: additionalRoles || [],
      phone
    });
    
    res.status(201).json({
      success: true,
      message: 'Tạo tài khoản thành công',
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể tạo tài khoản'
    });
  }
};

// Get all staff - Feature 148
exports.getAllStaff = async (req, res) => {
  try {
    const staff = await User.find({
      role: { $ne: 'customer' }
    })
      .select('-password')
      .sort({ role: 1, displayName: 1 });
    
    res.json({
      success: true,
      staff
    });
    
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể lấy danh sách nhân viên'
    });
  }
};

// Reset password - Feature 150
exports.resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({
        error: true,
        message: 'Mật khẩu phải có ít nhất 4 ký tự'
      });
    }
    
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        error: true,
        message: 'Không tìm thấy tài khoản'
      });
    }
    
    user.password = newPassword;
    await user.save();
    
    res.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công'
    });
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể đặt lại mật khẩu'
    });
  }
};

// Lock/Unlock account - Feature 151
exports.toggleAccountLock = async (req, res) => {
  try {
    const { id } = req.params;
    const { locked, reason } = req.body;
    
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        error: true,
        message: 'Không tìm thấy tài khoản'
      });
    }
    
    user.status.isLocked = locked;
    
    if (locked) {
      user.status.lockedReason = reason || 'Bị khóa bởi quản lý';
      user.status.lockedAt = new Date();
      user.status.lockedBy = req.session.user._id;
    } else {
      user.status.lockedReason = null;
      user.status.lockedAt = null;
      user.status.lockedBy = null;
    }
    
    await user.save();
    
    res.json({
      success: true,
      message: locked ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản'
    });
    
  } catch (error) {
    console.error('Toggle lock error:', error);
    res.status(500).json({
      error: true,
      message: 'Không thể cập nhật trạng thái tài khoản'
    });
  }
};
