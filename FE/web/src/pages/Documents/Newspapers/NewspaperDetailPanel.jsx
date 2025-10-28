import { useEffect, useState, memo } from "react";
import {
  Box, Drawer, IconButton, Card, CardMedia, CardContent, Typography,
  Stack, Chip, Divider, Button, Skeleton, Tooltip, alpha,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import LayersIcon from "@mui/icons-material/Layers";
import BadgeIcon from "@mui/icons-material/Badge"; // dùng làm biểu tượng ISSN
import TodayIcon from "@mui/icons-material/Today";
import ZoomInMapIcon from "@mui/icons-material/ZoomInMap";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";
import { getNewspaperById } from "../../../services/newpaperService";

function formatVND(v) {
  if (v === null || v === undefined) return "—";
  try {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v);
  } catch { return `${v} đ`; }
}
const toDateVN = (s) => {
  if (!s) return "—";
  const d = new Date(s.replace(" ", "T"));
  return isNaN(d) ? s : d.toLocaleDateString("vi-VN");
};

const SoftChip = memo(function SoftChip({ label }) {
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        height: 26, borderRadius: 999, px: 1,
        bgcolor: (t) => t.palette.action.hover,
        borderColor: (t) => t.palette.divider,
      }}
      variant="outlined"
    />
  );
});

export default function NewspaperDetailPanel({ open, onClose, id, initialItem }) {
  const [item, setItem] = useState(initialItem || null);
  const [loading, setLoading] = useState(!initialItem);
  const [error, setError] = useState("");

  const [compactCover, setCompactCover] = useState(true);
  const MAX_H = compactCover ? "40vh" : "62vh";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!open) return;
      if (initialItem) {
        setItem(initialItem);
        setLoading(false);
      } else if (id) {
        setLoading(true);
        setError("");
        try {
          const data = await getNewspaperById(id);
          if (!cancelled) setItem(data);
        } catch (e) {
          if (!cancelled) setError(e.message || "Không tải được chi tiết báo.");
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open, id, initialItem]);

  const np = item?.newspaper;

  return (
    <Drawer
      anchor="right" open={open} onClose={onClose} keepMounted
      PaperProps={{ sx: { width: { xs: "100%", sm: 560 }, borderTopLeftRadius: { xs: 0, sm: 16 }, borderBottomLeftRadius: { xs: 0, sm: 16 }, overflow: "hidden" } }}
    >
      {/* Header */}
      <Box sx={{ p: 1.25, px: 2, display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 1, borderBottom: (t) => `1px solid ${t.palette.divider}`, position: "sticky", top: 0, bgcolor: "background.paper", zIndex: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
          <Typography variant="subtitle1" fontWeight={700}>Chi tiết</Typography>
        </Stack>

        <Tooltip title={compactCover ? "Phóng to ảnh bìa" : "Thu nhỏ ảnh bìa"}>
          <IconButton size="small" onClick={() => setCompactCover((v) => !v)}
            sx={{ bgcolor: (t) => alpha(t.palette.action.hover, 0.8), "&:hover": { bgcolor: (t) => t.palette.action.hover } }}>
            {compactCover ? <ZoomOutMapIcon fontSize="small" /> : <ZoomInMapIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Cover */}
      <Box sx={{ display: "grid", placeItems: "center", py: 1, px: 1.5, bgcolor: (t) => t.palette.background.default }}>
        {loading ? (
          <Skeleton variant="rectangular" height={compactCover ? 260 : 380} sx={{ width: "100%", borderRadius: 2 }} />
        ) : (
          <Tooltip title="Nhấp để thu/phóng" placement="left">
            <CardMedia
              component="img"
              image={item?.coverPhoto || "https://via.placeholder.com/800x1200?text=No+Cover"}
              alt={item?.title}
              onClick={() => setCompactCover((v) => !v)}
              loading="lazy"
              sx={{
                width: "100%", height: "auto", maxHeight: MAX_H, objectFit: "contain",
                borderRadius: 8, boxShadow: "0 10px 24px rgba(0,0,0,0.08)", cursor: "zoom-in",
              }}
            />
          </Tooltip>
        )}
      </Box>

      {/* Content */}
      <Box sx={{ p: 2, pt: 1 }}>
        <Card elevation={0} sx={{ borderRadius: 3, overflow: "hidden", border: (t) => `1px solid ${t.palette.divider}`, boxShadow: "0 10px 24px rgba(0,0,0,0.06)" }}>
          <CardContent sx={{ pb: 2.5 }}>
            {loading ? (
              <>
                <Skeleton width="85%" height={36} sx={{ mb: 1 }} />
                <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                  <Skeleton variant="rounded" width={70} height={26} />
                  <Skeleton variant="rounded" width={90} height={26} />
                  <Skeleton variant="rounded" width={100} height={26} />
                  <Skeleton variant="rounded" width={120} height={26} />
                </Stack>
                <Skeleton width="60%" /><Skeleton width="50%" />
                <Divider sx={{ my: 2 }} />
                <Skeleton variant="rounded" width={110} height={36} />
              </>
            ) : error ? (
              <Typography color="error">{error}</Typography>
            ) : (
              <>
                <Typography variant="h6" fontWeight={800} gutterBottom lineHeight={1.25}>
                  {item?.title}
                </Typography>

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
                  <SoftChip label={item?.category?.name || "Báo"} />
                  <SoftChip label={`Năm: ${item?.publicationYear || "—"}`} />
                  <SoftChip label={`Số bản: ${item?.numberOfCopy ?? 0}`} />
                  <SoftChip label={`ID: ${id}`} />
                </Stack>

                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  Nhà xuất bản: <b style={{ textTransform: "uppercase" }}>{item?.publisher?.name || "—"}</b>
                </Typography>

                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1.5, mb: 1 }}>
                  <Button disableElevation variant="contained" sx={{ borderRadius: 999, px: 2, fontWeight: 800, letterSpacing: 0.2, minWidth: 0 }}>
                    {formatVND(item?.coverPrice)}
                  </Button>

                  <Tooltip title={item?.ebookUrl ? "Mở eBook" : "Chưa có eBook"}>
                    <span>
                      <Button
                        disableElevation variant="outlined" endIcon={<OpenInNewIcon fontSize="small" />}
                        href={item?.ebookUrl || "#"} target="_blank" rel="noopener" disabled={!item?.ebookUrl}
                        sx={{ borderRadius: 999, px: 2, fontWeight: 700 }}
                      >
                        Mở eBook
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                  <LayersIcon fontSize="small" />
                  <Typography variant="body2">Số phát hành: {np?.issueNumber ?? "—"}</Typography>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                  <BadgeIcon fontSize="small" />
                  <Typography variant="body2">ISSN: {np?.issn || "—"}</Typography>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                  <TodayIcon fontSize="small" />
                  <Typography variant="body2">Ngày phát hành: {toDateVN(np?.issueDate)}</Typography>
                </Stack>

                <Divider sx={{ mt: 1.5 }} />
              </>
            )}
          </CardContent>
        </Card>
      </Box>
    </Drawer>
  );
}
