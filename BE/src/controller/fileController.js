const { uploadCover, uploadEbook, deleteObject } = require("../service/r2Service");
const { absApiUrl } = require("../utils/url");

// map key -> đường ổn định
const toCoverPath = (key) => `/files/covers/${key.split("/").pop()}`;
const toEbookViewPath = (key) => `/files/ebooks/${key.split("/").pop()}`;

// Upload cover: trả absolute URL public dùng ngay
async function uploadCoverCtrl(req, res, next) {
    try {
        const f = req.file;
        if (!f) throw new Error("Thiếu file 'cover'");
        const r = await uploadCover(f);               // { key }
        const coverPath = toCoverPath(r.key);
        const coverUrl = absApiUrl(req, coverPath);  // absolute URL cho FE
        // TODO: lưu r.key (và coverUrl nếu muốn) vào DB
        res.json({ ok: true, key: r.key, coverUrl });
    } catch (e) { next(e); }
}

// Upload ebook: trả absolute URL view (inline, hạn chế tải)
async function uploadEbookCtrl(req, res, next) {
    try {
        const f = req.file;
        if (!f) throw new Error("Thiếu file 'ebook'");
        const r = await uploadEbook(f);               // { key }
        const viewPath = toEbookViewPath(r.key);
        const ebookViewUrl = absApiUrl(req, viewPath);
        // TODO: lưu r.key (và ebookViewUrl nếu muốn) vào DB
        res.json({ ok: true, key: r.key, ebookViewUrl });
    } catch (e) { next(e); }
}

async function deleteObjectCtrl(req, res, next) {
    try {
        const { key } = req.body;
        if (!key) throw new Error("Thiếu 'key'");
        await deleteObject(key);
        res.json({ ok: true });
    } catch (e) { next(e); }
}

module.exports = { uploadCoverCtrl, uploadEbookCtrl, deleteObjectCtrl };
