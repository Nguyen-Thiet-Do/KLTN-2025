// src/services/bookService.js
import api from "./api";

/** Lấy 1 trang sách từ BE (nếu cần xài server-side ở nơi khác) */
export async function getBooksPage({ page = 1, limit = 10 } = {}) {
    const { data } = await api.get("/documents/admin/books/basic", {
        params: { page, limit },
    });
    return data; // { items, currentPage, totalPages, totalItems, hasNextPage, ... }
}

/** Lấy toàn bộ sách để phân trang client (chuyển trang không reload) */
export async function getAllBooks({ pageSize = 100 } = {}) {
    let page = 1;
    const limit = pageSize;
    let all = [];

    while (true) {
        const res = await getBooksPage({ page, limit });
        all = all.concat(res.items || []);
        const lastPage = res.totalPages || 1;
        if (res.hasNextPage === false || page >= lastPage) break;
        page += 1;
    }
    return all; // mảng sách đầy đủ
}

/** Lấy chi tiết sách theo ID (dùng cho panel) */
export async function getBookById(id) {
    // nếu endpoint khác, chỉ cần đổi URL dưới đây
    const { data } = await api.get(`/documents/admin/books/${id}`);
    return data;
}

export async function getBookCopies(id) {
    const { data } = await api.get(`/documents/admin/${id}/copies`);
    // Kết quả mẫu:
    // { documentId, coverPrice, depositRate, copies: [...], summary: {minDeposit,maxDeposit,avgDeposit}}
    return data;
}