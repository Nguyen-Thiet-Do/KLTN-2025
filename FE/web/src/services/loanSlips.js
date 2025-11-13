// src/services/loanSlips.js
import api from "./api";

/**
 * Lấy danh sách phiếu mượn cho Admin/Thủ thư
 * @param {object} params
 */
export async function fetchLoanSlips(params = {}) {
    const res = await api.get("/loans/admin/loans", { params });
    return res?.data ?? { success: false, pagination: null, data: [] };
}

/**
 * Dùng cho tab PENDING để lấy tiêu đề tài liệu từ id
 */
export async function getDocumentDetail(documentId) {
    const res = await api.get(`/documents/reader/${documentId}`);
    const data = res?.data?.data ?? res?.data ?? null;
    return data;
}

export async function createLoanSlip(payload) {
    const res = await api.post("/loans/admin/loans", payload);
    return res?.data ?? null;
}

/**
 * NOTE: payment-related APIs removed from client since deposit/payment flow is disabled.
 * keep getCopyWithDeposit name for compatibility (server may still return some fields).
 */
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

/** Lấy bản sao AVAILABLE */
export async function fetchBorrowableCopies(documentId, { page = 1, limit = 50, q = "", exclude = [] } = {}) {
    const params = { page, limit };
    if (q) params.q = q;
    if (exclude?.length) params.exclude = exclude.join(",");
    const res = await api.get(`/loans/admin/documents/${documentId}/copies`, { params });
    return res?.data ?? { success: false, pagination: null, data: [] };
}

/** Duyệt đặt trước - không gửi deposits/createPayment nữa */
export async function approveReservation({
    loanSlipId,
    librarianId,
    dueDate,
    pricingMode = "AUTO_MIN",
    assignments = [],
}) {
    const payload = { librarianId, dueDate, pricingMode, assignments };
    const res = await api.post(`/loans/admin/reservations/${loanSlipId}/approve`, payload);
    return res?.data ?? { success: false };
}

/** TRẢ TỪNG QUYỂN */
export async function returnSingleItem(payload) {
    const res = await api.post("/loans/admin/items/return", payload);
    return res?.data ?? null;
}

/** TRẢ TOÀN BỘ PHIẾU */
export async function returnBulkItems(payload) {
    const res = await api.post(`/loans/admin/slips/${payload.loanSlipId}/return`, payload);
    return res?.data ?? null;
}
