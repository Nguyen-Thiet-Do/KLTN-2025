const fs = require("fs");
const path = require("path");

// Đọc đúng file fcmKey.json trong thư mục src/config
const filePath = path.join(__dirname, "..", "config", "fcmKey.json");

if (!fs.existsSync(filePath)) {
    console.error("❌ Không tìm thấy file:", filePath);
    process.exit(1);
}

const data = fs.readFileSync(filePath);
const b64 = Buffer.from(data).toString("base64");

fs.writeFileSync(path.join(__dirname, "sa.b64"), b64);
console.log("✅ Đã tạo file src/scripts/sa.b64 thành công!");
