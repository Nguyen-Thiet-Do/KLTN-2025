import { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Paper,
  TextField,
  Typography,
  Button,
  Alert,
  Stack,
  InputAdornment,
  IconButton,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Divider,
  Link,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useAuth } from '../../../contexts/AuthContext';

export default function SignUp() {
  const navigate = useNavigate();
  const auth = useAuth?.(); // phòng trường hợp hook khác cấu trúc
  const registerAccount = auth?.register; // nếu có register thì dùng

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirm: '',
    agree: true,
  });

  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [apiSuccess, setApiSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Ẩn thanh cuộn khi mở trang
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Prefill email nếu trước đó đã lưu ở màn hình đăng nhập
  useEffect(() => {
    const saved = localStorage.getItem('last_login_email');
    if (saved && !formData.email) {
      setFormData((p) => ({ ...p, email: saved }));
    }
  }, []);

  const validate = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Họ và tên không được để trống';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Họ và tên quá ngắn';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email không được để trống';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email không hợp lệ';
    }

    if (!formData.password) {
      newErrors.password = 'Mật khẩu không được để trống';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    }

    if (!formData.confirm) {
      newErrors.confirm = 'Vui lòng nhập lại mật khẩu';
    } else if (formData.confirm !== formData.password) {
      newErrors.confirm = 'Mật khẩu xác nhận không khớp';
    }

    if (!formData.agree) {
      newErrors.agree = 'Bạn cần đồng ý điều khoản sử dụng';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    setApiError('');
    setApiSuccess('');
    setErrors((prev) => ({ ...prev, [name]: '' }));

    if (type === 'checkbox') {
      setFormData((p) => ({ ...p, [name]: checked }));
    } else {
      setFormData((p) => ({ ...p, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setApiError('');
    setApiSuccess('');

    try {
      if (registerAccount) {
        // Nếu có hàm register từ AuthContext
        await registerAccount({
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          password: formData.password,
        });
      } else {
        // Demo: mô phỏng đăng ký thành công
        await new Promise((r) => setTimeout(r, 800));
      }

      setApiSuccess('Đăng ký thành công! Bạn có thể đăng nhập ngay.');
      // Gợi ý: lưu email để form đăng nhập tự điền sẵn
      localStorage.setItem('last_login_email', formData.email.trim());
      // Điều hướng về trang đăng nhập
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Sign up error:', err);
      setApiError(err?.message || 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        p: { xs: 2, sm: 3 },
        overflow: 'hidden',
        backgroundImage: `
          linear-gradient(135deg, rgba(102,126,234,0.15) 0%, rgba(118,75,162,0.15) 100%),
          radial-gradient(1200px 600px at 50% 100%, rgba(0,0,0,0.4), rgba(0,0,0,0.7)),
          url(/background.jpg)
        `,
        backgroundSize: 'cover, cover, cover',
        backgroundPosition: 'center, center, center',
        backgroundRepeat: 'no-repeat',
        fontFamily: '"Inter", "Roboto", "Segoe UI", sans-serif',
      }}
    >
      {/* Hiệu ứng hạt sáng */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: -200,
          background: `
            radial-gradient(800px 400px at 15% 10%, rgba(102,126,234,0.2), transparent 70%),
            radial-gradient(800px 400px at 85% 90%, rgba(118,75,162,0.2), transparent 70%)
          `,
          filter: 'blur(60px)',
          pointerEvents: 'none',
          opacity: 0.8,
        }}
      />

      {/* Card đăng ký */}
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 520,
          borderRadius: 3.5,
          p: { xs: 3.5, sm: 4.5 },
          position: 'relative',
          color: 'text.primary',
          backgroundColor: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(16px) saturate(180%)',
          boxShadow: `
            0 25px 50px -12px rgba(0,0,0,0.4),
            0 8px 20px -8px rgba(0,0,0,0.3),
            inset 0 1px 0 rgba(255,255,255,0.2)
          `,
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            padding: '1.5px',
            borderRadius: 3.5,
            background:
              'linear-gradient(135deg, rgba(102,126,234,0.6), rgba(118,75,162,0.6), rgba(102,126,234,0.6))',
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            pointerEvents: 'none',
          },
          animation: 'slideUpFade 500ms cubic-bezier(0.16, 1, 0.3, 1)',
          '@keyframes slideUpFade': {
            from: { opacity: 0, transform: 'translateY(24px) scale(0.98)' },
            to: { opacity: 1, transform: 'translateY(0) scale(1)' },
          },
          transition: 'transform 0.3s ease, box-shadow 0.3s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: `
              0 30px 60px -12px rgba(0,0,0,0.45),
              0 12px 24px -8px rgba(0,0,0,0.35),
              inset 0 1px 0 rgba(255,255,255,0.2)
            `,
          },
        }}
      >
        <Stack spacing={3.5} component="form" onSubmit={handleSubmit} noValidate>
          {/* Brand */}
          <Stack spacing={2} alignItems="center" textAlign="center">
            <Box
              component="img"
              src="/logoo.png"
              alt="Logo Thư Viện"
              sx={{
                width: 92,
                height: 92,
                objectFit: 'contain',
                filter: `
                  drop-shadow(0 6px 12px rgba(102,126,234,0.3))
                  brightness(1.05)
                  contrast(1.1)
                `,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.05)',
                  filter: `
                    drop-shadow(0 8px 16px rgba(102,126,234,0.4))
                    brightness(1.08)
                    contrast(1.15)
                  `,
                },
              }}
            />
            <Stack spacing={0.8}>
              <Typography
                variant="h5"
                fontWeight={800}
                sx={{
                  background: 'linear-gradient(135deg, #2D3748 0%, #4A5568 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '-0.02em',
                  fontFamily: '"Inter", sans-serif',
                }}
              >
                Thư Viện Book-tech
              </Typography>
              <Typography
                variant="h6"
                fontWeight={700}
                sx={{
                  background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontSize: '1.1rem',
                  letterSpacing: '-0.01em',
                }}
              >
             
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5, fontWeight: 500, opacity: 0.8, letterSpacing: '0.02em' }}
              >
                Tạo tài khoản mới
              </Typography>
            </Stack>
          </Stack>

          {apiError && (
            <Alert
              severity="error"
              sx={{
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: 'error.light',
                backgroundColor: 'rgba(254,242,242,0.9)',
                backdropFilter: 'blur(8px)',
                fontWeight: 500,
                '& .MuiAlert-message': { padding: '4px 0' },
              }}
            >
              {apiError}
            </Alert>
          )}

          {apiSuccess && (
            <Alert
              severity="success"
              sx={{
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: 'success.light',
                backgroundColor: 'rgba(240,253,244,0.9)',
                backdropFilter: 'blur(8px)',
                fontWeight: 500,
                '& .MuiAlert-message': { padding: '4px 0' },
              }}
            >
              {apiSuccess}
            </Alert>
          )}

          <TextField
            id="fullName"
            name="fullName"
            label="Họ và tên"
            placeholder="Nhập họ và tên"
            value={formData.fullName}
            onChange={handleChange}
            disabled={isSubmitting}
            error={Boolean(errors.fullName)}
            helperText={errors.fullName}
            fullWidth
            autoComplete="name"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2.5,
                fontSize: '0.95rem',
                transition: 'all 0.2s ease',
                fontFamily: '"Inter", sans-serif',
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.light' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                  borderWidth: '2px',
                  boxShadow: '0 0 0 3px rgba(102,126,234,0.1)',
                },
              },
              '& .MuiInputLabel-root': {
                fontSize: '0.95rem',
                fontFamily: '"Inter", sans-serif',
                fontWeight: 500,
              },
            }}
          />

          <TextField
            id="email"
            name="email"
            type="email"
            label="Email"
            placeholder="nhapemail@domain.com"
            value={formData.email}
            onChange={handleChange}
            disabled={isSubmitting}
            error={Boolean(errors.email)}
            helperText={errors.email}
            fullWidth
            autoComplete="email"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2.5,
                fontSize: '0.95rem',
                transition: 'all 0.2s ease',
                fontFamily: '"Inter", sans-serif',
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.light' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                  borderWidth: '2px',
                  boxShadow: '0 0 0 3px rgba(102,126,234,0.1)',
                },
              },
              '& .MuiInputLabel-root': {
                fontSize: '0.95rem',
                fontFamily: '"Inter", sans-serif',
                fontWeight: 500,
              },
            }}
          />

          <TextField
            id="password"
            name="password"
            type={showPwd ? 'text' : 'password'}
            label="Mật khẩu"
            placeholder="••••••••"
            value={formData.password}
            onChange={handleChange}
            disabled={isSubmitting}
            error={Boolean(errors.password)}
            helperText={errors.password}
            fullWidth
            autoComplete="new-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPwd ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    onClick={() => setShowPwd((p) => !p)}
                    edge="end"
                    disabled={isSubmitting}
                    sx={{
                      color: 'text.secondary',
                      '&:hover': { backgroundColor: 'rgba(102,126,234,0.08)', color: 'primary.main' },
                    }}
                  >
                    {showPwd ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2.5,
                fontSize: '0.95rem',
                transition: 'all 0.2s ease',
                fontFamily: '"Inter", sans-serif',
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.light' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                  borderWidth: '2px',
                  boxShadow: '0 0 0 3px rgba(102,126,234,0.1)',
                },
              },
              '& .MuiInputLabel-root': {
                fontSize: '0.95rem',
                fontFamily: '"Inter", sans-serif',
                fontWeight: 500,
              },
            }}
          />

          <TextField
            id="confirm"
            name="confirm"
            type={showConfirm ? 'text' : 'password'}
            label="Xác nhận mật khẩu"
            placeholder="••••••••"
            value={formData.confirm}
            onChange={handleChange}
            disabled={isSubmitting}
            error={Boolean(errors.confirm)}
            helperText={errors.confirm}
            fullWidth
            autoComplete="new-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showConfirm ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    onClick={() => setShowConfirm((p) => !p)}
                    edge="end"
                    disabled={isSubmitting}
                    sx={{
                      color: 'text.secondary',
                      '&:hover': { backgroundColor: 'rgba(102,126,234,0.08)', color: 'primary.main' },
                    }}
                  >
                    {showConfirm ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2.5,
                fontSize: '0.95rem',
                transition: 'all 0.2s ease',
                fontFamily: '"Inter", sans-serif',
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.light' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                  borderWidth: '2px',
                  boxShadow: '0 0 0 3px rgba(102,126,234,0.1)',
                },
              },
              '& .MuiInputLabel-root': {
                fontSize: '0.95rem',
                fontFamily: '"Inter", sans-serif',
                fontWeight: 500,
              },
            }}
          />

          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: -0.5 }}>
            <FormControlLabel
              control={
                <Checkbox
                  name="agree"
                  checked={formData.agree}
                  onChange={handleChange}
                  size="small"
                  sx={{
                    color: 'primary.main',
                    '&.Mui-checked': { color: 'primary.main' },
                    '&:hover': { backgroundColor: 'rgba(102,126,234,0.08)' },
                  }}
                />
              }
              label={
                <Typography variant="body2" sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 500 }}>
                  Tôi đồng ý với{' '}
                  <Link href="/terms" underline="hover" sx={{ fontWeight: 700 }}>
                    Điều khoản sử dụng
                  </Link>
                </Typography>
              }
              sx={{ userSelect: 'none' }}
            />
            {errors.agree && (
              <Typography variant="body2" color="error" sx={{ fontWeight: 600 }}>
                {errors.agree}
              </Typography>
            )}
          </Stack>

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={isSubmitting}
            sx={{
              py: 1.6,
              fontWeight: 700,
              letterSpacing: '0.02em',
              borderRadius: 2.5,
              fontSize: '1rem',
              textTransform: 'none',
              fontFamily: '"Inter", sans-serif',
              boxShadow: `
                0 8px 24px rgba(102,126,234,0.4),
                0 4px 12px rgba(118,75,162,0.3)
              `,
              background: 'linear-gradient(135deg, rgb(102,126,234) 0%, rgb(118,75,162) 100%)',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: `
                  0 12px 32px rgba(102,126,234,0.5),
                  0 6px 16px rgba(118,75,162,0.4)
                `,
                background: 'linear-gradient(135deg, rgb(92,116,224) 0%, rgb(108,65,152) 100%)',
              },
              '&:active': { transform: 'translateY(0)' },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                transition: 'left 0.6s ease',
              },
              '&:hover::before': { left: '100%' },
              '&.Mui-disabled': {
                background: 'linear-gradient(135deg, #ccc 0%, #999 100%)',
                boxShadow: 'none',
                transform: 'none',
              },
            }}
          >
            {isSubmitting ? (
              <Stack direction="row" spacing={1.5} alignItems="center">
                <CircularProgress size={20} sx={{ color: 'white' }} />
                <span>Đang tạo tài khoản...</span>
              </Stack>
            ) : (
              'Đăng ký'
            )}
          </Button>

          <Divider sx={{ my: 2, opacity: 0.4 }} />

          <Typography
            variant="body2"
            color="text.secondary"
            textAlign="center"
            sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 500 }}
          >
            Đã có tài khoản?{' '}
            <Link component={RouterLink} to="/login" underline="hover" sx={{ fontWeight: 700 }}>
              Đăng nhập
            </Link>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
