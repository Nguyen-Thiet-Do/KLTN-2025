import { useEffect, useMemo, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerSrc;

/**
 * Flipbook PDF (single-page), render -> ảnh sắc nét theo zoom.
 *
 * Props:
 *  - url: string (bắt buộc)
 *  - width: number (base width 1 trang, mặc định 800)
 *  - height: number (base height 1 trang, mặc định 1000)
 *  - autoScale: bool (tự scale theo viewport, mặc định true)
 *  - showCover: bool (mặc định false cho single page)
 *  - zoom: number (mặc định 1.0)  <-- thay đổi sẽ re-render ảnh với độ phân giải mới
 *  - qualityMultiplier: number (mặc định 1.2)  <-- tăng nhẹ độ nét (1.2–1.5)
 *  - maxCanvasDim: number (mặc định 4096)  <-- giới hạn chiều rộng/chiều cao canvas
 *  - containerHeight: CSS size, mặc định "calc(100vh - 220px)"
 *  - onReady: (numPages) => void
 */
export default function PdfFlipBook({
    url,
    width = 800,
    height = 1000,
    autoScale = true,
    showCover = false,
    zoom = 1,
    qualityMultiplier = 1.2,
    maxCanvasDim = 4096,
    containerHeight = "calc(100vh - 220px)",
    onReady,
}) {
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    const rerenderTimer = useRef(null);

    // Tính kích thước 1 trang (single page) theo viewport nếu autoScale
    const computed = useMemo(() => {
        if (!autoScale) return { w: width, h: height };
        // container làm 1 trang nên ta chọn max theo viewport
        const maxW = Math.min(1100, Math.floor(window.innerWidth * 0.9));   // 1 trang ~90% viewport
        const maxH = Math.min(1200, Math.floor(window.innerHeight * 0.78)); // chừa toolbars
        const ratio = width / height;
        let w = maxW;
        let h = Math.round(w / ratio);
        if (h > maxH) {
            h = maxH;
            w = Math.round(h * ratio);
        }
        return { w, h };
    }, [width, height, autoScale]);

    // Render PDF -> ảnh theo scale mục tiêu (sắc nét theo zoom)
    const renderPdfToImages = async ({ url, pageWidthCss, zoom }) => {
        const task = getDocument({ url });
        const pdf = await task.promise;

        const dpr = Math.max(1, window.devicePixelRatio || 1);
        // Single page: scale theo bề rộng 1 trang * dpr * zoom * quality
        const targetPixelWidth = pageWidthCss * dpr * Math.max(1, zoom) * qualityMultiplier;

        const imgs = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1 });

            // scale = targetPixelWidth / viewport.width
            let scale = targetPixelWidth / viewport.width;

            // Clamp canvas để tránh nặng
            let scaled = page.getViewport({ scale });
            if (scaled.width > maxCanvasDim) {
                scale = maxCanvasDim / viewport.width;
                scaled = page.getViewport({ scale });
            }
            if (scaled.height > maxCanvasDim) {
                scale = maxCanvasDim / viewport.height;
                scaled = page.getViewport({ scale });
            }

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d", { alpha: false });
            canvas.width = Math.ceil(scaled.width);
            canvas.height = Math.ceil(scaled.height);

            await page.render({ canvasContext: ctx, viewport: scaled }).promise;
            const dataUrl = canvas.toDataURL("image/jpeg", 0.93);
            imgs.push(dataUrl);

            ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        onReady?.(imgs.length);
        return imgs;
    };

    // Render lần đầu & khi URL/kích thước base đổi
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setErr("");
        setImages([]);

        (async () => {
            try {
                const imgs = await renderPdfToImages({
                    url,
                    pageWidthCss: computed.w,
                    zoom, // ngay lần đầu cũng theo zoom hiện tại
                });
                if (!cancelled) {
                    setImages(imgs);
                    setLoading(false);
                }
            } catch (e) {
                if (!cancelled) {
                    setErr(e?.message || "Không đọc được PDF");
                    setLoading(false);
                }
            }
        })();

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, computed.w, computed.h]);

    // Re-render khi zoom (debounce)
    useEffect(() => {
        if (!images.length) return; // chưa có ảnh thì chờ effect trên
        if (rerenderTimer.current) clearTimeout(rerenderTimer.current);
        rerenderTimer.current = setTimeout(async () => {
            setLoading(true);
            setErr("");
            try {
                const imgs = await renderPdfToImages({
                    url,
                    pageWidthCss: computed.w,
                    zoom,
                });
                setImages(imgs);
            } catch (e) {
                setErr(e?.message || "Lỗi khi render lại theo zoom");
            } finally {
                setLoading(false);
            }
        }, 250);
        return () => { if (rerenderTimer.current) clearTimeout(rerenderTimer.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoom]);

    if (err) return <div style={{ padding: 16, color: "#b91c1c" }}>{err}</div>;

    return (
        <div
            style={{
                width: "100%",
                height: containerHeight,
                overflow: "auto",
            }}
        >
            {loading && (
                <div style={{ padding: 12, textAlign: "center", opacity: 0.8 }}>
                    Đang kết xuất trang {(images.length ? "nét hơn…" : "…")}
                </div>
            )}

            {/* EP SINGLE-PAGE: ép width container ~ 1 trang để lib không chuyển qua 2 trang */}
            <div style={{ width: computed.w, margin: "0 auto" }}>
                {images.length > 0 && (
                    <HTMLFlipBook
                        width={computed.w}
                        height={computed.h}
                        size="fixed"               // giữ kích thước cố định 1 trang
                        autoSize={false}           // không stretch để tránh đủ chỗ cho 2 trang
                        showCover={false}          // single page: bỏ cover mode
                        usePortrait={true}         // luôn ưu tiên chế độ 1 trang
                        mobileScrollSupport
                        drawShadow
                        maxShadowOpacity={0.3}
                        flippingTime={650}
                        style={{ margin: "0 auto" }}
                        className="pdf-flipbook"
                    >
                        {images.map((img, idx) => (
                            <div key={idx} className="page" style={{ background: "#fff" }}>
                                <img
                                    src={img}
                                    alt={`Page ${idx + 1}`}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "contain",
                                        display: "block",
                                        imageRendering: "auto",
                                    }}
                                    draggable={false}
                                />
                            </div>
                        ))}
                    </HTMLFlipBook>
                )}
            </div>
        </div>
    );
}
