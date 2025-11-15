// src/service/payosService.js
const { PayOS } = require('@payos/node');
const { createHmac } = require('crypto');
const cfg = require('../config/payosConfig');

function getEnv(key, fallback) {
    return process.env[key] || fallback;
}

// ============================================================
// 🔧 KHỞI TẠO PAYOS (THEO DOCS CHÍNH THỨC)
// ============================================================
const payos = new PayOS({
    clientId: getEnv('PAYOS_CLIENT_ID', cfg.clientId),
    apiKey: getEnv('PAYOS_API_KEY', cfg.apiKey),
    checksumKey: getEnv('PAYOS_CHECKSUM_KEY', cfg.checksumKey),
    // Optional: timeout, maxRetries, logLevel...
    timeout: 30000,
    maxRetries: 2,
    logLevel: 'info'
});

console.log('✅ PayOS initialized successfully');

// ============================================================
// HELPER FUNCTIONS
// ============================================================
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
    const checksumKey = getEnv('PAYOS_CHECKSUM_KEY', cfg.checksumKey);
    const sigStr = buildSignatureString(data);
    const expected = calcHmacSha256Hex(sigStr, checksumKey);
    return expected === signature;
}

function generateOrderCode() {
    return Date.now();
}

function safeOrderCodeToNumber(orderCode) {
    if (typeof orderCode === 'number') {
        return Math.floor(orderCode);
    }

    const match = String(orderCode).match(/(\d{13,})/);
    if (match) {
        return Number(match[1]);
    }

    console.warn('⚠️ Cannot parse orderCode, generating new one:', orderCode);
    return Date.now();
}

// ============================================================
// CORE API WRAPPERS (THEO DOCS PAYOS)
// ============================================================

/**
 * Tạo payment link
 * Docs: payos.paymentRequests.create()
 */
async function createPaymentLink(params) {
    try {
        const { amount, description } = params;

        if (!amount) {
            throw new Error('amount là bắt buộc');
        }

        let orderCode = params.orderCode;

        if (!orderCode) {
            orderCode = generateOrderCode();
        } else if (typeof orderCode === 'string') {
            orderCode = safeOrderCodeToNumber(orderCode);
        } else {
            orderCode = Math.floor(Number(orderCode));
        }

        if (isNaN(orderCode) || orderCode <= 0) {
            console.error('❌ Invalid orderCode:', params.orderCode);
            throw new Error('orderCode không hợp lệ');
        }

        // ✅ Payload theo docs PayOS chính thức
        const paymentData = {
            orderCode: orderCode,
            amount: Number(amount),
            description: description || 'Thanh toán thẻ thành viên',
            returnUrl: params.returnUrl || `${cfg.appBaseUrl}/pay/return`,
            cancelUrl: params.cancelUrl || `${cfg.appBaseUrl}/pay/cancel`,
            items: params.items || [
                {
                    name: description || 'Thẻ thành viên',
                    quantity: 1,
                    price: Number(amount)
                }
            ]
        };

        console.log('📦 Creating PayOS payment:', JSON.stringify(paymentData, null, 2));

        // ✅ Gọi API theo docs: payos.paymentRequests.create()
        const result = await payos.paymentRequests.create(paymentData);

        console.log('✅ PayOS response:', JSON.stringify(result, null, 2));

        // Response structure: { bin, accountNumber, accountName, amount, description, orderCode, currency, paymentLinkId, status, checkoutUrl, qrCode }
        return {
            ...result,
            orderCode: orderCode,
            // Normalize field names
            checkoutUrl: result.checkoutUrl,
            qrCode: result.qrCode,
            paymentLinkId: result.paymentLinkId
        };

    } catch (error) {
        console.error('❌ PayOS API Error:', {
            message: error.message,
            name: error.name,
            status: error.status,
            code: error.code,
            desc: error.desc,
            headers: error.headers
        });
        throw error;
    }
}

/**
 * Query payment info
 * Docs: payos.paymentRequests.get(orderCode)
 */
async function inquiryPayment(orderCode) {
    try {
        const code = safeOrderCodeToNumber(orderCode);
        if (isNaN(code) || code <= 0) {
            throw new Error('orderCode không hợp lệ');
        }

        const result = await payos.paymentRequests.get(code);
        return result;
    } catch (error) {
        console.error('❌ Inquiry error:', error.message);
        throw error;
    }
}

/**
 * Cancel payment
 * Docs: payos.paymentRequests.cancel(orderCode, reason)
 */
async function cancelPayment(orderCode, reason) {
    try {
        const code = safeOrderCodeToNumber(orderCode);
        if (isNaN(code) || code <= 0) {
            throw new Error('orderCode không hợp lệ');
        }

        const result = await payos.paymentRequests.cancel(code, reason || 'User cancelled');
        return result;
    } catch (error) {
        console.error('❌ Cancel error:', error.message);
        throw error;
    }
}

/**
 * Verify webhook data
 * Docs: payos.webhooks.verify(webhookData)
 */
function verifyPaymentWebhookData(webhookData) {
    try {
        // ✅ Dùng method verify của PayOS SDK
        const result = payos.webhooks.verify(webhookData);
        return result;
    } catch (err) {
        console.error('❌ verifyPaymentWebhookData error:', err?.message || err);

        // Fallback: tự verify nếu SDK method fail
        try {
            const signature = webhookData.signature || webhookData.sign;
            const data = webhookData.data || webhookData;

            if (!signature) {
                console.warn('⚠️ No signature in webhook data');
                return false;
            }

            return verifyWebhookSignature(data, signature);
        } catch (e) {
            console.error('❌ Fallback verify also failed:', e.message);
            return false;
        }
    }
}

/**
 * Confirm webhook URL
 * Docs: payos.webhooks.confirm(webhookUrl)
 */
async function confirmWebhook(webhookUrl) {
    try {
        const result = await payos.webhooks.confirm(webhookUrl);
        console.log('✅ Webhook confirmed:', result);
        return result;
    } catch (error) {
        console.error('❌ Confirm webhook error:', error.message);
        throw error;
    }
}

module.exports = {
    createPaymentLink,
    inquiryPayment,
    cancelPayment,
    verifyWebhookSignature,
    verifyPaymentWebhookData,
    confirmWebhook,
    buildSignatureString,
    calcHmacSha256Hex,
    generateOrderCode,
    safeOrderCodeToNumber
};