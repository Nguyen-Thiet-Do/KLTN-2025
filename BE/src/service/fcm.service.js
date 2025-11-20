const { messaging } = require("../config/firebase");
const { Account } = require("../model");
const { Op } = require("sequelize");

/**
 * Safe wrapper: send to single token
 */
async function sendToToken(token, payload) {
    if (!messaging) {
        console.warn("[FCM] messaging not initialized - skipping sendToToken");
        return { success: false, error: new Error("FCM not initialized") };
    }

    try {
        const message = { token, ...payload };
        const resp = await messaging.send(message);
        return { success: true, resp };
    } catch (err) {
        console.error("[FCM] sendToToken error:", err?.message || err);
        return { success: false, error: err };
    }
}

/**
 * Safe wrapper: multicast (<= 500 tokens)
 */
async function sendMulticast(tokens, payload) {
    if (!messaging) {
        console.warn("[FCM] messaging not initialized - skipping sendMulticast");
        return { success: false, error: new Error("FCM not initialized") };
    }

    try {
        const message = { tokens, ...payload };
        const resp = await messaging.sendMulticast(message);
        // cleanup invalid tokens if any
        const toRemove = [];
        resp.responses.forEach((r, idx) => {
            if (!r.success) {
                const err = r.error;
                if (err && (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token')) {
                    toRemove.push(tokens[idx]);
                }
            }
        });

        if (toRemove.length) {
            try {
                console.log(`[FCM] Clearing ${toRemove.length} invalid token(s) from DB`);
                await Account.update(
                    { fcmToken: null },
                    { where: { fcmToken: { [Op.in]: toRemove } } }
                );
            } catch (e) {
                console.error("[FCM] Error clearing invalid tokens in DB:", e?.message || e);
            }
        }

        return { success: true, resp };
    } catch (err) {
        console.error("[FCM] sendMulticast error:", err?.message || err);
        return { success: false, error: err };
    }
}

/**
 * Send to topic
 */
async function sendToTopic(topic, payload) {
    if (!messaging) {
        console.warn("[FCM] messaging not initialized - skipping sendToTopic");
        return { success: false, error: new Error("FCM not initialized") };
    }

    try {
        const message = { topic, ...payload };
        const resp = await messaging.send(message);
        return { success: true, resp };
    } catch (err) {
        console.error("[FCM] sendToTopic error:", err?.message || err);
        return { success: false, error: err };
    }
}

/**
 * Send to list of accountIds.
 * Rule: if multiple accounts share same fcmToken, only send once to token
 * and only if the target is the latest owner of that token based on lastLoginAt.
 * @param {number[]} accountIds
 * @param {object} payload
 */
async function sendToAccounts(accountIds = [], payload) {
    if (!messaging) {
        console.warn("[FCM] messaging not initialized - skipping sendToAccounts");
        return { success: false, error: new Error("FCM not initialized") };
    }

    try {
        // fetch accounts with token in target set
        const accounts = await Account.findAll({
            where: {
                accountId: accountIds,
                fcmToken: { [Op.ne]: null }
            },
            attributes: ['accountId', 'fcmToken', 'lastLoginAt']
        });

        // group by token -> pick latest owner
        const tokenMap = new Map(); // token -> { accountId, lastLoginAt }
        for (const a of accounts) {
            const token = a.fcmToken;
            if (!token) continue;
            const prev = tokenMap.get(token);
            if (!prev || (a.lastLoginAt && (!prev.lastLoginAt || a.lastLoginAt > prev.lastLoginAt))) {
                tokenMap.set(token, { accountId: a.accountId, lastLoginAt: a.lastLoginAt });
            }
        }

        // only keep tokens whose latest owner is in accountIds (should be)
        const tokens = [];
        for (const [token, info] of tokenMap.entries()) {
            if (accountIds.includes(info.accountId)) tokens.push(token);
        }

        if (!tokens.length) return { success: false, message: "No tokens to send" };

        console.log(`[FCM] Sending notifications to ${tokens.length} unique token(s)`);

        // send in chunks of 500
        const chunk = (arr, size) => {
            const out = [];
            for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
            return out;
        };

        const results = [];
        for (const tkChunk of chunk(tokens, 500)) {
            const resp = await sendMulticast(tkChunk, payload);
            results.push(resp);
        }

        return { success: true, results };
    } catch (err) {
        console.error("[FCM] sendToAccounts error:", err?.message || err);
        return { success: false, error: err };
    }
}

module.exports = {
    sendToToken,
    sendMulticast,
    sendToTopic,
    sendToAccounts
};
