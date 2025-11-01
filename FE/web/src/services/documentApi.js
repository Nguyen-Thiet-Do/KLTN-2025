// src/services/documentApi.js
import api from "./api";

const withParams = (params, extra = {}) => ({ params, ...extra });
const normalizeList = (res) => ({
  items: res?.data?.data ?? [],
  pagination: res?.data?.pagination ?? null,
});

export const documentApi = {
  async fetchDocuments({
    type = "all",
    page = 1,
    limit,
    search = "",
    genreId = null,
    match = "any",
    signal,
  } = {}) {
    // ✅ mặc định 20 cho mọi trường hợp
    const finalLimit = limit ?? 20;

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

  // Raw helpers (cũng set mặc định 20)
  list: ({ page = 1, limit = 20, search = "", type = "all", signal } = {}) =>
    api.get("/documents/reader", withParams({ page, limit, search, type }, { signal })),

  byGenre: ({ page = 1, limit = 20, search = "", type = "all", genreIds = [], match = "any", signal } = {}) => {
    const genreParam = Array.isArray(genreIds) ? genreIds.join(",") : (genreIds ?? "");
    return api.get(
      "/documents/reader/by-genre",
      withParams({ page, limit, search, type, genreIds: genreParam, match }, { signal })
    );
  },

  // Genres
  genres: ({ signal } = {}) => api.get("/documents/genres", { signal }),

  // Detail / Similar / Ebook
  detail: (id, { signal } = {}) => api.get(`/documents/reader/${id}`, { signal }),
  similar: (id, { limit = 8, signal } = {}) =>
    api.get(`/documents/reader/${id}/similar`, withParams({ limit }, { signal })),

  // ⚠️ cache-buster tránh 304 rỗng body
  ebookUrl: (id, { signal } = {}) =>
    api.get(`/documents/ebook/${id}`, { params: { t: Date.now() }, signal }),

  // Aliases
  async getDocumentDetail(id, { signal } = {}) {
    const res = await this.detail(id, { signal });
    return res?.data?.data;
  },
  async getSimilarDocuments(id, { limit = 8, signal } = {}) {
    const res = await this.similar(id, { limit, signal });
    return { items: res?.data?.data ?? [] };
  },
  async getEbookUrl(id, { signal } = {}) {
    const res = await this.ebookUrl(id, { signal });
    return res?.data?.data ?? {};
  },
};

export default documentApi;
