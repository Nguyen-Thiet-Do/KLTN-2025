// scripts/test-fcm.js
require("dotenv").config(); // load .env nếu có
const { initFirebase } = require("../config/firebase");
const admin = require("firebase-admin");

async function main() {
  console.log("=== FCM TEST SCRIPT ===");

  // Khởi tạo firebase không crash nếu lỗi
  const { messaging } = initFirebase();

  if (!messaging) {
    console.warn("[FCM TEST] ⚠ Firebase chưa được khởi tạo → không thể gửi thông báo.");
    console.warn("[FCM TEST] Kiểm tra lại file FCM_KEY_PATH hoặc fcmKey.json.");
    console.log("=== END TEST ===");
    return;
  }

  // Token để test (fake hoặc thật đều được)
  const token = process.env.TEST_FCM_TOKEN || "<PUT_YOUR_DEVICE_TOKEN_HERE>";

  if (!token || token.startsWith("<")) {
    console.error("[FCM TEST] ❌ Bạn chưa đặt TEST_FCM_TOKEN!");
    console.error("Hãy đặt token trong .env: TEST_FCM_TOKEN=xxxx");
    console.log("=== END TEST ===");
    return;
  }

  // Payload hợp lệ
  const message = {
    token,
    notification: {
      title: "FCM Test",
      body: "Hello from test script at " + new Date().toISOString(),
    },
    data: {
      // Lưu ý: không dùng 'from' — FCM sẽ lỗi
      source: "test-script",
      isTest: "true"
    }
  };

  console.log("[FCM TEST] Sending message to token:", token);

  try {
    const resp = await admin.messaging().send(message);
    console.log("[FCM TEST] 🎉 Gửi thành công:", resp);
  } catch (err) {
    console.error("[FCM TEST] ❌ Lỗi gửi FCM:");
    console.error("└─ Code:", err.code);
    console.error("└─ Message:", err.message);
    console.error("└─ Full error object:", err);
  }

  console.log("=== END TEST ===");
}

main();
