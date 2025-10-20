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
  Grid,
  Typography,
  IconButton,
} from "@mui/material";
import { Close } from "@mui/icons-material";
import { createLibrarian } from "../../services/librarianService";

export default function AddLibrarian({ onSuccess, onCancel, open = true }) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    gender: "",
    dateOfBirth: "",
    phoneNumber: "",
    address: "",
    note: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const token = sessionStorage.getItem("accessToken");
      const res = await createLibrarian(token, form);
      if (res.success) {
        onSuccess();
      } else {
        setError(res.message || "Thêm thất bại");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Lỗi khi thêm thủ thư");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onCancel();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
          color: 'white',
          py: 2,
          position: 'relative',
        }}
      >
        <Typography variant="h5" fontWeight="700" textAlign="center">
          Thêm Thủ Thư Mới
        </Typography>
        <IconButton
          onClick={handleClose}
          disabled={loading}
          sx={{
            position: 'absolute',
            right: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'white',
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,0.1)',
            },
          }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ p: 4, '& .MuiTextField-root': { mb: 3 } }}>
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3,
                borderRadius: 2,
                '& .MuiAlert-message': { py: 1 }
              }}
            >
              {error}
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Hàng 1: Họ tên và Email */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="fullName"
                label="Họ tên"
                value={form.fullName}
                onChange={handleChange}
                required
                disabled={loading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&:hover fieldset': {
                      borderColor: '#667EEA',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#667EEA',
                      borderWidth: 2,
                    },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="email"
                type="email"
                label="Email"
                value={form.email}
                onChange={handleChange}
                required
                disabled={loading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&:hover fieldset': {
                      borderColor: '#667EEA',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#667EEA',
                      borderWidth: 2,
                    },
                  },
                }}
              />
            </Grid>

            {/* Hàng 2: Mật khẩu và Giới tính */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="password"
                type="password"
                label="Mật khẩu"
                value={form.password}
                onChange={handleChange}
                required
                disabled={loading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&:hover fieldset': {
                      borderColor: '#667EEA',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#667EEA',
                      borderWidth: 2,
                    },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Giới tính</InputLabel>
                <Select
                  name="gender"
                  value={form.gender}
                  label="Giới tính"
                  onChange={handleChange}
                  disabled={loading}
                  sx={{
                    borderRadius: 2,
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#667EEA',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#667EEA',
                      borderWidth: 2,
                    },
                  }}
                >
                  <MenuItem value="">Chọn giới tính</MenuItem>
                  <MenuItem value="1">Nam</MenuItem>
                  <MenuItem value="0">Nữ</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Hàng 3: Ngày sinh và Số điện thoại */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="dateOfBirth"
                type="date"
                label="Ngày sinh"
                value={form.dateOfBirth}
                onChange={handleChange}
                disabled={loading}
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&:hover fieldset': {
                      borderColor: '#667EEA',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#667EEA',
                      borderWidth: 2,
                    },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="phoneNumber"
                label="Số điện thoại"
                value={form.phoneNumber}
                onChange={handleChange}
                disabled={loading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&:hover fieldset': {
                      borderColor: '#667EEA',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#667EEA',
                      borderWidth: 2,
                    },
                  },
                }}
              />
            </Grid>

            {/* Hàng 4: Địa chỉ */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                name="address"
                label="Địa chỉ"
                value={form.address}
                onChange={handleChange}
                disabled={loading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&:hover fieldset': {
                      borderColor: '#667EEA',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#667EEA',
                      borderWidth: 2,
                    },
                  },
                }}
              />
            </Grid>

            {/* Hàng 5: Ghi chú */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                name="note"
                label="Ghi chú"
                value={form.note}
                onChange={handleChange}
                disabled={loading}
                multiline
                rows={3}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&:hover fieldset': {
                      borderColor: '#667EEA',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#667EEA',
                      borderWidth: 2,
                    },
                  },
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>

        {/* Actions */}
        <DialogActions sx={{ px: 4, pb: 3, gap: 2 }}>
          <Button
            onClick={handleClose}
            disabled={loading}
            variant="outlined"
            sx={{
              px: 4,
              py: 1,
              borderRadius: 2,
              borderColor: '#667EEA',
              color: '#667EEA',
              fontWeight: 600,
              '&:hover': {
                borderColor: '#5A67D8',
                backgroundColor: 'rgba(102,126,234,0.04)',
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
              background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(102,126,234,0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5A67D8 0%, #6B46C1 100%)',
                boxShadow: '0 6px 16px rgba(102,126,234,0.4)',
                transform: 'translateY(-1px)',
              },
              '&:disabled': {
                background: '#ccc',
                boxShadow: 'none',
                transform: 'none',
              },
            }}
          >
            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} sx={{ color: 'white' }} />
                <span>Đang xử lý...</span>
              </Box>
            ) : (
              'Thêm thủ thư'
            )}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}