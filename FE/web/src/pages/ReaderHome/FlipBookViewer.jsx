// src/pages/ReaderHome/FlipBookViewer.jsx
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    AppBar,
    Toolbar,
    IconButton,
    Typography,
    Box,
    LinearProgress,
    Tooltip,
    Stack,
    Alert,
    useMediaQuery,
} from "@mui/material";
import {
    ArrowBack as ArrowBackIcon,
    NavigateBefore as PrevIcon,
    NavigateNext as NextIcon,
    ZoomIn as ZoomInIcon,
    ZoomOut as ZoomOutIcon,
    OpenInNew as OpenInNewIcon,
    Download as DownloadIcon,
    Fullscreen as FullscreenIcon,
    FitScreen as FitScreenIcon,
    AutoStories as BookIcon,
} from "@mui/icons-material";
import { documentApi } from "../../services/documentApi";

// PDF.js v4 (ESM)
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

// PageFlip
import { PageFlip } from "page-flip";
// CSS của PageFlip: copy từ https://unpkg.com/page-flip/dist/page-flip.css
// import "../../styles/page-flip.css";

/**
 * Trình đọc flipbook (lazy):
 * - Tải URL PDF từ BE
 * - Dùng PDF.js render từng trang thành ảnh khi cần
 * - Tạo sẵn các trang trống để PageFlip khởi tạo ngay
 * - Khi lật trang sẽ tải trước trang kế tiếp
 */
