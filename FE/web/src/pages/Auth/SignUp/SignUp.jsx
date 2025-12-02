// src/pages/Auth/SignUp/SignUp.jsx
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
import QRCode from 'react-qr-code';

import { authService } from '../../../services/authService';
import { useAuth } from '../../../contexts/AuthContext';

export default function SignUp() {
  const navigate = useNavigate();
  const { login } = useAuth();

  // 1: Thông tin + OTP, 2: Làm thẻ
  const [step, setStep] = useState(1);
  const [readerId, setReaderId] = useState(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phoneNumber: '',
    dateOfBirth: '',
    gender: '',
    cccd: '',
    address: '',
    agree: true,
    otp: '',
  });

  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [apiSuccess, setApiSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [paymentData, setPaymentData] = useState(null);
  const [isWaitingPayment, setIsWaitingPayment] = useState(false);

  // Prefill email nếu có
  useEffect(() => {
    const saved = sessionStorage.getItem('last_login_email');
    if (saved && !formData.email) {
      setFormData((p) => ({ ...p, email: saved }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lắng nghe event payment_success (NotificationContext sẽ dispatch)
  useEffect(() => {
    const handlePaymentSuccess = (e) => {
      console.log('🔔 payment_success event:', e.detail);
      setApiError('');
      setApiSuccess('Thanh toán thành công! Thẻ thư viện của bạn đã được tạo.');
      setIsWaitingPayment(false);

      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3000);
    };

    window.addEventListener('payment_success', handlePaymentSuccess); 

    return () => {
      window.removeEventListener('payment_success', handlePaymentSuccess);
    };
  }, [navigate]);

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

  // ===== VALIDATE =====
  const validateInfo = () => {
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

    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const validateOtp = () => {
    const newErrors = {};
    if (!formData.otp.trim()) {
      newErrors.otp = 'Vui lòng nhập mã OTP';
    } else if (!/^\d{6}$/.test(formData.otp.trim())) {
      newErrors.otp = 'OTP phải gồm 6 chữ số';
    }
    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
    if (!readerId) {
      newErrors.cardType = 'Thiếu readerId, hãy thực hiện lại bước trước.';
    }
    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  // ===== CALL API =====

  // Gửi OTP
  const handleInitRegister = async () => {
    const okInfo = validateInfo();
    if (!okInfo) return;

    setIsSubmitting(true);
    setApiError('');
    setApiSuccess('');

    try {
      const res = await authService.registerInit(formData.email.trim());
      if (res.ok) {
        setApiSuccess(
          'Đã gửi mã OTP đến email của bạn. Vui lòng kiểm tra hộp thư (kể cả spam).'
        );
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
      } else if (code === 'MISSING_EMAIL') {
        setApiError('Thiếu thông tin email.');
      } else {
        setApiError(err?.message || 'Không thể gửi OTP. Vui lòng thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xác thực OTP + tạo account + reader + auto login
  const handleVerifyRegister = async () => {
    const okInfo = validateInfo();
    const okOtp = validateOtp();
    if (!okInfo || !okOtp) return;

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

        sessionStorage.setItem('last_login_email', account.email);

        // Auto login sau khi tạo tài khoản
        try {
          await login(formData.email.trim(), formData.password);
          console.log('✅ Auto login sau đăng ký thành công');
        } catch (loginErr) {
          console.error('Auto login sau đăng ký thất bại:', loginErr);
        }

        setApiSuccess('Tạo tài khoản thành công! Hãy làm thẻ thư viện để hoàn tất.');
        setStep(2);
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
      } else if (code === 'MISSING_FIELDS') {
        setApiError('Thiếu các trường bắt buộc (email, otp, password, họ tên).');
      } else {
        setApiError(err?.message || 'Xác thực OTP thất bại. Vui lòng thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // unwrap response /register/complete
  const unwrapCompleteResponse = (res) => {
    const level1 = res && res.data ? res.data : res;
    return level1 && level1.data ? level1.data : level1;
  };

  // ĐỂ SAU → tạo thẻ free (cardTypeId=1, action=SKIP)
  const handleCreateLater = async () => {
    if (!validateStep2()) return;

    setIsSubmitting(true);
    setApiError('');
    setApiSuccess('');
    setPaymentData(null);
    setIsWaitingPayment(false);

    try {
      const payload = {
        readerId,
        cardTypeId: 1,
        action: 'SKIP',
      };

      const res = await authService.registerComplete(payload);
      const data = unwrapCompleteResponse(res);

      if (data && data.free && data.memberCard) {
        setApiSuccess(
          'Đăng ký thành công! Bạn có thể làm thẻ chi tiết hơn sau. Hãy đăng nhập để sử dụng tài khoản.'
        );
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
      } else {
        setApiError(
          data?.message || res?.message || 'Không thể hoàn tất đăng ký. Vui lòng thử lại.'
        );
      }
    } catch (err) {
      console.error('Create later card error:', err);
      const code = err?.response?.data?.code;
      if (code === 'CARD_TYPE_NOT_FOUND') {
        setApiError('Loại thẻ không tồn tại hoặc đã bị xóa.');
      } else {
        setApiError(err?.message || 'Không thể hoàn tất đăng ký. Vui lòng thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // LÀM THẺ NGAY → tạo payment + QR (cardTypeId=2, action=PAY)
  const handleCreateAndPayCard = async () => {
    if (!validateStep2()) return;

    setIsSubmitting(true);
    setApiError('');
    setApiSuccess('');
    setPaymentData(null);
    setIsWaitingPayment(false);

    try {
      const payload = {
        readerId,
        cardTypeId: 2,
        action: 'PAY',
      };

      const res = await authService.registerComplete(payload);
      const data = unwrapCompleteResponse(res);

      if (data && data.payos && data.payos.qrCode) {
        setPaymentData({
          amount: data.amount,
          orderCode: data.orderCode,
          qrCode: data.payos.qrCode,
        });
        setIsWaitingPayment(true);
        setApiSuccess(
          'Đã tạo đơn thanh toán làm thẻ thư viện (150.000đ). Vui lòng quét QR để thanh toán. Sau khi thanh toán xong, hệ thống sẽ tự chuyển bạn sang trang đăng nhập.'
        );
      } else {
        setApiError(
          data?.message || res?.message || 'Không thể tạo đơn thanh toán. Vui lòng thử lại.'
        );
      }
    } catch (err) {
      console.error('Create card & payment error:', err);
      const code = err?.response?.data?.code;
      if (code === 'CARD_TYPE_NOT_FOUND') {
        setApiError('Loại thẻ không tồn tại hoặc đã bị xóa.');
      } else if (code === 'PAYOS_CREATE_FAILED') {
        setApiError('Không thể tạo link thanh toán PayOS.');
      } else {
        setApiError(err?.message || 'Không thể tạo đơn thanh toán. Vui lòng thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (step === 1) return handleVerifyRegister();
    if (step === 2) return handleCreateAndPayCard();
  };

  const renderStepTitle = () => {
    if (step === 1) return 'Bước 1: Thông tin & xác thực email';
    return 'Bước 2: Làm thẻ thư viện';
  };

  const renderPrimaryButtonLabel = () => {
    if (isSubmitting) return 'Đang xử lý...';
    if (step === 1) return 'Xác thực & tạo tài khoản';
    return 'Làm thẻ ngay';
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        p: { xs: 2, sm: 3 },
        overflowY: 'auto',
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
          {/* Header + Step */}
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

              <Stack direction="row" spacing={1.5} justifyContent="center" mt={1}>
                {[1, 2].map((s) => (
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

          {/* STEP 1: Thông tin + OTP */}
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
                helperText={errors.email || 'Email dùng để đăng nhập và nhận mã OTP'}
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
              {errors.agree && (
                <Typography variant="body2" color="error" sx={{ fontWeight: 600 }}>
                  {errors.agree}
                </Typography>
              )}

              <TextField
                id="otp"
                name="otp"
                label="Mã OTP (6 số)"
                placeholder="Nhập mã OTP từ email"
                value={formData.otp}
                onChange={handleChange}
                disabled={isSubmitting}
                error={Boolean(errors.otp)}
                helperText={errors.otp || 'Nhấn "Gửi mã OTP" để nhận mã, sau đó nhập vào đây.'}
                fullWidth
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  type="button"
                  variant="outlined"
                  disabled={isSubmitting}
                  onClick={handleInitRegister}
                  fullWidth
                >
                  Gửi mã OTP
                </Button>
                <Button
                  type="button"
                  variant="contained"
                disabled={isSubmitting}
                onClick={handleVerifyRegister}
                fullWidth
                >
                {renderPrimaryButtonLabel()}
              </Button>
            </Stack>
            </Stack>
          )}

        {/* STEP 2: Làm thẻ thư viện */}
        {step === 2 && (
          <Stack spacing={2.5}>
            <Alert severity="info">
              Tài khoản độc giả đã được tạo. Để có thể <b>mượn sách mang về</b>, bạn cần làm thẻ
              thư viện.
            </Alert>

            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Bạn có thể:
              <br />• Chọn <b>"Làm thẻ ngay"</b> để thanh toán làm thẻ (150.000đ) và dùng đầy đủ
              chức năng.
              <br />• Hoặc chọn <b>"Để sau"</b> nếu hiện tại chưa muốn làm thẻ.
            </Typography>

            {paymentData && paymentData.qrCode && (
              <Stack
                spacing={1.5}
                alignItems="center"
                sx={{
                  p: 2,
                  borderRadius: 2.5,
                  border: '1px dashed rgba(0,0,0,0.12)',
                  backgroundColor: 'rgba(247,250,252,0.9)',
                }}
              >
                <Typography variant="subtitle2" fontWeight={700}>
                  Quét QR để thanh toán làm thẻ thư viện
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Số tiền: {paymentData.amount?.toLocaleString('vi-VN')} đ
                </Typography>

                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    backgroundColor: '#fff',
                  }}
                >
                  <QRCode value={paymentData.qrCode} size={180} />
                </Box>

                <Typography variant="caption" sx={{ opacity: 0.7, textAlign: 'center' }}>
                  Sau khi thanh toán thành công, hệ thống sẽ tự động xác nhận và chuyển bạn sang
                  trang đăng nhập.
                </Typography>
              </Stack>
            )}

            {errors.cardType && (
              <Typography variant="body2" color="error">
                {errors.cardType}
              </Typography>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                type="button"
                variant="contained"
                fullWidth
                disabled={isSubmitting}
                onClick={handleCreateAndPayCard}
              >
                Làm thẻ ngay
              </Button>
              <Button
                type="button"
                variant="outlined"
                fullWidth
                disabled={isSubmitting}
                onClick={handleCreateLater}
              >
                Để sau
              </Button>
            </Stack>
          </Stack>
        )}

        <Divider sx={{ my: 2, opacity: 0.4 }} />

        <Typography
          variant="body2"
          color="text.secondary"
          textAlign="center"
          sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 500 }}
        >
          Đã có tài khoản?{' '}
          <Typography
            component={RouterLink}
            to="/login"
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
            Đăng nhập
          </Typography>
        </Typography>
      </Stack>
    </Paper>
    </Box >
  );
}
