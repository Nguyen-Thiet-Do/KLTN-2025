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
        console.log('--- PayOS Webhook received ---');
        console.log('Headers:', req.headers);
        console.log('RawBody:', typeof req.rawBody === 'string' ? req.rawBody.slice(0, 4000) : req.rawBody);
        console.log('Parsed body:', req.body);

        // Try signature from headers first
        const signatureHeader =
            req.headers['x-signature'] ||
            req.headers['x-payos-signature'] ||
            req.headers['x-hmac-signature'] ||
            req.headers['signature'];

        // parsed body (if json parsed)
        const parsed = req.body && Object.keys(req.body).length ? req.body : null;
        if (!parsed && !req.rawBody) {
            console.warn('Webhook: no parsed body and no rawBody');
            return res.status(400).send('no payload');
        }

        let data = null;
        let signature = signatureHeader || null;

        if (parsed) {
            if (parsed.data && parsed.signature) {
                data = parsed.data;
                signature = signature || parsed.signature;
            } else {
                // either direct data object or other wrapper
                data = parsed;
            }
        }

        // fallback parse rawBody if needed
        if (!data && req.rawBody) {
            try {
                const rb = JSON.parse(req.rawBody);
                data = rb.data || rb;
                signature = signature || rb.signature;
            } catch (e) {
                console.warn('rawBody is not JSON or cannot parse');
            }
        }

        if (!data) {
            console.warn('Webhook: no data extracted from request');
            return res.status(400).send('no payload');
        }

        if (!signature) {
            console.warn('Webhook: no signature provided');
            return res.status(400).send('no signature');
        }

        // verify signature: try both parsed data and parsedRaw.data if exists
        let verified = false;
        try {
            // if rawBody contained wrapper with data, try using that
            if (req.rawBody) {
                try {
                    const parsedRaw = JSON.parse(req.rawBody);
                    if (parsedRaw && parsedRaw.data) {
                        verified = payosService.verifyWebhookSignature(parsedRaw.data, signature);
                    }
                } catch (e) {
                    // ignore parse error
                }
            }
            if (!verified) verified = payosService.verifyWebhookSignature(data, signature);
        } catch (e) {
            console.error('Error during signature verification:', e);
            verified = false;
        }

        if (!verified) {
            console.warn('Invalid payos signature', { data: typeof data === 'object' ? JSON.stringify(data).slice(0, 1000) : data });
            return res.status(403).send('invalid signature');
        }

        // find payment by orderCode or reference
        const orderCode = data.orderCode || null;
        const reference = data.reference || data.transactionId || null;
        let payment = null;
        if (orderCode) payment = await Payment.findOne({ where: { transactionCode: orderCode } });
        if (!payment && reference) payment = await Payment.findOne({ where: { transactionCode: reference } });

        const code = data.code;
        const success = (String(code) === '00') || data.success === true || (String(data.status || '').toUpperCase() === 'SUCCESS');

        if (!payment) {
            console.warn('Webhook: payment not found for', { orderCode, reference });
            return res.status(200).send('OK');
        }

        // idempotency
        if (payment.status === 'COMPLETED' || payment.status === 'PAID') {
            console.log('Payment already processed', payment.paymentId);
            return res.status(200).send('OK');
        }

        if (success) {
            await payment.update({ status: 'COMPLETED', transactionCode: reference || payment.transactionCode });
            try {
                await authService.finalizePaymentAndCreateMemberCard(payment);
            } catch (err) {
                console.error('finalizePaymentAndCreateMemberCard error', err);
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
