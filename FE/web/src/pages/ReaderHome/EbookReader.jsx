// src/pages/ReaderHome/EbookReader.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Stack, IconButton, Typography, Paper, Alert, Tooltip, Divider, Switch, FormControlLabel,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  MenuBook as BookIcon,
  PictureAsPdf as PdfIcon,
  Refresh as RefreshIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FitScreen as FitScreenIcon,
} from "@mui/icons-material";

import ReaderHeader from "../../components/layouts/ReaderHeader";
import ReaderFooter from "../../components/layouts/ReaderFooter";
import { documentApi } from "../../services/documentApi";
import ButtonLoader from "../../components/Loading/ButtonLoader";

// pdf.js worker (Vite)
import { GlobalWorkerOptions } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
GlobalWorkerOptions.workerSrc = workerSrc;

// EPUB
import { ReactReader } from "react-reader";

// PDF Flip mode
import PdfFlipBook from "../../components/reader/PdfFlipBook";

const isAbort = (e) =>
  e?.code === "ERR_CANCELED" ||
  e?.name === "CanceledError" ||
  e?.name === "AbortError" ||
  e?.message?.includes?.("canceled") ||
  e?.message?.includes?.("aborted");

function purgeEpubStorage() {
  try {
    const rm = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || "";
      const kk = k.toLowerCase();
      if (kk.includes("epub") || kk.includes("reactreader") || kk.includes("epubjs")) rm.push(k);
    }
    rm.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

export default function EbookReader() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [ebookUrl, setEbookUrl] = useState("");
  const [mime, setMime] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // EPUB: luôn từ đầu
  const [epubLocation, setEpubLocation] = useState(0);

  // PDF flip mode + zoom (mặc định KHÔNG lật trang)
  const [flipMode, setFlipMode] = useState(false);
  const [flipZoom, setFlipZoom] = useState(1);
  const zoomIn = () => setFlipZoom((z) => Math.min(2.5, Math.round((z + 0.1) * 100) / 100));
  const zoomOut = () => setFlipZoom((z) => Math.max(0.6, Math.round((z - 0.1) * 100) / 100));
  const zoomFit = () => setFlipZoom(1);

  // force re-mount
  const [mountKey, setMountKey] = useState(0);

  // Abort + chống race/StrictMode
  const abortRef = useRef(null);
  const loadIdRef = useRef(0); // ✅ token cho request hiện hành

  const newSignal = () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  };

  const detectFromUrl = (url) => {
    const u = url.split("?")[0].toLowerCase();
    if (u.endsWith(".pdf")) return "application/pdf";
    if (u.endsWith(".epub")) return "application/epub+zip";
    return "";
  };

  const headContentType = async (url, signal) => {
    try {
      const res = await fetch(url, { method: "HEAD", signal });
      return (res.headers.get("content-type") || "").toLowerCase();
    } catch {
      return "";
    }
  };

  const hardReset = () => {
    purgeEpubStorage();
    setEbookUrl("");
    setMime("");
    setEpubLocation(0);
    setFlipZoom(1);
    setMountKey((k) => k + 1);
  };

  const load = async () => {
    const myId = ++loadIdRef.current; // ✅ token
    setLoading(true);
    setError("");
    hardReset();
    const signal = newSignal();
    try {
      const { ebookUrl: url } = await documentApi.getEbookUrl(Number(id), { signal });
      if (!url) throw new Error("Không lấy được URL ebook");
      if (myId !== loadIdRef.current) return; // stale

      setEbookUrl(url);

      let ct = detectFromUrl(url);
      if (!ct) ct = await headContentType(url, signal);
      if (myId !== loadIdRef.current) return; // stale
      setMime(ct);
    } catch (e) {
      if (isAbort(e)) return; // ❌ bị huỷ: không tắt loading, không set lỗi
      if (myId === loadIdRef.current) {
        setError(e?.response?.data?.message || e?.message || "Không đọc được ebook");
      }
    } finally {
      if (myId === loadIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isPDF = useMemo(() => mime.includes("pdf") || /\.pdf(\?|$)/i.test(ebookUrl), [mime, ebookUrl]);
  const isEPUB = useMemo(() => mime.includes("epub") || /\.epub(\?|$)/i.test(ebookUrl), [mime, ebookUrl]);

  return (
    <>
      <ReaderHeader />
      <Box sx={{ px: { xs: 1, md: 2 }, py: 2, maxWidth: 1400, mx: "auto" }}>
        <Paper sx={{ p: 1.5, mb: 2, borderRadius: 3, display: "flex", alignItems: "center", gap: 1 }} elevation={0}>
          <Tooltip title="Quay lại">
            <IconButton onClick={() => navigate(-1)}><ArrowBackIcon /></IconButton>
          </Tooltip>

          <Divider flexItem orientation="vertical" sx={{ mx: 1 }} />

          {isPDF ? <PdfIcon /> : <BookIcon />}
          <Typography variant="h6" fontWeight={800}>Trình đọc Ebook</Typography>

          <Box sx={{ flex: 1 }} />

          {/* Toggle flip + Zoom controls (PDF only) */}
          {isPDF && (
            <Stack direction="row" spacing={1} alignItems="center">
              <FormControlLabel
                control={<Switch checked={flipMode} onChange={(e) => setFlipMode(e.target.checked)} />}
                label="Lật trang"
                sx={{ mr: 1 }}
              />
              {flipMode && (
                <>
                  <Tooltip title="Thu nhỏ">
                    <span><IconButton onClick={zoomOut} disabled={flipZoom <= 0.6}><ZoomOutIcon /></IconButton></span>
                  </Tooltip>
                  <Tooltip title="Vừa khung">
                    <IconButton onClick={zoomFit}><FitScreenIcon /></IconButton>
                  </Tooltip>
                  <Tooltip title="Phóng to">
                    <span><IconButton onClick={zoomIn} disabled={flipZoom >= 2.5}><ZoomInIcon /></IconButton></span>
                  </Tooltip>
                  <Typography variant="body2" sx={{ minWidth: 64, textAlign: "center", opacity: 0.7 }}>
                    {(flipZoom * 100).toFixed(0)}%
                  </Typography>
                </>
              )}
            </Stack>
          )}

          <Tooltip title="Làm mới link">
            <IconButton onClick={load}><RefreshIcon /></IconButton>
          </Tooltip>
        </Paper>

        {loading ? (
          // ✅ Chỉ hiển thị loader, không nhảy sang “không tìm thấy”
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <ButtonLoader size={56} />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : !ebookUrl ? (
          <Alert severity="warning">Không tìm thấy ebook.</Alert>
        ) : isPDF ? (
          flipMode ? (
            <PdfFlipBook
              key={`flip-${mountKey}-${ebookUrl}`}
              url={ebookUrl}
              zoom={flipZoom}
              containerHeight="calc(100vh - 220px)"
            />
          ) : (
            // Nếu tắt flip, xem nhanh bằng <embed>
            <Box sx={{ height: "calc(100vh - 220px)", borderRadius: 2, overflow: "hidden" }}>
              <embed src={ebookUrl} type="application/pdf" width="100%" height="100%" />
            </Box>
          )
        ) : isEPUB ? (
          <Box sx={{ height: "calc(100vh - 220px)", borderRadius: 2, overflow: "hidden" }}>
            <ReactReader
              key={`epub-${mountKey}-${ebookUrl}`}
              url={ebookUrl}
              location={epubLocation}
              locationChanged={setEpubLocation}
              getRendition={(rendition) => {
                try {
                  rendition.themes.default({ body: { background: "#ffffff" } });
                  rendition.themes.fontSize("105%");
                } catch {}
                setTimeout(() => { try { rendition.display(0); } catch {} }, 0);
              }}
            />
          </Box>
        ) : (
          <Alert severity="info">Không xác định được định dạng ebook. URL: <code>{ebookUrl}</code></Alert>
        )}
      </Box>
      <ReaderFooter maxContentWidth={1400} />
    </>
  );
}
