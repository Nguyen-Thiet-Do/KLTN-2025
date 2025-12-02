// controller/paymentController.js
const { Payment, MemberCard } = require("../model/index");
const authService = require("../service/authService");

/**
 * GET /api/payments/:paymentId/status
 * Kiểm tra trạng thái thanh toán và xử lý theo loại payment
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

    console.log(`🔍 Check payment ${paymentId}: status=${payment.status}, type=${payment.paymentType}`);

    // ✅ Nếu đã SUCCESS/PAID → Xử lý theo loại payment
    if (payment.status === 'SUCCESS' || payment.status === 'PAID') {
      
      // ========================================
      // 📝 CASE 1: CARD_PURCHASE (Đăng ký thẻ mới)
      // ========================================
      if (payment.paymentType === 'CARD_PURCHASE') {
        const existingCard = await MemberCard.findOne({
          where: {
            readerId: payment.readerId,
            status: 'ACTIVE',
            deleted: false
          }
        });

        if (!existingCard) {
          console.log('💳 Creating member card for payment:', paymentId);
          
          try {
            const result = await authService.finalizePaymentAndCreateMemberCard(payment);
            
            return res.json({
              success: true,
              status: 'SUCCESS',
              message: 'Thanh toán thành công và thẻ đã được tạo',
              paymentType: 'CARD_PURCHASE',
              memberCard: result.memberCard
            });
          } catch (err) {
            console.error('❌ Error creating card:', err);
          }
        }

        return res.json({
          success: true,
          status: 'SUCCESS',
          message: 'Thanh toán thành công',
          paymentType: 'CARD_PURCHASE',
          memberCard: existingCard
        });
      }

      // ========================================
      // 💰 CASE 2: TOPUP hoặc DEPOSIT (Nạp tiền vào thẻ)
      // ========================================
      if (payment.paymentType === 'TOPUP' || payment.paymentType === 'DEPOSIT') {
        // Tìm thẻ thành viên
        const memberCard = await MemberCard.findOne({
          where: {
            readerId: payment.readerId,
            status: 'ACTIVE',
            deleted: false
          }
        });

        if (!memberCard) {
          return res.status(404).json({
            success: false,
            message: 'Không tìm thấy thẻ thành viên',
            status: 'MEMBER_CARD_NOT_FOUND'
          });
        }

        // Kiểm tra xem đã cộng tiền chưa (dựa vào note)
        const alreadyProcessed = payment.note?.includes('balance_updated');

        if (!alreadyProcessed) {
          console.log('💰 Adding balance to member card:', memberCard.memberCardId);
          
          const oldBalance = Number(memberCard.balance);
          const topupAmount = Number(payment.amount);
          const newBalance = oldBalance + topupAmount;

          // Cộng tiền vào thẻ
          await memberCard.update({ balance: newBalance });

          // Đánh dấu đã xử lý
          await payment.update({
            note: (payment.note || '') + '|balance_updated'
          });

          console.log(`✅ Balance updated: ${oldBalance} → ${newBalance}`);

          return res.json({
            success: true,
            status: 'SUCCESS',
            message: 'Nạp tiền thành công',
            paymentType: payment.paymentType,
            topup: {
              amount: topupAmount,
              oldBalance: oldBalance,
              newBalance: newBalance
            }
          });
        }

        // Đã xử lý rồi
        return res.json({
          success: true,
          status: 'SUCCESS',
          message: 'Nạp tiền đã được xử lý trước đó',
          paymentType: payment.paymentType,
          currentBalance: Number(memberCard.balance)
        });
      }

      // ========================================
      // 📦 CASE 3: Loại payment khác
      // ========================================
      return res.json({
        success: true,
        status: 'SUCCESS',
        message: 'Thanh toán thành công',
        paymentType: payment.paymentType
      });
    }

    // ⏳ Các trạng thái khác (PENDING, FAILED, ...)
    return res.json({
      success: payment.status !== 'FAILED',
      status: payment.status,
      message: getStatusMessage(payment.status),
      paymentType: payment.paymentType
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

/**
 * Helper: Get status message
 */
function getStatusMessage(status) {
  const messages = {
    'PENDING': 'Đang chờ thanh toán',
    'SUCCESS': 'Thanh toán thành công',
    'PAID': 'Đã thanh toán',
    'FAILED': 'Thanh toán thất bại',
    'CANCELLED': 'Đã hủy',
    'EXPIRED': 'Đã hết hạn'
  };
  return messages[status] || `Trạng thái: ${status}`;
}

module.exports = {
  getPaymentStatus
};