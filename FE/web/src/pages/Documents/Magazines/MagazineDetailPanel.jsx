// MagazineDetailPanel.jsx — panel hiện chi tiết (basing on BookDetailPanel.jsx)
import { useEffect, useState, memo } from "react";
import {
  Box, Drawer, IconButton, Card, CardMedia, CardContent, Typography, Stack, Chip, Divider, Tooltip, Skeleton
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { getMagazineById } from "../../../services/magazineService";

const SoftChip = memo(({ label }) => (
  <Chip label={label} size="small" sx={{ borderRadius: 999, px: 1 }} variant="outlined" />
));

export default function MagazineDetailPanel({ open, onClose, id, initialItem }) {
  const [item, setItem] = useState(initialItem || null);
  const [loading, setLoading] = useState(!initialItem);
  const [error, setError] = useState("");

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
          const data = await getMagazineById(id);
          if (!cancelled) setItem(data);
        } catch (e) {
          if (!cancelled) setError(e.message || "Không tải được chi tiết.");
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open, id, initialItem]);

  return (
    <Drawer anchor="right" open={open} onClose={onClose} keepMounted PaperProps={{ sx: { width: { xs: "100%", sm: 560 } } }}>
      <Box sx={{ p: 1, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: (t) => `1px solid ${t.palette.divider}` }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
          <Typography variant="subtitle1" fontWeight={700}>Chi tiết Tạp chí</Typography>
        </Stack>
        {item?.ebookViewUrl && <IconButton component="a" href={item.ebookViewUrl} target="_blank" rel="noopener"><OpenInNewIcon /></IconButton>}
      </Box>

      <Box sx={{ p: 2 }}>
        {loading ? (
          <>
            <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 2 }} />
            <Skeleton width="70%" sx={{ mt: 2 }} />
            <Skeleton width="50%" />
          </>
        ) : (
          <>
            <Card elevation={0} sx={{ mb: 2 }}>
              <CardMedia component="img" image={item?.coverPhoto || "https://via.placeholder.com/800x1200?text=No+Cover"} alt={item?.title} sx={{ maxHeight: 420, objectFit: "contain" }} />
            </Card>

            <CardContent sx={{ p: 0 }}>
              <Typography variant="h6" fontWeight={700}>{item?.title}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1, mb: 1 }}>
                <SoftChip label={item?.language || "—"} />
                <SoftChip label={`ISSN: ${item?.magazineData?.issn || "—"}`} />
                <SoftChip label={`Phát hành: ${item?.magazineData?.issueNumber || "—"}`} />
              </Stack>

              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-line", mb: 1 }}>
                {item?.description || "Chưa có mô tả."}
              </Typography>

              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2">Tác giả</Typography>
              <Typography variant="body2" color="text.secondary">{(item?.authors || []).map(a => a.fullName).join(", ") || "Chưa cập nhật"}</Typography>

              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2">Thông tin khác</Typography>
              <Typography variant="body2" color="text.secondary">Nhà xuất bản: {item?.publisher?.name || "—"}</Typography>
              <Typography variant="body2" color="text.secondary">Số bản: {item?.numberOfCopy ?? 0}</Typography>
            </CardContent>
          </>
        )}
      </Box>
    </Drawer>
  );
}
