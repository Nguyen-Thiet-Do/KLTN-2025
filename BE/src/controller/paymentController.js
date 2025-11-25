// ============================================================
// 📨 GỬI CHO BACKEND TEAM - CẦN THÊM API NÀY
// ============================================================

// File: controller/paymentController.js
const { Payment, MemberCard } = require("../model/index");
const authService = require("../service/authService");

/**
 * GET /api/payments/:paymentId/status
 * Kiểm tra trạng thái thanh toán và tạo thẻ nếu thành công
 */
const getPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findByPk(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thanh toán",
        status: "NOT_FOUND"
      });
    }

    console.log(`🔍 Check payment ${paymentId}: status=${payment.status}`);

    // ✅ Nếu đã SUCCESS và chưa có thẻ → Tạo thẻ
    if (payment.status === 'SUCCESS' || payment.status === 'PAID') {
      // Kiểm tra xem đã có thẻ chưa
      const existingCard = await MemberCard.findOne({
        where: {
          readerId: payment.readerId,
          status: 'ACTIVE',
          deleted: false
        }
      });

      // Nếu chưa có thẻ thì tạo
      if (!existingCard) {
        console.log('💳 Creating member card for payment:', paymentId);
        
        try {
          const result = await authService.finalizePaymentAndCreateMemberCard(payment);
          
          return res.json({
            success: true,
            status: 'SUCCESS',
            message: 'Thanh toán thành công và thẻ đã được tạo',
            memberCard: result.memberCard
          });
        } catch (err) {
          console.error('❌ Error creating card:', err);
          // Vẫn trả SUCCESS vì payment đã thành công
        }
      }

      return res.json({
        success: true,
        status: 'SUCCESS',
        message: 'Thanh toán thành công',
        memberCard: existingCard
      });
    }

    // ⏳ Các trạng thái khác
    return res.json({
      success: true,
      status: payment.status,
      message: payment.status === 'PENDING' 
        ? 'Đang chờ thanh toán' 
        : `Trạng thái: ${payment.status}`
    });

  } catch (error) {
    console.error('❌ Get payment status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi kiểm tra trạng thái',
      error: error.message
    });
  }
};

module.exports = {
  getPaymentStatus
};


