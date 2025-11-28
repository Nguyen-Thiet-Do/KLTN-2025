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
  Chip
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
  Edit
} from "@mui/icons-material";

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
            </Box>

            {/* Info Section */}
            <Box sx={{ p: 4 }}>
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
                {/* ✅ Email và phoneNumber đã được merge từ account */}
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
    </>
  );
}