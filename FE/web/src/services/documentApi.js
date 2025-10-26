import axios from "axios";

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  timeout: 15000,
});


// Thêm token nếu đã đăng nhập
http.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const documentApi = {
  // 📘 Danh sách tài liệu (trang chủ)
  list: async ({ page = 1, limit = 12, search = "", type = "all" } = {}) =>
    http.get("/api/documents/reader", { params: { page, limit, search, type } }),

  // 🎯 Lọc theo thể loại (sidebar)
  byGenre: async ({
    page = 1,
    limit = 12,
    search = "",
    type = "all",
    genreIds = [],
    match = "any",
  } = {}) =>
    http.get("/api/documents/reader/by-genre", {
      params: {
        page,
        limit,
        search,
        type,
        genreIds: Array.isArray(genreIds)
          ? genreIds.join(",")
          : genreIds,
        match,
      },
    }),

  // 🔍 Tìm kiếm tài liệu
  search: async ({ page = 1, limit = 12, q = "", type = "all" } = {}) =>
    http.get("/api/documents/reader/search", { params: { page, limit, q, type } }),

  // 📄 Chi tiết 1 tài liệu
  detail: async (id) => http.get(`/api/documents/reader/${id}`),

  // 🗂️ Danh mục thể loại
  genres: async () => http.get("/api/documents/genres"),

  // 📖 Lấy URL ebook
  ebookUrl: async (id) => http.get(`/api/documents/ebook/${id}`),
};
