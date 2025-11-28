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
  Alert
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
  CardMembership
} from "@mui/icons-material";
import QRPaymentModal from "../Readers/QRPaymentModal";
import { completeRegistration } from "../../services/authService";

export default function ProfilePage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // ✅ State cho payment modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [currentPaymentData, setCurrentPaymentData] = useState(null);

  // Hàm xử lý hiển thị giới tính
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

  // Format ngày sinh
  const formatDate = (date) => {
    if (!date) return null;
    try {
      return new Date(date).toLocaleDateString("vi-VN");
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!authLoading) {
      setLoading(false);
      console.log('👤 Current user data:', user);
    }
  }, [user, authLoading]);

  // ✅ Xử lý đăng ký thẻ thành viên
  const handleRegisterMemberCard = async () => {
    try {
      setProcessingPayment(true);
      setError(null);

      const token = sessionStorage.getItem("accessToken");
      if (!token) {
        throw new Error("Vui lòng đăng nhập lại");
      }

      console.log("📤 Đang tạo thanh toán cho reader:", user.readerId);

      const res = await completeRegistration(
        {
          readerId: user.readerId,
          cardTypeId: 2, // PREMIUM card
          action: "PAY"
        },
        token
      );

      console.log("✅ API response:", res);

      const responseData = res.data || res;
      
      // ✅ Lấy thông tin thanh toán
      const paymentId = responseData.paymentId;
      const amount = responseData.amount;
      const qrCode = responseData.payos?.qrCode;
      const checkoutUrl = responseData.payos?.checkoutUrl;
      
      if (!paymentId) {
        throw new Error("Không nhận được thông tin thanh toán từ server");
      }

      // ✅ Chuẩn bị dữ liệu cho modal
      const paymentInfo = {
        paymentId: paymentId,
        qrCode: qrCode || null,
        checkoutUrl: checkoutUrl || null,
        amount: amount || 10000
      };

      console.log("🎯 Payment info for modal:", paymentInfo);

      // Validate có thông tin thanh toán
      if (!paymentInfo.qrCode && !paymentInfo.checkoutUrl) {
        throw new Error("Không có thông tin thanh toán. Vui lòng liên hệ quản trị viên.");
      }

      // ✅ Mở modal hiển thị QR
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

  // ✅ Xử lý sau khi thanh toán thành công (giống admin)
  const handlePaymentSuccess = () => {
    console.log("✅ Thanh toán thành công - Đang reload trang...");
    
    // Đóng modal
    setPaymentModalOpen(false);
    setCurrentPaymentData(null);
    
    // Hiển thị thông báo
    alert("🎉 Thẻ thành viên đã được kích hoạt thành công!");
    
    // ✅ Reload trang để cập nhật user data (đơn giản và chắc chắn)
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
                label={user?.memberCard ? "Thành viên " : "Chưa là thành viên"}
                sx={{
                  backgroundColor: user?.memberCard
                    ? "rgba(255,255,255,0.25)"
                    : "rgba(0,0,0,0.25)",
                  color: "white",
                  fontWeight: 600,
                  backdropFilter: "blur(10px)",
                }}
              />

              {/* ✅ Nút đăng ký thẻ thành viên nếu chưa có */}
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
              {/* ✅ Hiển thị lỗi nếu có */}
              {error && (
                <Alert 
                  severity="error" 
                  sx={{ mb: 3, borderRadius: 2 }}
                  onClose={() => setError(null)}
                >
                  {error}
                </Alert>
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

      {/* ✅ Payment Modal */}
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