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

            // --- BỔ SUNG: xử lý DEPOSIT / CARD_TOPUP trước khi gọi finalize ---
            try {
                // lazy-require models để không phá vỡ import ở đầu file
                const { MemberCard } = require('../model');
                const sequelize = require('./config/database');

                const pType = (payment.paymentType || '').toUpperCase();
                if (pType === 'DEPOSIT' || pType === 'CARD_TOPUP') {
                    console.log('ℹ️ Payment type is DEPOSIT/CARD_TOPUP — attempting to apply topup');

                    const note = payment.note || '';
                    const m = /memberCardId:(\d+)/.exec(note);
                    const memberCardId = m ? Number(m[1]) : null;

                    if (!memberCardId) {
                        console.warn('⚠️ No memberCardId found in payment.note — cannot auto-apply topup');
                        // vẫn tiếp tục (không finalize tạo thẻ) — trả về OK để provider không retry
                        return res.status(200).json({ message: 'no memberCardId' });
                    }

                    // Thực hiện cập nhật balance trong transaction (idempotency & atomic)
                    await sequelize.transaction(async (tx) => {
                        const mc = await MemberCard.findByPk(memberCardId, { transaction: tx, lock: tx.LOCK.UPDATE });
                        if (!mc) throw new Error('MemberCard not found for topup: ' + memberCardId);

                        // Idempotency: nếu payment.note đã chứa applied_to_memberCard thì coi như đã apply
                        if ((payment.note || '').includes(`applied_to_memberCard:${memberCardId}`)) {
                            console.log('ℹ️ Topup already applied for memberCard:', memberCardId);
                            return;
                        }

                        const currentBalance = Number(mc.balance || 0);
                        const addAmount = Number(payment.amount || 0);
                        if (isNaN(addAmount) || addAmount <= 0) {
                            throw new Error('Invalid payment.amount for topup: ' + payment.amount);
                        }

                        const newBalance = Number((currentBalance + addAmount).toFixed(2));
                        await mc.update({ balance: newBalance }, { transaction: tx });

                        // Ghi note để tránh apply lại
                        await payment.update({ note: (payment.note || '') + `|applied_to_memberCard:${memberCardId}` }, { transaction: tx });

                        console.log(`✅ Top-up applied: +${addAmount} to memberCard ${memberCardId}. New balance: ${newBalance}`);
                    });

                    // Sau khi apply topup, emit socket event tới reader nếu có (giống luồng payment success)
                    try {
                        const payload = {
                            paymentId: payment.paymentId,
                            transactionCode: payment.transactionCode,
                            amount: payment.amount,
                            status: 'COMPLETED',
                            topupApplied: true
                        };
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
                    } catch (emitErr) {
                        console.error('❌ Error emitting socket after topup:', emitErr?.message || emitErr);
                    }

                    return res.status(200).json({ message: 'topup applied' });
                }
            } catch (topupErr) {
                // Nếu xảy ra lỗi ở phần topup, log và trả 200 để provider không retry nhiều lần.
                console.error('❌ Error applying topup (DEPOSIT/CARD_TOPUP):', topupErr?.message || topupErr);
                return res.status(200).json({ message: 'topup error logged' });
            }

            // --- Nếu không phải DEPOSIT/CARD_TOPUP thì giữ nguyên luồng finalize tạo member card ---
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
