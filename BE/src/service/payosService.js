// src/service/payosService.js
const PayOS = require('@payos/node');
const { createHmac } = require('crypto');
const cfg = require('../config/payosConfig');

// KHỞI TẠO PAYOS CLIENT — KHÔNG ĐƯỢC DÙNG `new`
const payos = PayOS({
    clientId: process.env.PAYOS_CLIENT_ID || cfg.clientId,
    apiKey: process.env.PAYOS_API_KEY || cfg.apiKey,
    checksumKey: process.env.PAYOS_CHECKSUM_KEY || cfg.checksumKey
});

// ============================================
// HELPER FUNCTIONS — SORT & SIGNATURE
// ============================================

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
        if (val === null || val === undefined) val = '';
        else if (typeof val === 'object') val = JSON.stringify(val);
        parts.push(`${k}=${String(val)}`);
    });
    return parts.join('&');
}

function calcHmacSha256Hex(str, secret) {
    return createHmac('sha256', secret).update(str).digest('hex');
}

function verifyWebhookSignature(data, signature) {
    try {
        const raw = buildSignatureString(data);
        const expected = calcHmacSha256Hex(raw, process.env.PAYOS_CHECKSUM_KEY || cfg.checksumKey);
        return expected === signature;
    } catch (e) {
        console.error('verifyWebhookSignature error:', e);
        return false;
    }
}

// ============================================
// TẠO PAYMENT LINK (SDK)
// ============================================

async function createPaymentLink({ orderCode, amount, description, returnUrl, cancelUrl }) {
    try {
        if (!orderCode || !amount) throw new Error('orderCode và amount là bắt buộc');

        let numericOrderCode = orderCode;
        if (typeof orderCode === 'string') {
            numericOrderCode = parseInt(orderCode.replace(/\D/g, ''));
        }
        numericOrderCode = Number(numericOrderCode);

        if (isNaN(numericOrderCode) || numericOrderCode <= 0)
            throw new Error('orderCode phải là số nguyên dương');

        const payload = {
            orderCode: numericOrderCode,
            amount: Number(amount),
            description: description || 'Thanh toán',
            returnUrl: returnUrl || `${cfg.appBaseUrl}/pay/return`,
            cancelUrl: cancelUrl || `${cfg.appBaseUrl}/pay/cancel`
        };

        console.log('📦 Creating PayOS payment:', JSON.stringify(payload, null, 2));

        const resp = await payos.createPaymentLink(payload);

        console.log('✅ PayOS Response:', JSON.stringify(resp, null, 2));
        return resp;
    } catch (err) {
        console.error('❌ PayOS createPaymentLink Error:', err.response?.data || err.message);
        throw new Error(err.response?.data?.message || err.message || 'PayOS error');
    }
}

// ============================================
// INQUIRY
// ============================================

async function inquiryPayment(orderCode) {
    try {
        const resp = await payos.getPaymentLinkInformation(orderCode);
        return resp;
    } catch (err) {
        console.error('❌ inquiryPayment error:', err.message);
        throw err;
    }
}

// ============================================
// CANCEL
// ============================================

async function cancelPayment(orderCode, reason) {
    try {
        const resp = await payos.cancelPaymentLink(orderCode, reason);
        return resp;
    } catch (err) {
        console.error('❌ cancelPayment error:', err.message);
        throw err;
    }
}

// ============================================
// VERIFY WEBHOOK (SDK + fallback HMAC)
// ============================================

function verifyPaymentWebhookData(data) {
    try {
        if (typeof payos.verifyPaymentWebhookData === 'function') {
            // SDK hỗ trợ verify
            const ok = payos.verifyPaymentWebhookData(data);
            console.log('🔒 Webhook (SDK):', ok);
            return ok;
        }

        // fallback: tự verify HMAC
        const sig = data.signature || data.sign || data.data?.signature;
        const rawData = data.data || data;
        if (!sig) return false;

        const ok = verifyWebhookSignature(rawData, sig);
        console.log('🔒 Webhook (manual):', ok);
        return ok;
    } catch (err) {
        console.error('❌ Webhook verify error:', err.message);
        return false;
    }
}

module.exports = {
    createPaymentLink,
    inquiryPayment,
    cancelPayment,
    verifyWebhookSignature,
    verifyPaymentWebhookData,
    buildSignatureString,
    calcHmacSha256Hex
};
