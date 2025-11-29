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
  MenuItem,
  Chip,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { authService } from '../../../services/authService';

export default function SignUp() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1: email, 2: info+OTP, 3: card
  const [readerId, setReaderId] = useState(null);

  const [formData, setFormData] = useState({
    // step 1
    email: '',
    // step 2
    otp: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phoneNumber: '',
    dateOfBirth: '',
    gender: '',
    cccd: '',
    address: '',
    agree: true,
    // step 3
    cardTypeId: 1, // 1 = FREE, 2 = PREMIUM
    action: 'SKIP', // SKIP (free) hoặc PAY (premium)
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

  // ================= VALIDATE =================

  const validateStep1 = () => {
    const newErrors = {};
    if (!formData.email.trim()) {
      newErrors.email = 'Email không được để trống';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email không hợp lệ';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};

    if (!formData.otp.trim()) {
      newErrors.otp = 'Vui lòng nhập mã OTP';
    } else if (!/^\d{6}$/.test(formData.otp.trim())) {
      newErrors.otp = 'OTP phải gồm 6 chữ số';
    }

    if (!formData.password) {
      newErrors.password = 'Mật khẩu không được để trống';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Vui lòng nhập lại mật khẩu';
    } else if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Họ và tên không được để trống';
    }

    if (formData.phoneNumber && !/^\d{10,11}$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Số điện thoại phải 10-11 chữ số';
    }

    if (formData.cccd && !/^\d{9,12}$/.test(formData.cccd)) {
      newErrors.cccd = 'Số CMND/CCCD phải 9-12 chữ số';
    }

    if (!formData.agree) {
      newErrors.agree = 'Bạn cần đồng ý điều khoản sử dụng';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors = {};
    if (!readerId) {
      newErrors.cardTypeId = 'Thiếu thông tin readerId, hãy thực hiện lại bước 2';
    }
    if (![1, 2].includes(Number(formData.cardTypeId))) {
      newErrors.cardTypeId = 'Loại thẻ không hợp lệ';
    }
    if (!formData.action) {
      newErrors.action = 'Thiếu hành động đăng ký thẻ';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ================= CALL API =================

  // Bước 1: gửi OTP
  const handleInitRegister = async () => {
    if (!validateStep1()) return;

    setIsSubmitting(true);
    setApiError('');
    setApiSuccess('');

    try {
      const res = await authService.registerInit(formData.email.trim());

      if (res.ok) {
        setApiSuccess('Đã gửi mã OTP đến email của bạn. Vui lòng kiểm tra hộp thư (kể cả spam).');
        setStep(2);
      } else {
        setApiError(res.message || 'Không thể gửi OTP. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error('Init register error:', err);
      const code = err?.response?.data?.code;
      if (code === 'EMAIL_EXISTS') {
        setApiError('Email này đã được đăng ký tài khoản khác.');
      } else if (code === 'INVALID_EMAIL') {
        setApiError('Định dạng email không hợp lệ.');
      } else {
        setApiError(err?.message || 'Không thể gửi OTP. Vui lòng thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bước 2: verify OTP + tạo account/reader
  const handleVerifyRegister = async () => {
    if (!validateStep2()) return;

    setIsSubmitting(true);
    setApiError('');
    setApiSuccess('');

    try {
      const payload = {
        email: formData.email.trim(),
        otp: formData.otp.trim(),
        password: formData.password,
        fullName: formData.fullName.trim(),
        phoneNumber: formData.phoneNumber || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        gender: formData.gender || undefined,
        cccd: formData.cccd || undefined,
        address: formData.address || undefined,
      };

      const res = await authService.registerVerify(payload);

      if (res.ok && res.data) {
        const { account, reader } = res.data;
        setReaderId(reader.readerId);
        // lưu tạm để login nhanh
        localStorage.setItem('last_login_email', account.email);

        setApiSuccess('Xác thực OTP thành công! Hãy chọn loại thẻ thành viên để hoàn tất.');
        setStep(3);
      } else {
        setApiError(res.message || 'Xác thực OTP thất bại.');
      }
    } catch (err) {
      console.error('Verify register error:', err);
      const code = err?.response?.data?.code;
      if (code === 'OTP_INVALID_OR_EXPIRED') {
        setApiError('Mã OTP không đúng hoặc đã hết hạn (10 phút).');
      } else if (code === 'EMAIL_EXISTS') {
        setApiError('Email đã được đăng ký bởi người khác.');
      } else if (code === 'CCCD_EXISTS') {
        setApiError('Số CMND/CCCD đã được đăng ký.');
      } else if (code === 'WEAK_PASSWORD') {
        setApiError('Mật khẩu phải có ít nhất 6 ký tự.');
      } else {
        setApiError(err?.message || 'Xác thực OTP thất bại. Vui lòng thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bước 3: chọn thẻ + complete
  const handleCompleteRegister = async () => {
    if (!validateStep3()) return;

    setIsSubmitting(true);
    setApiError('');
    setApiSuccess('');

    try {
      const cardTypeId = Number(formData.cardTypeId);
      let action = formData.action;

      // Logic nhẹ: nếu thẻ FREE thì auto SKIP, thẻ PREMIUM thì auto PAY
      if (cardTypeId === 1) action = 'SKIP';
      if (cardTypeId === 2) action = 'PAY';

      const payload = {
        readerId,
        cardTypeId,
        action,
      };

      const res = await authService.registerComplete(payload);

      if (cardTypeId === 1 && res.ok && res.memberCard) {
        setApiSuccess('Đăng ký thành công! Thẻ FREE đã được tạo cho bạn. Hãy đăng nhập để sử dụng.');
        // chuyển sang login sau 2 giây
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
      } else if (cardTypeId === 2 && res.ok && res.payos) {
        setApiSuccess(
          'Đã tạo đơn thanh toán PREMIUM 150.000đ. Hãy thanh toán qua PayOS, sau đó đăng nhập để xem thẻ.'
        );
        // mở trang thanh toán PayOS
        if (res.payos.checkoutUrl) {
          window.open(res.payos.checkoutUrl, '_blank');
        }
        // chuyển sang login sau 3 giây
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 3000);
      } else {
        setApiError(res.message || 'Không thể hoàn tất đăng ký. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error('Complete register error:', err);
      const code = err?.response?.data?.code;
      if (code === 'CARD_TYPE_NOT_FOUND') {
        setApiError('Loại thẻ không tồn tại hoặc đã bị xóa.');
      } else if (code === 'PAYOS_CREATE_FAILED') {
        setApiError('Không thể tạo link thanh toán PayOS.');
      } else {
        setApiError(err?.message || 'Không thể hoàn tất đăng ký. Vui lòng thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler cho nút chính theo step
  const handleSubmit = (e) => {
    e.preventDefault();
    if (step === 1) return handleInitRegister();
    if (step === 2) return handleVerifyRegister();
    if (step === 3) return handleCompleteRegister();
  };

  const renderStepTitle = () => {
    if (step === 1) return 'Bước 1: Xác thực email';
    if (step === 2) return 'Bước 2: Thông tin cá nhân & OTP';
    return 'Bước 3: Chọn loại thẻ thành viên';
  };

  const renderPrimaryButtonLabel = () => {
    if (isSubmitting) {
      if (step === 1) return 'Đang gửi OTP...';
      if (step === 2) return 'Đang xác thực...';
      if (step === 3) return 'Đang hoàn tất...';
    }
    if (step === 1) return 'Gửi mã OTP';
    if (step === 2) return 'Xác thực & tạo tài khoản';
    return 'Hoàn tất đăng ký';
  };

  // ================= UI =================

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
          maxWidth: 620,
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
        }}
      >
        <Stack spacing={3.5} component="form" onSubmit={handleSubmit} noValidate>
          {/* Brand + Step */}
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
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5, fontWeight: 500, opacity: 0.8, letterSpacing: '0.02em' }}
              >
                {renderStepTitle()}
              </Typography>

              {/* mini step indicator */}
              <Stack direction="row" spacing={1.5} justifyContent="center" mt={1}>
                {[1, 2, 3].map((s) => (
                  <Chip
                    key={s}
                    size="small"
                    label={`B${s}`}
                    variant={step === s ? 'filled' : 'outlined'}
                    color={step === s ? 'primary' : 'default'}
                    sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                  />
                ))}
              </Stack>
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

          {/* ==== STEP 1: EMAIL ==== */}
          {step === 1 && (
            <Stack spacing={2.5}>
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
                helperText={errors.email || 'Email sẽ được dùng để gửi mã OTP'}
                fullWidth
              />
            </Stack>
          )}

          {/* ==== STEP 2: INFO + OTP ==== */}
          {step === 2 && (
            <Stack spacing={2.2}>
              <TextField
                id="email"
                name="email"
                type="email"
                label="Email"
                value={formData.email}
                disabled
                fullWidth
                helperText="Email đã cố định, nếu muốn đổi hãy quay lại bước 1."
              />

              <TextField
                id="otp"
                name="otp"
                label="Mã OTP (6 số)"
                placeholder="Nhập mã OTP từ email"
                value={formData.otp}
                onChange={handleChange}
                disabled={isSubmitting}
                error={Boolean(errors.otp)}
                helperText={errors.otp}
                fullWidth
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
                      >
                        {showPwd ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                label="Xác nhận mật khẩu"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={isSubmitting}
                error={Boolean(errors.confirmPassword)}
                helperText={errors.confirmPassword}
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
                      >
                        {showConfirm ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

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
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  id="phoneNumber"
                  name="phoneNumber"
                  label="Số điện thoại"
                  placeholder="Ví dụ: 0987654321"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  error={Boolean(errors.phoneNumber)}
                  helperText={errors.phoneNumber}
                  fullWidth
                />
                <TextField
                  id="dateOfBirth"
                  name="dateOfBirth"
                  label="Ngày sinh"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  id="gender"
                  name="gender"
                  label="Giới tính"
                  select
                  value={formData.gender}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  fullWidth
                >
                  <MenuItem value="">Không chọn</MenuItem>
                  <MenuItem value="male">Nam</MenuItem>
                  <MenuItem value="female">Nữ</MenuItem>
                </TextField>
                <TextField
                  id="cccd"
                  name="cccd"
                  label="Số CMND/CCCD"
                  value={formData.cccd}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  error={Boolean(errors.cccd)}
                  helperText={errors.cccd}
                  fullWidth
                />
              </Stack>

              <TextField
                id="address"
                name="address"
                label="Địa chỉ"
                placeholder="Nhập địa chỉ"
                value={formData.address}
                onChange={handleChange}
                disabled={isSubmitting}
                fullWidth
              />

              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: -0.5 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      name="agree"
                      checked={formData.agree}
                      onChange={handleChange}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2">
                      Tôi đồng ý với{' '}
                      <Link href="/terms" underline="hover" sx={{ fontWeight: 700 }}>
                        Điều khoản sử dụng
                      </Link>
                    </Typography>
                  }
                />
              </Stack>
              {errors.agree && (
                <Typography variant="body2" color="error" sx={{ fontWeight: 600 }}>
                  {errors.agree}
                </Typography>
              )}

              <Button
                variant="text"
                size="small"
                disabled={isSubmitting}
                onClick={() => setStep(1)}
                sx={{ alignSelf: 'flex-start' }}
              >
                ← Quay lại bước 1
              </Button>
            </Stack>
          )}

          {/* ==== STEP 3: CARD TYPE ==== */}
          {step === 3 && (
            <Stack spacing={2.5}>
              <Alert severity="info">
                Bạn đã có tài khoản độc giả. Hãy chọn loại thẻ thành viên để sử dụng dịch vụ thư viện.
              </Alert>

              <Stack spacing={1.5}>
                <Button
                  variant={Number(formData.cardTypeId) === 1 ? 'contained' : 'outlined'}
                  onClick={() =>
                    setFormData((p) => ({ ...p, cardTypeId: 1, action: 'SKIP' }))
                  }
                  disabled={isSubmitting}
                  sx={{ justifyContent: 'space-between' }}
                >
                  <span>Thẻ FREE (miễn phí)</span>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    0đ • Đọc sách tại chỗ, mượn số lượng cơ bản
                  </Typography>
                </Button>

                <Button
                  variant={Number(formData.cardTypeId) === 2 ? 'contained' : 'outlined'}
                  onClick={() =>
                    setFormData((p) => ({ ...p, cardTypeId: 2, action: 'PAY' }))
                  }
                  disabled={isSubmitting}
                  sx={{ justifyContent: 'space-between' }}
                >
                  <span>Thẻ PREMIUM (150.000đ / năm)</span>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Mượn nhiều hơn, ưu tiên đặt chỗ, nhiều ưu đãi khác
                  </Typography>
                </Button>

                {errors.cardTypeId && (
                  <Typography variant="body2" color="error">
                    {errors.cardTypeId}
                  </Typography>
                )}
              </Stack>

              <Button
                variant="text"
                size="small"
                disabled={isSubmitting}
                onClick={() => setStep(2)}
                sx={{ alignSelf: 'flex-start' }}
              >
                ← Quay lại bước 2
              </Button>
            </Stack>
          )}

          {/* Nút submit */}
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
            }}
          >
            {isSubmitting ? (
              <Stack direction="row" spacing={1.5} alignItems="center">
                <CircularProgress size={20} sx={{ color: 'white' }} />
                <span>{renderPrimaryButtonLabel()}</span>
              </Stack>
            ) : (
              renderPrimaryButtonLabel()
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
