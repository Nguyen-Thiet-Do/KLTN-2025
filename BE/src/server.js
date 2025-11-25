// ============================================================
// APPLICATION SERVER CONFIGURATION
// ============================================================

// ⚠️ NẠP BIẾN MÔI TRƯỜNG PHẢI ĐƯỢC ĐẶT Ở DÒNG ĐẦU TIÊN
require('dotenv').config();

const express = require('express');
const httpsRedirect = require('./middleware/httpsRedirect');
const cors = require('cors');
const sequelize = require('./config/database');
const passport = require('./config/passport'); // passport sử dụng JWT_SECRET từ .env

// ⚡ THÊM SOCKET.IO
const http = require("http");
const { initSocket } = require("./config/socket");

// ROUTES
const authRoutes = require('./route/authRoutes');
const routeApi = require('./route/api');
const librarianRoutes = require("./route/librarianRoutes");
const readerRoutes = require("./route/readerRoutes");
const documentRoutes = require('./route/documentRoutes');
const fileRoute = require('./route/fileRoutes');
const profileRoutes = require("./route/profileRoutes");
const metadataRoutes = require("./route/metadataRoutes");
const documentAdminRoutes = require('./route/documentAdminRoutes');
const adminLoanSlipRoutes = require('./route/adminLoanSlip.routes');
const readerLoanSlipRoutes = require('./route/readerLoanSlip.routes');
const statisticRoutes = require('./route/statisticRoutes');
const payosRoutes = require('./route/payos.routes');
const notificationRoutes = require('./route/notificationRoutes');
const debugJobRoutes = require("./route/debugJob.routes");
const fcmRoutes = require('./route/fcm.api');


const nodemailer = require('nodemailer');
const { scheduleDailyJob, runNotificationJob } = require('./service/notificationJob.service');

const app = express();
const port = process.env.PORT || 8080;

const cartRoutes = require("./route/cartRoutes");
const favoriteRoutes = require("./route/favoriteRoutes");
const paymentRoutes = require('./route/payment');
// ============================================================
// CORS CONFIGURATION
// ============================================================
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// ============================================================
// VIEW ENGINE
// ============================================================
const configViewEngine = require('./config/viewEngine');
configViewEngine(app);

// ============================================================
// MIDDLEWARE
// ============================================================
const rawBodySaver = (req, res, buf, encoding) => {
  if (buf && buf.length) req.rawBody = buf.toString(encoding || 'utf8');
};
app.use(express.json({ limit: '10mb', verify: rawBodySaver }));
app.use(express.urlencoded({ extended: true, limit: '10mb', verify: rawBodySaver }));

// Khởi tạo Passport
app.use(passport.initialize());
app.set('trust proxy', 1);
app.use(httpsRedirect);

// ============================================================
// ROUTES
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/librarian', librarianRoutes);
app.use('/api/reader', readerRoutes);
app.use('/', routeApi);
app.use('/api/documents', documentRoutes);
app.use('/api/files', fileRoute);
app.use('/api/profile', profileRoutes);
app.use('/api/metadata', metadataRoutes);
app.use('/api/documents/admin', documentAdminRoutes);
app.use('/api/loans/admin', adminLoanSlipRoutes);
app.use('/api/loans/reader', readerLoanSlipRoutes);
app.use('/api/statistics', statisticRoutes);
app.use('/api/payos', payosRoutes);
app.use('/pay', payosRoutes);
app.use('/api/notifications', notificationRoutes);
app.use("/api/debug", debugJobRoutes);
app.use('/api/fcm', fcmRoutes);

app.use("/api/cart", cartRoutes);
app.use("/api/favorite", favoriteRoutes);

app.use('/api', paymentRoutes);
// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date(),
    environment: process.env.NODE_ENV,
    port: port
  });
});

// ============================================================
// ERROR HANDLING
// ============================================================
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} không tồn tại`
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS policy: Origin không được phép'
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'development'
      ? err.message
      : 'Internal Server Error'
  });
});

// ============================================================
// START SERVER
// ============================================================
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Kết nối database thành công');
    console.log(`📊 Database: ${process.env.DB_NAME}`);

    // Lên lịch công việc hàng ngày
    try {
      scheduleDailyJob();
      console.log('⏰ Notification job scheduled (daily).');
    } catch (jobErr) {
      console.error('❌ Không thể đăng ký notification job:', jobErr);
    }

    // ----- One-off startup check: nếu server khởi động sau 02:00 (TZ cấu hình), chạy job ngay -----
    (async () => {
      try {
        const tz = process.env.SERVER_TIMEZONE || 'Asia/Ho_Chi_Minh';
        const now = new Date();
        // Lấy giờ theo timezone cấu hình (string rồi parse lại Date để lấy giờ cục bộ theo TZ)
        const localNowStr = now.toLocaleString('en-US', { timeZone: tz });
        const localHour = new Date(localNowStr).getHours();

        // Nếu server khởi động sau 02:00 (theo TZ), thì chạy one-off để bắt các cron bị missed
        if (localHour >= 2) {
          console.log('[notificationJob] Startup detected after 02:00 (TZ=' + tz + '), running one-off check at', new Date().toISOString());
          await runNotificationJob();
          console.log('[notificationJob] Startup one-off check finished at', new Date().toISOString());
        } else {
          console.log('[notificationJob] Startup before 02:00 (TZ=' + tz + '), skipping one-off run');
        }
      } catch (err) {
        console.error('[notificationJob] startup one-off error', err);
      }
    })();


    // ⚡ KHỞI TẠO HTTP SERVER + SOCKET.IO
    const server = http.createServer(app);
    initSocket(server);

    server.listen(port, '0.0.0.0', () => {
      console.log('='.repeat(50));
      console.log(`🚀 Server đang chạy tại port ${port}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 API Base: http://localhost:${port}`);
      console.log(`⚡ WebSocket: ENABLED`);
      console.log(`❤️  Health Check: http://localhost:${port}/health`);
      console.log('='.repeat(50));
    });

  } catch (error) {
    console.error('❌ Không thể kết nối database:', error.message);
    console.error('Chi tiết lỗi:', error);
    process.exit(1);
  }
};

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================
const shutdown = async (signal) => {
  console.log(`\n🛑 Nhận tín hiệu ${signal}, đang tắt server...`);

  try {
    await sequelize.close();
    console.log('✅ Đã đóng kết nối database');
    console.log('👋 Server đã tắt an toàn');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi đóng kết nối:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ============================================================
// GLOBAL ERROR HANDLERS
// ============================================================
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection tại:', promise);
  console.error('❌ Lý do:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// ============================================================
// RUN SERVER
// ============================================================
startServer();
