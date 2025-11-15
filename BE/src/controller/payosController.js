// src/controller/payosController.js
const payosService = require('../service/payosService');
const { Payment } = require('../model');
const authService = require('../service/authService'); // để finalize và tạo member card

// POST /api/payos/create
// body: { orderCode, amount, description, returnUrl, cancelUrl }
// (in our registration flow you can call with { readerId, cardTypeId } and build orderCode in service)
// POST /api/payos/create
async function createPayment(req, res) {
    try {
        const { orderCode, amount, description, returnUrl, cancelUrl } = req.body;
        if (!amount) return res.status(400).json({ ok: false, message: 'amount required' });

        // ✅ Đảm bảo có items array
        const items = req.body.items || [{
            name: description || 'Payment',
            quantity: 1,
            price: Number(amount)
        }];

        const resp = await payosService.createPaymentLink({
            orderCode, // Có thể null, service sẽ tự tạo
            amount,
            description,
            returnUrl,
            cancelUrl,
            items // ✅ Thêm items
        });

        return res.json({ ok: true, data: resp });
    } catch (err) {
        console.error('createPayment error', err?.response?.data || err.message);
        return res.status(500).json({ ok: false, message: 'create payment failed' });
    }
}

// POST /api/payos/webhook
// payload: { data: {...}, signature: "..." }
async function webhookHandler(req, res) {
    try {
        console.log('--- PayOS Webhook received ---');
        console.log('Headers:', req.headers);
        console.log('Body:', req.body);

        const webhookData = req.body;

        // Verify webhook using PayOS SDK
        const isValid = payosService.verifyPaymentWebhookData(webhookData);

        if (!isValid) {
            console.warn('❌ Invalid webhook signature');
            return res.status(403).json({ error: 'invalid signature' });
        }

        console.log('✅ Webhook signature valid');

        // Extract data
        const data = webhookData.data || webhookData;
        const orderCode = data.orderCode;
        const code = data.code;
        const desc = data.desc;

        console.log('📦 Webhook data:', { orderCode, code, desc });

        // Find payment
        let payment = await Payment.findOne({
            where: { transactionCode: String(orderCode) }
        });

        if (!payment) {
            console.warn('⚠️ Payment not found for orderCode:', orderCode);
            return res.status(200).json({ message: 'payment not found' });
        }

        // Idempotency check
        if (payment.status === 'COMPLETED' || payment.status === 'PAID') {
            console.log('✅ Payment already processed:', payment.paymentId);
            return res.status(200).json({ message: 'already processed' });
        }

        // code: "00" = success
        const isSuccess = String(code) === '00';

        if (isSuccess) {
            console.log('✅ Payment successful, creating member card...');

            await payment.update({
                status: 'COMPLETED',
                paymentDate: new Date()
            });

            try {
                await authService.finalizePaymentAndCreateMemberCard(payment);
                console.log('✅ Member card created successfully');
            } catch (err) {
                console.error('❌ Error creating member card:', err.message);
            }
        } else {
            console.log('❌ Payment failed with code:', code);
            await payment.update({ status: 'FAILED' });
        }

        return res.status(200).json({ message: 'OK' });

    } catch (err) {
        console.error('❌ Webhook error:', err);
        return res.status(500).json({ error: 'internal error' });
    }
}

// optional: simple return/cancel pages for browser flow
function returnPage(req, res) {
    const orderCode = req.query.orderCode || '';
    res.send(`<html><body><h3>Thanh toán: ${orderCode} - đang xử lý</h3></body></html>`);
}
function cancelPage(req, res) {
    const orderCode = req.query.orderCode || '';
    res.send(`<html><body><h3>Thanh toán: ${orderCode} đã hủy</h3></body></html>`);
}

module.exports = {
    createPayment,
    webhookHandler,
    returnPage,
    cancelPage
};
