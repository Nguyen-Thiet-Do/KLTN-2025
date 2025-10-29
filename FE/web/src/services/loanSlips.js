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