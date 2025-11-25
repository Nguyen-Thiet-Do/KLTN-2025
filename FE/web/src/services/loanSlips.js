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


/**
 * Hủy phiếu đặt trước (PENDING)
 * DELETE /api/loans/admin/reservations/:loanSlipId
 * payload body: { librarianId: number, reason?: string }
 *
 * Important:
 * - axios.delete needs { data: {...} } to send request body
 * - we validate librarianId here to avoid sending empty body (which makes req.body undefined on BE)
 */
export async function cancelReservation(loanSlipId, { librarianId, reason } = {}) {
  if (!loanSlipId) throw new Error("loanSlipId is required");

  // Guard: librarianId must be provided (backend expects it)
  if (!librarianId) {
    throw new Error("Thiếu librarianId. Vui lòng đăng nhập hoặc cung cấp librarianId.");
  }

  try {
    const res = await api.delete(`/loans/admin/reservations/${loanSlipId}`, {
      data: { librarianId, reason }
    });
    return res?.data ?? { success: false };
  } catch (err) {
    // rethrow with server message (api interceptor already normalizes message into Error)
    // If err is Error instance from interceptor, rethrow
    throw err;
  }
}

/** Xác nhận độc giả đến lấy (PICKUP)
 * POST /api/loans/admin/slips/:loanSlipId/pickup
 * body: { librarianId, pickupDate?, dueDate?, items?, preserveLoanDate? }
 */
export async function pickupLoanSlip(loanSlipId, { librarianId, pickupDate, dueDate, items = [], preserveLoanDate = false } = {}) {
  if (!loanSlipId) throw new Error("loanSlipId is required");
  if (!librarianId) throw new Error("Thiếu librarianId.");
  const payload = { librarianId, preserveLoanDate };
  if (pickupDate) payload.pickupDate = pickupDate;
  if (dueDate) payload.dueDate = dueDate;
  if (items && Array.isArray(items) && items.length) payload.items = items;
  const res = await api.post(`/loans/admin/slips/${loanSlipId}/pickup`, payload);
  return res?.data ?? { success: false };
}

/** Xóa 1 tài liệu khỏi phiếu
 * DELETE /api/loans/admin/slips/:loanSlipId/details/:loanDetailId
 * body: { librarianId, reason? }
 * axios.delete needs { data: {...} }
 */
export async function deleteLoanDetail(loanSlipId, loanDetailId, { librarianId, reason } = {}) {
  if (!loanSlipId) throw new Error("loanSlipId is required");
  if (!loanDetailId) throw new Error("loanDetailId is required");
  if (!librarianId) throw new Error("Thiếu librarianId.");
  const res = await api.delete(`/loans/admin/slips/${loanSlipId}/details/${loanDetailId}`, {
    data: { librarianId, reason }
  });
  return res?.data ?? { success: false };
}

/** Hủy toàn bộ phiếu (trạng thái nào cũng nên có kiểm tra trên BE)
 * DELETE /api/loans/admin/slips/:loanSlipId
 * body: { librarianId, reason? }
 */
export async function cancelLoanSlip(loanSlipId, { librarianId, reason } = {}) {
  if (!loanSlipId) throw new Error("loanSlipId is required");
  if (!librarianId) throw new Error("Thiếu librarianId.");
  const res = await api.delete(`/loans/admin/slips/${loanSlipId}`, {
    data: { librarianId, reason }
  });
  return res?.data ?? { success: false };
}
