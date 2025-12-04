// src/config/cloudinary.js
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Test connection khi server khởi động
cloudinary.api.ping()
  .then(() => {
    console.log('✅ Cloudinary connected successfully');
    console.log('📦 Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
  })
  .catch((err) => {
    console.error('❌ Cloudinary connection error:', err);
  });

module.exports = cloudinary;