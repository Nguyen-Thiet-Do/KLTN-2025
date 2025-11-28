import { useState, useEffect } from "react";
import {
  Box,
  Paper,
  TextField,
  Typography,
  Button,
  Alert,
  Stack,
  IconButton,
  InputAdornment,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import ButtonLoader from "../../../components/Loading/ButtonLoader.jsx";
import api from "../../../services/api";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(""); // ✅ Thêm state success
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const savedEmail = sessionStorage.getItem("reset_email");
    const verified = sessionStorage.getItem("otp_verified");

    console.log("📧 ResetPassword - Email:", savedEmail);
    console.log("✅ OTP Verified:", verified);

    if (!savedEmail || verified !== "true") {
      console.warn("⚠️ Chưa verify OTP, redirect về ForgotPassword");
      window.location.href = "/ForgotPassword";
      return;
    }

    setEmail(savedEmail);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (!newPassword || newPassword.trim() === "") {
      setError("Vui lòng nhập mật khẩu mới");
      return;
    }

    if (newPassword.length < 6) {
      setError("Mật khẩu phải chứa ít nhất 6 ký tự");
      return;
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setIsSubmitting(true);

    try {
      console.log("🔄 Sending reset password request...");
      console.log("📧 Email:", email);
      console.log("🔑 Password length:", newPassword.length);

      const res = await api.post("/auth/forgot/reset-password", {
        email,
        newPassword,
      });

      console.log("✅ Response:", res.data);

      // Hiển thị thông báo thành công
      setSuccess("Đặt lại mật khẩu thành công! Đang chuyển đến trang đăng nhập...");

      // Xóa session
      sessionStorage.removeItem("reset_email");
      sessionStorage.removeItem("otp_verified");

      // Chuyển hướng sau 2 giây
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);

    } catch (err) {
      console.error("❌ Reset password error:", err);
      console.error("❌ Error response:", err.response?.data);

      setError(
        err.response?.data?.message || 
        "Không thể đặt lại mật khẩu. Vui lòng thử lại."
      );
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
            Đặt lại mật khẩu
          </Typography>

          <Typography textAlign="center" sx={{ opacity: 0.8 }}>
            Email: <strong>{email}</strong>
          </Typography>

          {/* Success message */}
          {success && (
            <Alert severity="success" sx={{ borderRadius: 2.5, fontWeight: 500 }}>
              {success}
            </Alert>
          )}

          {/* Error message */}
          {error && (
            <Alert severity="error" sx={{ borderRadius: 2.5, fontWeight: 500 }}>
              {error}
            </Alert>
          )}

          {/* Password field */}
          <TextField
            label="Mật khẩu mới"
            type={showPassword ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
            disabled={isSubmitting || !!success}
            fullWidth
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton 
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {/* Confirm password field (optional) */}
          <TextField
            label="Xác nhận mật khẩu"
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Nhập lại mật khẩu mới"
            disabled={isSubmitting || !!success}
            fullWidth
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton 
                    onClick={() => setShowConfirm(!showConfirm)}
                    edge="end"
                  >
                    {showConfirm ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {/* Submit button */}
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={isSubmitting || !!success}
            sx={{
              borderRadius: 2.5,
              py: 1.5,
              fontWeight: 700,
              background:
                "linear-gradient(135deg, rgb(102,126,234), rgb(118,75,162))",
            }}
          >
            {isSubmitting ? (
              <Stack direction="row" spacing={1.5} alignItems="center">
                <ButtonLoader inline size={35} />
                <span>Đang đặt lại...</span>
              </Stack>
            ) : success ? (
              "✅ Thành công"
            ) : (
              "Xác nhận"
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
      </Paper>
    </Box>
  );
}