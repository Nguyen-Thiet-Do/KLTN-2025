// src/components/reader/ProfilePage.jsx 
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { 
  Box, 
  Typography, 
  Button, 
  Avatar, 
  Paper, 
  Divider,
  Stack,
  Chip,
  Alert,
  Card,
  CardContent,
  Grid
} from "@mui/material";
import ReaderHeader from "../../components/layouts/ReaderHeader";
import { useNavigate } from "react-router-dom";
import {
  Person,
  Wc,
  Cake,
  Phone,
  CreditCard,
  Home,
  Email,
  Edit,
  CardMembership,
  AddCard
} from "@mui/icons-material";
import QRPaymentModal from "../Readers/QRPaymentModal";
import { completeRegistration, topupMemberCard } from "../../services/authService";

export default function ProfilePage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const navigate = useNavigate();

  // ✅ State cho payment modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [currentPaymentData, setCurrentPaymentData] = useState(null);

  const getGenderDisplay = (gender) => {
    if (!gender) return "Chưa cập nhật";
    if (typeof gender === "object") {
      const value = gender?.data?.[0] ?? (gender instanceof Uint8Array ? gender[0] : undefined);
      if (value === 1) return "Nam";
      if (value === 0) return "Nữ";
      return "Khác";
    }
    const g = gender.toString().trim().toLowerCase();
    if (["male", "nam", "1"].includes(g)) return "Nam";
    if (["female", "nu", "nữ", "0"].includes(g)) return "Nữ";
    if (["other", "khac", "khác"].includes(g)) return "Khác";
    return "Chưa cập nhật";
  };

  const formatDate = (date) => {
    if (!date) return null;
    try {
      return new Date(date).toLocaleDateString("vi-VN");
    } catch {
      return null;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount || 0);
  };

  useEffect(() => {
    if (!authLoading) {
      setLoading(false);
      console.log('👤 Current user data:', user);
    }
  }, [user, authLoading]);

  // ========================================
  // ✅ USE CASE 1: ĐĂNG KÝ THẺ MỚI (chưa có thẻ)
  // ========================================
  const handleRegisterMemberCard = async () => {
    try {
      setProcessingPayment(true);
      setError(null);

      const token = sessionStorage.getItem("accessToken");
      if (!token) {
        throw new Error("Vui lòng đăng nhập lại");
      }

      console.log("📝 [ĐĂNG KÝ THẺ MỚI] Reader:", user.readerId);

      const res = await completeRegistration(
        {
          readerId: user.readerId,
          cardTypeId: 2, // PREMIUM card
          action: "PAY"
        },
        token
      );

      console.log("✅ Register card response:", res);

      const responseData = res.data || res;
      const paymentId = responseData.paymentId;
      const amount = responseData.amount;
      const qrCode = responseData.payos?.qrCode;
      const checkoutUrl = responseData.payos?.checkoutUrl;
      
      if (!paymentId) {
        throw new Error("Không nhận được thông tin thanh toán từ server");
      }

      const paymentInfo = {
        paymentId: paymentId,
        qrCode: qrCode || null,
        checkoutUrl: checkoutUrl || null,
        amount: amount || 10000
      };

      console.log("🎯 Payment info (register):", paymentInfo);

      if (!paymentInfo.qrCode && !paymentInfo.checkoutUrl) {
        throw new Error("Không có thông tin thanh toán. Vui lòng liên hệ quản trị viên.");
      }

      setCurrentPaymentData(paymentInfo);
      setPaymentModalOpen(true);
      setProcessingPayment(false);

    } catch (err) {
      setProcessingPayment(false);
      console.error("❌ Lỗi đăng ký thẻ:", err);
      
      let errorMessage = "Không thể tạo thanh toán";
      
      if (err.response) {
        const serverError = err.response.data;
        
        if (serverError.message === "PAYOS_CREATE_FAILED") {
          errorMessage = "Không thể kết nối với cổng thanh toán. Vui lòng thử lại sau.";
        } else if (serverError.message === "Reader already has an active member card") {
          errorMessage = "Bạn đã có thẻ thành viên rồi!";
        } else if (serverError.message) {
          errorMessage = serverError.message;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    }
  };

  // ========================================
  // ✅ USE CASE 2: NẠP TIỀN VÀO THẺ (đã có thẻ)
  // ========================================
  const handleTopupBalance = async () => {
    try {
      setProcessingPayment(true);
      setError(null);
      setSuccess(null);

      const token = sessionStorage.getItem("accessToken");
      if (!token) {
        throw new Error("Vui lòng đăng nhập lại");
      }

      const memberCardId = user?.memberCard?.memberCardId;
      if (!memberCardId) {
        throw new Error("Không tìm thấy thẻ thành viên");
      }

      console.log("💰 [NẠP TIỀN] MemberCardId:", memberCardId);

      const res = await topupMemberCard(
        {
          memberCardId: memberCardId,
          readerId: user.readerId
        },
        token
      );

      console.log("✅ Topup response:", res);
      console.log("📦 Full response structure:", JSON.stringify(res, null, 2));

      // ✅ Xử lý trường hợp đã đủ tiền
      // Backend có thể trả về nhiều format khác nhau:
      // Format 1: { already_sufficient: {...} }
      if (res.already_sufficient) {
        const balanceInfo = res.already_sufficient;
        setSuccess(
          `${balanceInfo.message || "Số dư thẻ của bạn đã đầy rồi!"} 🎉\n` +
          `Số dư hiện tại: ${formatCurrency(balanceInfo.currentBalance)}`
        );
        setProcessingPayment(false);
        return;
      }
      
      // Format 2: { success: true, message: "Thẻ đã có đủ số dư...", data: {...} }
      if (res.success === true && res.message?.includes("đủ số dư")) {
        const balanceData = res.data || {};
        setSuccess(
          `${res.message} 🎉\n` +
          `Số dư hiện tại: ${formatCurrency(balanceData.currentBalance || 0)}`
        );
        setProcessingPayment(false);
        return;
      }
      
      // Format 3: Check data có currentBalance >= targetBalance
      if (res.success && res.data?.currentBalance !== undefined && 
          res.data?.targetBalance !== undefined &&
          res.data.currentBalance >= res.data.targetBalance) {
        setSuccess(
          `Số dư thẻ của bạn đã đầy rồi! 🎉\n` +
          `Số dư hiện tại: ${formatCurrency(res.data.currentBalance)}`
        );
        setProcessingPayment(false);
        return;
      }

      // ✅ Xử lý trường hợp cần thanh toán
      // Backend có thể trả về: res.created hoặc res.data
      let responseData = res.created || res.data || res;
      
      console.log("📋 Response data:", responseData);
      console.log("💳 Payment ID:", responseData.paymentId);
      console.log("💰 Amount:", responseData.amount);
      console.log("🔗 Checkout URL:", responseData.checkoutUrl);
      console.log("📱 QR Code:", responseData.qrCode);

      const paymentId = responseData.paymentId;
      const amount = responseData.amount;
      const qrCode = responseData.qrCode;
      const checkoutUrl = responseData.checkoutUrl;
      
      if (!paymentId) {
        console.error("❌ Missing paymentId in response:", responseData);
        throw new Error("Không nhận được thông tin thanh toán từ server. Vui lòng kiểm tra console.");
      }

      const paymentInfo = {
        paymentId: paymentId,
        qrCode: qrCode || null,
        checkoutUrl: checkoutUrl || null,
        amount: amount
      };

      console.log("🎯 Payment info (topup):", paymentInfo);

      if (!paymentInfo.qrCode && !paymentInfo.checkoutUrl) {
        throw new Error("Không có thông tin thanh toán. Vui lòng liên hệ quản trị viên.");
      }

      setCurrentPaymentData(paymentInfo);
      setPaymentModalOpen(true);
      setProcessingPayment(false);

    } catch (err) {
      setProcessingPayment(false);
      console.error("❌ Lỗi nạp tiền:", err);
      
      let errorMessage = "Không thể tạo thanh toán";
      
      if (err.response) {
        const serverError = err.response.data;
        
        if (serverError.message === "PAYOS_CREATE_FAILED") {
          errorMessage = "Không thể kết nối với cổng thanh toán. Vui lòng thử lại sau.";
        } else if (serverError.message === "MISSING_MEMBER_CARD") {
          errorMessage = "Không tìm thấy thẻ thành viên!";
        } else if (serverError.message) {
          errorMessage = serverError.message;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    }
  };

  const handlePaymentSuccess = () => {
    console.log("✅ Thanh toán thành công - Đang reload trang...");
    
    setPaymentModalOpen(false);
    setCurrentPaymentData(null);
    
    alert("🎉 Thanh toán thành công!");
    
    window.location.reload();
  };

  if (loading || authLoading) {
    return (
      <>
        <ReaderHeader />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <Typography>Đang tải...</Typography>
        </Box>
      </>
    );
  }

  const InfoRow = ({ icon: Icon, label, value }) => (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        py: 2,
        px: 3,
        borderRadius: 2,
        transition: "all 0.3s ease",
        "&:hover": {
          backgroundColor: "rgba(25, 118, 210, 0.04)",
          transform: "translateX(5px)",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 48,
          height: 48,
          borderRadius: "12px",
          backgroundColor: "primary.main",
          color: "white",
          mr: 3,
        }}
      >
        <Icon />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {label}
        </Typography>
        <Typography
          variant="body1"
          sx={{
            fontWeight: 600,
            color: "text.primary",
            mt: 0.5,
          }}
        >
          {value || "Chưa cập nhật"}
        </Typography>
      </Box>
    </Box>
  );

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
        <Box
          sx={{
            maxWidth: 900,
            mx: "auto",
          }}
        >
          {/* Profile Card */}
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
                pt: 6,
                pb: 8,
                px: 4,
                textAlign: "center",
                position: "relative",
              }}
            >
              <Avatar
                sx={{
                  width: 120,
                  height: 120,
                  mx: "auto",
                  mb: 2,
                  border: "4px solid white",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                  fontSize: "3rem",
                  fontWeight: 700,
                }}
              >
                {user?.fullName?.[0]?.toUpperCase() || "U"}
              </Avatar>
              <Typography
                variant="h4"
                sx={{
                  color: "white",
                  fontWeight: 700,
                  mb: 1,
                }}
              >
                {user?.fullName || "Người dùng"}
              </Typography>
              <Chip
                label={user?.memberCard ? "Thành viên" : "Chưa là thành viên"}
                sx={{
                  backgroundColor: user?.memberCard
                    ? "rgba(255,255,255,0.25)"
                    : "rgba(0,0,0,0.25)",
                  color: "white",
                  fontWeight: 600,
                  backdropFilter: "blur(10px)",
                }}
              />

              {/* ========================================
                  ✅ USE CASE 1: NÚT ĐĂNG KÝ THẺ (chưa có thẻ)
                  ======================================== */}
              {!user?.memberCard && (
                <Box sx={{ mt: 3 }}>
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    startIcon={<CardMembership />}
                    onClick={handleRegisterMemberCard}
                    disabled={processingPayment}
                    sx={{
                      py: 1.5,
                      borderRadius: 2,
                      fontWeight: 600,
                      fontSize: "1rem",
                      textTransform: "none",
                      background: "white",
                      color: "#667eea",
                      boxShadow: "0 8px 24px rgba(255,255,255,0.3)",
                      "&:hover": {
                        background: "rgba(255,255,255,0.95)",
                        boxShadow: "0 12px 32px rgba(255,255,255,0.4)",
                        transform: "translateY(-2px)",
                      },
                      "&:disabled": {
                        background: "rgba(255,255,255,0.5)",
                        color: "rgba(102,126,234,0.5)",
                      },
                      transition: "all 0.3s ease",
                    }}
                  >
                    {processingPayment ? "Đang xử lý..." : "Đăng ký thẻ thành viên - 10.000đ"}
                  </Button>

                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      mt: 1,
                      color: "rgba(255,255,255,0.8)",
                      fontStyle: "italic",
                    }}
                  >
                    ✨ Trở thành thành viên để mượn sách không giới hạn
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Info Section */}
            <Box sx={{ p: 4 }}>
              {/* ✅ Hiển thị thông báo */}
              {error && (
                <Alert 
                  severity="error" 
                  sx={{ mb: 3, borderRadius: 2 }}
                  onClose={() => setError(null)}
                >
                  {error}
                </Alert>
              )}

              {success && (
                <Alert 
                  severity="success" 
                  sx={{ mb: 3, borderRadius: 2 }}
                  onClose={() => setSuccess(null)}
                >
                  {success}
                </Alert>
              )}

              {/* ========================================
                  ✅ USE CASE 2: THÔNG TIN THẺ + NÚT NẠP TIỀN (đã có thẻ)
                  ======================================== */}
              {user?.memberCard && (
                <Card
                  sx={{
                    mb: 4,
                    borderRadius: 3,
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                    boxShadow: "0 8px 24px rgba(102, 126, 234, 0.3)",
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                      <CardMembership sx={{ fontSize: 32, mr: 2 }} />
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Thẻ thành viên
                      </Typography>
                    </Box>

                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="caption" sx={{ opacity: 0.8 }}>
                          Số thẻ
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {user.memberCard.cardNumber || "N/A"}
                        </Typography>
                      </Grid>

                      <Grid item xs={6}>
                        {/* <Typography variant="caption" sx={{ opacity: 0.8 }}>
                          Loại thẻ
                        </Typography> */}
                        {/* <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {user.memberCard.cardType?.cardTypeName || 
                           user.memberCard.cardType?.typeName || "N/A"}
                        </Typography> */}
                      </Grid>

                      <Grid item xs={6}>
                        <Typography variant="caption" sx={{ opacity: 0.8 }}>
                          Số dư hiện tại
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {formatCurrency(user.memberCard.balance)}
                        </Typography>
                      </Grid>

                      <Grid item xs={6}>
                        <Typography variant="caption" sx={{ opacity: 0.8 }}>
                          Hạn sử dụng
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {formatDate(user.memberCard.expiryDate) || "N/A"}
                        </Typography>
                      </Grid>
                    </Grid>

                    {/* ✅ NÚT NẠP TIỀN (chỉ hiện khi ĐÃ CÓ THẺ) */}
                    <Button
                      variant="contained"
                      fullWidth
                      startIcon={<AddCard />}
                      onClick={handleTopupBalance}
                      disabled={processingPayment}
                      sx={{
                        mt: 3,
                        py: 1.2,
                        borderRadius: 2,
                        fontWeight: 600,
                        textTransform: "none",
                        background: "white",
                        color: "#667eea",
                        "&:hover": {
                          background: "rgba(255,255,255,0.95)",
                          transform: "translateY(-2px)",
                        },
                        "&:disabled": {
                          background: "rgba(255,255,255,0.5)",
                          color: "rgba(102,126,234,0.5)",
                        },
                        transition: "all 0.3s ease",
                      }}
                    >
                      {processingPayment ? "Đang xử lý..." : "Nạp tiền vào thẻ"}
                    </Button>

                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        mt: 1.5,
                        textAlign: "center",
                        opacity: 0.8,
                        fontStyle: "italic",
                      }}
                    >
                      💡 Nạp tiền để đủ số dư mặc định của loại thẻ
                    </Typography>
                  </CardContent>
                </Card>
              )}

              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  mb: 3,
                  color: "text.primary",
                }}
              >
                Thông tin cá nhân
              </Typography>

              <Stack spacing={1} divider={<Divider />}>
                <InfoRow icon={Person} label="Họ và tên" value={user?.fullName} />
                <InfoRow icon={Wc} label="Giới tính" value={getGenderDisplay(user?.gender)} />
                <InfoRow icon={Cake} label="Ngày sinh" value={formatDate(user?.dateOfBirth)} />
                <InfoRow icon={Email} label="Email" value={user?.email} />
                <InfoRow icon={Phone} label="Số điện thoại" value={user?.phoneNumber} />
                <InfoRow icon={CreditCard} label="CCCD" value={user?.cccd} />
                <InfoRow icon={Home} label="Địa chỉ" value={user?.address} />
              </Stack>

              <Button
                variant="contained"
                size="large"
                fullWidth
                startIcon={<Edit />}
                onClick={() => navigate("/settings")}
                sx={{
                  mt: 4,
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 600,
                  fontSize: "1rem",
                  textTransform: "none",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  boxShadow: "0 8px 24px rgba(102, 126, 234, 0.4)",
                  "&:hover": {
                    boxShadow: "0 12px 32px rgba(102, 126, 234, 0.5)",
                    transform: "translateY(-2px)",
                  },
                  transition: "all 0.3s ease",
                }}
              >
                Cập nhật hồ sơ
              </Button>
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* ✅ Payment Modal (dùng chung cho cả 2 use case) */}
      {paymentModalOpen && currentPaymentData && (
        <QRPaymentModal
          open={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setCurrentPaymentData(null);
          }}
          paymentData={currentPaymentData}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </>
  );
}