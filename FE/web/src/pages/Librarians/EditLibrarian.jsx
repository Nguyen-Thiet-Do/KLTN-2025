import { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, MenuItem, FormControl, InputLabel, Select,
  Box, Alert, CircularProgress, Typography, IconButton, Card, CardContent,
} from "@mui/material";
import { Close } from "@mui/icons-material";
import { useSnackbar } from "notistack"; // ✅ thêm import notistack
import { updateLibrarian } from "../../services/librarianService";

// Chuẩn hóa giới tính
function normalizeGender(raw) {
  if (raw === 0 || raw === 1) return String(raw);
  if (raw === "0" || raw === "1") return raw;
  if (raw === true) return "1";
  if (raw === false) return "0";
  const buf = raw?.data?.[0];
  if (buf === 0 || buf === 1) return String(buf);
  if (buf === 48) return "0";
  if (buf === 49) return "1";
  const s = String(raw || "").toLowerCase().trim();
  if (["1", "nam", "male", "m"].includes(s)) return "1";
  if (["0", "nữ", "nu", "female", "f"].includes(s)) return "0";
  return "0";
}

// Chuẩn hóa ngày sinh
function normalizeDob(dob) {
  if (!dob) return "";
  const str = String(dob);
  return str.includes("T") ? str.split("T")[0] : str;
}

export default function EditLibrarian({ librarian, onSuccess, onCancel, open = true }) {
  const { enqueueSnackbar } = useSnackbar(); // ✅ hook để hiển thị thông báo

  const [form, setForm] = useState({
    fullName: librarian?.fullName || "",
    gender: normalizeGender(librarian?.gender),
    dateOfBirth: normalizeDob(librarian?.dateOfBirth),
    phoneNumber: librarian?.phoneNumber || "",
    cccd: librarian?.cccd || "",
    address: librarian?.address || "",
    basicSalary: librarian?.basicSalary || "",
    salaryCoefficient: librarian?.salaryCoefficient || "",
    note: librarian?.note || "",
  });

  useEffect(() => {
    setForm({
      fullName: librarian?.fullName || "",
      gender: normalizeGender(librarian?.gender),
      dateOfBirth: normalizeDob(librarian?.dateOfBirth),
      phoneNumber: librarian?.phoneNumber || "",
      cccd: librarian?.cccd || "",
      address: librarian?.address || "",
      basicSalary: librarian?.basicSalary || "",
      salaryCoefficient: librarian?.salaryCoefficient || "",
      note: librarian?.note || "",
    });
  }, [librarian]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const token = sessionStorage.getItem("accessToken");
      const payload = {
        ...form,
        gender: form.gender === "1" ? 1 : 0,
        basicSalary: form.basicSalary ? parseFloat(form.basicSalary) : null,
        salaryCoefficient: form.salaryCoefficient ? parseFloat(form.salaryCoefficient) : null,
        dateOfBirth: form.dateOfBirth || null,
      };

      const res = await updateLibrarian(librarian.librarianId, payload, token);

      if (res?.success) {
        enqueueSnackbar("✅ Cập nhật thông tin thủ thư thành công!", { variant: "success" }); // ✅ thông báo thành công
        onSuccess?.();
      } else {
        enqueueSnackbar(res?.message || "Không thể cập nhật thủ thư.", { variant: "error" }); // ✅ thông báo lỗi
        setError(res?.message || "Không thể cập nhật thủ thư.");
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Lỗi khi cập nhật.";
      enqueueSnackbar(`❌ ${msg}`, { variant: "error" }); // ✅ thông báo lỗi
      setError(msg);
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
          Sửa Thông Tin Thủ Thư
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

          <Card elevation={0} sx={{ borderRadius: 0 }}>
            <CardContent sx={{ p: 4 }}>
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
                    value={form.gender ?? ""}
                    label="Giới tính"
                    onChange={handleChange}
                    disabled={loading}
                  >
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
                  label="Số CCCD"
                  value={form.cccd}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="Nhập số căn cước công dân"
                  sx={fieldSx}
                />

                {/* <TextField
                  name="basicSalary"
                  type="number"
                  label="Lương cơ bản"
                  value={form.basicSalary}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="Nhập lương cơ bản"
                  sx={fieldSx}
                />

                <TextField
                  name="salaryCoefficient"
                  type="number"
                  label="Hệ số lương"
                  value={form.salaryCoefficient}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="Nhập hệ số lương"
                  sx={fieldSx}
                /> */}

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
              "&:hover": { borderColor: "#5A67D8", backgroundColor: "rgba(102,126,234,0.04)" },
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
                <span>Đang lưu...</span>
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
