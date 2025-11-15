// src/service/payosService.js
const { createHmac } = require('crypto');
const cfg = require('../config/payosConfig');

function getEnv(key, fallback) {
    return process.env[key] || fallback;
}

// ============================================================
// 🔧 KHỞI TẠO PAYOS - TRY MULTIPLE PATTERNS
// ============================================================
let payos = null;

try {
    // Pattern 1: Thử default export
    const PayOSModule = require('@payos/node');

    console.log('📦 PayOS module keys:', Object.keys(PayOSModule));
    console.log('📦 PayOS module type:', typeof PayOSModule);

    // Case 1: Named export { PayOS }
    if (PayOSModule.PayOS && typeof PayOSModule.PayOS === 'function') {
        console.log('✅ Found PayOS as named export');
        payos = new PayOSModule.PayOS(
            getEnv('PAYOS_CLIENT_ID', cfg.clientId),
            getEnv('PAYOS_API_KEY', cfg.apiKey),
            getEnv('PAYOS_CHECKSUM_KEY', cfg.checksumKey)
        );
    }
    // Case 2: Default export is constructor
    else if (typeof PayOSModule === 'function') {
        console.log('✅ PayOS is default export (function)');
        payos = new PayOSModule(
            getEnv('PAYOS_CLIENT_ID', cfg.clientId),
            getEnv('PAYOS_API_KEY', cfg.apiKey),
            getEnv('PAYOS_CHECKSUM_KEY', cfg.checksumKey)
        );
    }
    // Case 3: Default export has default property
    else if (PayOSModule.default && typeof PayOSModule.default === 'function') {
        console.log('✅ Found PayOS as default.default');
        payos = new PayOSModule.default(
            getEnv('PAYOS_CLIENT_ID', cfg.clientId),
            getEnv('PAYOS_API_KEY', cfg.apiKey),
            getEnv('PAYOS_CHECKSUM_KEY', cfg.checksumKey)
        );
    }
    // Case 4: Already initialized client
    else if (PayOSModule.createPaymentLink && typeof PayOSModule.createPaymentLink === 'function') {
        console.log('✅ PayOS already initialized');
        payos = PayOSModule;
    }
    else {
        throw new Error('Cannot find PayOS constructor in module');
    }

    console.log('✅ PayOS initialized successfully');
    console.log('   Has createPaymentLink:', typeof payos.createPaymentLink);

} catch (error) {
    console.error('❌ Failed to initialize PayOS:', error.message);
    throw error;
}

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
    const checksumKey = getEnv('PAYOS_CHECKSUM_KEY', cfg.checksumKey);
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

        const payload = {
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

        console.log('📦 Creating PayOS payment:', JSON.stringify(payload, null, 2));

        // Try multiple method names
        let result;
        if (typeof payos.createPaymentLink === 'function') {
            result = await payos.createPaymentLink(payload);
        } else if (typeof payos.create === 'function') {
            result = await payos.create(payload);
        } else if (typeof payos.createPayment === 'function') {
            result = await payos.createPayment(payload);
        } else {
            throw new Error('PayOS client has no create method');
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
            status: error.response?.status
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