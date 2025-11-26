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
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const savedEmail = sessionStorage.getItem("reset_email");
    const verified = sessionStorage.getItem("otp_verified");

    if (!savedEmail || verified !== "true") {
      window.location.href = "/ForgotPassword";
      return;
    }

    setEmail(savedEmail);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 6) {
      setError("Mật khẩu phải chứa ít nhất 6 ký tự");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const res = await api.post("/auth/forgot/reset-password", {
        email,
        newPassword,
      });
  setSuccess("Đặt lại mật khẩu thành công!");
      sessionStorage.removeItem("reset_email");
      sessionStorage.removeItem("otp_verified");

      window.location.href = "/login";
    } catch (err) {
      setError(err.response?.data?.message || "Không thể đặt lại mật khẩu");
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

          <Typography textAlign="center">Email: <b>{email}</b></Typography>

          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Mật khẩu mới"
            type={show ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nhập mật khẩu mới"
            fullWidth
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShow(!show)}>
                    {show ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
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
                <span>Đang đặt lại...</span>
              </Stack>
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
