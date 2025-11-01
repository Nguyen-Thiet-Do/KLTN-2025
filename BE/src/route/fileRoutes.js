// src/routes/files.js
const express = require("express");
const { upload } = require("../middleware/upload");
const {
  uploadCoverCtrl,
  uploadEbookCtrl,
  deleteObjectCtrl
} = require("../controller/fileController");
const { getObject } = require("../service/r2Service");

const router = express.Router();

/** ========== CORS chọn lọc cho tài nguyên nhị phân (covers / ebooks) ========== */

const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "https://booktechv2.netlify.app",
]);

function allowCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    // Cho phép front-end đọc các header cần thiết khi fetch stream
    res.setHeader(
      "Access-Control-Expose-Headers",
      [
        "Content-Length",
        "Content-Range",
        "ETag",
        "Last-Modified",
        "Accept-Ranges",
        "Content-Type",
        "Cache-Control",
      ].join(", ")
    );
    // Tài nguyên này có thể được dùng cross-origin
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  }
}

// Preflight cho ebooks (có thể cần vì header Range không safelisted)
router.options("/ebooks/:file", (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      // Range và cache validators có thể gây preflight
      "Range, If-None-Match, If-Modified-Since, Content-Type"
    );
    res.setHeader("Access-Control-Max-Age", "86400"); // cache preflight 1 ngày
  }
  res.status(204).end();
});

// (Tuỳ chọn) Preflight cho covers nếu bạn fetch qua JS thay vì <img>
// router.options("/covers/:file", (req, res) => {
//   const origin = req.headers.origin;
//   if (origin && ALLOWED_ORIGINS.has(origin)) {
//     res.setHeader("Access-Control-Allow-Origin", origin);
//     res.setHeader("Vary", "Origin");
//     res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
//     res.setHeader("Access-Control-Allow-Headers", "Range, If-None-Match, If-Modified-Since");
//     res.setHeader("Access-Control-Max-Age", "86400");
//   }
//   res.status(204).end();
// });

/** ========================= Upload ========================= */
router.post("/upload/cover", upload.single("cover"), uploadCoverCtrl);
router.post("/upload/ebook", upload.single("ebook"), uploadEbookCtrl);

/** =================== Proxy stream: ổn định cho FE =================== */

// Ảnh bìa (public): cache dài
router.get("/covers/:file", async (req, res) => {
  const key = `covers/${req.params.file}`;
  try {
    const range = req.headers.range;
    const obj = await getObject({ key, range });

    // CORS (để fetch qua JS nếu cần). Với <img> tag thuần thì có thể không cần.
    allowCors(req, res);

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

// Ebook (view inline / cho viewer JS tải): không cache + ép MIME cho .epub + CORS
router.get("/ebooks/:file", async (req, res) => {
  const key = `ebooks/${req.params.file}`;
  try {
    const range = req.headers.range;
    const obj = await getObject({ key, range });

    // CORS trước để trình đọc/iframe có thể fetch file
    allowCors(req, res);

    // Không cache vì nội dung có thể cập nhật
    res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    res.setHeader("Accept-Ranges", "bytes");

    // Ép MIME đúng chuẩn cho .epub nếu SDK không trả
    const isEpub = /\.epub$/i.test(key);
    const contentType = isEpub
      ? "application/epub+zip"
      : (obj.ContentType || "application/octet-stream");
    res.setHeader("Content-Type", contentType);

    if (obj.ContentLength) res.setHeader("Content-Length", String(obj.ContentLength));
    if (obj.ETag) res.setHeader("ETag", obj.ETag.replace(/"/g, ""));
    if (obj.LastModified) res.setHeader("Last-Modified", obj.LastModified.toUTCString());
    if (obj.ContentRange) res.setHeader("Content-Range", obj.ContentRange);

    const filename = key.split("/").pop();
    // inline để không gợi ý download (trình duyệt vẫn cần viewer để hiển thị .epub)
    res.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(filename)}`
    );

    // BẢO MẬT cơ bản (KHÔNG đặt CSP frame-ancestors ở endpoint file này)
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");

    res.status(range ? 206 : 200);
    obj.Body.pipe(res);
  } catch {
    res.status(404).json({ ok: false, message: "Ebook not found" });
  }
});

/** ================ Xoá object ================ */
router.delete("/object", deleteObjectCtrl);

module.exports = router;
