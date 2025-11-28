import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Box,
  Alert,
  CircularProgress,
  Typography,
  IconButton,
  Card,
  CardContent,
} from "@mui/material";
import { Close } from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { updateReader } from "../../services/readerService";

export default function EditReader({ open = true, reader = {}, onSuccess, onCancel }) {
  const { enqueueSnackbar } = useSnackbar();

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

  const initial = useMemo(
    () => ({
      email: reader?.email || "",
      password: "",
      fullName: reader?.fullName || "",
      gender: normalizeGender(reader?.gender),
      dateOfBirth: reader?.dateOfBirth
        ? new Date(reader.dateOfBirth).toISOString().slice(0, 10)
        : "",
      phoneNumber: reader?.phoneNumber || "",
      cccd: reader?.cccd || "",
      address: reader?.address || "",
      note: reader?.note || "",
    }),
    [reader]
  );

  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError(null);
  };

  const validate = () => {
    if (!form.fullName.trim()) return "Vui lòng nhập họ tên.";
    if (!form.email.trim()) return "Vui lòng nhập email.";
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
const phone = form.phoneNumber.trim();
  const cccd = form.cccd.trim();

  if (phone && !/^[0-9]{10}$/.test(phone)) {
    setLoading(false);
    const msg = "Số điện thoại phải có đúng 10 số.";
    setError(msg);
    enqueueSnackbar(msg, { variant: "error" });
    return;
  }

  // Validate CCCD (must be 12 digits)
  if (cccd && !/^[0-9]{12}$/.test(cccd)) {
    setLoading(false);
    const msg = "Số CCCD phải có đúng 12 số.";
    setError(msg);
    enqueueSnackbar(msg, { variant: "error" });
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
        return;
      }

      const payload = {
        email: form.email,
        password: form.password || undefined, // Không bắt buộc đổi
        fullName: form.fullName,
        gender: form.gender,
        dateOfBirth: form.dateOfBirth || null,
        phoneNumber: form.phoneNumber,
        cccd: form.cccd,
        address: form.address,
        note: form.note,
      };

      const res = await updateReader(reader.readerId, payload, token);

      if (res.success) {
        enqueueSnackbar("✅ Cập nhật độc giả thành công!", { variant: "success" });
        onSuccess?.();
      } else {
        enqueueSnackbar(res.message || "❌ Cập nhật thất bại!", { variant: "error" });
        setError(res.message || "Cập nhật thất bại.");
      }
    } catch (err) {
      console.error("❌ Lỗi khi cập nhật độc giả:", err);
      enqueueSnackbar("⚠️ Lỗi khi kết nối đến máy chủ!", { variant: "error" });
      setError(err.response?.data?.message || "Lỗi khi cập nhật độc giả.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) onCancel?.();
  };

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: 2,
      "&:hover fieldset": { borderColor: "#667EEA" },
      "&.Mui-focused fieldset": { borderColor: "#667EEA", borderWidth: 2 },
    },
  };

  return (
    <Dialog
      open={!!open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          height: "90vh",
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          overflow: "hidden",
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          background: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
          color: "white",
          py: 2,
          position: "relative",
        }}
      >
        <Typography variant="h5" fontWeight={700} textAlign="center">
          Chỉnh Sửa Thông Tin Độc Giả
        </Typography>
        <IconButton
          onClick={handleClose}
          disabled={loading}
          sx={{
            position: "absolute",
            right: 16,
            top: "50%",
            transform: "translateY(-50%)",
            color: "white",
            "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" },
          }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      {/* Form */}
      <Box component="form" onSubmit={handleSubmit} sx={{ display: "contents" }}>
        <DialogContent
          sx={{
            p: 0,
            overflowY: "auto",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {error && (
            <Alert severity="error" sx={{ m: 3, mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {/* Thông tin tài khoản */}
          <Card elevation={0} sx={{ borderRadius: 0, borderBottom: "1px solid #e0e0e0" }}>
            <CardContent sx={{ p: 4, pb: 3 }}>
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
                    width: 24,
                    height: 24,
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
                      disabled
                      placeholder="Nhập email"
                      sx={{
                        ...fieldSx,
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 2,
                          backgroundColor: "#f5f5f5",
                          "&:hover fieldset": { borderColor: "#ccc" },
                          "&.Mui-disabled": {
                            backgroundColor: "#f5f5f5",
                          },
                        },
                      }}
                      helperText="Email không thể thay đổi"
                    />
                {/* <TextField
                  name="password"
                  type="password"
                  label="Mật khẩu (để trống nếu không đổi)"
                  value={form.password}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="Nhập mật khẩu mới (nếu có)"
                  sx={fieldSx}
                /> */}
              </Box>
            </CardContent>
          </Card>

          {/* Thông tin cá nhân */}
          <Card elevation={0} sx={{ borderRadius: 0 }}>
            <CardContent sx={{ p: 4, pt: 3 }}>
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
                    width: 24,
                    height: 24,
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
                  placeholder="Nhập họ và tên đầy đủ"
                  sx={fieldSx}
                />

                <FormControl required sx={fieldSx}>
                  <InputLabel id="gender-label">Giới tính</InputLabel>
                  <Select
                    labelId="gender-label"
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
                  placeholder="Nhập địa chỉ đầy đủ"
                  sx={{
                    ...fieldSx,
                    gridColumn: { xs: "auto", md: "1 / span 2" },
                  }}
                />

                {/* <TextField
                  name="note"
                  label="Ghi chú"
                  value={form.note}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="Thêm ghi chú (nếu có)"
                  multiline
                  rows={3}
                  sx={{
                    ...fieldSx,
                    gridColumn: { xs: "auto", md: "1 / span 2" },
                  }}
                /> */}
              </Box>
            </CardContent>
          </Card>
        </DialogContent>

        {/* Footer */}
        <DialogActions
          sx={{
            px: 4,
            pb: 3,
            pt: 3,
            gap: 2,
            borderTop: "1px solid #e0e0e0",
            backgroundColor: "white",
          }}
        >
          <Button
            onClick={handleClose}
            disabled={loading}
            variant="outlined"
            sx={{
              px: 4,
              py: 1,
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
            disabled={loading}
            variant="contained"
            sx={{
              px: 4,
              py: 1,
              borderRadius: 2,
              background: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
              fontWeight: 600,
              boxShadow: "0 4px 12px rgba(102,126,234,0.3)",
              "&:hover": {
                background: "linear-gradient(135deg, #5A67D8 0%, #6B46C1 100%)",
                boxShadow: "0 6px 16px rgba(102,126,234,0.4)",
              },
            }}
          >
            {loading ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={16} sx={{ color: "white" }} />
                <span>Đang xử lý...</span>
              </Box>
            ) : (
              "Lưu thay đổi"
            )}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
