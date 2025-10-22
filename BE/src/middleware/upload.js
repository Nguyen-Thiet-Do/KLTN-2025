const multer = require("multer");
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const isCover = file.fieldname === "cover";
    const okCover = /^image\/(png|jpeg|jpg|webp)$/.test(file.mimetype);
    const okEbook = /\.(pdf|epub)$/i.test(file.originalname || "");
    if ((isCover && okCover) || (!isCover && okEbook)) cb(null, true);
    else cb(new Error("Định dạng file không hợp lệ"));
  }
});

module.exports = { upload };
