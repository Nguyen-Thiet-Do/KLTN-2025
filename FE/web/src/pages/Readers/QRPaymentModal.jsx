import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Stack,
} from "@mui/material";
import {
  CheckCircle as CheckIcon,
  QrCode2 as QrIcon,
  OpenInNew as OpenIcon,
} from "@mui/icons-material";

export default function QRPaymentModal({ 
  open, 
  onClose, 
  paymentData, 
  onPaymentSuccess 
}) {
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [checkInterval, setCheckInterval] = useState(null);

  // ✅ Debug payment data
  useEffect(() => {
    if (open && paymentData) {
      console.log("═══════════════════════════════");
      console.log("📦 PAYMENT DATA:");
      console.log("   - paymentId:", paymentData.paymentId);
      console.log("   - qrCode:", paymentData.qrCode);
      console.log("   - checkoutUrl:", paymentData.checkoutUrl);
      console.log("   - Full:", paymentData);
      console.log("═══════════════════════════════");
    }
  }, [open, paymentData]);

  // ✅ Kiểm tra trạng thái thanh toán định kỳ
  useEffect(() => {
    if (!open || !paymentData?.paymentId) return;

    console.log("💳 Payment modal opened with ID:", paymentData.paymentId);
    console.log("🔄 Starting auto-check payment status every 3 seconds...");

    const interval = setInterval(async () => {
      await checkPaymentStatus();
    }, 3000);

    setCheckInterval(interval);

    return () => {
      if (interval) {
        console.log("⏹️ Stopping payment status check");
        clearInterval(interval);
      }
    };
  }, [open, paymentData]);

  // ✅ Gọi API kiểm tra thanh toán
  const checkPaymentStatus = async () => {
    try {
      const token = sessionStorage.getItem("accessToken");
      
      const getApiBaseUrl = () => {
        const isProduction = window.location.hostname !== 'localhost' 
                          && window.location.hostname !== '127.0.0.1';
        
        if (isProduction) {
          return 'https://kltn-2025-ehsx.onrender.com/api';
        }
        
        if (import.meta.env.VITE_API_URL) {
          return import.meta.env.VITE_API_URL;
        }
        
        return 'http://localhost:8080/api';
      };
      
      const API_BASE_URL = getApiBaseUrl();
      
      const response = await fetch(
        `${API_BASE_URL}/payments/${paymentData.paymentId}/status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        console.error("❌ API response not OK:", response.status);
        return;
      }

      const result = await response.json();
      
      console.log("💳 Payment status:", result);

      // ✅ Sync với backend: SUCCESS, PAID, COMPLETED
      const successStatuses = ["SUCCESS", "PAID", "COMPLETED"];
      if (result.success && successStatuses.includes(result.status)) {
        console.log("🎉 Payment successful! Status:", result.status);
        setPaymentStatus("success");
        
        if (checkInterval) {
          clearInterval(checkInterval);
        }

        setTimeout(() => {
          onPaymentSuccess();
        }, 2000);
      }
    } catch (error) {
      console.error("❌ Lỗi kiểm tra thanh toán:", error);
    }
  };

  const handleClose = () => {
    if (checkInterval) {
      clearInterval(checkInterval);
    }
    setPaymentStatus("pending");
    onClose();
  };

  const openPaymentLink = () => {
    if (paymentData?.checkoutUrl) {
      window.open(paymentData.checkoutUrl, "_blank");
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }
      }}
    >
      <DialogTitle sx={{ 
        background: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
        color: "white",
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        gap: 1,
      }}>
        <QrIcon />
        Thanh toán thẻ thành viên
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {paymentStatus === "success" ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <CheckIcon 
              sx={{ 
                fontSize: 80, 
                color: "#38A169",
                mb: 2,
              }} 
            />
            <Typography variant="h5" fontWeight={700} color="#38A169" gutterBottom>
              Thanh toán thành công!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Thẻ thành viên đã được kích hoạt
            </Typography>
          </Box>
        ) : (
          <Stack spacing={3}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Vui lòng quét mã QR hoặc mở link thanh toán để hoàn tất
            </Alert>

            <Box sx={{ textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                Số tiền thanh toán
              </Typography>
              <Typography variant="h4" fontWeight={700} color="#667EEA">
                {paymentData?.amount?.toLocaleString("vi-VN")} đ
              </Typography>
            </Box>

            {/* ✅ QR Code - sync với BE */}
            {paymentData?.qrCode && (
              <Box sx={{ 
                textAlign: "center",
                p: 2,
                backgroundColor: "white",
                borderRadius: 2,
                border: "2px solid #E2E8F0",
              }}>
                <img 
                  src={paymentData.qrCode} 
                  alt="QR Payment" 
                  style={{ 
                    maxWidth: "100%", 
                    height: "auto",
                    maxHeight: "300px",
                  }}
                  onError={(e) => {
                    console.error("❌ QR Code load failed:", paymentData.qrCode);
                    e.target.style.display = 'none';
                  }}
                  onLoad={() => {
                    console.log("✅ QR Code loaded successfully");
                  }}
                />
              </Box>
            )}

            {/* ✅ Checkout Link - sync với BE */}
            {paymentData?.checkoutUrl && (
              <Button
                variant="outlined"
                fullWidth
                startIcon={<OpenIcon />}
                onClick={openPaymentLink}
                sx={{
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
                Mở trang thanh toán
              </Button>
            )}

            <Box sx={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              gap: 1,
              py: 1,
            }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Đang chờ thanh toán...
              </Typography>
            </Box>

            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              <Typography variant="body2">
                ⚠️ <strong>Lưu ý:</strong> Không đóng cửa sổ này cho đến khi thanh toán thành công
              </Typography>
            </Alert>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        {paymentStatus !== "success" && (
          <Button 
            onClick={handleClose}
            variant="outlined"
            sx={{ 
              borderRadius: 2,
              fontWeight: 600,
            }}
          >
            Đóng
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}