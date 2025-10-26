import { useEffect, useState, memo } from "react";
import {
  Box,
  Drawer,
  IconButton,
  Card,
  CardMedia,
  CardContent,
  Typography,
  Stack,
  Chip,
  Divider,
  Button,
  Skeleton,
  Tooltip,
  alpha,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import LayersIcon from "@mui/icons-material/Layers";
import ZoomInMapIcon from "@mui/icons-material/ZoomInMap";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";
import { getBookById } from "../../../services/bookService";

function formatVND(v) {
  if (v === null || v === undefined) return "—";
  try {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `${v} đ`;
  }
}
const authorNames = (authors = []) =>
  !authors?.length
    ? "Chưa cập nhật"
    : [...authors]
        .sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0))
        .map((a) => a.fullName)
        .join(", ");

const SoftChip = memo(function SoftChip({ label }) {
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        height: 26,
        borderRadius: 999,
        px: 1,
        bgcolor: (t) => t.palette.action.hover,
        borderColor: (t) => t.palette.divider,
      }}
      variant="outlined"
    />
  );
});

export default function BookDetailPanel({ open, onClose, id, initialBook }) {
  const [book, setBook] = useState(initialBook || null);
  const [loading, setLoading] = useState(!initialBook);
  const [error, setError] = useState("");

  // Chế độ hiển thị bìa: gọn (nhỏ) ↔ rộng (to hơn). Luôn giữ tỉ lệ.
  const [compactCover, setCompactCover] = useState(true); // true = nhỏ

  const MAX_H = compactCover ? "40vh" : "62vh"; // 2 mức, đủ dùng và không cần slider

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!open) return;
      if (initialBook) {
        setBook(initialBook);
        setLoading(false);
      } else if (id) {
        setLoading(true);
        setError("");
        try {
          const data = await getBookById(id);
          if (!cancelled) setBook(data);
        } catch (e) {
          if (!cancelled) setError(e.message || "Không tải được chi tiết sách.");
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [open, id, initialBook]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      keepMounted
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 560 },
          borderTopLeftRadius: { xs: 0, sm: 16 },
          borderBottomLeftRadius: { xs: 0, sm: 16 },
          overflow: "hidden",
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 1.25,
          px: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          borderBottom: (t) => `1px solid ${t.palette.divider}`,
          position: "sticky",
          top: 0,
          bgcolor: "background.paper",
          zIndex: 3,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
          <Typography variant="subtitle1" fontWeight={700}>Chi tiết</Typography>
        </Stack>

        {/* Nút đổi kích thước ảnh: 2 mức, giữ tỉ lệ */}
        <Tooltip title={compactCover ? "Phóng to ảnh bìa" : "Thu nhỏ ảnh bìa"}>
          <IconButton
            size="small"
            onClick={() => setCompactCover((v) => !v)}
            sx={{
              bgcolor: (t) => alpha(t.palette.action.hover, 0.8),
              "&:hover": { bgcolor: (t) => t.palette.action.hover },
            }}
          >
            {compactCover ? <ZoomOutMapIcon fontSize="small" /> : <ZoomInMapIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Ảnh bìa: luôn giữ tỉ lệ, không bao giờ vượt quá MAX_H */}
      <Box
        sx={{
          display: "grid",
          placeItems: "center",
          py: 1,
          px: 1.5,
          bgcolor: (t) => t.palette.background.default,
        }}
      >
        {loading ? (
          <Skeleton variant="rectangular" height={compactCover ? 260 : 380} sx={{ width: "100%", borderRadius: 2 }} />
        ) : (
          <Tooltip title="Nhấp để thu/phóng" placement="left">
            <CardMedia
              component="img"
              image={book?.coverPhoto || "https://via.placeholder.com/800x1200?text=No+Cover"}
              alt={book?.title}
              onClick={() => setCompactCover((v) => !v)}
              loading="lazy"
              sx={{
                width: "100%",        // chiếm full bề ngang drawer
                height: "auto",       // GIỮ TỈ LỆ
                maxHeight: MAX_H,     // không vượt quá khung → nhỏ gọn khi compact
                objectFit: "contain", // hiển thị đủ ảnh, không cắt
                borderRadius: 8,
                boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
                cursor: "zoom-in",
              }}
            />
          </Tooltip>
        )}
      </Box>

      {/* Nội dung */}
      <Box sx={{ p: 2, pt: 1 }}>
        <Card
          elevation={0}
          sx={{
            borderRadius: 3,
            overflow: "hidden",
            border: (t) => `1px solid ${t.palette.divider}`,
            boxShadow: "0 10px 24px rgba(0,0,0,0.06)",
          }}
        >
          <CardContent sx={{ pb: 2.5 }}>
            {loading ? (
              <>
                <Skeleton width="85%" height={36} sx={{ mb: 1 }} />
                <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                  <Skeleton variant="rounded" width={70} height={26} />
                  <Skeleton variant="rounded" width={90} height={26} />
                  <Skeleton variant="rounded" width={90} height={26} />
                  <Skeleton variant="rounded" width={90} height={26} />
                </Stack>
                <Skeleton width="70%" />
                <Skeleton width="55%" />
                <Divider sx={{ my: 2 }} />
                <Skeleton variant="rounded" width={110} height={36} />
              </>
            ) : error ? (
              <Typography color="error">{error}</Typography>
            ) : (
              <>
                <Typography variant="h6" fontWeight={800} gutterBottom lineHeight={1.25}>
                  {book?.title}
                </Typography>

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
                  <SoftChip label={book?.category?.name || "Sách"} />
                  <SoftChip label={`Năm: ${book?.publicationYear || "—"}`} />
                  <SoftChip label={`Số bản: ${book?.numberOfCopy ?? 0}`} />
                  <SoftChip label={`ID: ${id}`} />
                </Stack>

                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  Tác giả: <b>{authorNames(book?.authors)}</b>
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Nhà xuất bản: <b style={{ textTransform: "uppercase" }}>{book?.publisher?.name || "—"}</b>
                </Typography>

                <Divider sx={{ my: 1.5 }} />

                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: (book?.book?.edition || book?.book?.pageCount) ? 1.5 : 0 }}>
                  <Button disableElevation variant="contained" sx={{ borderRadius: 999, px: 2, fontWeight: 800, letterSpacing: 0.2, minWidth: 0 }}>
                    {formatVND(book?.coverPrice)}
                  </Button>

                  <Tooltip title={book?.ebookUrl ? "Mở eBook" : "Chưa có eBook"}>
                    <span>
                      <Button
                        disableElevation
                        variant="outlined"
                        endIcon={<OpenInNewIcon fontSize="small" />}
                        href={book?.ebookUrl || "#"}
                        target="_blank"
                        rel="noopener"
                        disabled={!book?.ebookUrl}
                        sx={{ borderRadius: 999, px: 2, fontWeight: 700 }}
                      >
                        Mở eBook
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>

                {!!book?.book?.edition && (
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                    <LayersIcon fontSize="small" />
                    <Typography variant="body2">Tái bản: {book.book.edition}</Typography>
                  </Stack>
                )}
                {!!book?.book?.pageCount && (
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    <MenuBookIcon fontSize="small" />
                    <Typography variant="body2">Số trang: {book.book.pageCount}</Typography>
                  </Stack>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </Box>
    </Drawer>
  );
}
