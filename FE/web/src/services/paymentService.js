// src/services/paymentService.js

import api from './api';

/**
 * 🔍 Kiểm tra trạng thái thanh toán
 * @param {number} paymentId - ID của payment
 * @param {string} token - Access token
 * @returns {Promise} Response data
 */
export const checkPaymentStatus = async (paymentId, token) => {
  try {
    const response = await api.get(`/payments/${paymentId}/status`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('❌ Check payment status error:', error);
    throw error;
  }
};

/**
 * 💳 Tạo payment link cho member card
 * @param {object} payload - { readerId, cardTypeId, action }
 * @param {string} token - Access token
 * @returns {Promise} Payment data với QR code
 */
export const createMemberCardPayment = async (payload, token) => {
  try {
    const response = await api.post('/auth/register/complete', payload, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('❌ Create payment error:', error);
    throw error;
  }
};

export default {
  checkPaymentStatus,
  createMemberCardPayment
};