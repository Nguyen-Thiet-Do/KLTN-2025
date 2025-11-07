// src/services/loanSlips.js
import api from "./api";

/**
 * Lấy danh sách phiếu mượn cho Admin/Thủ thư
 * @param {{
 *  page?: number,
 *  limit?: number,
 *  status?: 'PENDING'|'PENDING_PAYMENT'|'BORROWING'|'RETURNED'|'OVERDUE',
 *  readerId?: number,
 *  librarianId?: number,
 *  fromDate?: string, // YYYY-MM-DD
 *  toDate?: string,   // YYYY-MM-DD
 *  sortBy?: string,   // loanDate | dueDate | created_at ...
 *  sortDir?: 'ASC'|'DESC'
 * }} params
 * @returns {Promise<{success:boolean, pagination: any, data: any[]}>}
 */
export async function fetchLoanSlips(params = {}) {
    const res = await api.get("/loans/admin/loans", { params });
    return res?.data ?? { success: false, pagination: null, data: [] };
}

/**
 * Dùng cho tab PENDING để lấy tiêu đề tài liệu từ id
 * (khi LoanDetail chưa gán DocumentCopy, chỉ có note có dạng REQUEST_DOCUMENT_ID=xxx)
 * @param {number|string} documentId
 * @returns {Promise<any>} // { documentId, title, ... }
 */
export async function getDocumentDetail(documentId) {
    const res = await api.get(`/documents/reader/${documentId}`);
    const data = res?.data?.data ?? res?.data ?? null;
    return data;
}

export async function createLoanSlip(payload) {
    // payload: { readerId, librarianId, loanDate?, dueDate?, items:[{documentCopyId, depositAmount?, note?}], totalAmount? }
    const res = await api.post("/loans/admin/loans", payload);
    return res?.data ?? null;
}

export async function createLoanSlipPaymentQR({ loanSlipId, amount, description }) {
    const res = await api.post(`/loans/admin/loans/${loanSlipId}/payment/qr`, { amount, description });
    return res?.data ?? null;
}

export async function confirmLoanSlipPaymentBySlip(loanSlipId, transactionCode) {
    const res = await api.patch(
        `/loans/admin/loans/${loanSlipId}/payment/confirm`,
        transactionCode ? { transactionCode } : {}
    );
    return res?.data ?? null;
}

export async function getCopyWithDeposit(copyId, {
    withDoc = 1,
    withAuthors = 1,
    withSubtype = 1,
} = {}) {
    const res = await api.get(
        `/documents/admin/copies/${copyId}`,
        { params: { withDoc, withAuthors, withSubtype } }
    );
    return res?.data ?? null;
}

/** NEW: Lấy danh sách bản sao AVAILABLE của 1 tài liệu (để chọn thủ công khi duyệt) */
export async function fetchBorrowableCopies(documentId, { page = 1, limit = 50, q = "", exclude = [] } = {}) {
    const params = { page, limit };
    if (q) params.q = q;
    if (exclude?.length) params.exclude = exclude.join(",");
    // BE route: /api/loans/admin/documents/:documentId/copies
    const res = await api.get(`/loans/admin/documents/${documentId}/copies`, { params });
    return res?.data ?? { success: false, pagination: null, data: [] };
}

/** NEW: Duyệt phiếu đặt trước -> WAITING_FOR_PICKUP (gửi assignments & deposits nếu có) */
export async function approveReservation({
    loanSlipId,
    librarianId,
    dueDate,
    pricingMode = "AUTO_MIN", // 'AUTO_MIN' | 'AUTO_MAX' | 'MANUAL'
    deposits = [],             // [{ loanDetailId, depositAmount }]
    assignments = [],          // [{ loanDetailId, documentCopyId }]
    createPayment = true,
}) {
    const payload = { librarianId, dueDate, pricingMode, deposits, assignments, createPayment };
    const res = await api.post(`/loans/admin/reservations/${loanSlipId}/approve`, payload);
    return res?.data ?? { success: false };
}
