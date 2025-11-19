// src/components/reader/Settings.jsx
import { useEffect, useState } from "react";
import {
  Box,
  TextField,
  Button,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  CircularProgress,
  Typography,
  Card,
  CardContent,
  Avatar,
  Paper,
} from "@mui/material";
import { Save, ArrowBack } from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { useAuth } from "../../contexts/AuthContext";
import { updateCurrentReader as updateFullProfile } from "../../services/readerService";
import ReaderHeader from "../../components/layouts/ReaderHeader";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const { user, updateUserContext } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const normalizeGender = (gender) => {
    if (gender == null) return "";
    if (typeof gender === "object") {
      const value = gender?.data?.[0] ?? (gender instanceof Uint8Array ? gender[0] : undefined);
      if (value === 1) return "1";
      if (value === 0) return "0";
      return "other";
    }
    const g = String(gender).trim().toLowerCase();
    if (["male", "nam", "1"].includes(g)) return "1";
    if (["female", "nu", "nữ", "0"].includes(g)) return "0";
    if (["other", "khac", "khác"].includes(g)) return "other";
    return "";
  };

  const [form, setForm] = useState({
    email: user?.email || "",
    password: "",
    fullName: user?.fullName || "",
    gender: normalizeGender(user?.gender),
    dateOfBirth: user?.dateOfBirth
      ? new Date(user.dateOfBirth).toISOString().slice(0, 10)
      : "",
    phoneNumber: user?.phoneNumber || "",
    cccd: user?.cccd || "",
    address: user?.address || "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      setForm({
        email: user?.email || "",
        password: "",
        fullName: user?.fullName || "",
        gender: normalizeGender(user?.gender),
        dateOfBirth: user?.dateOfBirth
          ? new Date(user.dateOfBirth).toISOString().slice(0, 10)
          : "",
        phoneNumber: user?.phoneNumber || "",
        cccd: user?.cccd || "",
        address: user?.address || "",
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError(null);
  };

  const validate = () => {
    if (!form.fullName.trim()) return "Vui lòng nhập họ tên.";
    if (!form.email.trim()) return "Vui lòng nhập email.";
    if (form.password && form.password.length < 6)
      return "Mật khẩu phải có ít nhất 6 ký tự.";
    return null;
  };

const handleSubmit = async (e) => {
  e.preventDefault();
  const msg = validate();
  if (msg) {
    setError(msg);
    enqueueSnackbar(msg, { variant: "warning" });
    return;
  }

  setLoading(true);
  setError(null);

  try {
    const token = sessionStorage.getItem("accessToken");
    if (!token) {
      enqueueSnackbar("⚠️ Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.", {
        variant: "warning",
      });
      setLoading(false);
      navigate("/login");
      return;
    }

    const payload = {
      email: form.email,
      password: form.password || undefined,
      fullName: form.fullName,
      gender: form.gender,
      dateOfBirth: form.dateOfBirth || null,
      phoneNumber: form.phoneNumber,
      cccd: form.cccd,
      address: form.address,
    };

    // API call để cập nhật thông tin
  const res = await updateFullProfile(payload, token);

    if (res.success) {
      enqueueSnackbar("✅ Cập nhật thông tin thành công!", { variant: "success" });
      
      // Cập nhật thông tin người dùng trong context
      const updatedUserData = {
        email: form.email,
        fullName: form.fullName,
        gender: form.gender,
        dateOfBirth: form.dateOfBirth,
        phoneNumber: form.phoneNumber,
        cccd: form.cccd,
        address: form.address,
      };
      
      updateUserContext(updatedUserData);  // Cập nhật context
      setForm({ ...form, password: "" });

      setTimeout(() => {
        navigate("/profile", { replace: true });
      }, 1500);
    } else {
      enqueueSnackbar(res.message || "❌ Cập nhật thất bại!", { variant: "error" });
      setError(res.message || "Cập nhật thất bại.");
    }
  } catch (err) {
    console.error("❌ Lỗi khi cập nhật thông tin:", err);
    enqueueSnackbar("⚠️ Lỗi khi kết nối đến máy chủ!", { variant: "error" });
    setError(err.response?.data?.message || "Lỗi khi cập nhật thông tin.");
  } finally {
    setLoading(false);
  }
};

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: 2,
      backgroundColor: "white",
      "&:hover fieldset": { borderColor: "#667EEA" },
      "&.Mui-focused fieldset": { borderColor: "#667EEA", borderWidth: 2 },
    },
  };

  return (
    <>
      <ReaderHeader />

      <Box
        sx={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          py: 6,
          px: 2,
        }}
      >
        <Box sx={{ maxWidth: 900, mx: "auto" }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate("/profile")}
            sx={{
              mb: 3,
              color: "white",
              fontWeight: 600,
              "&:hover": {
                backgroundColor: "rgba(255,255,255,0.1)",
              },
            }}
          >
            Quay lại Hồ sơ
          </Button>

          <Paper
            elevation={0}
            sx={{
              borderRadius: 4,
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            {/* Header Section */}
            <Box
              sx={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                py: 4,
                px: 4,
                textAlign: "center",
              }}
            >
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  mx: "auto",
                  mb: 2,
                  border: "3px solid white",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                  fontSize: "2rem",
                  fontWeight: 700,
                }}
              >
                {user?.fullName?.[0]?.toUpperCase() || "U"}
              </Avatar>
              <Typography variant="h5" sx={{ color: "white", fontWeight: 700 }}>
                Cài Đặt Thông Tin
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.8)", mt: 1 }}>
                Cập nhật thông tin cá nhân của bạn
              </Typography>
            </Box>

            {/* Form Section */}
            <Box component="form" onSubmit={handleSubmit} sx={{ p: 4 }}>
              {error && (
                <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                  {error}
                </Alert>
              )}

              {/* Thông tin tài khoản */}
              <Card elevation={0} sx={{ mb: 3, backgroundColor: "#f8f9fa", borderRadius: 2 }}>
                <CardContent>
                  <Typography
                    variant="h6"
                    fontWeight={600}
                    sx={{
                      mb: 3,
                      color: "#667EEA",
                      display: "flex",
                      alignItems: "center",
                      "&::before": {
                        content: '"1"',
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 28,
                        height: 28,
                        backgroundColor: "#667EEA",
                        color: "white",
                        borderRadius: "50%",
                        fontSize: "0.875rem",
                        mr: 2,
                      },
                    }}
                  >
                    Thông Tin Tài Khoản
                  </Typography>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                      gap: 3,
                    }}
                  >
                    <TextField
                      name="email"
                      type="email"
                      label="Email đăng nhập"
                      value={form.email}
                      onChange={handleChange}
                      required
                      disabled={loading}
                      placeholder="Nhập email"
                      sx={fieldSx}
                    />
                    <TextField
                      name="password"
                      type="password"
                      label="Mật khẩu mới (tùy chọn)"
                      value={form.password}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="Để trống nếu không đổi"
                      helperText="Chỉ nhập nếu muốn thay đổi mật khẩu"
                      sx={fieldSx}
                    />
                  </Box>
                </CardContent>
              </Card>

              {/* Thông tin cá nhân */}
              <Card elevation={0} sx={{ backgroundColor: "#f8f9fa", borderRadius: 2 }}>
                <CardContent>
                  <Typography
                    variant="h6"
                    fontWeight={600}
                    sx={{
                      mb: 3,
                      color: "#667EEA",
                      display: "flex",
                      alignItems: "center",
                      "&::before": {
                        content: '"2"',
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 28,
                        height: 28,
                        backgroundColor: "#667EEA",
                        color: "white",
                        borderRadius: "50%",
                        fontSize: "0.875rem",
                        mr: 2,
                      },
                    }}
                  >
                    Thông Tin Cá Nhân
                  </Typography>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                      gap: 3,
                    }}
                  >
                    <TextField
                      name="fullName"
                      label="Họ và tên"
                      value={form.fullName}
                      onChange={handleChange}
                      required
                      disabled={loading}
                      placeholder="Nhập họ và tên"
                      sx={fieldSx}
                    />

                    <FormControl required sx={fieldSx}>
                      <InputLabel>Giới tính</InputLabel>
                      <Select
                        name="gender"
                        value={form.gender}
                        label="Giới tính"
                        onChange={handleChange}
                        disabled={loading}
                      >
                        <MenuItem value="">
                          <em>Chọn giới tính</em>
                        </MenuItem>
                        <MenuItem value="1">Nam</MenuItem>
                        <MenuItem value="0">Nữ</MenuItem>
                        <MenuItem value="other">Khác</MenuItem>
                      </Select>
                    </FormControl>

                    <TextField
                      name="dateOfBirth"
                      type="date"
                      label="Ngày sinh"
                      value={form.dateOfBirth}
                      onChange={handleChange}
                      disabled={loading}
                      InputLabelProps={{ shrink: true }}
                      sx={fieldSx}
                    />

                    <TextField
                      name="phoneNumber"
                      label="Số điện thoại"
                      value={form.phoneNumber}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="Nhập số điện thoại"
                      sx={fieldSx}
                    />

                    <TextField
                      name="cccd"
                      label="CCCD"
                      value={form.cccd}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="Nhập số CCCD"
                      sx={fieldSx}
                    />

                    <TextField
                      name="address"
                      label="Địa chỉ"
                      value={form.address}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="Nhập địa chỉ"
                      sx={{
                        ...fieldSx,
                        gridColumn: { xs: "auto", md: "1 / span 2" },
                      }}
                    />
                  </Box>
                </CardContent>
              </Card>

              {/* Buttons */}
              <Box sx={{ display: "flex", gap: 2, mt: 4, justifyContent: "flex-end" }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate("/profile")}
                  disabled={loading}
                  sx={{
                    px: 4,
                    py: 1.5,
                    borderRadius: 2,
                    borderColor: "#667EEA",
                    color: "#667EEA",
                    fontWeight: 600,
                    "&:hover": {
                      borderColor: "#5A67D8",
                      backgroundColor: "rgba(102,126,234,0.04)",
                    },
                  }}
                >
                  Hủy
                </Button>

                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={16} /> : <Save />}
                  sx={{
                    px: 4,
                    py: 1.5,
                    borderRadius: 2,
                    background: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
                    fontWeight: 600,
                    boxShadow: "0 4px 12px rgba(102,126,234,0.3)",
                    "&:hover": {
                      background: "linear-gradient(135deg, #5A67D8 0%, #6B46C1 100%)",
                      boxShadow: "0 6px 16px rgba(102,126,234,0.4)",
                      transform: "translateY(-1px)",
                    },
                    transition: "all 0.3s ease",
                  }}
                >
                  {loading ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Box>
    </>
  );
}