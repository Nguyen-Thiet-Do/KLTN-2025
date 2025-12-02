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

    console.log('='.repeat(50));
    console.log(`🔍 CHECK PAYMENT STATUS`);
    console.log(`   Payment ID: ${paymentId}`);
    console.log(`   Status: ${payment.status}`);
    console.log(`   Type: ${payment.paymentType}`);
    console.log(`   Amount: ${payment.amount}`);
    console.log(`   Reader ID: ${payment.readerId}`);
    console.log(`   Note: ${payment.note}`);
    console.log('='.repeat(50));

    // ✅ Nếu đã SUCCESS/PAID/COMPLETED → Xử lý theo loại payment
    const successStatuses = ['SUCCESS', 'PAID', 'COMPLETED'];
    if (successStatuses.includes(payment.status)) {
      
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
            return res.status(500).json({
              success: false,
              message: 'Lỗi tạo thẻ thành viên',
              error: err.message
            });
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
        console.log('='.repeat(50));
        console.log('💰 PROCESSING TOPUP/DEPOSIT');
        console.log(`   Payment Type: ${payment.paymentType}`);
        console.log(`   Amount: ${payment.amount}`);
        console.log(`   Reader ID: ${payment.readerId}`);
        console.log('='.repeat(50));

        // Tìm thẻ thành viên
        const memberCard = await MemberCard.findOne({
          where: {
            readerId: payment.readerId,
            status: 'ACTIVE',
            deleted: false
          }
        });

        if (!memberCard) {
          console.error('❌ MEMBER CARD NOT FOUND');
          console.error(`   Reader ID: ${payment.readerId}`);
          console.error(`   Payment ID: ${paymentId}`);
          return res.status(404).json({
            success: false,
            message: 'Không tìm thấy thẻ thành viên',
            status: 'MEMBER_CARD_NOT_FOUND'
          });
        }

        console.log('✅ FOUND MEMBER CARD');
        console.log(`   Member Card ID: ${memberCard.memberCardId}`);
        console.log(`   Current Balance: ${memberCard.balance}`);
        console.log(`   Reader ID: ${memberCard.readerId}`);

        // Kiểm tra xem đã cộng tiền chưa (dựa vào note)
        const alreadyProcessed = payment.note?.includes('balance_updated');
        
        console.log('🔍 CHECK IF ALREADY PROCESSED');
        console.log(`   Payment Note: ${payment.note}`);
        console.log(`   Already Processed: ${alreadyProcessed}`);

        if (!alreadyProcessed) {
          console.log('='.repeat(50));
          console.log('💰 ADDING BALANCE TO CARD');
          console.log(`   Member Card ID: ${memberCard.memberCardId}`);
          
          const oldBalance = Number(memberCard.balance || 0);
          const topupAmount = Number(payment.amount);
          const newBalance = oldBalance + topupAmount;

          console.log('💵 BALANCE CALCULATION:');
          console.log(`   Old Balance: ${oldBalance}`);
          console.log(`   Topup Amount: ${topupAmount}`);
          console.log(`   New Balance: ${newBalance}`);
          console.log(`   Formula: ${oldBalance} + ${topupAmount} = ${newBalance}`);
          console.log('='.repeat(50));

          // ✅ Cộng tiền vào thẻ
          await memberCard.update({ balance: newBalance });
          console.log('✅ DATABASE UPDATE: MemberCard balance updated');

          // ✅ Đánh dấu đã xử lý
          await payment.update({
            note: (payment.note || '') + '|balance_updated',
            paymentDate: new Date() // ✅ Cập nhật ngày thanh toán
          });
          console.log('✅ DATABASE UPDATE: Payment marked as processed');

          console.log('='.repeat(50));
          console.log(`🎉 SUCCESS: Balance updated from ${oldBalance} to ${newBalance}`);
          console.log('='.repeat(50));

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
        console.log('⚠️ Payment already processed');
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
      console.log('ℹ️ Other payment type:', payment.paymentType);
      return res.json({
        success: true,
        status: 'SUCCESS',
        message: 'Thanh toán thành công',
        paymentType: payment.paymentType
      });
    }

    // ⏳ Các trạng thái khác (PENDING, FAILED, ...)
    console.log('⏳ Payment not completed yet:', payment.status);
    return res.json({
      success: payment.status !== 'FAILED',
      status: payment.status,
      message: getStatusMessage(payment.status),
      paymentType: payment.paymentType
    });

  } catch (error) {
    console.error('❌ Get payment status error:', error);
    console.error('Stack trace:', error.stack);
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
    'COMPLETED': 'Đã hoàn tất',
    'FAILED': 'Thanh toán thất bại',
    'CANCELLED': 'Đã hủy',
    'EXPIRED': 'Đã hết hạn'
  };
  return messages[status] || `Trạng thái: ${status}`;
}

module.exports = {
  getPaymentStatus
};