// src/services/magazineService.js
import api from "./api";

/** Lấy 1 trang tạp chí từ BE (nếu cần xài server-side ở nơi khác) */
export async function getMagazinesPage({ page = 1, limit = 10 } = {}) {
    const { data } = await api.get("/documents/admin/magazines/basic", {
        params: { page, limit },
    });
    return data; // { items, currentPage, totalPages, totalItems, hasNextPage, ... }
}

/** Lấy toàn bộ tạp chí để phân trang client (chuyển trang không reload) */
export async function getAllMagazines({ pageSize = 100 } = {}) {
    let page = 1;
    const limit = pageSize;
    let all = [];

    while (true) {
        const res = await getMagazinesPage({ page, limit });
        all = all.concat(res.items || []);
        const lastPage = res.totalPages || 1;
        if (res.hasNextPage === false || page >= lastPage) break;
        page += 1;
    }
    return all; // mảng tạp chí đầy đủ
}

/** Lấy chi tiết tạp chí theo ID (dùng cho panel) */
export async function getMagazineById(id) {
    if (!id && id !== 0) throw new Error("Thiếu id tạp chí");
    const { data } = await api.get(`/documents/reader/magazines/${id}`);
    return data;
}

/** Lấy danh sách bản sao của một tạp chí */
export async function getMagazineCopies(id) {
    if (!id && id !== 0) throw new Error("Thiếu id tạp chí");
    const { data } = await api.get(`/documents/admin/${id}/copies`);
    // Kết quả mẫu:
    // { documentId, coverPrice, depositRate, copies: [...], summary: {minDeposit,maxDeposit,avgDeposit} }
    return data;
}

/**
 * Tạo tạp chí mới
 * payload: {
 *   title, language, publicationYear, coverPrice, description, shelfLocation, publisherName,
 *   authors: [{fullName, role, ord}], genres: [string],
 *   magazineData: { issn, issueNumber, releaseDate },
 *   initialCopies: [], initialCopiesCount: number,
 *   coverFile?, ebookFile?, coverUrl?, ebookViewUrl?
 * }
 */
export async function createMagazine(payload) {
    const hasFile = !!(payload.coverFile || payload.ebookFile);

    // Kiểm tra ebook nếu có: chấp nhận PDF hoặc EPUB
    if (payload.ebookFile) {
        const name = (payload.ebookFile.name || "").toLowerCase();
        const ok =
            ["application/pdf", "application/epub+zip"].includes(payload.ebookFile.type) ||
            name.endsWith(".pdf") ||
            name.endsWith(".epub");
        if (!ok) throw new Error("Ebook chỉ hỗ trợ PDF hoặc EPUB.");
    }

    if (hasFile) {
        // Multipart (ưu tiên khi có file)
        const fd = new FormData();
        const put = (k, v) => (v !== undefined && v !== null ? fd.append(k, v) : null);

        put("title", payload.title);
        put("language", payload.language);
        put("publicationYear", payload.publicationYear);
        put("coverPrice", payload.coverPrice);
        put("description", payload.description);
        put("shelfLocation", payload.shelfLocation);
        put("publisherName", payload.publisherName);

        // stringify mảng/obj
        put("authors", JSON.stringify(payload.authors || []));
        put("genres", JSON.stringify(payload.genres || []));
        put("magazineData", JSON.stringify(payload.magazineData || {}));
        put("initialCopies", JSON.stringify(payload.initialCopies || []));
        put("initialCopiesCount", payload.initialCopiesCount || 0);

        if (payload.coverFile) fd.append("cover", payload.coverFile);
        if (payload.ebookFile) fd.append("ebook", payload.ebookFile); // PDF/EPUB đều ok

        // Khi có file, BE bỏ qua coverUrl/ebookViewUrl nên không cần gửi
        const { data } = await api.post("/documents/admin/magazines", fd, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return data;
    } else {
        // JSON (không có file) → coverUrl là bắt buộc từ BE contract
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
            magazineData: payload.magazineData || {},
            initialCopies: payload.initialCopies || [],
            initialCopiesCount: payload.initialCopiesCount || 0,
            coverUrl: payload.coverUrl, // bắt buộc trong mode JSON
            ebookViewUrl: payload.ebookViewUrl || "",
        };

        // (Tuỳ chọn) kiểm tra đuôi URL ebook nếu có
        if (body.ebookViewUrl) {
            const url = body.ebookViewUrl.toLowerCase();
            const ok = url.endsWith(".pdf") || url.endsWith(".epub");
            if (!ok) throw new Error("URL ebook phải kết thúc bằng .pdf hoặc .epub");
        }

        const { data } = await api.post("/documents/admin/magazines", body);
        return data;
    }
}

