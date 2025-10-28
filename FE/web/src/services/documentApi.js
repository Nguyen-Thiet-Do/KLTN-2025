// services/documentApi.js
import api from "./api";

// Gom params + hỗ trợ AbortController signal
const withParams = (params, extra = {}) => ({ params, ...extra });

// Chuẩn hoá dữ liệu danh sách
const normalizeList = (res) => ({
  items: res?.data?.data ?? [],
  pagination: res?.data?.pagination ?? null,
});

/**
 * API tổng hợp cho Reader:
 * - Nếu có genreId => gọi /documents/reader/by-genre
 * - Không có => gọi /documents/reader
 * - Tự join genreIds & map dữ liệu trả về
 */
export const documentApi = {
  async fetchDocuments({
    type = "all",
    page = 1,
    limit,            // optional; nếu không truyền sẽ auto chọn theo ngữ cảnh
    search = "",
    genreId = null,   // số | chuỗi | mảng
    match = "any",
    signal,
  } = {}) {
    const finalLimit = limit ?? (genreId ? 12 : 12000);

    if (genreId) {
      const genreParam = Array.isArray(genreId) ? genreId.join(",") : (genreId ?? "");
      const res = await api.get(
        "/documents/reader/by-genre",
        withParams({ page, limit: finalLimit, search, type, genreIds: genreParam, match }, { signal })
      );
      return normalizeList(res);
    }

    const res = await api.get(
      "/documents/reader",
      withParams({ page, limit: finalLimit, search, type }, { signal })
    );
    return normalizeList(res);
  },

  // (Raw) nếu muốn dùng riêng
  list: ({ page = 1, limit = 12000, search = "", type = "all", signal } = {}) =>
    api.get("/documents/reader", withParams({ page, limit, search, type }, { signal })),

  byGenre: ({
    page = 1,
    limit = 120000,
    search = "",
    type = "all",
    genreIds = [],
    match = "any",
    signal,
  } = {}) => {
    const genreParam = Array.isArray(genreIds) ? genreIds.join(",") : (genreIds ?? "");
    return api.get(
      "/documents/reader/by-genre",
      withParams({ page, limit, search, type, genreIds: genreParam, match }, { signal })
    );
  },

  detail: (id, { signal } = {}) => api.get(`/documents/reader/${id}`, { signal }),
  genres: ({ signal } = {}) => api.get("/documents/genres", { signal }),
  ebookUrl: (id, { signal } = {}) => api.get(`/documents/ebook/${id}`, { signal }),
};

export default documentApi;
