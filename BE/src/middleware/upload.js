// src/middleware/upload.js
const multer = require("multer");
const path = require("path");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// ========================================
// PHẦN CŨ - GIỮ NGUYÊN (cho documents/covers)
// ========================================
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const isCover = file.fieldname === "cover";
  const okImage = /\.(png|jpg|jpeg|webp)$/i.test(file.originalname || "");
  const okEbook = /\.(pdf|epub)$/i.test(file.originalname || "");

  if (isCover && okImage) cb(null, true);
  else if (!isCover && (okImage || okEbook)) cb(null, true);
  else cb(new Error("Định dạng file không hợp lệ"));
};

const upload = multer({
  storage,
  limits: { filesize: 50 * 1024 * 1024 },
  fileFilter
});

// ========================================
// ✅ PHẦN MỚI - CLOUDINARY AVATAR UPLOAD (FIXED)
// ========================================
const avatarStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const accountId = req.user?.accountId || "unknown";
    
    return {
      folder: "avatars",
      allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
      public_id: `avatar-${accountId}-${Date.now()}`,
      // ✅ SỬA: transformation phải là object, không phải array
      transformation: {
        width: 500,
        height: 500,
        crop: "fill",
        quality: "auto"
      }
    };
  }
});

const uploadAvatarMiddleware = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
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
  },
}).single("avatar");

// ========================================
// EXPORT
// ========================================
module.exports = { 
  upload,
  uploadAvatarMiddleware
};