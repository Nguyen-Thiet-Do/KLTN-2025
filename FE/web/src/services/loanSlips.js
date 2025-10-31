// src/services/loanSlips.js
import api from "./api";

/**
 * Lấy danh sách phiếu mượn cho Admin/Thủ thư
 * @param {{
 *  page?: number,
 *  limit?: number,
 *  status?: 'PENDING'|'OPEN'|'CLOSED'|'OVERDUE',
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
    // BE trả { success, pagination, data }
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
    // BE có thể trả {success, data} hoặc trả thẳng object
    const data = res?.data?.data ?? res?.data ?? null;
    return data;
}

export async function createLoanSlip(payload) {
    // payload: { readerId, librarianId, loanDate?, dueDate?, items:[{documentCopyId, depositAmount?, note?}], totalAmount? }
    const res = await api.post("/loans/admin/loans", payload);
    // BE trả về { loanSlip, items, payment }
    return res?.data ?? null;
}

export async function createLoanSlipPaymentQR({ loanSlipId, amount, description }) {
    const res = await api.post(`/loans/admin/loans/${loanSlipId}/payment/qr`, { amount, description });
    // BE trả { paymentId, amount, status, transactionCode, qr, qrPayloadExample }
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
    // BE trả { copy: {...}, document: {...} }
    return res?.data ?? null;
}