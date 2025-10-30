// src/pages/LibraryHome.jsx
import { useState, useEffect } from "react";
import ReaderHeader from "../components/layouts/ReaderHeader";
import {
  Box, Container, Typography, Paper, Grid, Stack, Button, Chip,
  Card, CardContent, alpha, useTheme
} from "@mui/material";
import { KeyboardArrowLeft, KeyboardArrowRight, PlayArrow, Pause } from "@mui/icons-material";
import ReaderFooter from "../components/layouts/ReaderFooter";

// Dữ liệu mẫu cho banner carousel
const bannerItems = [
  {
    id: 1,
    title: "Khám phá Thế giới Tri thức",
    subtitle: "Hơn 50.000 đầu sách đang chờ bạn khám phá",
    image: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1950&q=80",
    cta: "Xem ngay",
    color: "primary"
  },
  {
    id: 2,
    title: "Công nghệ Đọc mới",
    subtitle: "Trải nghiệm đọc sách số với các tính năng hiện đại",
    image: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1950&q=80",
    cta: "Khám phá",
    color: "secondary"
  },
  {
    id: 3,
    title: "Thư viện Thông minh",
    subtitle: "Mượn trả sách dễ dàng với công nghệ QR Code",
    image: "https://images.unsplash.com/photo-1589998059171-988d887df646?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1950&q=80",
    cta: "Tìm hiểu",
    color: "success"
  }
];

