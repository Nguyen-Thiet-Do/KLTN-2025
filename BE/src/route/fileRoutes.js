// src/routes/files.js (ví dụ)
const express = require("express");
const { upload } = require("../middleware/upload");
const { uploadCoverCtrl, uploadEbookCtrl, deleteObjectCtrl } = require("../controller/fileController");
const { getObject } = require("../service/r2Service");

const router = express.Router();

/** Upload */
router.post("/upload/cover", upload.single("cover"), uploadCoverCtrl);
router.post("/upload/ebook", upload.single("ebook"), uploadEbookCtrl);

/** Proxy stream: URL ổn định cho FE, không hết hạn */

// Ảnh bìa (public): cache dài
router.get("/covers/:file", async (req, res) => {
  const key = `covers/${req.params.file}`;
  try {
    const range = req.headers.range;
    const obj = await getObject({ key, range });

    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Accept-Ranges", "bytes");
    if (obj.ContentType) res.setHeader("Content-Type", obj.ContentType);
    if (obj.ContentLength) res.setHeader("Content-Length", String(obj.ContentLength));
    if (obj.ETag) res.setHeader("ETag", obj.ETag.replace(/"/g, ""));
    if (obj.LastModified) res.setHeader("Last-Modified", obj.LastModified.toUTCString());
    if (obj.ContentRange) res.setHeader("Content-Range", obj.ContentRange);

    res.status(range ? 206 : 200);
    obj.Body.pipe(res);
  } catch {
    res.status(404).json({ ok: false, message: "Cover not found" });
  }
});

// Ebook (view inline, hạn chế tải): không cache + Content-Disposition: inline
router.get("/ebooks/:file", async (req, res) => {
  const key = `ebooks/${req.params.file}`;
  try {
    const range = req.headers.range;
    const obj = await getObject({ key, range });

    res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Accept-Ranges", "bytes");
    if (obj.ContentType) res.setHeader("Content-Type", obj.ContentType);
    if (obj.ContentLength) res.setHeader("Content-Length", String(obj.ContentLength));
    if (obj.ETag) res.setHeader("ETag", obj.ETag.replace(/"/g, ""));
    if (obj.LastModified) res.setHeader("Last-Modified", obj.LastModified.toUTCString());
    if (obj.ContentRange) res.setHeader("Content-Range", obj.ContentRange);

    const filename = key.split("/").pop();
    // hiển thị inline => không gợi ý download
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(filename)}`);

    // BẢO MẬT & NHÚNG:
    // ❗ KHÔNG set X-Frame-Options (SAMEORIGIN sẽ chặn cross-origin). Dùng CSP: frame-ancestors.
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");

    // Chỉ cho phép hai origin bên dưới được nhúng iframe:
    const ALLOWED_ANCESTORS = [
      "'self'",
      "http://localhost:3000",
      "https://booktechv2.netlify.app",
    ].join(" ");

    // Nếu bạn có thêm CSP toàn cục (helmet), đảm bảo không bị ghi đè.
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'none'; img-src 'self' data: blob:; media-src 'self' data: blob:; frame-ancestors ${ALLOWED_ANCESTORS};`
    );

    res.status(range ? 206 : 200);
    obj.Body.pipe(res);
  } catch {
    res.status(404).json({ ok: false, message: "Ebook not found" });
  }
});

/** Xoá object */
router.delete("/object", deleteObjectCtrl);

module.exports = router;
