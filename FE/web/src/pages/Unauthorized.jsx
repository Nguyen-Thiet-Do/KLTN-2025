// src/pages/Unauthorized.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Box, Paper, Stack, Typography, Button } from "@mui/material";
import Lottie from "lottie-react";

export default function Unauthorized() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [aniData, setAniData] = useState(null);

  // Lazy-load JSON animation để giảm bundle (đặt file vào public/animations/)
  useEffect(() => {
    fetch("/animations/forbidden403.json")
      .then((r) => r.json())
      .then(setAniData)
      .catch(() => setAniData(null));
  }, []);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const handleGoBack = () => {
    if (user) {
      const routes = {
        1: "/admin",
        2: "/librarian",
        3: "/",
      };
      navigate(routes[user.roleId] || "/login");
    } else {
      navigate("/login");
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        p: 2,
        background:
          'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(59,130,246,0.12)), url(/background.jpg) center/cover no-repeat',
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
          {/* Lottie minh họa */}
          <Box sx={{ width: { xs: 220, md: 280 } }}>
            {aniData ? (
              <Lottie
                animationData={aniData}
                loop={!prefersReducedMotion}
                autoplay={!prefersReducedMotion}
                style={{ width: "100%", height: "100%" }}
                aria-label="Minh họa 403"
                role="img"
              />
            ) : (
              <Box sx={{ height: 200 }} />
            )}
          </Box>

          <Typography
            variant="h3"
            fontWeight={900}
            sx={{
              fontSize: { xs: 28, md: 32 },
              color: "error.main",
              letterSpacing: 0.5,
            }}
          >
            403 – Truy cập bị từ chối
          </Typography>

          <Typography color="text.secondary">
            Bạn không có quyền truy cập vào trang này. Vui lòng quay lại trang phù hợp.
          </Typography>

          <Stack
            direction="row"
            spacing={1.5}
            sx={{ mt: 1 }}
            justifyContent="center"
          >
            <Button
              onClick={handleGoBack}
              variant="contained"
              size="large"
              sx={{
                textTransform: "none",
                fontWeight: 700,
                borderRadius: 2,
                px: 3,
                background:
                  "linear-gradient(135deg, rgb(59,130,246), rgb(99,102,241))",
              }}
            >
              Quay lại
            </Button>
            <Button
              onClick={async () => {
                await logout();
                navigate("/");
              }}
              variant="outlined"
              size="large"
              sx={{
                textTransform: "none",
                fontWeight: 700,
                borderRadius: 2,
                px: 3,
              }}
            >
              Đăng xuất
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
