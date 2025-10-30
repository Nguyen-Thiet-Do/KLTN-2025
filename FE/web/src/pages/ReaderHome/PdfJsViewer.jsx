// src/pages/ReaderHome/PdfJsViewer.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    AppBar,
    Toolbar,
    IconButton,
    Typography,
    Box,
    LinearProgress,
    Tooltip,
    Stack,
    Paper,
    Alert,
    TextField,
} from "@mui/material";
import {
    ArrowBack as ArrowBackIcon,
    ZoomIn as ZoomInIcon,
    ZoomOut as ZoomOutIcon,
    FitScreen as FitScreenIcon,
    Refresh as RefreshIcon,
    OpenInNew as OpenInNewIcon,
    Download as DownloadIcon,
    NavigateBefore as PrevIcon,
    NavigateNext as NextIcon,
    Fullscreen as FullscreenIcon,
} from "@mui/icons-material";
import { documentApi } from "../../services/documentApi";

// --------- PDF.js setup (Vite-friendly) ----------
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

// Nếu dùng CRA cũ, thử (một trong hai cách):
// import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.js";
// pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default function PdfJsViewer() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [fileUrl, setFileUrl] = useState(null);
    const [loadingMeta, setLoadingMeta] = useState(true);
    const [error, setError] = useState("");

    // PDF.js document & page state
    const pdfDocRef = useRef(null);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [pageNum, setPageNum] = useState(1);
    const [pageCount, setPageCount] = useState(1);
    const [scale, setScale] = useState(1);      // zoom thủ công
    const [fitWidth, setFitWidth] = useState(true); // vừa khít chiều ngang

    const [rendering, setRendering] = useState(false);

    // Lấy URL file từ API metadata
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

    // Tải metadata mỗi khi id đổi
    useEffect(() => {
        setPageNum(1);
        setScale(1);
        setFitWidth(true);
        fetchUrl();
    }, [id, fetchUrl]);

    // Tải tài liệu PDF khi có fileUrl
    useEffect(() => {
        let cancelled = false;

        async function loadPdf() {
            if (!fileUrl) return;
            try {
                // Cho phép range requests tối ưu
                const loadingTask = pdfjsLib.getDocument({
                    url: fileUrl,
                    withCredentials: true, // nếu BE bật Access-Control-Allow-Credentials
                });
                const pdf = await loadingTask.promise;
                if (cancelled) return;

                pdfDocRef.current = pdf;
                setPageCount(pdf.numPages);
                setPageNum(1); // về trang đầu khi đổi file
            } catch (e) {
                if (!cancelled) setError(e?.message || "Không tải được PDF");
            }
        }
        loadPdf();

        return () => {
            cancelled = true;
            pdfDocRef.current = null;
        };
    }, [fileUrl]);

    // Hàm render 1 trang
    const renderPage = useCallback(async (num) => {
        const pdf = pdfDocRef.current;
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!pdf || !canvas || !container) return;

        setRendering(true);
        try {
            const page = await pdf.getPage(num);

            // Tính viewport theo fit mode
            const unscaledViewport = page.getViewport({ scale: 1 });

            let targetScale = scale;
            if (fitWidth) {
                // Vừa khít chiều ngang container (trừ padding nhỏ)
                const padding = 16;
                const containerWidth = container.clientWidth - padding * 2;
                targetScale = Math.max(0.1, containerWidth / unscaledViewport.width);
            }

            const viewport = page.getViewport({ scale: targetScale });

            const context = canvas.getContext("2d");
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);

            const renderContext = {
                canvasContext: context,
                viewport,
            };

            await page.render(renderContext).promise;
        } catch (e) {
            setError(e?.message || "Lỗi khi render trang");
        } finally {
            setRendering(false);
        }
    }, [fitWidth, scale]);

    // Render khi thay đổi pageNum / fit / scale / pdfDoc
    useEffect(() => {
        if (!pdfDocRef.current) return;
        renderPage(pageNum);
    }, [pageNum, renderPage]);

    // Render lại khi thay đổi kích thước cửa sổ, nếu đang fitWidth
    useEffect(() => {
        if (!fitWidth) return;
        const handler = () => renderPage(pageNum);
        window.addEventListener("resize", handler);
        return () => window.removeEventListener("resize", handler);
    }, [fitWidth, pageNum, renderPage]);

    // Điều khiển
    const gotoPrev = () => setPageNum((p) => Math.max(1, p - 1));
    const gotoNext = () => setPageNum((p) => Math.min(pageCount, p + 1));
    const onEnterPage = (e) => {
        const v = Number(e.target.value);
        if (!Number.isNaN(v) && v >= 1 && v <= pageCount) setPageNum(v);
    };

    const zoomIn = () => {
        setFitWidth(false);
        setScale((s) => Math.min(4, +(s + 0.1).toFixed(2)));
    };
    const zoomOut = () => {
        setFitWidth(false);
        setScale((s) => Math.max(0.25, +(s - 0.1).toFixed(2)));
    };
    const fitToWidth = () => setFitWidth(true);
    const refresh = () => renderPage(pageNum);

    const openNewTab = () => {
        if (fileUrl) window.open(fileUrl, "_blank", "noopener,noreferrer");
    };
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

    return (
        <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", bgcolor: "#0b1020" }}>
            <AppBar position="static" elevation={1} sx={{ bgcolor: "#0f172a" }}>
                <Toolbar variant="dense" sx={{ gap: 1 }}>
                    <Tooltip title="Quay lại">
                        <IconButton edge="start" color="inherit" onClick={() => navigate(-1)}>
                            <ArrowBackIcon />
                        </IconButton>
                    </Tooltip>

                    <Typography variant="subtitle1" sx={{ flex: 1, ml: 1, fontWeight: 700 }}>
                        Trình đọc PDF (PDF.js)
                    </Typography>

                    <Stack direction="row" alignItems="center" spacing={0.75}>
                        <Tooltip title="Trang trước">
                            <span>
                                <IconButton color="inherit" onClick={gotoPrev} disabled={!pdfDocRef.current || pageNum <= 1}>
                                    <PrevIcon />
                                </IconButton>
                            </span>
                        </Tooltip>

                        <TextField
                            size="small"
                            value={pageNum}
                            onChange={onEnterPage}
                            inputProps={{ inputMode: "numeric", pattern: "[0-9]*", style: { width: 52, textAlign: "center" } }}
                            sx={{
                                "& input": { color: "#e2e8f0", textAlign: "center", p: "6px 8px" },
                                "& fieldset": { borderColor: "rgba(148,163,184,0.35)" },
                                minWidth: 64,
                            }}
                        />
                        <Typography variant="body2" sx={{ color: "#cbd5e1", minWidth: 70, textAlign: "left" }}>
                            / {pageCount}
                        </Typography>

                        <Tooltip title="Trang sau">
                            <span>
                                <IconButton color="inherit" onClick={gotoNext} disabled={!pdfDocRef.current || pageNum >= pageCount}>
                                    <NextIcon />
                                </IconButton>
                            </span>
                        </Tooltip>

                        <Box sx={{ width: 8 }} />

                        <Tooltip title="Phóng to">
                            <span>
                                <IconButton color="inherit" onClick={zoomIn} disabled={!pdfDocRef.current}>
                                    <ZoomInIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Thu nhỏ">
                            <span>
                                <IconButton color="inherit" onClick={zoomOut} disabled={!pdfDocRef.current}>
                                    <ZoomOutIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Vừa khít chiều ngang">
                            <span>
                                <IconButton color="inherit" onClick={fitToWidth} disabled={!pdfDocRef.current}>
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
                        <Tooltip title="Làm mới trang hiện tại">
                            <IconButton color="inherit" onClick={refresh} disabled={!pdfDocRef.current}>
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </Toolbar>
                {(loadingMeta || rendering) && <LinearProgress />}
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
                <Box ref={containerRef} sx={{ flex: 1, position: "relative", overflow: "auto", p: 2 }}>
                    <Paper
                        elevation={0}
                        sx={{
                            mx: "auto",
                            width: "min(100%, 1200px)",
                            background: "transparent",
                        }}
                    >
                        <canvas
                            ref={canvasRef}
                            style={{
                                display: "block",
                                width: "100%",   // quan trọng để fit ngang
                                height: "auto",
                                backgroundColor: "#0b1020",
                                borderRadius: 8,
                                boxShadow: "0 0 0 1px rgba(255,255,255,0.06)",
                            }}
                        />
                    </Paper>
                </Box>
            )}
        </Box>
    );
}
