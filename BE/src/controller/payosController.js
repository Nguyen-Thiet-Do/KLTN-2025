// src/controller/payosController.js
const payosService = require('../service/payosService');
const { Payment } = require('../model');
const authService = require('../service/authService'); // để finalize và tạo member card

// POST /api/payos/create
// body: { orderCode, amount, description, returnUrl, cancelUrl }
// (in our registration flow you can call with { readerId, cardTypeId } and build orderCode in service)
async function createPayment(req, res) {
    try {
        const { orderCode, amount, description, returnUrl, cancelUrl } = req.body;
        if (!orderCode || !amount) return res.status(400).json({ ok: false, message: 'orderCode & amount required' });

        const resp = await payosService.createPaymentLink({ orderCode, amount, description, returnUrl, cancelUrl });
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
        const body = req.body;
        if (!body) return res.status(400).send('no payload');
        const { data, signature } = body;
        if (!data || !signature) return res.status(400).send('invalid payload');

        // verify signature
        const ok = payosService.verifyWebhookSignature(data, signature);
        if (!ok) {
            console.warn('Invalid payos signature', { data });
            return res.status(403).send('invalid signature');
        }

        // find payment record by orderCode (transactionCode) or other
        const orderCode = data.orderCode || null;
        const reference = data.reference || data.transactionId || null;
        let payment = null;
        if (orderCode) payment = await Payment.findOne({ where: { transactionCode: orderCode } });
        if (!payment && reference) payment = await Payment.findOne({ where: { transactionCode: reference } });

        // interpret success (provider dependent)
        const code = data.code;
        const success = (String(code) === '00') || data.success === true || (String(data.status || '').toUpperCase() === 'SUCCESS');

        if (!payment) {
            console.warn('Webhook: payment not found for', { orderCode, reference });
            // ACK to avoid retries; optionally create record here
            return res.status(200).send('OK');
        }

        // idempotency: ignore already processed
        if (payment.status === 'COMPLETED' || payment.status === 'PAID') {
            console.log('Payment already processed', payment.paymentId);
            return res.status(200).send('OK');
        }

        if (success) {
            await payment.update({ status: 'COMPLETED', transactionCode: reference || payment.transactionCode });
            // finalize: create member card etc.
            try {
                await authService.finalizePaymentAndCreateMemberCard(payment);
            } catch (err) {
                console.error('finalizePaymentAndCreateMemberCard error', err);
                // we already marked payment completed; handle manual retry if necessary
            }
            return res.status(200).send('OK');
        } else {
            await payment.update({ status: 'FAILED', transactionCode: reference || payment.transactionCode });
            return res.status(200).send('OK');
        }
    } catch (err) {
        console.error('payos webhook error', err);
        return res.status(500).send('ERR');
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
