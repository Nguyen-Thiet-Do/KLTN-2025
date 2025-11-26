import { useState, useEffect } from "react";
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
import api from "../../../services/api";

export default function VerifyOTP() {
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const savedEmail = sessionStorage.getItem("reset_email");
    if (!savedEmail) {
      window.location.href = "/ForgotPassword";
      return;
    }
    setEmail(savedEmail);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!otp.trim()) {
      setError("Vui lòng nhập mã OTP");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const res = await api.post("/auth/forgot/verify-otp", { email, otp });

      sessionStorage.setItem("otp_verified", "true");

      window.location.href = "/reset-password";
    } catch (err) {
      setError(err.response?.data?.message || "OTP không hợp lệ");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        p: 3,
        backgroundImage: `
          linear-gradient(135deg, rgba(102,126,234,0.15), rgba(118,75,162,0.15)),
          radial-gradient(1200px 600px at 50% 100%, rgba(0,0,0,0.4), rgba(0,0,0,0.7)),
          url(/background.jpg)
        `,
        backgroundSize: "cover",
      }}
    >
      <Paper
        sx={{
          width: "100%",
          maxWidth: 440,
          borderRadius: 3.5,
          p: 4,
          backgroundColor: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(16px)",
        }}
      >
        <Stack spacing={3} component="form" onSubmit={handleSubmit}>
          <Typography
            variant="h5"
            fontWeight={800}
            textAlign="center"
            sx={{
              background: "linear-gradient(135deg, #2D3748, #4A5568)",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Xác minh OTP
          </Typography>

          <Typography textAlign="center" sx={{ opacity: 0.8 }}>
            Mã OTP đã được gửi đến email:
            <br />
            <b>{email}</b>
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Mã OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Nhập mã OTP"
            fullWidth
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={isSubmitting}
            sx={{
              borderRadius: 2.5,
              py: 1.5,
              background:
                "linear-gradient(135deg, rgb(102,126,234), rgb(118,75,162))",
            }}
          >
            {isSubmitting ? (
              <Stack direction="row" spacing={1.5} alignItems="center">
                <ButtonLoader inline size={35} />
                <span>Đang xác minh...</span>
              </Stack>
            ) : (
              "Xác minh"
            )}
          </Button>

          <Typography
            component="a"
            href="/ForgotPassword"
            sx={{
              textAlign: "center",
              mt: 1,
              fontWeight: 600,
              color: "primary.main",
              textDecoration: "none",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            Gửi lại OTP
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
