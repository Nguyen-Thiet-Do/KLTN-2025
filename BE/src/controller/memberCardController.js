// controller/memberCardController.js
const { MemberCard, CardType, Payment, sequelize } = require('../model');
const payosService = require('../service/payosService');

async function topupToDefault(req, res) {
  try {
    const { memberCardId } = req.body;
    if (!memberCardId) return res.status(400).json({ success: false, message: 'memberCardId required' });

    const card = await MemberCard.findByPk(memberCardId);
    if (!card) return res.status(404).json({ success: false, message: 'MemberCard not found' });

    const cardType = await CardType.findByPk(card.cardTypeId);
    if (!cardType) return res.status(500).json({ success: false, message: 'CardType not found' });

    // Xác định target balance (chỉnh theo nhu cầu)
    const envFallback = Number(process.env.DEFAULT_CARD_INITIAL_BALANCE || 0);
    const targetBalance = Number(cardType.initialBalance || cardType.price || envFallback || 0);

    const current = Number(card.balance || 0);
    const missing = Math.max(0, Number((targetBalance - current).toFixed(2)));

    if (missing <= 0) {
      return res.json({ success: true, message: 'Thẻ đã có đủ số dư mặc định', data: { memberCardId, currentBalance: current, targetBalance } });
    }

    // Tạo payment record
    const orderCode = Date.now();
    const payment = await Payment.create({
      loanSlipId: null,
      violationId: null,
      readerId: card.readerId,
      librarianId: Number(process.env.SYSTEM_LIBRARIAN_ID || 120401),
      paymentType: 'DEPOSIT', // hoặc 'CARD_TOPUP'
      amount: missing,
      paymentMethod: 'PAYOS_QR',
      paymentDate: null,
      transactionCode: String(orderCode),
      status: 'PENDING',
      note: `topup_to_default|memberCardId:${card.memberCardId}`
    });

    // Tạo link thanh toán qua PayOS
    const baseUrl = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
    const resp = await payosService.createPaymentLink({
      orderCode,
      amount: missing,
      description: `Nạp thẻ ${targetBalance}`,
      returnUrl: `${baseUrl}/pay/return`,
      cancelUrl: `${baseUrl}/pay/cancel`,
      items: [{ name: 'Top-up member card', quantity: 1, price: missing }]
    });

    // Lưu info payos vào note (giống flow hiện tại)
    await payment.update({ note: (payment.note || '') + `|payos:${JSON.stringify({ checkoutUrl: resp.checkoutUrl, paymentLinkId: resp.paymentLinkId })}` });

    return res.status(201).json({
      success: true,
      message: 'Created topup payment',
      data: {
        paymentId: payment.paymentId,
        orderCode,
        amount: missing,
        checkoutUrl: resp.checkoutUrl,
        qrCode: resp.qrCode || null
      }
    });
  } catch (err) {
    console.error('topupToDefault error', err?.message || err);
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
}

module.exports = { topupToDefault };
