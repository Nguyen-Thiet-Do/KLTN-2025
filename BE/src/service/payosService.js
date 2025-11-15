// src/service/payosService.js
const PayOS = require('@payos/node').default; // ✅ Thử import default
const { createHmac } = require('crypto');
const cfg = require('../config/payosConfig');

function getEnv(key, fallback) {
    return process.env[key] || fallback;
}

// ============================================================
// 🔧 KHỞI TẠO PAYOS THEO DOCS CHÍNH THỨC
// ============================================================
const clientId = getEnv('PAYOS_CLIENT_ID', cfg.clientId);
const apiKey = getEnv('PAYOS_API_KEY', cfg.apiKey);
const checksumKey = getEnv('PAYOS_CHECKSUM_KEY', cfg.checksumKey);

console.log('🔑 PayOS credentials:', {
    clientId: clientId?.substring(0, 10) + '...',
    apiKey: apiKey?.substring(0, 10) + '...',
    checksumKey: checksumKey?.substring(0, 10) + '...'
});

let payos;

try {
    // Method 1: Using default export
    payos = new PayOS(clientId, apiKey, checksumKey);
    console.log('✅ PayOS initialized via default export');
} catch (e1) {
    console.error('❌ Default export failed:', e1.message);

    try {
        // Method 2: Using named export
        const PayOSClass = require('@payos/node').PayOS;
        payos = new PayOSClass(clientId, apiKey, checksumKey);
        console.log('✅ PayOS initialized via named export');
    } catch (e2) {
        console.error('❌ Named export failed:', e2.message);

        try {
            // Method 3: Direct require
            const PayOSModule = require('@payos/node');
            payos = PayOSModule(clientId, apiKey, checksumKey);
            console.log('✅ PayOS initialized via direct call');
        } catch (e3) {
            console.error('❌ All initialization methods failed');
            throw new Error('Cannot initialize PayOS - check package installation');
        }
    }
}

// Verify methods exist
console.log('📋 Available PayOS methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(payos)));

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
// CORE API WRAPPERS
// ============================================================
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

        // ✅ Gọi API PayOS - thử tất cả method names có thể
        let result;

        if (typeof payos.createPaymentLink === 'function') {
            console.log('🔄 Using createPaymentLink()');
            result = await payos.createPaymentLink(paymentData);
        }
        else if (typeof payos.createPayment === 'function') {
            console.log('🔄 Using createPayment()');
            result = await payos.createPayment(paymentData);
        }
        else if (typeof payos.create === 'function') {
            console.log('🔄 Using create()');
            result = await payos.create(paymentData);
        }
        else if (typeof payos.payment?.create === 'function') {
            console.log('🔄 Using payment.create()');
            result = await payos.payment.create(paymentData);
        }
        else {
            // List all available methods for debugging
            const availableMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(payos))
                .filter(name => typeof payos[name] === 'function');

            console.error('❌ No create method found. Available methods:', availableMethods);
            throw new Error(`PayOS client missing create method. Available: ${availableMethods.join(', ')}`);
        }

        console.log('✅ PayOS response:', JSON.stringify(result, null, 2));

        return {
            ...result,
            orderCode: orderCode
        };

    } catch (error) {
        console.error('❌ PayOS API Error:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            stack: error.stack
        });
        throw error;
    }
}

async function inquiryPayment(orderCode) {
    try {
        const code = safeOrderCodeToNumber(orderCode);
        if (isNaN(code) || code <= 0) {
            throw new Error('orderCode không hợp lệ');
        }

        if (typeof payos.getPaymentLinkInformation === 'function') {
            return await payos.getPaymentLinkInformation(code);
        } else if (typeof payos.getPaymentInfo === 'function') {
            return await payos.getPaymentInfo(code);
        } else if (typeof payos.inquiry === 'function') {
            return await payos.inquiry(code);
        }

        throw new Error('PayOS client has no inquiry method');
    } catch (error) {
        console.error('❌ Inquiry error:', error.message);
        throw error;
    }
}

async function cancelPayment(orderCode, reason) {
    try {
        const code = safeOrderCodeToNumber(orderCode);
        if (isNaN(code) || code <= 0) {
            throw new Error('orderCode không hợp lệ');
        }

        if (typeof payos.cancelPaymentLink === 'function') {
            return await payos.cancelPaymentLink(code, reason);
        } else if (typeof payos.cancel === 'function') {
            return await payos.cancel(code, reason);
        }

        throw new Error('PayOS client has no cancel method');
    } catch (error) {
        console.error('❌ Cancel error:', error.message);
        throw error;
    }
}

function verifyPaymentWebhookData(webhookData) {
    try {
        if (payos && typeof payos.verifyPaymentWebhookData === 'function') {
            return payos.verifyPaymentWebhookData(webhookData);
        }

        const signature = webhookData.signature || webhookData.sign || webhookData.data?.signature;
        const data = webhookData.data || webhookData;

        if (!signature) {
            console.warn('⚠️ No signature in webhook data');
            return false;
        }

        return verifyWebhookSignature(data, signature);
    } catch (err) {
        console.error('❌ verifyPaymentWebhookData error:', err?.message || err);
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
    generateOrderCode,
    safeOrderCodeToNumber
};