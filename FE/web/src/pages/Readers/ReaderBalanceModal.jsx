import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress,
  Stack,
  Divider
} from "@mui/material";
import {
  CardMembership,
  AddCard,
  AccountBalanceWallet,
  CalendarToday,
  CreditCard
} from "@mui/icons-material";
import { topupMemberCard } from "../../services/authService";
import QRPaymentModal from "./QRPaymentModal";

export default function ReaderBalanceModal({ open, onClose, reader, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [currentPaymentData, setCurrentPaymentData] = useState(null);


  const getAvatarUrl = () => {
  if (!reader?.avatarUrl) return null;

  const baseURL =
    window.location.hostname === "localhost"
      ? "http://localhost:8080"
      : "https://kltn-2025-ehsx.onrender.com";

  if (reader.avatarUrl.startsWith("http")) {
    return reader.avatarUrl;
  }

  return `${baseURL}${reader.avatarUrl}`;
};

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    try {
      return new Date(date).toLocaleDateString("vi-VN");
    } catch {
      return "N/A";
    }
  };

  const handleTopupBalance = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const token = sessionStorage.getItem("accessToken");
      if (!token) {
        throw new Error("Vui lòng đăng nhập lại");
      }

      const memberCardId = reader?.memberCard?.memberCardId;
      if (!memberCardId) {
        throw new Error("Không tìm thấy thẻ thành viên");
      }

      console.log("💰 [NẠP TIỀN CHO READER] MemberCardId:", memberCardId);

      const res = await topupMemberCard(
        {
          memberCardId: memberCardId,
          readerId: reader.readerId
        },
        token
      );

      console.log("✅ Topup response:", res);

      // ✅ Xử lý trường hợp đã đủ tiền
      if (res.already_sufficient) {
        const balanceInfo = res.already_sufficient;
        setSuccess(
          `${balanceInfo.message || "Số dư thẻ đã đầy rồi!"} 🎉\n` +
          `Số dư hiện tại: ${formatCurrency(balanceInfo.currentBalance)}`
        );
        setLoading(false);
        return;
      }
      
      if (res.success === true && res.message?.includes("đủ số dư")) {
        const balanceData = res.data || {};
        setSuccess(
          `${res.message} 🎉\n` +
          `Số dư hiện tại: ${formatCurrency(balanceData.currentBalance || 0)}`
        );
        setLoading(false);
        return;
      }
      
      if (res.success && res.data?.currentBalance !== undefined && 
          res.data?.targetBalance !== undefined &&
          res.data.currentBalance >= res.data.targetBalance) {
        setSuccess(
          `Số dư thẻ đã đầy rồi! 🎉\n` +
          `Số dư hiện tại: ${formatCurrency(res.data.currentBalance)}`
        );
        setLoading(false);
        return;
      }

      // ✅ Xử lý trường hợp cần thanh toán
      let responseData = res.created || res.data || res;
      
      const paymentId = responseData.paymentId;
      const amount = responseData.amount;
      const qrCode = responseData.qrCode;
      const checkoutUrl = responseData.checkoutUrl;
      
      if (!paymentId) {
        throw new Error("Không nhận được thông tin thanh toán từ server");
      }

      const paymentInfo = {
        paymentId: paymentId,
        qrCode: qrCode || null,
        checkoutUrl: checkoutUrl || null,
        amount: amount
      };

      console.log("🎯 Payment info:", paymentInfo);

      if (!paymentInfo.qrCode && !paymentInfo.checkoutUrl) {
        throw new Error("Không có thông tin thanh toán. Vui lòng liên hệ quản trị viên.");
      }

      setCurrentPaymentData(paymentInfo);
      setPaymentModalOpen(true);
      setLoading(false);

    } catch (err) {
      setLoading(false);
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
    console.log("✅ Thanh toán thành công");
    setPaymentModalOpen(false);
    setCurrentPaymentData(null);
    alert("🎉 Nạp tiền thành công!");
    if (onSuccess) onSuccess();
    onClose();
  };

  if (!reader?.memberCard) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Thông tin thẻ thành viên</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Độc giả này chưa có thẻ thành viên
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Đóng</Button>
        </DialogActions>
      </Dialog>
    );
  }

  const memberCard = reader.memberCard;

  return (
    <>
      <Dialog 
        open={open} 
        onClose={onClose} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <CardMembership sx={{ fontSize: 32, color: "#667EEA" }} />
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Quản lý thẻ thành viên
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {reader.fullName} (DG{reader.readerId})
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ pt: 3 }}>
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

          <Card
            sx={{
              mb: 3,
              borderRadius: 3,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              boxShadow: "0 8px 24px rgba(102, 126, 234, 0.3)",
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
                <CreditCard sx={{ fontSize: 32, mr: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Thông tin thẻ
                </Typography>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Số thẻ
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                    {memberCard.cardNumber || "N/A"}
                  </Typography>
                </Grid>

                <Grid item xs={6}>
                  {/* <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Loại thẻ
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                    {memberCard.cardType?.cardTypeName || 
                     memberCard.cardType?.typeName || "N/A"}
                  </Typography> */}
                </Grid>

                <Grid item xs={6}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <AccountBalanceWallet />
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        Số dư hiện tại
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {formatCurrency(memberCard.balance)}
                      </Typography>
                    </Box>
                  </Stack>
                </Grid>

                <Grid item xs={6}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <CalendarToday />
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        Hạn sử dụng
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                        {formatDate(memberCard.expiryDate)}
                      </Typography>
                    </Box>
                  </Stack>
                </Grid>
              </Grid>

              <Button
                variant="contained"
                fullWidth
                startIcon={loading ? <CircularProgress size={20} /> : <AddCard />}
                onClick={handleTopupBalance}
                disabled={loading}
                sx={{
                  mt: 3,
                  py: 1.5,
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
                {loading ? "Đang xử lý..." : "Nạp tiền vào thẻ"}
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

          {/* Thông tin độc giả */}
         <Card
  sx={{
    borderRadius: 3,
    backgroundColor: "rgba(102,126,234,0.04)",
    mt: 3
  }}
>
  <CardContent>
    <Typography
      variant="subtitle2"
      fontWeight={700}
      gutterBottom
      sx={{ mb: 2, color: "#667EEA" }}
    >
      Thông tin độc giả
    </Typography>

    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
      {/* Avatar */}
     {getAvatarUrl() ? (
  <Box
    component="img"
    src={getAvatarUrl()}
    alt="avatar"
    sx={{
      width: 56,
      height: 56,
      borderRadius: "50%",
      objectFit: "cover",
      border: "2px solid #667EEA"
    }}
  />
) : (
  <Box
    sx={{
      width: 56,
      height: 56,
      borderRadius: "50%",
      backgroundColor: "#667EEA",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
      fontWeight: 700,
      fontSize: 20
    }}
  >
    {reader.fullName?.charAt(0)?.toUpperCase() || "U"}
  </Box>
)}


      <Box>
        <Typography variant="h6" fontWeight={700}>
          {reader.fullName}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          DG{reader.readerId}
        </Typography>
      </Box>
    </Stack>

    {/* Thông tin chi tiết */}
    <Grid container spacing={2}>

      <Grid item xs={12} sm={4}>
        <Typography variant="caption" color="text.secondary">
          Email
        </Typography>
        <Typography variant="body2" fontWeight={600}>
          {reader.email || "-"}
        </Typography>
      </Grid>

      <Grid item xs={12} sm={4}>
        <Typography variant="caption" color="text.secondary">
          Số điện thoại
        </Typography>
        <Typography variant="body2" fontWeight={600}>
          {reader.phoneNumber || "-"}
        </Typography>
      </Grid>

      <Grid item xs={12} sm={4}>
        <Typography variant="caption" color="text.secondary">
          CCCD
        </Typography>
        <Typography variant="body2" fontWeight={600}>
          {reader.cccd || "-"}
        </Typography>
      </Grid>

    </Grid>
  </CardContent>
</Card>

        </DialogContent>

        <Divider />

        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={onClose}
            sx={{ 
              borderRadius: 2,
              fontWeight: 600,
              textTransform: "none"
            }}
          >
            Đóng
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Modal */}
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