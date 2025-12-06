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

/**
 * 🔼 Tạo yêu cầu nạp tiền để làm đầy số dư mặc định của memberCard
 * payload: { memberCardId?: number, readerId?: number }
 * token: access token
 * trả về: data giống spec (ok + paymentId/orderCode/amount/payos... hoặc already_sufficient)
 */
export const topupMemberCard = async (payload, token) => {
  try {
    const response = await api.post('/member-cards/topup', payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
    return response.data;
  } catch (error) {
    console.error('❌ topupMemberCard error:', error);
    // Trả lỗi nguyên bản để component xử lý chi tiết
    if (error.response?.data) throw error.response.data;
    throw error;
  }
  
};
export const paymentService = {
  async getMyPayments(params = {}) {
    try {
      const query = {
        page: params.page || 1,
        limit: params.limit || 10,
        sortBy: params.sortBy || "created_at",
        sortDir: params.sortDir || "DESC",
        ...params
      };

      console.log('🔍 Calling API:', '/loans/reader/payments/my', query);

      const res = await api.get("/loans/reader/payments/my", {
        params: query
      });

      console.log('✅ API Response:', res.data);
      return res.data;
    } catch (error) {
      console.error('❌ getMyPayments error:', error);
      console.error('❌ Error response:', error.response?.data);
      throw error;
    }
  },
};


export default {
  checkPaymentStatus,
  createMemberCardPayment,
  topupMemberCard,
  paymentService,
};