// ==========================
//  IMPORTS (không lazy nữa)
// ==========================
const payosService = require('../service/payosService');
const { Payment, MemberCard } = require('../model');  // lấy luôn MemberCard
const sequelize = require('../config/database');       // lấy đúng instance Sequelize
const authService = require('../service/authService');
const { emitToUser } = require('../config/socket'); 

/**
 * POST /api/payos/create
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
 */
async function webhookHandler(req, res) {
    try {
        console.log('--- PayOS Webhook received ---');
        console.log('Headers:', req.headers);
        console.log('Body:', req.body);

        const webhookData = req.body;

        // Verify signature
        const isValid = payosService.verifyPaymentWebhookData(webhookData);
        if (!isValid) {
            console.warn('❌ Invalid webhook signature');
            return res.status(403).json({ error: 'invalid signature' });
        }

        console.log('✅ Webhook signature valid');

        const data = webhookData.data || webhookData;
        const orderCode = data.orderCode || data.order_code || data.order;
        const code = data.code || data.statusCode || data.status;

        console.log('📦 Webhook data:', { orderCode, code });

        if (!orderCode) {
            return res.status(400).json({ error: 'no orderCode' });
        }

        // Find payment
        let payment = await Payment.findOne({
            where: { transactionCode: String(orderCode) }
        });

        if (!payment) {
            console.warn('⚠️ Payment not found for orderCode:', orderCode);
            return res.status(200).json({ message: 'payment not found' });
        }

        if (['COMPLETED', 'PAID'].includes((payment.status || '').toUpperCase())) {
            console.log('⚡ Already processed');
            return res.status(200).json({ message: 'already processed' });
        }

        const isSuccess = String(code) === '00' || String(code).toUpperCase() === 'SUCCESS';

        if (isSuccess) {
            console.log('✅ Payment successful, updating payment...');
            await payment.update({
                status: 'COMPLETED',
                paymentDate: new Date(),
            });

            // ================================
            //  HANDLE TOP-UP (DEPOSIT / CARD_TOPUP)
            // ================================
            const pType = (payment.paymentType || '').toUpperCase();

            if (pType === 'DEPOSIT' || pType === 'CARD_TOPUP') {
                console.log('💳 Applying topup...');

                const note = payment.note || '';
                const match = /memberCardId:(\d+)/.exec(note);
                const memberCardId = match ? Number(match[1]) : null;

                if (!memberCardId) {
                    console.warn('⚠ No memberCardId found in payment.note');
                    return res.status(200).json({ message: 'no memberCardId' });
                }

                try {
                    await sequelize.transaction(async (tx) => {
                        let mc = await MemberCard.findByPk(memberCardId, {
                            transaction: tx,
                            lock: tx.LOCK.UPDATE
                        });

                        if (!mc) throw new Error('MemberCard not found');

                        if ((payment.note || '').includes(`applied_to_memberCard:${memberCardId}`)) {
                            console.log('⚡ Topup already applied previously.');
                            return;
                        }

                        const addAmount = Number(payment.amount || 0);
                        const newBalance = Number(mc.balance || 0) + addAmount;

                        await mc.update({ balance: newBalance }, { transaction: tx });

                        await payment.update({
                            note: (payment.note || '') + `|applied_to_memberCard:${memberCardId}`
                        }, { transaction: tx });

                        console.log(`✅ Top-up success! +${addAmount} → new balance = ${newBalance}`);
                    });
                } catch (err) {
                    console.error('❌ Error applying topup:', err.message);
                    return res.status(200).json({ message: 'topup error logged' });
                }

                // Emit socket
                try {
                    if (payment.readerId) {
                        emitToUser(payment.readerId, 'payment_success', {
                            paymentId: payment.paymentId,
                            amount: payment.amount,
                            status: 'COMPLETED',
                            topupApplied: true
                        });
                    }
                } catch (err) {
                    console.error('❌ Emit socket error:', err.message);
                }

                return res.status(200).json({ message: 'topup applied' });
            }

            // ================================
            // NOT TOPUP → CREATE MEMBER CARD
            // ================================
            try {
                const result = await authService.finalizePaymentAndCreateMemberCard(payment);

                if (payment.readerId) {
                    emitToUser(payment.readerId, 'payment_success', {
                        paymentId: payment.paymentId,
                        transactionCode: payment.transactionCode,
                        amount: payment.amount,
                        status: 'COMPLETED',
                        memberCard: result.memberCard
                    });
                }
            } catch (err) {
                console.error('❌ finalize error:', err.message);
            }
        } else {
            console.log('❌ Payment failed');
            await payment.update({ status: 'FAILED' });
        }

        return res.status(200).json({ message: 'OK' });

    } catch (err) {
        console.error('❌ Webhook error:', err.message);
        return res.status(500).json({ error: 'internal error' });
    }
}


// =====================================================================

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
