// services/documentApi.js
import api from "./api";

// Helper gọn để truyền params
const withParams = (params) => ({ params });

/**
 * Document API (chuẩn hoá, dùng chung instance `api`)
 * - Tự kế thừa interceptor gắn Authorization + refresh token từ services/api.js
 * - Không tạo thêm axios instance
 * - Thống nhất tham số & mặc định
 */
export const documentApi = {
  // 📘 Danh sách tài liệu (trang chủ)
  list: ({ page = 1, limit = 12, search = "", type = "all" } = {}) =>
    api.get("/documents/reader", withParams({ page, limit, search, type })),

  // 🎯 Lọc theo thể loại (sidebar)
  byGenre: ({
    page = 1,
    limit = 12,
    search = "",
    type = "all",
    genreIds = [],
    match = "any",
  } = {}) => {
    const genreParam = Array.isArray(genreIds) ? genreIds.join(",") : (genreIds ?? "");
    return api.get("/documents/reader/by-genre", withParams({
      page,
      limit,
      search,
      type,
      genreIds: genreParam,
      match,
    }));
  },

  // 🔍 Tìm kiếm tài liệu
  search: ({ page = 1, limit = 12, q = "", type = "all" } = {}) =>
    api.get("/documents/reader/search", withParams({ page, limit, q, type })),

  // 📄 Chi tiết 1 tài liệu
  detail: (id) => api.get(`/documents/reader/${id}`),

  // 🗂️ Danh mục thể loại
  genres: () => api.get("/documents/genres"),

  // 📖 Lấy URL ebook
  ebookUrl: (id) => api.get(`/documents/ebook/${id}`),
};

export default documentApi;
