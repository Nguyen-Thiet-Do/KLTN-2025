import { useState } from "react";
import {
  Box,
  Paper,
  TextField,
  Typography,
  Button,
  Alert,
  Stack,
} from "@mui/material";
import ButtonLoader from "../../../components/Loading/ButtonLoader.jsx";
import api from "../../../services/api"; // ⭐ dùng axios wrapper

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      setError("Email không được để trống");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Email không hợp lệ");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      // ⭐ GỌI API BACKEND GỬI OTP
      const res = await api.post("/auth/forgot/send-otp", { email });

      // ⭐ LƯU EMAIL VÀO SESSION ĐỂ SANG BƯỚC 2 XÁC NHẬN OTP
      sessionStorage.setItem("reset_email", email);

      setSubmitted(true);

      // ⭐ CHUYỂN SANG TRANG VERIFY OTP
      setTimeout(() => {
        window.location.href = "/verify-otp";
      }, 800);

    } catch (err) {
      setError(err.response?.data?.message || "Không thể gửi OTP.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        position: "relative",
        display: "grid",
        placeItems: "center",
        p: { xs: 2, sm: 3 },
        overflow: "hidden",
        backgroundImage: `
          linear-gradient(135deg, rgba(102,126,234,0.15) 0%, rgba(118,75,162,0.15) 100%),
          radial-gradient(1200px 600px at 50% 100%, rgba(0,0,0,0.4), rgba(0,0,0,0.7)),
          url(/background.jpg)
        `,
        backgroundSize: "cover, cover, cover",
        backgroundPosition: "center, center, center",
      }}
    >
      {/* Hiệu ứng nền */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: -200,
          background: `
            radial-gradient(800px 400px at 15% 10%, rgba(102,126,234,0.2), transparent 70%),
            radial-gradient(800px 400px at 85% 90%, rgba(118,75,162,0.2), transparent 70%)
          `,
          filter: "blur(60px)",
          pointerEvents: "none",
          opacity: 0.8,
        }}
      />

      {/* Card */}
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 440,
          borderRadius: 3.5,
          p: { xs: 3.5, sm: 4.5 },
          position: "relative",
          backgroundColor: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(16px)",
        }}
      >
        {!submitted ? (
          <Stack spacing={3.5} component="form" onSubmit={handleSubmit}>
            <Stack spacing={1.5} textAlign="center">
              <Typography
                variant="h5"
                fontWeight={800}
                sx={{
                  background: "linear-gradient(135deg, #2D3748, #4A5568)",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Quên mật khẩu
              </Typography>

              <Typography
                variant="body1"
                sx={{
                  opacity: 0.8,
                  fontWeight: 500,
                }}
              >
                Nhập email để nhận mã OTP đặt lại mật khẩu
              </Typography>
            </Stack>

            {error && (
              <Alert severity="error" sx={{ borderRadius: 2.5, fontWeight: 500 }}>
                {error}
              </Alert>
            )}

            <TextField
              label="Email"
              value={email}
              placeholder="nhapemail@domain.com"
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              fullWidth
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isSubmitting}
              sx={{
                py: 1.6,
                fontWeight: 700,
                borderRadius: 2.5,
                background:
                  "linear-gradient(135deg, rgb(102,126,234) 0%, rgb(118,75,162) 100%)",
              }}
            >
              {isSubmitting ? (
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <ButtonLoader inline size={35} />
                  <span>Đang gửi...</span>
                </Stack>
              ) : (
                "Gửi OTP"
              )}
            </Button>

            <Typography
              component="a"
              href="/login"
              sx={{
                textAlign: "center",
                fontWeight: 600,
                color: "primary.main",
                textDecoration: "none",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              Quay về đăng nhập
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={3} textAlign="center">
            <Typography
              variant="h5"
              fontWeight={800}
              sx={{
                background: "linear-gradient(135deg, #2D3748, #4A5568)",
                WebkitTextFillColor: "transparent",
              }}
            >
              OTP đã được gửi
            </Typography>

            <Typography
              variant="body1"
              sx={{
                opacity: 0.85,
                fontWeight: 500,
                lineHeight: 1.6,
              }}
            >
              Vui lòng kiểm tra email của bạn.
            </Typography>

            <Button
              href="/verify-otp"
              variant="contained"
              sx={{
                py: 1.4,
                fontWeight: 700,
                borderRadius: 2.5,
                background:
                  "linear-gradient(135deg, rgb(102,126,234) 0%, rgb(118,75,162) 100%)",
              }}
            >
              Tiếp tục
            </Button>
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
