// src/pages/LibraryHome.jsx
import ReaderHeader from "../components/layouts/ReaderHeader";
import {
  Box, Container, Typography, Paper, Grid, Stack, Button, Chip
} from "@mui/material";
import ReaderFooter from "../components/layouts/ReaderFooter";

export default function LibraryHome() {
  return (
    <>
      <ReaderHeader />

      <Box sx={{ py: 6, background: (t) => t.palette.grey[50] }}>
        <Container maxWidth="lg">
          {/* Hero */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 5 },
              borderRadius: 3,
              background:
                "linear-gradient(135deg, rgba(59,130,246,.08), rgba(16,185,129,.08))",
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              alignItems={{ xs: "flex-start", md: "center" }}
              spacing={3}
              justifyContent="space-between"
            >
              <Box sx={{ maxWidth: 800 }}>
                <Chip
                  color="primary"
                  variant="outlined"
                  label="Book-Tech Library"
                  sx={{ mb: 1.5 }}
                />
                <Typography variant="h4" fontWeight={800} gutterBottom>
                  Chào mừng đến với Thư viện Book-Tech
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Kho tri thức số với hàng chục nghìn đầu sách, tạp chí, báo
                  và ebook. Đăng ký thẻ để mượn tài liệu, đọc online và theo
                  dõi tình trạng mượn trả hoàn toàn trực tuyến.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button variant="contained" size="large" onClick={() => (window.location.href = "/books")}>
                  Khám phá sách
                </Button>
                <Button variant="outlined" size="large" onClick={() => (window.location.href = "/signup")}>
                  Đăng ký thẻ
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {/* Stats */}
          <Grid container spacing={2} sx={{ mt: 3 }}>
            {[
              { k: "50.000+", v: "tài liệu" },
              { k: "120+", v: "thể loại" },
              { k: "24/7", v: "truy cập" },
              { k: "100%", v: "miễn phí đọc tại chỗ" },
            ].map((s) => (
              <Grid key={s.v} item xs={6} md={3}>
                <Paper elevation={1} sx={{ p: 2.5, textAlign: "center", borderRadius: 2 }}>
                  <Typography variant="h5" fontWeight={800}>{s.k}</Typography>
                  <Typography variant="body2" color="text.secondary">{s.v}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          {/* Thông tin thêm */}
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <Paper elevation={0} sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Dịch vụ nổi bật
                </Typography>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
                  <li>Mượn – trả sách nhanh với QR</li>
                  <li>Đặt chỗ trước và gia hạn trực tuyến</li>
                  <li>Đọc ebook trên mọi thiết bị</li>
                  <li>Không gian học tập yên tĩnh, wifi miễn phí</li>
                </ul>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper elevation={0} sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Liên hệ & Giờ mở cửa
                </Typography>
                <Typography variant="body2">
                  Địa chỉ: 123 Book-Tech, Q.1, TP.HCM
                  <br />
                  Điện thoại: (028) 1234 5678 – Email: support@booktech.vn
                  <br />
                  Thứ 2–6: 8:00–20:00 • Thứ 7–CN: 8:00–18:00
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <ReaderFooter maxContentWidth={1280} />
    </>
  );
}
