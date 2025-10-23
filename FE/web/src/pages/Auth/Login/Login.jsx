import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Checkbox,
  FormControlLabel,
  Divider,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useAuth } from '../../../contexts/AuthContext';
import ButtonLoader from '../../../components/Loading/ButtonLoader.jsx';


export default function Login() {
  const navigate = useNavigate();
  const { login, user, isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  // Ẩn thanh cuộn toàn cục khi component mount
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Tự động chuyển trang nếu đã đăng nhập
  useEffect(() => {
    if (isAuthenticated && user) {
      const routes = { 1: '/admin', 2: '/librarian', 3: '/reader' };
      navigate(routes[user.roleId] || '/admin', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const validateForm = () => {
    const newErrors = {};
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
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    if (name === 'remember') {
      setRemember(checked);
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (apiError) setApiError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setApiError('');

    try {
      if (remember) localStorage.setItem('last_login_email', formData.email);
      else localStorage.removeItem('last_login_email');

      const account = await login(formData.email, formData.password);
      const routes = { 1: '/admin', 2: '/librarian', 3: '/reader' };
      navigate(routes[account.roleId] || '/admin');
    } catch (error) {
      console.error('Login error:', error);
      setApiError(error.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Prefill email từ localStorage
  useEffect(() => {
    const saved = localStorage.getItem('last_login_email');
    if (saved) setFormData((p) => ({ ...p, email: saved }));
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        p: { xs: 2, sm: 3 },
        overflow: 'hidden', // Ẩn thanh cuộn cho chính component này
        // Nền được tối ưu
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

      {/* Card đăng nhập */}
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 440,
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
          // Viền gradient
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            padding: '1.5px',
            borderRadius: 3.5,
            background: 'linear-gradient(135deg, rgba(102,126,234,0.6), rgba(118,75,162,0.6), rgba(102,126,234,0.6))',
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            pointerEvents: 'none',
          },
          animation: 'slideUpFade 500ms cubic-bezier(0.16, 1, 0.3, 1)',
          '@keyframes slideUpFade': {
            from: {
              opacity: 0,
              transform: 'translateY(24px) scale(0.98)'
            },
            to: {
              opacity: 1,
              transform: 'translateY(0) scale(1)'
            },
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
          {/* Brand section */}
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
                Thư Viện Book-Tech
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
                sx={{
                  mt: 0.5,
                  fontWeight: 500,
                  opacity: 0.8,
                  letterSpacing: '0.02em',
                }}
              >
                Chào mừng bạn trở lại
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
                '& .MuiAlert-message': {
                  padding: '4px 0',
                },
              }}
            >
              {apiError}
            </Alert>
          )}

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
            autoComplete="email"
            fullWidth
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2.5,
                fontSize: '0.95rem',
                transition: 'all 0.2s ease',
                fontFamily: '"Inter", sans-serif',
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.light',
                },
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
            type={showPassword ? 'text' : 'password'}
            label="Mật khẩu"
            placeholder="••••••••"
            value={formData.password}
            onChange={handleChange}
            disabled={isSubmitting}
            error={Boolean(errors.password)}
            helperText={errors.password}
            autoComplete="current-password"
            fullWidth
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    onClick={() => setShowPassword((p) => !p)}
                    edge="end"
                    disabled={isSubmitting}
                    sx={{
                      color: 'text.secondary',
                      '&:hover': {
                        backgroundColor: 'rgba(102,126,234,0.08)',
                        color: 'primary.main',
                      },
                    }}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
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
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.light',
                },
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

          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mt: -0.5 }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  name="remember"
                  checked={remember}
                  onChange={handleChange}
                  size="small"
                  sx={{
                    color: 'primary.main',
                    '&.Mui-checked': {
                      color: 'primary.main',
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(102,126,234,0.08)',
                    },
                  }}
                />
              }
              label={
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: '"Inter", sans-serif',
                    fontWeight: 500,
                    userSelect: 'none',
                  }}
                >
                  Ghi nhớ đăng nhập
                </Typography>
              }
              sx={{ userSelect: 'none' }}
            />
            <Typography
              component="a"
              href="/forgot-password"
              sx={{
                fontSize: '0.875rem',
                textDecoration: 'none',
                color: 'primary.main',
                fontWeight: 600,
                fontFamily: '"Inter", sans-serif',
                transition: 'all 0.2s ease',
                '&:hover': {
                  textDecoration: 'underline',
                  color: 'primary.dark',
                },
              }}
            >
              Quên mật khẩu?
            </Typography>
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
              '&:active': {
                transform: 'translateY(0)',
              },
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
              '&:hover::before': {
                left: '100%',
              },
              '&.Mui-disabled': {
                background: 'linear-gradient(135deg, #ccc 0%, #999 100%)',
                boxShadow: 'none',
                transform: 'none',
              },
            }}
          >
            {isSubmitting ? (
              <Stack direction="row" spacing={1.5} alignItems="center">
                <ButtonLoader inline size={35} />
                <span>Đang đăng nhập...</span>
              </Stack>
            ) : (
              'Đăng nhập'
            )}
          </Button>

          <Divider sx={{ my: 2, opacity: 0.4 }} />

          <Typography
            variant="body2"
            color="text.secondary"
            textAlign="center"
            sx={{
              fontFamily: '"Inter", sans-serif',
              fontWeight: 500,
            }}
          >
            Chưa có tài khoản?{' '}
            <Typography
              component="a"
              href="/signup"
              sx={{
                color: 'primary.main',
                fontWeight: 700,
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                fontFamily: '"Inter", sans-serif',
                '&:hover': {
                  textDecoration: 'underline',
                  color: 'primary.dark',
                },
              }}
            >
              Đăng ký ngay
            </Typography>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}