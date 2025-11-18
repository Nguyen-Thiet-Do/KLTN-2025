// src/config/firebase.js
const admin = require("firebase-admin");
const path = require("path");

if (!admin.apps.length) {
  const keyPath = process.env.FCM_KEY_PATH
    ? path.resolve(process.cwd(), process.env.FCM_KEY_PATH)
    : path.join(__dirname, "fcmKey.json");

  const serviceAccount = require(keyPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const messaging = admin.messaging();

module.exports = { admin, messaging };