export default function FlipBookViewer() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isSmall = useMediaQuery("(max-width: 900px)");

    const [fileUrl, setFileUrl] = useState(null);
    const [loadingMeta, setLoadingMeta] = useState(true);
    const [loadingRender, setLoadingRender] = useState(false);
    const [error, setError] = useState("");

    const containerRef = useRef(null);
    const flipRef = useRef(/** @type {import("page-flip").PageFlip | null} */(null));

    const pdfRef = useRef(/** @type {import("pdfjs-dist/types/src/display/api").PDFDocumentProxy | null} */(null));
    const pageCountRef = useRef(0);
    const pageSizeRef = useRef({ w: 1000, h: 1414 }); // tỉ lệ A-series
    const cacheRef = useRef(new Map()); // Map<number, {url,w,h}>
    const objectUrlsRef = useRef(/** @type {string[]} */([]));

    // Phóng to toàn flipbook
    const [zoom, setZoom] = useState(1);
    const scaledStyle = useMemo(() => ({
        transform: `scale(${zoom})`,
        transformOrigin: "center center",
        width: "100%",
        height: "100%",
    }), [zoom]);

    // Lấy URL PDF từ BE
    const fetchUrl = useCallback(async () => {
        setLoadingMeta(true);
        setError("");
        try {
            const { ebookUrl } = await documentApi.getEbookUrl(Number(id));
            if (!ebookUrl) throw new Error("Không lấy được URL ebook");
            setFileUrl(ebookUrl);
        } catch (e) {
            setError(e?.response?.data?.message || e?.message || "Không lấy được URL ebook");
            setFileUrl(null);
        } finally {
            setLoadingMeta(false);
        }
    }, [id]);

    useEffect(() => {
        setZoom(1);
        destroyFlip();
        clearCache();
        fetchUrl();
    }, [id, fetchUrl]);

    // Khởi tạo PDF + PageFlip với trang trống (placeholder)
    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (!fileUrl) return;

            setLoadingRender(true);
            try {
                const pdf = await pdfjsLib.getDocument({ url: fileUrl, withCredentials: true }).promise;
                if (cancelled) return;

                pdfRef.current = pdf;
                pageCountRef.current = pdf.numPages;

                // Render trang 1 để lấy kích thước chuẩn
                const firstImg = await renderPageToImage(1, { targetWidth: isSmall ? 800 : 1200 });
                cacheRef.current.set(1, firstImg);
                pageSizeRef.current = { w: firstImg.w, h: firstImg.h };

                // Khởi tạo flipbook với các trang placeholder ngay trong containerRef
                initFlipbookWithPlaceholders(firstImg);

                // Gán ảnh trang 1 ngay
                setPageBackground(1, firstImg);

                // Tải trước các trang gần kề
                preloadPage(2);
                preloadPage(3);
            } catch (e) {
                if (!cancelled) setError(e?.message || "Không thể tải PDF");
            } finally {
                if (!cancelled) setLoadingRender(false);
            }
        })();

        return () => { cancelled = true; };
    }, [fileUrl, isSmall]);

    // ---------- Helpers ----------
    function destroyFlip() {
        try { flipRef.current?.destroy(); } catch { }
        flipRef.current = null;
        if (containerRef.current) containerRef.current.innerHTML = "";
    }

    function clearCache() {
        cacheRef.current.forEach(v => URL.revokeObjectURL(v.url));
        cacheRef.current.clear();
        objectUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
        objectUrlsRef.current = [];
    }

    async function renderPageToImage(
        index,
        { pdf = pdfRef.current, targetWidth = isSmall ? 800 : 1200 }
    ) {
        if (!pdf) throw new Error("PDF chưa sẵn sàng");
        const page = await pdf.getPage(index);

        const v0 = page.getViewport({ scale: 1 });
        const width = Math.min(targetWidth, v0.width);
        const scale = width / v0.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        await page.render({ canvasContext: ctx, viewport }).promise;

        const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.8));
        const url = URL.createObjectURL(blob);
        objectUrlsRef.current.push(url);

        return { url, w: canvas.width, h: canvas.height };
    }

    // SỬA LỖI: dùng trực tiếp containerRef làm root cho PageFlip
    function initFlipbookWithPlaceholders(firstImg) {
        const total = pageCountRef.current;
        const { w, h } = pageSizeRef.current;

        const root = containerRef.current;
        root.innerHTML = "";
        root.className = "flipbook-root";
        root.style.width = "100%";
        root.style.height = "100%";
        root.style.display = "flex";
        root.style.justifyContent = "center";
        root.style.alignItems = "center";

        // Tạo trang placeholder trực tiếp dưới root
        for (let i = 1; i <= total; i++) {
            const page = document.createElement("div");
            page.className = "page";
            page.dataset.pageIndex = String(i);
            page.style.width = `${w}px`;
            page.style.height = `${h}px`;
            page.style.background =
                i === 1
                    ? `#0b1020 url(${firstImg.url}) center/cover no-repeat`
                    : "linear-gradient(135deg, #0b1020 0%, #111827 100%)";
            root.appendChild(page);
        }

        // Hủy instance cũ (nếu có) rồi khởi tạo mới trên root
        try { flipRef.current?.destroy(); } catch { }
        flipRef.current = null;

        const pf = new PageFlip(root, {
            width: w,
            height: h,
            size: "stretch",
            minWidth: 320,
            minHeight: 240,
            maxWidth: 3000,
            maxHeight: 3000,
            showCover: true,
            usePortrait: true,
            mobileScrollSupport: true,
            flippingTime: 600,
            drawShadow: true,
            startPage: 0,
        });

        pf.loadFromHTML(root.children);
        flipRef.current = pf;

        // Khi lật trang: tải trước trang kế
        pf.on("flip", (e) => {
            const currentBase1 = e.data + 1;
            preloadPage(currentBase1 + 1);
            preloadPage(currentBase1 + 2);
        });
    }

    // Đảm bảo trang đã có ảnh; nếu chưa thì render và gán vào nền
    async function preloadPage(index) {
        const total = pageCountRef.current;
        if (index < 1 || index > total) return;

        if (!cacheRef.current.has(index)) {
            try {
                const img = await renderPageToImage(index, {});
                cacheRef.current.set(index, img);
                setPageBackground(index, img);
            } catch { /* bỏ qua lỗi riêng từng trang */ }
        } else {
            const img = cacheRef.current.get(index);
            setPageBackground(index, img);
        }
    }

    function setPageBackground(index, img) {
        const el = containerRef.current?.querySelector(`.page[data-page-index="${index}"]`);
        if (el && img?.url) {
            el.style.background = `#0b1020 url(${img.url}) center/cover no-repeat`;
        }
    }

    // ---------- Điều khiển ----------
    const next = () => flipRef.current?.flipNext();
    const prev = () => flipRef.current?.flipPrev();
    const zoomIn = () => setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(2)));
    const zoomOut = () => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)));
    const fitToScreen = () => setZoom(1);

    const openNewTab = () => { if (fileUrl) window.open(fileUrl, "_blank", "noopener,noreferrer"); };
    const downloadFile = () => {
        if (!fileUrl) return;
        const a = document.createElement("a");
        a.href = fileUrl;
        a.download = "ebook.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
    };
    const requestFullscreen = () => {
        const el = containerRef.current;
        if (!el) return;
        if (document.fullscreenElement) {
            document.exitFullscreen?.();
        } else {
            el.requestFullscreen?.();
        }
    };

    // Dọn dẹp
    useEffect(() => () => {
        destroyFlip();
        clearCache();
    }, []);

    return (
        <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", bgcolor: "#0b1020" }}>
            <AppBar position="static" elevation={1} sx={{ bgcolor: "#0f172a" }}>
                <Toolbar variant="dense" sx={{ gap: 1 }}>
                    <Tooltip title="Quay lại">
                        <IconButton edge="start" color="inherit" onClick={() => navigate(-1)}>
                            <ArrowBackIcon />
                        </IconButton>
                    </Tooltip>

                    <Typography variant="subtitle1" sx={{ flex: 1, ml: 1, fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
                        <BookIcon fontSize="small" />
                        Trình đọc lật trang (Flipbook)
                    </Typography>

                    <Stack direction="row" alignItems="center" spacing={0.75}>
                        <Tooltip title="Trang trước">
                            <span>
                                <IconButton color="inherit" onClick={prev} disabled={!flipRef.current}>
                                    <PrevIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Trang sau">
                            <span>
                                <IconButton color="inherit" onClick={next} disabled={!flipRef.current}>
                                    <NextIcon />
                                </IconButton>
                            </span>
                        </Tooltip>

                        <Box sx={{ width: 8 }} />

                        <Tooltip title="Phóng to">
                            <span>
                                <IconButton color="inherit" onClick={zoomIn} disabled={!flipRef.current}>
                                    <ZoomInIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Thu nhỏ">
                            <span>
                                <IconButton color="inherit" onClick={zoomOut} disabled={!flipRef.current}>
                                    <ZoomOutIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Vừa khít">
                            <span>
                                <IconButton color="inherit" onClick={fitToScreen} disabled={!flipRef.current}>
                                    <FitScreenIcon />
                                </IconButton>
                            </span>
                        </Tooltip>

                        <Box sx={{ width: 8 }} />

                        <Tooltip title="Mở tab mới">
                            <span>
                                <IconButton color="inherit" onClick={openNewTab} disabled={!fileUrl}>
                                    <OpenInNewIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Tải xuống">
                            <span>
                                <IconButton color="inherit" onClick={downloadFile} disabled={!fileUrl}>
                                    <DownloadIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Toàn màn hình">
                            <IconButton color="inherit" onClick={requestFullscreen}>
                                <FullscreenIcon />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </Toolbar>

                {(loadingMeta || loadingRender) && <LinearProgress />}
            </AppBar>

            {error ? (
                <Box sx={{ p: 2 }}>
                    <Alert severity="error">{error}</Alert>
                </Box>
            ) : !fileUrl && !loadingMeta ? (
                <Box sx={{ p: 2 }}>
                    <Alert severity="warning">Không có URL PDF để hiển thị.</Alert>
                </Box>
            ) : (
                <Box sx={{ flex: 1, position: "relative", overflow: "hidden" }}>
                    <Box ref={containerRef} style={scaledStyle} className="flipbook-container" />
                </Box>
            )}
        </Box>
    );
}
