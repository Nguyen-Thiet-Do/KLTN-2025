import { useState, useEffect, useRef } from "react";
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
import { QRCodeSVG } from "qrcode.react";

export default function QRPaymentModal({ 
  open, 
  onClose, 
  paymentData, 
  onPaymentSuccess 
}) {
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const checkIntervalRef = useRef(null); // ✅ Dùng useRef thay vì useState

  useEffect(() => {
    if (open && paymentData) {
      console.log("═══════════════════════════════");
      console.log("📦 PAYMENT DATA:");
      console.log("   - paymentId:", paymentData.paymentId);
      console.log("   - qrCode:", paymentData.qrCode);
      console.log("   - checkoutUrl:", paymentData.checkoutUrl);
      console.log("   - amount:", paymentData.amount);
      console.log("═══════════════════════════════");
    }
  }, [open, paymentData]);

  useEffect(() => {
    if (!open || !paymentData?.paymentId) {
      return;
    }

    console.log("💳 Payment modal opened with ID:", paymentData.paymentId);
    console.log("🔄 Starting auto-check payment status every 3 seconds...");

    // ✅ Clear interval cũ nếu có
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }

    // ✅ Check ngay lần đầu
    checkPaymentStatus();

    // ✅ Sau đó check mỗi 3 giây
    checkIntervalRef.current = setInterval(() => {
      checkPaymentStatus();
    }, 3000);

    return () => {
      if (checkIntervalRef.current) {
        console.log("⏹️ Stopping payment status check");
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [open, paymentData?.paymentId]); // ✅ Dependency chính xác

  const checkPaymentStatus = async () => {
    try {
      const token = sessionStorage.getItem("accessToken");
      
      if (!token) {
        console.error("❌ No access token found");
        return;
      }

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
      
      console.log(`🔍 Checking payment status: ${API_BASE_URL}/payments/${paymentData.paymentId}/status`);
      
      const response = await fetch(
        `${API_BASE_URL}/payments/${paymentData.paymentId}/status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error("❌ API response not OK:", response.status, response.statusText);
        return;
      }

      const result = await response.json();
      
      console.log("📊 Payment status response:", result);

      // ✅ Check các trạng thái thành công
      const successStatuses = ["SUCCESS", "PAID", "COMPLETED"];
      if (result.success && successStatuses.includes(result.status)) {
        console.log("🎉 Payment successful! Status:", result.status);
        console.log("📦 Payment details:", result);
        
        // ✅ Stop checking
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
          checkIntervalRef.current = null;
        }

        // ✅ Update UI
        setPaymentStatus("success");

        // ✅ Đợi 2 giây để user thấy UI thành công, sau đó callback
        setTimeout(() => {
          console.log("✅ Calling onPaymentSuccess callback...");
          onPaymentSuccess();
        }, 2000);
      } else {
        console.log("⏳ Payment still pending. Status:", result.status);
      }
    } catch (error) {
      console.error("❌ Error checking payment status:", error);
    }
  };

  const handleClose = () => {
    console.log("🚪 Closing payment modal");
    
    // ✅ Clear interval khi đóng modal
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    
    // ✅ Reset state
    setPaymentStatus("pending");
    
    onClose();
  };

  const openPaymentLink = () => {
    if (paymentData?.checkoutUrl) {
      console.log("🔗 Opening payment link:", paymentData.checkoutUrl);
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
                animation: "scaleIn 0.3s ease-out",
                "@keyframes scaleIn": {
                  "0%": { transform: "scale(0)" },
                  "100%": { transform: "scale(1)" }
                }
              }} 
            />
            <Typography variant="h5" fontWeight={700} color="#38A169" gutterBottom>
              Thanh toán thành công!
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Thẻ thành viên đã được kích hoạt
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Đang tải lại trang...
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

            {/* ✅ Generate QR Code từ chuỗi EMVCo */}
            {paymentData?.qrCode && (
              <Box sx={{ 
                textAlign: "center",
                p: 3,
                backgroundColor: "white",
                borderRadius: 2,
                border: "2px solid #E2E8F0",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}>
                <QRCodeSVG 
                  value={paymentData.qrCode}
                  size={280}
                  level="H"
                  includeMargin={true}
                  style={{
                    border: "8px solid white",
                    borderRadius: "8px",
                  }}
                />
              </Box>
            )}

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