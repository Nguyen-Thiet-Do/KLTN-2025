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

// ----- Try multiple ways to initialize based on observed export shapes -----
try {
    // Case A: module exports named PayOS class: require('@payos/node').PayOS
    if (payosModule && typeof payosModule.PayOS === 'function') {
        try {
            // try constructor with object
            payos = new payosModule.PayOS(initOpts);
        } catch (e1) {
            initErrors.push('PayOS constructor with object failed: ' + (e1.message || e1));
            try {
                // try constructor with positional args (clientId, apiKey, checksum)
                payos = new payosModule.PayOS(initOpts.clientId, initOpts.apiKey, initOpts.checksumKey);
            } catch (e2) {
                initErrors.push('PayOS constructor with positional args failed: ' + (e2.message || e2));
            }
        }
    }

    // Case B: module itself is a function (initializer)
    if (!payos && typeof payosModule === 'function') {
        try {
            payos = payosModule(initOpts);
        } catch (e) {
            initErrors.push('module-as-function init failed: ' + (e.message || e));
        }
    }

    // Case C: default export (ESM compiled to CommonJS)
    if (!payos && payosModule && typeof payosModule.default === 'function') {
        try {
            payos = payosModule.default(initOpts);
        } catch (e) {
            initErrors.push('default(fn) init failed: ' + (e.message || e));
        }
    }

    // Case D: module already a client-like object (has common methods)
    if (!payos && payosModule && (typeof payosModule.createPaymentLink === 'function' || typeof payosModule.getPaymentLinkInformation === 'function')) {
        payos = payosModule;
    }

    // Case E: named factory method createClient/create
    if (!payos && payosModule && typeof payosModule.createClient === 'function') {
        try {
            payos = payosModule.createClient(initOpts);
        } catch (e) {
            initErrors.push('createClient failed: ' + (e.message || e));
        }
    }

    // If still no client, show keys to help debug (but do not crash silently)
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

// ---------------- core wrappers ----------------
async function createPaymentLink(params) {
    const { orderCode, amount } = params;
    if (!orderCode || !amount) throw new Error('orderCode và amount là bắt buộc');

    // ✅ GIỮ NGUYÊN orderCode dạng string/number như client gửi
    const payload = {
        orderCode: orderCode, // Không convert
        amount: Number(amount),
        description: params.description || 'Thanh toán',
        returnUrl: params.returnUrl || `${cfg.appBaseUrl}/pay/return`,
        cancelUrl: params.cancelUrl || `${cfg.appBaseUrl}/pay/cancel`
    };

    console.log('📦 Creating PayOS payment:', payload);

    if (typeof payos.createPaymentLink === 'function') return await payos.createPaymentLink(payload);
    if (typeof payos.create === 'function') return await payos.create(payload);
    if (typeof payos.pay === 'function') return await payos.pay(payload);

    throw new Error('PayOS client missing create method');
}

async function inquiryPayment(orderCode) {
    if (typeof payos.getPaymentLinkInformation === 'function') return await payos.getPaymentLinkInformation(orderCode);
    if (typeof payos.inquiry === 'function') return await payos.inquiry(orderCode);
    throw new Error('PayOS client missing inquiry method');
}

async function cancelPayment(orderCode, reason) {
    if (typeof payos.cancelPaymentLink === 'function') return await payos.cancelPaymentLink(orderCode, reason);
    if (typeof payos.cancel === 'function') return await payos.cancel(orderCode, reason);
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
    calcHmacSha256Hex
};
