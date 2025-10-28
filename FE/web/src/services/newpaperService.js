// NEWSPAPER SERVICE (giữ đúng tên file newpaperService.js để khớp screenshot)
import api from "./api";

/** Lấy 1 trang báo (server-side nếu cần) */
export async function getNewspapersPage({ page = 1, limit = 10 } = {}) {
  const { data } = await api.get("/documents/admin/newspapers/basic", {
    params: { page, limit },
  });
  return data; // { items, currentPage, totalPages, totalItems, hasNextPage, ... }
}

/** Lấy toàn bộ báo để phân trang client */
export async function getAllNewspapers({ pageSize = 100 } = {}) {
  let page = 1;
  const limit = pageSize;
  let all = [];
  while (true) {
    const res = await getNewspapersPage({ page, limit });
    all = all.concat(res.items || []);
    const lastPage = res.totalPages || 1;
    if (res.hasNextPage === false || page >= lastPage) break;
    page += 1;
  }
  return all;
}

/** Lấy chi tiết báo theo ID (dùng cho panel) */
export async function getNewspaperById(id) {
  // nếu BE khác đường dẫn, sửa lại URL dưới
  const { data } = await api.get(`/documents/admin/newspapers/${id}`);
  return data;
}

/** Lấy danh sách bản sao của tài liệu (dùng chung endpoint) */
export async function getNewspaperCopies(id) {
  const { data } = await api.get(`/documents/admin/${id}/copies`);
  return data; // { documentId, coverPrice, depositRate, copies:[...], summary:{...} }
}
