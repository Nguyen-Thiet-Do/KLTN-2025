// src/config/firebase.js
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

let messaging = null;
let firebaseInitialized = false;

function initFirebase() {
  if (firebaseInitialized) {
    return { admin, messaging };
  }

  try {
    if (!admin.apps.length) {
      // Lấy path key từ ENV hoặc fallback
      const keyPath = process.env.FCM_KEY_PATH
        ? path.resolve(process.cwd(), process.env.FCM_KEY_PATH)
        : path.join(__dirname, "fcmKey.json");

      if (!fs.existsSync(keyPath)) {
        console.warn(
          `[FCM] ⚠ Không tìm thấy file service account: ${keyPath}. App vẫn tiếp tục chạy nhưng FCM sẽ bị tắt.`
        );
        return { admin: null, messaging: null };
      }

      const serviceAccount = require(keyPath);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      console.log("[FCM] Firebase Admin initialized.");
    }

    messaging = admin.messaging();
    firebaseInitialized = true;

    return { admin, messaging };
  } catch (err) {
    console.error("[FCM] 🚨 Lỗi khi khởi tạo Firebase (app sẽ vẫn chạy):", err.message);
    // Không throw để app không crash
    return { admin: null, messaging: null };
  }
}

// Khởi tạo ngay khi file được import, nhưng KHÔNG CRASH nếu lỗi.
initFirebase();

module.exports = { admin, messaging, initFirebase };
