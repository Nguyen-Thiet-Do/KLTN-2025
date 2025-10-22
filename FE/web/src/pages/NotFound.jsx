// NotFoundLottie.jsx
import { Box, Paper, Stack, Typography, Button } from "@mui/material";
import Lottie from "lottie-react"; // nếu bạn dùng @lottiefiles/... thì import Player
import { useEffect, useState } from "react";

export default function NotFoundLottie() {
  const [aniData, setAniData] = useState(null);

  // Lazy load JSON để giảm bundle
  useEffect(() => {
    fetch("/animations/404Luna.json")
      .then((r) => r.json())
      .then(setAniData)
      .catch(() => setAniData(null));
  }, []);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        p: 2,
        background:
          'linear-gradient(135deg, rgba(102,126,234,0.12), rgba(118,75,162,0.12)), url(/background.jpg) center/cover no-repeat',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 560,
          width: "100%",
          p: { xs: 3, md: 4 },
          borderRadius: 3,
          textAlign: "center",
          backgroundColor: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(16px)",
        }}
      >
        <Stack spacing={2.5} alignItems="center">
          <Box sx={{ width: { xs: 220, md: 280 } }}>
            {aniData ? (
              <Lottie
                animationData={aniData}
                loop={!prefersReducedMotion}
                autoplay={!prefersReducedMotion}
                style={{ width: "100%", height: "100%" }}
                aria-label="Minh họa 404"
                role="img"
              />
            ) : (
              <Box sx={{ height: 200 }} />
            )}
          </Box>

          <Typography variant="h4" fontWeight={800}>
            404 – Lạc đường rồi!
          </Typography>
          <Typography color="text.secondary">
            Trang bạn tìm không tồn tại. Hãy quay lại trang chủ nhé.
          </Typography>

          <Button
            variant="contained"
            size="large"
            href="/"
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 2,
              px: 3,
              background:
                "linear-gradient(135deg, rgb(102,126,234), rgb(118,75,162))",
            }}
          >
            Về trang chủ
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
