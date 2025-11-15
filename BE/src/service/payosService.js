// src/service/payosService.js
const { PayOS } = require('@payos/node'); // ✅ Named import
const { createHmac } = require('crypto');
const cfg = require('../config/payosConfig');

function getEnv(key, fallback) {
    return process.env[key] || fallback;
}

// ============================================================
// 🔧 KHỞI TẠO PAYOS
// ============================================================
const clientId = getEnv('PAYOS_CLIENT_ID', cfg.clientId);
const apiKey = getEnv('PAYOS_API_KEY', cfg.apiKey);
const checksumKey = getEnv('PAYOS_CHECKSUM_KEY', cfg.checksumKey);

console.log('🔑 PayOS credentials loaded');

const payos = new PayOS(clientId, apiKey, checksumKey);

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
// 🔐 TẠO SIGNATURE CHO PAYMENT REQUEST
// ============================================================
function generatePaymentSignature(data) {
    const sigStr = buildSignatureString(data);
    return calcHmacSha256Hex(sigStr, checksumKey);
}

// ============================================================
// CORE API WRAPPERS - SỬ DỤNG HTTP CLIENT
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

        // ✅ Payload theo PayOS API docs
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

        // ✅ Tạo signature
        const signature = generatePaymentSignature(paymentData);
        paymentData.signature = signature;

        console.log('📦 Creating PayOS payment:', JSON.stringify(paymentData, null, 2));

        // ✅ Gọi API PayOS - PayOS client có method post()
        let result;
        
        try {
            // Endpoint: POST /v2/payment-requests
            result = await payos.post('/v2/payment-requests', paymentData);
            console.log('✅ PayOS raw response:', JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('❌ POST /v2/payment-requests failed:', err.message);
            console.error('Error details:', err.response?.data || err.data);
            throw err;
        }
        
        // Response structure từ PayOS: { code, desc, data: { ... } }
        if (result.code && result.code !== '00' && String(result.code) !== '00') {
            throw new Error(`PayOS error [${result.code}]: ${result.desc || result.message || 'Unknown error'}`);
        }

        const responseData = result.data || result;
        
        // ✅ Normalize response
        return {
            ...responseData,
            orderCode: orderCode,
            checkoutUrl: responseData.checkoutUrl || responseData.checkout_url,
            qrCode: responseData.qrCode || responseData.qr,
            paymentLinkId: responseData.paymentLinkId || responseData.id
        };

    } catch (error) {
        console.error('❌ PayOS API Error:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            data: error.data
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
        
        // GET /v2/payment-requests/{orderCode}
        const result = await payos.get(`/v2/payment-requests/${code}`);
        
        if (result.code && result.code !== '00' && String(result.code) !== '00') {
            throw new Error(`PayOS error: ${result.desc || 'Query failed'}`);
        }
        
        return result.data || result;
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
        
        // POST /v2/payment-requests/{orderCode}/cancel
        const result = await payos.post(`/v2/payment-requests/${code}/cancel`, {
            cancellationReason: reason || 'User cancelled'
        });
        
        if (result.code && result.code !== '00' && String(result.code) !== '00') {
            throw new Error(`PayOS error: ${result.desc || 'Cancel failed'}`);
        }
        
        return result.data || result;
    } catch (error) {
        console.error('❌ Cancel error:', error.message);
        throw error;
    }
}

function verifyPaymentWebhookData(webhookData) {
    try {
        // Nếu PayOS SDK có method verify, dùng nó
        if (payos && typeof payos.verifyPaymentWebhookData === 'function') {
            return payos.verifyPaymentWebhookData(webhookData);
        }
        
        // Fallback: tự verify
        const signature = webhookData.signature || webhookData.sign;
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
    safeOrderCodeToNumber,
    generatePaymentSignature
};