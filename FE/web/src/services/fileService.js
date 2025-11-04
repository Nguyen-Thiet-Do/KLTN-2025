// src/services/fileService.js
import api from "./api";

/** Upload ảnh bìa -> trả {key,url} (url = coverUrl từ BE) */
export async function uploadCover(file, onProgress) {
    if (!file) throw new Error("Chưa chọn ảnh bìa");
    const fd = new FormData();
    fd.append("cover", file);

    const { data } = await api.post("/files/upload/cover", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
            if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
        },
    });

    if (!data?.ok || !data.coverUrl) throw new Error("Upload cover thất bại");
    return { key: data.key, url: data.coverUrl };
}

/** Upload ebook (PDF/EPUB) -> trả {key,url} (url = ebookViewUrl từ BE) */
export async function uploadEbook(file, onProgress) {
    if (!file) throw new Error("Chưa chọn ebook");
    const name = (file.name || "").toLowerCase();
    const typeOk = ["application/pdf", "application/epub+zip"].includes(file.type);
    const extOk = name.endsWith(".pdf") || name.endsWith(".epub");
    if (!typeOk && !extOk) throw new Error("Ebook chỉ hỗ trợ PDF hoặc EPUB.");

    const fd = new FormData();
    fd.append("ebook", file);

    const { data } = await api.post("/files/upload/ebook", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
            if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
        },
    });

    if (!data?.ok || !data.ebookViewUrl) throw new Error("Upload ebook thất bại");
    return { key: data.key, url: data.ebookViewUrl };
}
