// src/service/payosService.js
const PayOS = require('@payos/node');
const { createHmac } = require('crypto');
const cfg = require('../config/payosConfig');

// Khởi tạo PayOS client
const payos = new PayOS(
    process.env.PAYOS_CLIENT_ID || cfg.clientId,
    process.env.PAYOS_API_KEY || cfg.apiKey,
    process.env.PAYOS_CHECKSUM_KEY || cfg.checksumKey
);

// ============================================
// HELPER FUNCTIONS FOR WEBHOOK VERIFICATION
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

// ============================================
// CREATE PAYMENT LINK (Using Official SDK)
// ============================================

/**
 * Tạo payment link với PayOS SDK
 * @param {Object} params
 * @param {string|number} params.orderCode - Mã đơn hàng 
 * @param {number} params.amount - Số tiền (VNĐ)
 * @param {string} params.description - Mô tả giao dịch
 * @param {string} params.returnUrl - URL redirect khi thành công
 * @param {string} params.cancelUrl - URL redirect khi hủy
 */
async function createPaymentLink({ orderCode, amount, description, returnUrl, cancelUrl }) {
    try {
        // Validate
        if (!orderCode || !amount) {
            throw new Error('orderCode và amount là bắt buộc');
        }

        // Convert orderCode to number (PayOS yêu cầu số nguyên)
        let numericOrderCode = orderCode;
        if (typeof orderCode === 'string') {
            numericOrderCode = parseInt(orderCode.replace(/[^\d]/g, ''));
        }
        numericOrderCode = Number(numericOrderCode);

        if (isNaN(numericOrderCode) || numericOrderCode <= 0) {
            throw new Error('orderCode phải là số nguyên dương');
        }

        // PayOS SDK payload
        const paymentData = {
            orderCode: numericOrderCode,
            amount: Number(amount),
            description: description || 'Thanh toán',
            returnUrl: returnUrl || `${cfg.appBaseUrl}/pay/return`,
            cancelUrl: cancelUrl || `${cfg.appBaseUrl}/pay/cancel`
        };

        console.log('📦 Creating PayOS payment:', JSON.stringify(paymentData, null, 2));

        // Gọi SDK - nó sẽ tự động xử lý signature và headers
        const response = await payos.createPaymentLink(paymentData);

        console.log('✅ PayOS Response:', JSON.stringify(response, null, 2));

        return response;

    } catch (error) {
        console.error('❌ PayOS createPaymentLink Error:');
        console.error('Message:', error.message);

        if (error.response) {
            console.error('Status:', error.response?.status);
            console.error('Data:', error.response?.data);
        }

        // Ném lỗi với message rõ ràng
        const errorMsg = error.response?.data?.desc
            || error.response?.data?.message
            || error.message
            || 'PayOS API Error';

        throw new Error(`PayOS Error: ${errorMsg}`);
    }
}

// ============================================
// INQUIRY PAYMENT (Using Official SDK)
// ============================================

async function inquiryPayment(orderCode) {
    try {
        console.log('🔍 Querying payment:', orderCode);

        const response = await payos.getPaymentLinkInformation(orderCode);

        console.log('✅ Payment info:', JSON.stringify(response, null, 2));

        return response;
    } catch (error) {
        console.error('❌ inquiryPayment error:', error.message);
        throw error;
    }
}

// ============================================
// CANCEL PAYMENT (Using Official SDK)
// ============================================

async function cancelPayment(orderCode, reason) {
    try {
        console.log('❌ Cancelling payment:', orderCode);

        const response = await payos.cancelPaymentLink(orderCode, reason);

        console.log('✅ Cancel response:', response);

        return response;
    } catch (error) {
        console.error('❌ cancelPayment error:', error.message);
        throw error;
    }
}

// ============================================
// VERIFY WEBHOOK (Using Official SDK)
// ============================================

function verifyPaymentWebhookData(webhookData) {
    try {
        const result = payos.verifyPaymentWebhookData(webhookData);
        console.log('✅ Webhook verification:', result ? 'VALID' : 'INVALID');
        return result;
    } catch (error) {
        console.error('❌ Webhook verification error:', error.message);
        return false;
    }
}

module.exports = {
    // Core functions
    createPaymentLink,
    inquiryPayment,
    cancelPayment,

    // Webhook verification
    verifyWebhookSignature,
    verifyPaymentWebhookData,

    // Helper functions (for backward compatibility)
    buildSignatureString,
    calcHmacSha256Hex
};