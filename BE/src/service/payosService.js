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

/**
 * Tạo payment link với PayOS
 * @param {Object} params
 * @param {string|number} params.orderCode - Mã đơn hàng (số nguyên dương, tối đa 9 chữ số)
 * @param {number} params.amount - Số tiền (VNĐ)
 * @param {string} params.description - Mô tả giao dịch
 * @param {string} params.returnUrl - URL redirect khi thành công
 * @param {string} params.cancelUrl - URL redirect khi hủy
 */
async function createPaymentLink({ orderCode, amount, description, returnUrl, cancelUrl }) {
    try {
        // Validate inputs
        if (!orderCode || !amount) {
            throw new Error('orderCode và amount là bắt buộc');
        }

        // PayOS yêu cầu orderCode là số nguyên dương, tối đa 9 chữ số
        let numericOrderCode = orderCode;
        if (typeof orderCode === 'string') {
            // Nếu orderCode là string có format "REG1234567890-123", chỉ lấy phần số
            numericOrderCode = parseInt(orderCode.replace(/[^\d]/g, '').slice(-9));
        }
        numericOrderCode = Number(numericOrderCode);

        if (isNaN(numericOrderCode) || numericOrderCode <= 0) {
            throw new Error('orderCode phải là số nguyên dương');
        }

        // ❌ BỎ clientId ra khỏi payload - PayOS không cần field này trong body
        const payload = {
            orderCode: numericOrderCode,
            amount: Number(amount),
            description: description || 'Thanh toán',
            returnUrl: returnUrl || `${cfg.appBaseUrl}/pay/return`,
            cancelUrl: cancelUrl || `${cfg.appBaseUrl}/pay/cancel`
        };

        console.log('📦 PayOS Request Payload:', JSON.stringify(payload, null, 2));

        // Tạo signature từ payload (KHÔNG bao gồm clientId)
        const sigStr = buildSignatureString(payload);
        console.log('🔐 Signature String:', sigStr);

        const signature = calcHmacSha256Hex(sigStr, process.env.PAYOS_CHECKSUM_KEY || cfg.checksumKey);
        console.log('✍️ Signature:', signature);

        const url = `${process.env.PAYOS_API_BASE || cfg.apiBase}/v2/payment-requests`;
        console.log('🌐 PayOS URL:', url);

        // Headers theo docs PayOS
        const headers = {
            'Content-Type': 'application/json',
            'x-client-id': process.env.PAYOS_CLIENT_ID || cfg.clientId,
            'x-api-key': process.env.PAYOS_API_KEY || cfg.apiKey
        };

        console.log('📤 Sending request to PayOS...');

        const res = await axios.post(url, payload, {
            headers,
            timeout: 15000
        });

        console.log('✅ PayOS Response:', JSON.stringify(res.data, null, 2));

        return res.data;

    } catch (error) {
        console.error('❌ PayOS createPaymentLink Error:');
        console.error('Message:', error.message);

        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
            console.error('Headers:', error.response.headers);
        } else if (error.request) {
            console.error('No response received:', error.request);
        }

        // Ném lỗi với thông tin chi tiết
        const errorMsg = error.response?.data?.message
            || error.response?.data?.error
            || error.message
            || 'PayOS API Error';

        throw new Error(`PayOS Error: ${errorMsg}`);
    }
}

async function inquiryPayment(paymentLinkId) {
    try {
        const url = `${process.env.PAYOS_API_BASE || cfg.apiBase}/v2/payment-requests/${encodeURIComponent(paymentLinkId)}`;

        const res = await axios.get(url, {
            headers: {
                'x-client-id': process.env.PAYOS_CLIENT_ID || cfg.clientId,
                'x-api-key': process.env.PAYOS_API_KEY || cfg.apiKey
            },
            timeout: 10000
        });

        return res.data;
    } catch (error) {
        console.error('inquiryPayment error:', error.response?.data || error.message);
        throw error;
    }
}

module.exports = {
    buildSignatureString,
    calcHmacSha256Hex,
    verifyWebhookSignature,
    createPaymentLink,
    inquiryPayment
};