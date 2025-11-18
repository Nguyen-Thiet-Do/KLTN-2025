// src/service/fcm.service.js
const { messaging } = require("../config/firebase");

/**
 * Send one notification to a token
 * @param {string} token
 * @param {object} payload - { notification: { title, body }, data: {...} }
 */
async function sendToToken(token, payload) {
    try {
        const message = {
            token,
            ...payload
        };
        const resp = await messaging.send(message);
        return { success: true, resp };
    } catch (err) {
        // bạn có thể check err.code để xử lý token invalid, etc.
        return { success: false, error: err };
    }
}

/**
 * Send to multiple tokens (max 500 tokens per call)
 * @param {string[]} tokens
 * @param {object} payload
 */
async function sendMulticast(tokens, payload) {
    try {
        const message = {
            tokens,
            ...payload
        };
        const resp = await messaging.sendMulticast(message);
        return { success: true, resp };
    } catch (err) {
        return { success: false, error: err };
    }
}

/**
 * Send to topic
 * @param {string} topic
 * @param {object} payload
 */
async function sendToTopic(topic, payload) {
    try {
        const message = {
            topic,
            ...payload
        };
        const resp = await messaging.send(message);
        return { success: true, resp };
    } catch (err) {
        return { success: false, error: err };
    }
}

module.exports = {
    sendToToken,
    sendMulticast,
    sendToTopic,
};