export default function LibraryHome() {
  const theme = useTheme();
  const [activeBanner, setActiveBanner] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  // Tự động chuyển banner
  useEffect(() => {
    if (!autoPlay) return;

    const interval = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % bannerItems.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [autoPlay]);

  const handleNext = () => {
    setActiveBanner((prev) => (prev + 1) % bannerItems.length);
  };

  const handlePrev = () => {
    setActiveBanner((prev) => (prev - 1 + bannerItems.length) % bannerItems.length);
  };

  const handleBannerClick = (index) => {
    setActiveBanner(index);
  };

  return (
    <>
      <ReaderHeader />

      {/* Hero Banner Carousel */}
      <Box sx={{ position: "relative", height: { xs: "400px", md: "500px" }, overflow: "hidden" }}>
        {bannerItems.map((item, index) => (
          <Box
            key={item.id}
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${item.image})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              opacity: index === activeBanner ? 1 : 0,
              transform: `translateX(${(index - activeBanner) * 100}%)`,
              transition: "all 0.5s ease-in-out",
              display: "flex",
              alignItems: "center",
              color: "white"
            }}
          >
            <Container maxWidth="lg">
              <Box sx={{ maxWidth: { xs: "100%", md: "60%" } }}>
                <Chip
                  label="Book-Tech Library"
                  sx={{
                    backgroundColor: alpha(theme.palette.primary.main, 0.9),
                    color: "white",
                    mb: 2,
                    fontWeight: 600
                  }}
                />
                <Typography
                  variant="h2"
                  fontWeight={800}
                  gutterBottom
                  sx={{
                    fontSize: { xs: "2rem", md: "3rem" },
                    textShadow: "2px 2px 4px rgba(0,0,0,0.5)"
                  }}
                >
                  {item.title}
                </Typography>
                <Typography
                  variant="h5"
                  sx={{
                    mb: 3,
                    textShadow: "1px 1px 2px rgba(0,0,0,0.5)"
                  }}
                >
                  {item.subtitle}
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  sx={{
                    px: 4,
                    py: 1.5,
                    fontSize: "1.1rem",
                    backgroundColor: theme.palette[item.color].main,
                    "&:hover": {
                      backgroundColor: theme.palette[item.color].dark,
                    }
                  }}
                  onClick={() => (window.location.href = "/books")}
                >
                  {item.cta}
                </Button>
              </Box>
            </Container>
          </Box>
        ))}

        {/* Banner Controls */}
        <Box sx={{
          position: "absolute",
          bottom: 20,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 2
        }}>
          {/* Play/Pause */}
          <Button
            variant="contained"
            size="small"
            onClick={() => setAutoPlay(!autoPlay)}
            sx={{
              minWidth: "auto",
              width: 40,
              height: 40,
              borderRadius: "50%",
              backgroundColor: alpha("#fff", 0.2),
              "&:hover": {
                backgroundColor: alpha("#fff", 0.3),
              }
            }}
          >
            {autoPlay ? <Pause /> : <PlayArrow />}
          </Button>

          {/* Dots Indicator */}
          <Stack direction="row" spacing={1}>
            {bannerItems.map((_, index) => (
              <Box
                key={index}
                onClick={() => handleBannerClick(index)}
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  backgroundColor: index === activeBanner ? "white" : alpha("#fff", 0.5),
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    backgroundColor: "white",
                    transform: "scale(1.2)"
                  }
                }}
              />
            ))}
          </Stack>

          {/* Navigation Arrows */}
          <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              onClick={handlePrev}
              sx={{
                minWidth: "auto",
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: alpha("#fff", 0.2),
                "&:hover": {
                  backgroundColor: alpha("#fff", 0.3),
                }
              }}
            >
              <KeyboardArrowLeft />
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleNext}
              sx={{
                minWidth: "auto",
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: alpha("#fff", 0.2),
                "&:hover": {
                  backgroundColor: alpha("#fff", 0.3),
                }
              }}
            >
              <KeyboardArrowRight />
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{ py: 6, background: (t) => t.palette.grey[50] }}>
        <Container maxWidth="lg">
          {/* Quick Stats */}
          <Grid container spacing={3} sx={{ mb: 6 }}>
            {[
              { k: "50.000+", v: "Đầu sách", icon: "📚" },
              { k: "120+", v: "Thể loại", icon: "🏷️" },
              { k: "24/7", v: "Truy cập", icon: "🌐" },
              { k: "100%", v: "Miễn phí", icon: "🎯" },
            ].map((s, index) => (
              <Grid key={s.v} item xs={6} md={3}>
                <Card
                  sx={{
                    textAlign: "center",
                    borderRadius: 3,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                    transition: "transform 0.3s ease, box-shadow 0.3s ease",
                    "&:hover": {
                      transform: "translateY(-8px)",
                      boxShadow: "0 8px 30px rgba(0,0,0,0.12)"
                    }
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h3" sx={{ mb: 1, opacity: 0.8 }}>
                      {s.icon}
                    </Typography>
                    <Typography variant="h4" fontWeight={800} color="primary.main" gutterBottom>
                      {s.k}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" fontWeight={500}>
                      {s.v}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Features Grid */}
          <Grid container spacing={4} sx={{ mb: 6 }}>
            <Grid item xs={12} md={6}>
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  borderRadius: 3,
                  background: "linear-gradient(135deg, rgba(59,130,246,.05), rgba(16,185,129,.05))",
                  height: "100%"
                }}
              >
                <Typography variant="h5" fontWeight={700} gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <span>🚀</span> Dịch vụ Nổi bật
                </Typography>
                <Stack spacing={2} sx={{ mt: 2 }}>
                  {[
                    "Mượn – trả sách nhanh với QR Code",
                    "Đặt chỗ trước và gia hạn trực tuyến",
                    "Đọc ebook trên mọi thiết bị",
                    "Không gian học tập yên tĩnh",
                    "Wifi miễn phí tốc độ cao",
                    "Hỗ trợ nghiên cứu chuyên sâu"
                  ].map((feature, index) => (
                    <Box key={index} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          backgroundColor: "primary.main"
                        }}
                      />
                      <Typography variant="body1">{feature}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  borderRadius: 3,
                  background: "linear-gradient(135deg, rgba(147,51,234,.05), rgba(219,39,119,.05))",
                  height: "100%"
                }}
              >
                <Typography variant="h5" fontWeight={700} gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <span>📞</span> Thông tin Liên hệ
                </Typography>
                <Box sx={{ mt: 3 }}>
                  <Typography variant="body1" paragraph>
                    <strong>📍 Địa chỉ:</strong> 123 Book-Tech, Q.1, TP.HCM
                  </Typography>
                  <Typography variant="body1" paragraph>
                    <strong>📞 Điện thoại:</strong> (028) 1234 5678
                  </Typography>
                  <Typography variant="body1" paragraph>
                    <strong>✉️ Email:</strong> support@booktech.vn
                  </Typography>
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="h6" fontWeight={600} gutterBottom>
                      🕒 Giờ mở cửa
                    </Typography>
                    <Typography variant="body2">
                      Thứ 2–6: 8:00–20:00
                      <br />
                      Thứ 7–CN: 8:00–18:00
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* CTA Section */}
          <Paper
            elevation={0}
            sx={{
              p: 5,
              borderRadius: 3,
              background: "linear-gradient(135deg, rgba(59,130,246,.08), rgba(16,185,129,.08))",
              textAlign: "center"
            }}
          >
            <Typography variant="h4" fontWeight={800} gutterBottom>
              Sẵn sàng bắt đầu hành trình?
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 600, mx: "auto" }}>
              Đăng ký thẻ thư viện ngay hôm nay để truy cập không giới hạn vào kho tàng tri thức đồ sộ của chúng tôi
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
              <Button
                variant="contained"
                size="large"
                onClick={() => (window.location.href = "/signup")}
                sx={{ px: 4, py: 1.5 }}
              >
                Đăng ký thẻ ngay
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => (window.location.href = "/books")}
                sx={{ px: 4, py: 1.5 }}
              >
                Khám phá sách
              </Button>
            </Stack>
          </Paper>
        </Container>
      </Box>

      <ReaderFooter maxContentWidth={1280} />
    </>
  );
}