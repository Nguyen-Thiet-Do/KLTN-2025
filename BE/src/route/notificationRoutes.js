// src/route/notificationRoutes.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controller/notification.controller');

// dùng middleware auth/role (đổi đường dẫn nếu file của bạn ở chỗ khác)
const { requireAuth, requireRole } = require('../middleware/auth');

// Routes cho notifications
// GET /api/notifications
router.get('/', requireAuth, notificationController.listNotifications);

// GET /api/notifications/:id
router.get('/:id', requireAuth, notificationController.getNotification);

// POST /api/notifications/:id/mark-read
router.post('/:id/mark-read', requireAuth, notificationController.markRead);

// POST /api/notifications/:id/mark-unread
router.post('/:id/mark-unread', requireAuth, notificationController.markUnread);

// POST /api/notifications/mark-all-read
router.post('/mark-all-read', requireAuth, notificationController.markAllRead);

// POST /api/notifications/create  -> chỉ dành cho Admin (roleId = 1)
// nếu muốn cho Admin và Librarian: use requireRole([1,2])
router.post('/create', requireAuth, requireRole([1]), notificationController.createNotification);

module.exports = router;
