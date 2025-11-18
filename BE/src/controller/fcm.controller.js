// src/controller/fcm.controller.js
const { Account } = require("../model");
const fcmService = require("../service/fcm.service");

async function registerFcmToken(req, res) {
    try {
        const accountId = req.user.accountId;
        const { fcmToken } = req.body;

        if (!fcmToken) {
            return res.status(400).json({ success: false, message: "Missing FCM token" });
        }

        const account = await Account.findByPk(accountId);
        if (!account) {
            return res.status(404).json({ success: false, message: "Account not found" });
        }

        account.fcmToken = fcmToken;
        await account.save();

        return res.json({ success: true, message: "Token saved" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

/**
 * Send a test notification to currently authenticated user's token
 * Body: { title, body, data }
 */
async function sendTestNotification(req, res) {
    try {
        const accountId = req.user.accountId;
        const { title = "Test", body = "Hello from server", data = {} } = req.body;

        const account = await Account.findByPk(accountId);
        if (!account || !account.fcmToken) {
            return res.status(404).json({ success: false, message: "No token saved for this account" });
        }

        const payload = {
            notification: { title, body },
            data: Object.keys(data).length ? data : undefined
        };

        const { success, resp, error } = await fcmService.sendToToken(account.fcmToken, payload);

        if (!success) {
            console.error("FCM send error:", error);
            // nếu token invalid bạn nên xóa token khỏi DB
            return res.status(500).json({ success: false, message: "Failed to send notification", error: error.message });
        }

        return res.json({ success: true, message: "Notification sent", resp });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

module.exports = { registerFcmToken, sendTestNotification };
