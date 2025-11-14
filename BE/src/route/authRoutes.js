const express = require('express');
const router = express.Router();
const authController = require('../controller/authController');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  validateRegister,
  validateLogin,
  validateRefreshToken,
  checkRateLimit
} = require('../middleware/authValidation');

// Public routes
router.get('/', (req, res) => {
  res.json({
    message: 'Auth route is working!',
    status: 'success',
    code: 200,
    data: null
  });
});

// Registration with validation
router.post('/register',
  validateRegister,
  authController.registerReader
);

// Login with validation and rate limiting
router.post('/login',
  validateLogin,
  checkRateLimit,
  authController.login
);

// Refresh token with validation
router.post('/refresh-token',
  validateRefreshToken,
  authController.refreshToken
);

// Protected routes
router.post('/logout',
  requireAuth,
  authController.logout
);

router.get('/profile',
  requireAuth,
  authController.getProfile
);

// Example: Admin only route
router.get('/admin',
  requireAuth,
  requireRole([1]),
  (req, res) => {
    res.json({
      success: true,
      message: 'Admin access granted',
      user: req.user
    });
  }
);

router.post(
  '/login/reader',
  validateLogin,
  checkRateLimit,
  authController.loginReader
);

router.post('/register/init', authController.registerInit);
router.post('/register/verify', authController.registerVerify);
router.post('/register/complete', authController.registerComplete);

module.exports = router;