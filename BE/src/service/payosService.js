// src/service/payosService.js
const axios = require('axios');
const { createHmac } = require('crypto');
const cfg = require('../config/payosConfig');

function deepSortObj(v) {
    if (Array.isArray(v)) return v.map(x => (x && typeof x === 'object') ? deepSortObj(x) : x);
    if (v && typeof v === 'object') {
        const out = {};
        Object.keys(v).sort().forEach(k => out[k] = deepSortObj(v[k]));
        return out;
    }
    return v;
}

function buildSignatureString(data) {
    const sorted = deepSortObj(data || {});
    const parts = [];
    Object.keys(sorted).sort().forEach(k => {
        let val = sorted[k];
        if (val === null || typeof val === 'undefined') val = '';
        else if (typeof val === 'object') val = JSON.stringify(val);
        parts.push(`${k}=${String(val)}`);
    });
    return parts.join('&');
}

function calcHmacSha256Hex(dataStr, secret) {
    return createHmac('sha256', secret).update(dataStr).digest('hex');
}

function verifyWebhookSignature(data, signature) {
    const sigStr = buildSignatureString(data);
    const expected = calcHmacSha256Hex(sigStr, process.env.PAYOS_CHECKSUM_KEY || cfg.checksumKey);
    return expected === signature;
}

async function createPaymentLink({ orderCode, amount, description, returnUrl, cancelUrl }) {
    const payload = {
        clientId: process.env.PAYOS_CLIENT_ID || cfg.clientId,
        orderCode,
        amount: Number(amount),
        description,
        returnUrl,
        cancelUrl
    };

    const sigStr = buildSignatureString(payload);
    const signature = calcHmacSha256Hex(sigStr, process.env.PAYOS_CHECKSUM_KEY || cfg.checksumKey);

    const url = `${process.env.PAYOS_API_BASE || cfg.apiBase}/payments`;
    const res = await axios.post(url, payload, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.PAYOS_API_KEY || cfg.apiKey}`,
            'X-Signature': signature
        },
        timeout: 15000
    });
    return res.data;
}

async function inquiryPayment(paymentLinkId) {
    const url = `${process.env.PAYOS_API_BASE || cfg.apiBase}/payments/${encodeURIComponent(paymentLinkId)}`;
    const res = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${process.env.PAYOS_API_KEY || cfg.apiKey}` },
        timeout: 10000
    });
    return res.data;
}

module.exports = {
    buildSignatureString,
    calcHmacSha256Hex,
    verifyWebhookSignature,
    createPaymentLink,
    inquiryPayment
};
