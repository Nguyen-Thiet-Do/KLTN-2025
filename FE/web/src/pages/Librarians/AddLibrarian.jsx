import { useState } from "react";
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
import { createLibrarian } from "../../services/librarianService";

export default function AddLibrarian({ onSuccess, onCancel, open = true }) {
  const { enqueueSnackbar } = useSnackbar();

  const [form, setForm] = useState({
    // Account info
    email: "",
    password: "",
    // Librarian info
    fullName: "",
    gender: "",
    dateOfBirth: "",
    phoneNumber: "",
    cccd: "",
    address: "",
    basicSalary: "", // Vẫn giữ để gửi data
    salaryCoefficient: "", // Vẫn giữ để gửi data
    note: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ✅ Chỉ cho phép nhập số cho phoneNumber và cccd
const handleChange = (e) => {
  const { name, value } = e.target;
  
  // Chỉ cho phép nhập số cho phoneNumber và cccd
  if (name === "phoneNumber" || name === "cccd") {
    // Loại bỏ tất cả ký tự không phải số
    const numericValue = value.replace(/\D/g, "");
    setForm((prev) => ({ ...prev, [name]: numericValue }));
  } else {
    setForm((prev) => ({ ...prev, [name]: value }));
  }
  
  if (error) setError(null);
};

const handleSubmit = async (e) => {
  e.preventDefault();
  
  const phone = form.phoneNumber.trim();
  const cccd = form.cccd.trim();

  // ✅ Validate số điện thoại (10 số)
  if (phone && !/^[0-9]{10}$/.test(phone)) {
    const msg = "Số điện thoại phải có đúng 10 số.";
    setError(msg);
    enqueueSnackbar(msg, { variant: "error" });
    return;
  }

  // ✅ Validate số CCCD (12 số)
  if (cccd && !/^[0-9]{12}$/.test(cccd)) {
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
      return;
    }

    const res = await createLibrarian(token, form);

    console.log("📥 Response từ API:", res);
    console.log("📥 res.success:", res.success);
    console.log("📥 res.message:", res.message);

    // ✅ Kiểm tra res.success một cách rõ ràng
    if (res.success === true) {
      enqueueSnackbar("✅ Thêm thủ thư mới thành công!", { 
        variant: "success" 
      });
      onSuccess();
    } else {
      // ✅ Xử lý các loại lỗi cụ thể
      const errorMsg = res.message || "Không thể thêm thủ thư.";
      
      console.log("❌ Phát hiện lỗi:", errorMsg);
      
      if (errorMsg.toLowerCase().includes("số điện thoại") || 
          errorMsg.toLowerCase().includes("phone") ||
          errorMsg.toLowerCase().includes("tồn tại")) {
        setError("Số điện thoại đã tồn tại trong hệ thống.");
        enqueueSnackbar("❌ Số điện thoại đã tồn tại trong hệ thống.", { 
          variant: "error" 
        });
      } else if (errorMsg.toLowerCase().includes("email")) {
        setError("Email đã tồn tại trong hệ thống.");
        enqueueSnackbar("❌ Email đã tồn tại trong hệ thống.", { 
          variant: "error" 
        });
      } else {
        setError(errorMsg);
        enqueueSnackbar(`❌ ${errorMsg}`, { variant: "error" });
      }
    }
  } catch (err) {
    console.error("❌ Lỗi khi thêm thủ thư:", err);
    
    // Xử lý lỗi từ response
    const errorMessage = err.response?.data?.message || 
                        err.message || 
                        "Lỗi khi kết nối đến máy chủ!";
    
    if (errorMessage.toLowerCase().includes("số điện thoại") || 
        errorMessage.toLowerCase().includes("phone")) {
      setError("Số điện thoại đã tồn tại trong hệ thống.");
      enqueueSnackbar("❌ Số điện thoại đã tồn tại trong hệ thống.", { 
        variant: "error" 
      });
    } else if (errorMessage.toLowerCase().includes("email")) {
      setError("Email đã tồn tại trong hệ thống.");
      enqueueSnackbar("❌ Email đã tồn tại trong hệ thống.", { 
        variant: "error" 
      });
    } else {
      setError(errorMessage);
      enqueueSnackbar(`⚠️ ${errorMessage}`, { variant: "error" });
    }
  } finally {
    setLoading(false);
  }
};
  const handleClose = () => {
    if (!loading) onCancel();
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
      open={open}
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
      <DialogTitle
        sx={{
          background: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
          color: "white",
          py: 2,
          position: "relative",
        }}
      >
        <Typography variant="h5" fontWeight="700" textAlign="center">
          Thêm Thủ Thư Mới
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

      <Box component="form" onSubmit={handleSubmit} sx={{ display: "contents" }}>
        <DialogContent
          sx={{
            p: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {error && (
            <Alert severity="error" sx={{ m: 3, mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {/* 1️⃣ Thông tin tài khoản */}
          <Card elevation={0} sx={{ borderBottom: "1px solid #e0e0e0" }}>
            <CardContent sx={{ p: 4, pb: 3 }}>
              <Typography
                variant="h6"
                fontWeight="600"
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
                  onChange={handleChange}
                  required
                  disabled={loading}
                  placeholder="Nhập email đăng nhập"
                  sx={fieldSx}
                />
                <TextField
                  name="password"
                  type="password"
                  label="Mật khẩu"
                  value={form.password}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  placeholder="Nhập mật khẩu"
                  sx={fieldSx}
                />
              </Box>
            </CardContent>
          </Card>

          {/* 2️⃣ Thông tin cá nhân */}
          <Card elevation={0}>
            <CardContent sx={{ p: 4, pt: 3 }}>
              <Typography
                variant="h6"
                fontWeight="600"
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
                  InputLabelProps={{ shrink: true }}
                  disabled={loading}
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
                  label="Số CCCD"
                  value={form.cccd}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="Nhập số căn cước công dân"
                  sx={{ ...fieldSx, gridColumn: { xs: "auto", md: "1 / span 2" } }}
                />

                <TextField
                  name="address"
                  label="Địa chỉ"
                  value={form.address}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="Nhập địa chỉ đầy đủ"
                  sx={{ ...fieldSx, gridColumn: { xs: "auto", md: "1 / span 2" } }}
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
                  sx={{ ...fieldSx, gridColumn: { xs: "auto", md: "1 / span 2" } }}
                /> */}
              </Box>
            </CardContent>
          </Card>
        </DialogContent>

        {/* Nút hành động */}
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
                transform: "translateY(-1px)",
              },
              "&:disabled": { background: "#ccc", boxShadow: "none", transform: "none" },
            }}
          >
            {loading ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={16} sx={{ color: "white" }} />
                <span>Đang xử lý...</span>
              </Box>
            ) : (
              "Thêm thủ thư"
            )}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}