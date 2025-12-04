// src/middleware/upload.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ✅ Cấu hình storage cho COVER (memoryStorage - giữ nguyên cho các file khác)
const storage = multer.memoryStorage();

const limits = { fileSize: 50 * 1024 * 1024 }; // 50MB

const fileFilter = (req, file, cb) => {
  const isCover = file.fieldname === "cover";
  const isAvatar = file.fieldname === "avatar";
  const okImage = /\.(png|jpg|jpeg|webp)$/i.test(file.originalname || "");
  const okEbook = /\.(pdf|epub)$/i.test(file.originalname || "");

  if ((isCover && okImage) || (isAvatar && okImage)) cb(null, true);
  else if (!isCover && !isAvatar && (okImage || okEbook)) cb(null, true);
  else cb(new Error("Định dạng file không hợp lệ"));
};

const upload = multer({
  storage,
  limits: { filesize: 50 * 1024 * 1024 },
  fileFilter
});

// ========================================
// ✅ AVATAR UPLOAD CONFIGURATION
// ========================================

// Tạo thư mục avatars nếu chưa có
const avatarUploadsDir = path.join(__dirname, "../uploads/avatars");
if (!fs.existsSync(avatarUploadsDir)) {
  fs.mkdirSync(avatarUploadsDir, { recursive: true });
  console.log("✅ Created avatars directory:", avatarUploadsDir);
}

// Storage cho avatar (lưu trực tiếp vào disk)
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, avatarUploadsDir);
  },
  filename: function (req, file, cb) {
    // Tạo tên file unique: accountId-timestamp-random.ext
    const accountId = req.user?.accountId || "unknown";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${accountId}-${uniqueSuffix}${ext}`);
  },
});

// File filter cho avatar
const avatarFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Chỉ chấp nhận file ảnh (JPEG, PNG, GIF, WebP)"));
  }
};

// Cấu hình multer cho avatar
const avatarUploadConfig = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: avatarFileFilter,
});

// ✅ Middleware cho upload avatar - ĐỔI TÊN ĐỂ TRÁNH CONFLICT
const uploadAvatarMiddleware = avatarUploadConfig.single("avatar");

// ========================================
// ✅ EXPORT - QUAN TRỌNG
// ========================================
module.exports = { 
  upload, 
  uploadAvatarMiddleware  // ← TÊN MỚI, TRÁNH TRÙNG VỚI CONTROLLER
};