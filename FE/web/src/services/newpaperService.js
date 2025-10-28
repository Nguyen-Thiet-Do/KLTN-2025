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

/** Tạo Newspaper mới (multipart nếu có file, ngược lại JSON) */
export async function createNewspaper(payload) {
  const hasFile = !!(payload.coverFile || payload.ebookFile);

  if (hasFile) {
    const fd = new FormData();
    const put = (k, v) => (v !== undefined && v !== null ? fd.append(k, v) : null);

    put("title", payload.title);
    put("language", payload.language);
    put("publicationYear", payload.publicationYear);
    put("coverPrice", payload.coverPrice);
    put("description", payload.description);
    put("shelfLocation", payload.shelfLocation);
    put("publisherName", payload.publisherName);

    put("authors", JSON.stringify(payload.authors || []));   // [{fullName, role, ord}]
    put("genres", JSON.stringify(payload.genres || []));     // ["Kinh tế", ...]
    put("newspaperData", JSON.stringify(payload.newspaperData || {})); // {issn, issueDate, issueNumber}
    put("initialCopies", JSON.stringify(payload.initialCopies || []));
    put("initialCopiesCount", payload.initialCopiesCount || 0);

    if (payload.coverFile) fd.append("cover", payload.coverFile);
    if (payload.ebookFile) fd.append("ebook", payload.ebookFile);

    const { data } = await api.post("/documents/admin/newspapers", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  } else {
    const body = {
      title: payload.title,
      language: payload.language,
      publicationYear: payload.publicationYear,
      coverPrice: payload.coverPrice,
      description: payload.description,
      shelfLocation: payload.shelfLocation,
      publisherName: payload.publisherName,
      authors: payload.authors || [],
      genres: payload.genres || [],
      newspaperData: payload.newspaperData || {},
      initialCopies: payload.initialCopies || [],
      initialCopiesCount: payload.initialCopiesCount || 0,
      coverUrl: payload.coverUrl,
      ebookViewUrl: payload.ebookViewUrl || "",
    };
    const { data } = await api.post("/documents/admin/newspapers", body);
    return data;
  }
}
export async function addNewspaperCopies(documentId, copies = []) {
  if (!documentId) throw new Error("documentId là bắt buộc");
  if (!Array.isArray(copies)) throw new Error("copies phải là một mảng");

  const payload = copies.map(c => ({
    barCode: c.barCode?.trim() || undefined,                   // để undefined để BE tự sinh
    status: (c.status || "available").toLowerCase(),           // BE default 'available'
    conditionNote: c.conditionNote != null ? String(c.conditionNote) : "100",
    entryDate: c.entryDate || new Date().toISOString().slice(0, 10),
  }));

  const { data } = await api.post(`/documents/admin/${documentId}/copies`, payload);
  return data; // { ok: true, createdCount, numberOfCopy } theo controller
}