/** Thêm nhiều bản sao cho 1 tạp chí */
export async function addMagazineCopies(documentId, copies = []) {
    if (!documentId) throw new Error("documentId là bắt buộc");
    if (!Array.isArray(copies)) throw new Error("copies phải là một mảng");

    // Chuẩn hoá nhẹ trước khi gửi
    const payload = copies.map((c) => ({
        barCode: c.barCode?.trim() || undefined, // để undefined cho BE tự sinh nếu trống
        status: (c.status || "available").toLowerCase(), // BE default 'available'
        conditionNote: c.conditionNote != null ? String(c.conditionNote) : "100",
        entryDate: c.entryDate || new Date().toISOString().slice(0, 10), // YYYY-MM-DD
    }));

    const { data } = await api.post(`/documents/admin/${documentId}/copies`, payload);
    return data; // { ok: true, createdCount, numberOfCopy } theo controller
}

/**
 * Cập nhật tạp chí (PUT /documents/admin/magazines/:id)
 * payload: chỉ gửi TRƯỜNG CẦN SỬA.
 * - Nếu có file: multipart (cover, ebook) + các field text
 * - Nếu không file: JSON
 * - authors / genres:
 *    - undefined: giữ nguyên
 *    - []       : xoá hết
 *    - array    : thay toàn bộ
 * - publisherName:
 *    - undefined: giữ nguyên
 *    - ""/null  : xoá
 */
export async function updateMagazine(id, payload = {}) {
    if (!id) throw new Error("Thiếu id");

    const hasFile = !!(payload.coverFile || payload.ebookFile);

    // Helper: append only when defined (and not undefined)
    const appendIfDef = (fd, k, v) => {
        if (v === undefined) return;
        if (v === null) return fd.append(k, ""); // cho phép clear bằng rỗng
        fd.append(k, v);
    };

    if (hasFile) {
        const fd = new FormData();
        appendIfDef(fd, "title", payload.title);
        appendIfDef(fd, "language", payload.language);
        appendIfDef(fd, "publicationYear", payload.publicationYear);
        appendIfDef(fd, "coverPrice", payload.coverPrice);
        appendIfDef(fd, "description", payload.description);
        appendIfDef(fd, "shelfLocation", payload.shelfLocation);
        appendIfDef(fd, "publisherName", payload.publisherName);

        if (payload.authors !== undefined) fd.append("authors", JSON.stringify(payload.authors || []));
        if (payload.genres !== undefined) fd.append("genres", JSON.stringify(payload.genres || []));
        if (payload.magazineData !== undefined) fd.append("magazineData", JSON.stringify(payload.magazineData || {}));

        if (payload.coverFile) fd.append("cover", payload.coverFile);
        if (payload.ebookFile) fd.append("ebook", payload.ebookFile);

        // Khi có file, BE bỏ qua coverUrl/ebookViewUrl nên khỏi gửi
        const { data } = await api.put(`/documents/admin/magazines/${id}`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return data;
    } else {
        // JSON – chỉ đưa keys có ý định sửa
        const body = {};
        const set = (k, v) => { if (v !== undefined) body[k] = v; };

        set("title", payload.title);
        set("language", payload.language);
        set("publicationYear", payload.publicationYear);
        set("coverPrice", payload.coverPrice);
        set("description", payload.description);
        set("shelfLocation", payload.shelfLocation);
        set("publisherName", payload.publisherName); // ""/null để xoá
        set("authors", payload.authors);             // undefined giữ nguyên; [] xoá; array thay
        set("genres", payload.genres);
        set("magazineData", payload.magazineData);   // phần subtype
        set("coverUrl", payload.coverUrl);           // ""/null để xoá
        set("ebookViewUrl", payload.ebookViewUrl);   // ""/null để xoá

        const { data } = await api.put(`/documents/admin/magazines/${id}`, body);
        return data; // { ok:true, data: <magazineMapped> }
    }
}

// ============================
// Soft Delete helpers (NEW) - mirror same behavior as bookService
// ============================
/**
 * Xoá mềm tài liệu theo ID
 * - cascadeSubtype: 0|1 (mặc định 1) — xoá subtype (Magazine)
 * - cascadeCopies : 0|1 (mặc định 0) — xoá toàn bộ bản sao (cần cẩn thận)
 * - cascadeMaps   : 0|1 (mặc định 0) — xoá liên kết tác giả/thể loại
 */
export async function deleteMagazine(documentId, { cascadeSubtype = 1, cascadeCopies = 0, cascadeMaps = 0 } = {}) {
    if (!documentId && documentId !== 0) throw new Error("Thiếu documentId");
    const params = { cascadeSubtype, cascadeCopies, cascadeMaps };
    const { data } = await api.delete(`/documents/admin/${documentId}`, { params });
    return data; // tuỳ BE: { success: true } hoặc entity đã xoá
}

/** Xoá mềm một bản sao theo ID */
export async function deleteCopy(copyId) {
    if (!copyId && copyId !== 0) throw new Error("Thiếu copyId");
    const { data } = await api.delete(`/documents/admin/copies/${copyId}`);
    return data; // tuỳ BE
}
