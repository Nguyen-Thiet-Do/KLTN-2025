const { Account } = require("../model");
const fcmService = require("../service/fcm.service");
const { Op } = require("sequelize");

/**
 * POST /fcm/register
 * Body: { fcmToken }
 * Gọi khi user login hoặc khi token thay đổi (onNewToken)
 */
async function registerFcmToken(req, res) {
    try {
        const accountId = req.user.accountId;
        const { fcmToken } = req.body;

        if (!fcmToken) {
            return res.status(400).json({ success: false, message: "Missing FCM token" });
        }

        const account = await Account.findByPk(accountId);
        if (!account) return res.status(404).json({ success: false, message: "Account not found" });

        // Cập nhật token và lastLoginAt để đánh dấu account này là owner mới nhất
        account.fcmToken = fcmToken;
        account.lastLoginAt = new Date();
        await account.save();

        // --- Xóa token này khỏi các account khác (nếu có) để DB sạch hơn ---
        try {
            await Account.update(
                { fcmToken: null },
                {
                    where: {
                        fcmToken,
                        accountId: { [Op.ne]: accountId }
                    }
                }
            );
        } catch (e) {
            console.error("[FCM] Error clearing duplicate tokens for other accounts:", e?.message || e);
        }

        return res.json({ success: true, message: "Token saved" });
    } catch (err) {
        console.error("[FCM Controller] registerFcmToken error:", err?.message || err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
}

/**
 * POST /fcm/unregister
 * Gọi khi user logout (tùy chọn nhưng nên dùng)
 */
async function unregisterFcmToken(req, res) {
    try {
        const accountId = req.user.accountId;
        const account = await Account.findByPk(accountId);
        if (!account) return res.status(404).json({ success: false, message: "Account not found" });

        account.fcmToken = null;
        await account.save();

        return res.json({ success: true, message: "Token removed" });
    } catch (err) {
        console.error("[FCM Controller] unregisterFcmToken error:", err?.message || err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
}

/**
 * Send a test notification to currently authenticated user's token
 * Body: { title, body, data }
 * Only send if this account is the latest owner of that token (lastLoginAt).
 */
async function sendTestNotification(req, res) {
    try {
        const accountId = req.user.accountId;
        const { title = "Test", body = "Hello from server", data = {} } = req.body;

        const account = await Account.findByPk(accountId);
        if (!account || !account.fcmToken) {
            return res.status(404).json({ success: false, message: "No token saved for this account" });
        }

        const token = account.fcmToken;

        // tìm account có lastLoginAt mới nhất cho token này
        const latestOwner = await Account.findOne({
            where: { fcmToken: token },
            order: [['lastLoginAt', 'DESC']],
        });

        if (!latestOwner) {
            return res.status(404).json({ success: false, message: "No owner found for token" });
        }

        if (latestOwner.accountId !== accountId) {
            return res.status(403).json({
                success: false,
                message: "This token is owned by another account with more recent login"
            });
        }

        const payload = {
            notification: { title, body },
            data: Object.keys(data).length ? stringifyDataValues(data) : undefined
        };

        const { success, resp, error } = await fcmService.sendToToken(token, payload);

        if (!success) {
            console.error("[FCM Controller] sendTestNotification FCM error:", error?.message || error);
            // nếu token invalid => clear token trên DB để tránh gửi lần sau
            if (error && (error.code === 'messaging/registration-token-not-registered' || error.code === 'messaging/invalid-registration-token')) {
                account.fcmToken = null;
                await account.save();
            }
            return res.status(500).json({ success: false, message: "Failed to send notification", error: error?.message || error });
        }

        return res.json({ success: true, message: "Notification sent", resp });
    } catch (err) {
        console.error("[FCM Controller] sendTestNotification error:", err?.message || err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
}

/**
 * Helper: ensure all data values are strings (FCM requires data values to be strings)
 */
function stringifyDataValues(data) {
    const out = {};
    for (const k of Object.keys(data)) {
        // tránh dùng reserved keys like 'from' — caller should avoid, but we keep as-is
        try {
            out[k] = typeof data[k] === 'string' ? data[k] : JSON.stringify(data[k]);
        } catch (e) {
            out[k] = String(data[k]);
        }
    }
    return out;
}

module.exports = {
    registerFcmToken,
    unregisterFcmToken,
    sendTestNotification
};
