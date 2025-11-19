// src/controller/payosController.js
const payosService = require('../service/payosService');
const { Payment } = require('../model');
const authService = require('../service/authService');
const { emitToUser } = require('../config/socket'); // đảm bảo đường dẫn đúng

/**
 * POST /api/payos/create
 * body: { orderCode, amount, description, returnUrl, cancelUrl, items }
 */
async function createPayment(req, res) {
    try {
        const { orderCode, amount, description, returnUrl, cancelUrl } = req.body;
        if (!amount) return res.status(400).json({ ok: false, message: 'amount required' });

        const items = req.body.items || [{
            name: description || 'Payment',
            quantity: 1,
            price: Number(amount)
        }];

        const resp = await payosService.createPaymentLink({
            orderCode,
            amount,
            description,
            returnUrl,
            cancelUrl,
            items
        });

        return res.json({ ok: true, data: resp });
    } catch (err) {
        console.error('createPayment error', err?.response?.data || err.message || err);
        return res.status(500).json({ ok: false, message: 'create payment failed' });
    }
}

/**
 * POST /api/payos/webhook
 * payload: { data: {...}, signature: "..." } or PayOS default shape
 *
 * Flow:
 *  - Verify signature (payosService.verifyPaymentWebhookData)
 *  - Find Payment by transactionCode = orderCode
 *  - Idempotency: nếu payment đã COMPLETED/PAID -> return 200
 *  - Nếu thành công (code === '00'), cập nhật payment, gọi finalize -> tạo member card
 *  - Nếu tạo member card thành công, emit socket event 'payment_success' cho room user_<readerId>
 */
async function webhookHandler(req, res) {
    try {
        console.log('--- PayOS Webhook received ---');
        console.log('Headers:', req.headers);
        console.log('Body:', req.body);

        const webhookData = req.body;

        // Verify webhook bằng SDK / fallback
        const isValid = payosService.verifyPaymentWebhookData(webhookData);

        if (!isValid) {
            console.warn('❌ Invalid webhook signature');
            return res.status(403).json({ error: 'invalid signature' });
        }

        console.log('✅ Webhook signature valid');

        // Lấy payload chính
        const data = webhookData.data || webhookData;
        const orderCode = data.orderCode || data.order_code || data.order;
        const code = data.code || data.statusCode || data.status;

        console.log('📦 Webhook data:', { orderCode, code });

        if (!orderCode) {
            console.warn('❌ No orderCode in webhook data');
            return res.status(400).json({ error: 'no orderCode' });
        }

        // Tìm Payment theo transactionCode
        let payment = await Payment.findOne({
            where: { transactionCode: String(orderCode) }
        });

        if (!payment) {
            console.warn('⚠️ Payment not found for orderCode:', orderCode);
            // Trả 200 để tránh PayOS retry nếu bạn không muốn xử lý sau
            return res.status(200).json({ message: 'payment not found' });
        }

        // Idempotency: nếu đã xử lý -> trả 200
        const processedStatuses = ['COMPLETED', 'PAID'];
        if (processedStatuses.includes((payment.status || '').toUpperCase())) {
            console.log('✅ Payment already processed:', payment.paymentId, payment.status);
            return res.status(200).json({ message: 'already processed' });
        }

        // Xác định thành công: PayOS trả code "00" cho success (điều chỉnh nếu khác)
        const isSuccess = String(code) === '00' || String(code).toUpperCase() === 'SUCCESS';

        if (isSuccess) {
            console.log('✅ Payment successful, updating payment record...');

            await payment.update({
                status: 'COMPLETED',
                paymentDate: new Date()
            });

            // finalize payment -> tạo member card (nếu cần)
            try {
                const result = await authService.finalizePaymentAndCreateMemberCard(payment);
                // result: { payment: updatedPayment, memberCard }

                // Chuẩn bị payload nhỏ gọn gửi cho client
                const payload = {
                    paymentId: payment.paymentId,
                    transactionCode: payment.transactionCode,
                    amount: payment.amount,
                    status: 'COMPLETED',
                    memberCard: result.memberCard ? {
                        memberCardId: result.memberCard.memberCardId,
                        cardNumber: result.memberCard.cardNumber,
                        cardTypeId: result.memberCard.cardTypeId,
                        issueDate: result.memberCard.issueDate,
                        expiryDate: result.memberCard.expiryDate
                    } : null
                };

                // Emit event qua Socket.IO tới user room
                const readerId = payment.readerId;
                if (readerId) {
                    try {
                        emitToUser(readerId, 'payment_success', payload);
                        console.log('🚀 Socket emitted payment_success to user', readerId);
                    } catch (emitErr) {
                        console.error('❌ Emit socket failed:', emitErr?.message || emitErr);
                    }
                } else {
                    console.warn('⚠️ Payment has no readerId - cannot emit socket event');
                }

            } catch (finalizeErr) {
                console.error('❌ finalizePaymentAndCreateMemberCard error:', finalizeErr?.message || finalizeErr);
                // Không rollback payment; chỉ log — có thể retry bằng job admin
            }

        } else {
            console.log('❌ Payment failed according to webhook code:', code);
            await payment.update({ status: 'FAILED' });
        }

        return res.status(200).json({ message: 'OK' });
    } catch (err) {
        console.error('❌ Webhook error:', err?.message || err);
        return res.status(500).json({ error: 'internal error' });
    }
}

/**
 * Optional simple pages for browser flow
 */
function returnPage(req, res) {
    const orderCode = req.query.orderCode || req.query.order_code || '';
    res.send(`<html><body><h3>Thanh toán: ${orderCode} - đang xử lý</h3></body></html>`);
}
function cancelPage(req, res) {
    const orderCode = req.query.orderCode || req.query.order_code || '';
    res.send(`<html><body><h3>Thanh toán: ${orderCode} đã hủy</h3></body></html>`);
}

module.exports = {
    createPayment,
    webhookHandler,
    returnPage,
    cancelPage
};
