import {
  Box,
  Container,
  Grid,
  Typography,
  Link as MLink,
  IconButton,
  Divider,
  Stack,
} from "@mui/material";
import FacebookIcon from "@mui/icons-material/Facebook";
import YouTubeIcon from "@mui/icons-material/YouTube";
import GitHubIcon from "@mui/icons-material/GitHub";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import LocationOnIcon from "@mui/icons-material/LocationOn";

export default function ReaderFooter({
  maxContentWidth = 1280, // 0 = full-bleed hoàn toàn
}) {
  return (
    <Box
      component="footer"
      sx={{
        mt: 6,
        color: "text.secondary",
        borderTop: (t) => `1px solid ${t.palette.divider}`,
        bgcolor: "background.paper",
      }}
    >
      {/* Top */}
      <Box sx={{ py: { xs: 4, md: 6 } }}>
        <Box
          sx={{
            width: "100%",
            px: { xs: 2, sm: 3 },
            ...(maxContentWidth ? { maxWidth: maxContentWidth, mx: "auto" } : null),
          }}
        >
          <Grid container spacing={4}>
            {/* Brand + intro */}
            <Grid item xs={12} md={4}>
              <Stack spacing={1}>
                <Typography variant="h6" fontWeight={800}>
                  Thư Viện <Box component="span" sx={{ color: "primary.main" }}>Book-Tech</Box>
                </Typography>
                <Typography variant="body2">
                  Kho tri thức số: sách, tạp chí, báo và ebook. Mượn – trả nhanh,
                  đặt chỗ trước, đọc online mọi lúc mọi nơi.
                </Typography>

                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <IconButton aria-label="Facebook" size="small" LinkComponent={MLink} href="https://www.facebook.com/TiDii.Tw1/" target="_blank" rel="noopener">
                    <FacebookIcon fontSize="small" />
                  </IconButton>
                  <IconButton aria-label="YouTube" size="small">
                    <YouTubeIcon fontSize="small" />
                  </IconButton>
                  <IconButton aria-label="GitHub" size="small">
                    <GitHubIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
            </Grid>

            {/* Liên kết nhanh */}
            <Grid item xs={6} sm={4} md={2}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Liên kết
              </Typography>
              <Stack spacing={0.75}>
                <MLink href="/books" underline="hover" color="inherit">Sách</MLink>
                <MLink href="/newspapers" underline="hover" color="inherit">Báo</MLink>
                <MLink href="/magazines" underline="hover" color="inherit">Tạp chí</MLink>
                <MLink href="/search" underline="hover" color="inherit">Tìm kiếm</MLink>
              </Stack>
            </Grid>

            {/* Chính sách */}
            <Grid item xs={6} sm={4} md={3}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Chính sách
              </Typography>
              <Stack spacing={0.75}>
                <MLink href="/terms" underline="hover" color="inherit">Điều khoản sử dụng</MLink>
                <MLink href="/privacy" underline="hover" color="inherit">Bảo mật</MLink>
                <MLink href="/rules" underline="hover" color="inherit">Nội quy thư viện</MLink>
                <MLink href="/faq" underline="hover" color="inherit">FAQ</MLink>
              </Stack>
            </Grid>

            {/* Liên hệ */}
            <Grid item xs={12} sm={4} md={3}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Liên hệ
              </Typography>
              <Stack spacing={0.75}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <LocationOnIcon fontSize="small" />
                  <Typography variant="body2">123 Book-Tech, Q.1, TP.HCM</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <EmailIcon fontSize="small" />
                  <MLink href="mailto:support@booktech.vn" underline="hover" color="inherit">
                    support@booktech.vn
                  </MLink>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PhoneIphoneIcon fontSize="small" />
                  <MLink href="tel:+842812345678" underline="hover" color="inherit">
                    (028) 1234 5678
                  </MLink>
                </Stack>
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Box>

      <Divider />

      {/* Bottom */}
      <Box sx={{ py: 2 }}>
        <Box
          sx={{
            width: "100%",
            px: { xs: 2, sm: 3 },
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1,
            ...(maxContentWidth ? { maxWidth: maxContentWidth, mx: "auto" } : null),
          }}
        >
          <Typography variant="caption" color="text.secondary">
            © {new Date().getFullYear()} Book-Tech Library. All rights reserved.
          </Typography>
          <Stack direction="row" spacing={2}>
            <MLink href="/privacy" variant="caption" underline="hover" color="inherit">
              Bảo mật
            </MLink>
            <MLink href="/terms" variant="caption" underline="hover" color="inherit">
              Điều khoản
            </MLink>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
