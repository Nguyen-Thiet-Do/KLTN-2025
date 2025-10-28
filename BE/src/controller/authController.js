const passport = require('../config/passport');
const authService = require('../service/authService');

// Login with Passport Local Strategy
const login = async (req, res, next) => {
  passport.authenticate('local', { session: false }, async (err, account, info) => {
    try {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Đã có lỗi xảy ra',
          error: err.message
        });
      }

      if (!account) {
        return res.status(401).json({
          success: false,
          message: info.message || 'Đăng nhập thất bại'
        });
      }

      const data = await authService.loginService(account);

      return res.json({
        success: true,
        message: 'Đăng nhập thành công',
        data
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Đã có lỗi xảy ra',
        error: error.message
      });
    }
  })(req, res, next);
};

// Refresh Token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token là bắt buộc'
      });
    }

    const data = await authService.refreshTokenService(refreshToken);

    return res.json({
      success: true,
      message: 'Refresh token thành công',
      data
    });
  } catch (error) {
    if (error.message === 'INVALID_REFRESH_TOKEN') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token không hợp lệ'
      });
    }

    if (error.message === 'INACTIVE_ACCOUNT') {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản không hoạt động'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token không hợp lệ'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token đã hết hạn'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Đã có lỗi xảy ra',
      error: error.message
    });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    await authService.logoutService(req.user.accountId);

    return res.json({
      success: true,
      message: 'Đăng xuất thành công'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Đã có lỗi xảy ra',
      error: error.message
    });
  }
};

// Get Profile
const getProfile = async (req, res) => {
  try {
    const fullProfile = await authService.getFullProfile(
      req.user.accountId,
      req.user.roleId
    );

    if (!fullProfile) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin tài khoản'
      });
    }

    return res.json({
      success: true,
      message: 'Lấy thông tin tài khoản thành công',
      data: fullProfile
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Đã có lỗi xảy ra',
      error: error.message
    });
  }
};

// Register Reader
const registerReader = async (req, res) => {
  try {
    const data = await authService.registerReaderService(req.body);

    return res.status(201).json({
      success: true,
      message: 'Đăng ký thành công',
      data
    });
  } catch (error) {
    console.error('Register error:', error);

    // Handle custom errors
    const errorMessages = {
      'MISSING_REQUIRED_FIELDS': 'Email, mật khẩu và họ tên là bắt buộc',
      'INVALID_EMAIL': 'Email không hợp lệ',
      'WEAK_PASSWORD': 'Mật khẩu phải có ít nhất 6 ký tự',
      'EMAIL_EXISTS': 'Email đã được sử dụng',
      'CCCD_EXISTS': 'CCCD đã được đăng ký'
    };

    if (errorMessages[error.message]) {
      return res.status(error.message === 'EMAIL_EXISTS' || error.message === 'CCCD_EXISTS' ? 409 : 400).json({
        success: false,
        message: errorMessages[error.message]
      });
    }

    // Handle Sequelize errors
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: error.errors.map(e => ({
          field: e.path,
          message: e.message
        }))
      });
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        message: 'Email hoặc CCCD đã được sử dụng'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Đã có lỗi xảy ra khi đăng ký',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const loginReader = async (req, res, next) => {
  passport.authenticate('local', { session: false }, async (err, account, info) => {
    try {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Đã có lỗi xảy ra',
          error: err.message
        });
      }

      if (!account) {
        return res.status(401).json({
          success: false,
          message: info?.message || 'Đăng nhập thất bại'
        });
      }

      // Chỉ cho phép Reader
      if (account.roleId !== 3) {
        return res.status(403).json({
          success: false,
          message: 'Chỉ tài khoản độc giả (roleId = 3) được phép đăng nhập tại endpoint này'
        });
      }

      const data = await authService.loginService(account);

      return res.json({
        success: true,
        message: 'Đăng nhập thành công (Reader)',
        data
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Đã có lỗi xảy ra',
        error: error.message
      });
    }
  })(req, res, next);
};

module.exports = {
  login,
  refreshToken,
  logout,
  getProfile,
  registerReader,
  loginReader
};