// src/service/payosService.js
const payosModule = require('@payos/node');
const { createHmac } = require('crypto');
const cfg = require('../config/payosConfig');

function getEnv(key, fallback) {
    return process.env[key] || fallback;
}

const initOpts = {
    clientId: getEnv('PAYOS_CLIENT_ID', cfg.clientId),
    apiKey: getEnv('PAYOS_API_KEY', cfg.apiKey),
    checksumKey: getEnv('PAYOS_CHECKSUM_KEY', cfg.checksumKey)
};

let payos = null;
let initErrors = [];

// ----- Initialize PayOS -----
try {
    if (payosModule && typeof payosModule.PayOS === 'function') {
        try {
            payos = new payosModule.PayOS(initOpts);
        } catch (e1) {
            initErrors.push('PayOS constructor with object failed: ' + (e1.message || e1));
            try {
                payos = new payosModule.PayOS(initOpts.clientId, initOpts.apiKey, initOpts.checksumKey);
            } catch (e2) {
                initErrors.push('PayOS constructor with positional args failed: ' + (e2.message || e2));
            }
        }
    }

    if (!payos && typeof payosModule === 'function') {
        try {
            payos = payosModule(initOpts);
        } catch (e) {
            initErrors.push('module-as-function init failed: ' + (e.message || e));
        }
    }

    if (!payos && payosModule && typeof payosModule.default === 'function') {
        try {
            payos = payosModule.default(initOpts);
        } catch (e) {
            initErrors.push('default(fn) init failed: ' + (e.message || e));
        }
    }

    if (!payos && payosModule && (typeof payosModule.createPaymentLink === 'function' || typeof payosModule.getPaymentLinkInformation === 'function')) {
        payos = payosModule;
    }

    if (!payos && payosModule && typeof payosModule.createClient === 'function') {
        try {
            payos = payosModule.createClient(initOpts);
        } catch (e) {
            initErrors.push('createClient failed: ' + (e.message || e));
        }
    }

    if (!payos) {
        console.error('@payos/node: unexpected export shape, keys =', Object.keys(payosModule || {}));
        console.error('Init attempts failed:', initErrors);
        throw new Error('Cannot initialize @payos/node client — unsupported export shape. Check logs above.');
    }

} catch (err) {
    console.error('Error initializing @payos/node:', err?.message || err);
    throw err;
}

// ---------------- helper functions ----------------
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
    const expected = calcHmacSha256Hex(sigStr, initOpts.checksumKey);
    return expected === signature;
}

// ✅ Tạo orderCode số nguyên duy nhất
function generateOrderCode() {
    // Timestamp (ms) + random 3 chữ số
    return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

// ---------------- core wrappers ----------------
async function createPaymentLink(params) {
    const { amount, description, readerId, cardTypeId } = params;

    if (!amount) throw new Error('amount là bắt buộc');

    // ✅ Tạo orderCode là số nguyên
    const orderCode = params.orderCode || generateOrderCode();

    // ✅ PayOS yêu cầu đầy đủ các trường
    const payload = {
        orderCode: Number(orderCode), // ⚠️ Phải là NUMBER
        amount: Number(amount),
        description: description || 'Thanh toán thẻ thành viên',

        // ✅ Không có query params trong returnUrl/cancelUrl ban đầu
        returnUrl: params.returnUrl || `${cfg.appBaseUrl}/pay/return`,
        cancelUrl: params.cancelUrl || `${cfg.appBaseUrl}/pay/cancel`,

        // ✅ Thêm items array (bắt buộc với một số merchant)
        items: params.items || [
            {
                name: description || 'Thẻ thành viên',
                quantity: 1,
                price: Number(amount)
            }
        ],

        // Optional: buyer info nếu có
        ...(params.buyerName && { buyerName: params.buyerName }),
        ...(params.buyerPhone && { buyerPhone: params.buyerPhone }),
        ...(params.buyerEmail && { buyerEmail: params.buyerEmail })
    };

    console.log('📦 Creating PayOS payment:', JSON.stringify(payload, null, 2));

    try {
        let result;
        if (typeof payos.createPaymentLink === 'function') {
            result = await payos.createPaymentLink(payload);
        } else if (typeof payos.create === 'function') {
            result = await payos.create(payload);
        } else if (typeof payos.pay === 'function') {
            result = await payos.pay(payload);
        } else {
            throw new Error('PayOS client missing create method');
        }

        console.log('✅ PayOS response:', JSON.stringify(result, null, 2));
        return result;

    } catch (error) {
        console.error('❌ PayOS API Error:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            payload
        });
        throw error;
    }
}

async function inquiryPayment(orderCode) {
    if (typeof payos.getPaymentLinkInformation === 'function') {
        return await payos.getPaymentLinkInformation(Number(orderCode));
    }
    if (typeof payos.inquiry === 'function') {
        return await payos.inquiry(Number(orderCode));
    }
    throw new Error('PayOS client missing inquiry method');
}

async function cancelPayment(orderCode, reason) {
    if (typeof payos.cancelPaymentLink === 'function') {
        return await payos.cancelPaymentLink(Number(orderCode), reason);
    }
    if (typeof payos.cancel === 'function') {
        return await payos.cancel(Number(orderCode), reason);
    }
    throw new Error('PayOS client missing cancel method');
}

function verifyPaymentWebhookData(webhookData) {
    try {
        if (payos && typeof payos.verifyPaymentWebhookData === 'function') {
            return payos.verifyPaymentWebhookData(webhookData);
        }
        const signature = webhookData.signature || webhookData.sign || webhookData.data?.signature;
        const data = webhookData.data || webhookData;
        if (!signature) return false;
        return verifyWebhookSignature(data, signature);
    } catch (err) {
        console.error('verifyPaymentWebhookData error:', err?.message || err);
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
    calcHmacSha256Hex,
    generateOrderCode // Export để có thể dùng bên ngoài
};