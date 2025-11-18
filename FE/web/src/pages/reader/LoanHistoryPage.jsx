import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Stack
} from "@mui/material";
import api from "../../services/api";
import ReaderHeader from "../../components/layouts/ReaderHeader";
import { statusLabel } from "../../components/common/statusMap";

const statusColor = {
  PENDING: "warning",
  WAITING_FOR_PICKUP: "info",
  BORROWING: "primary",
  RETURNED: "success",
  OVERDUE: "error",
};

export default function LoanHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState([]);
  const [error, setError] = useState("");

  const loadLoans = async () => {
    try {
      // ✔ SỬA ĐÚNG API
     const res = await api.get("/loans/reader/loans/my");  


      // ✔ BE trả về res.data.data
      setLoans(res.data?.data || []);
    } catch (err) {
      setError(err.message || "Không tải được lịch sử mượn");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLoans();
  }, []);

  return (
    <>
      <ReaderHeader />

      <Box sx={{ maxWidth: 900, mx: "auto", mt: 4, px: 2, pb: 8 }}>
        <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
          Lịch sử mượn / trả
        </Typography>

        {loading ? (
          <Box sx={{ textAlign: "center", mt: 10 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : loans.length === 0 ? (
          <Alert severity="info">Bạn chưa có phiếu mượn nào.</Alert>
        ) : (
          loans.map((loan) => (
            <Paper key={loan.loanSlipId} sx={{ p: 3, borderRadius: 3, mb: 3 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography variant="h6" fontWeight={700}>
                  Phiếu mượn #{loan.loanSlipId}
                </Typography>
     <Chip 
  label={statusLabel[loan.status] || loan.status}
  size="small"
  color={statusColor[loan.status] || "default"} 
/>


              </Stack>

              <Divider sx={{ my: 2 }} />

              {/* Ngày */}
              <Typography variant="body2">
                <strong>Ngày mượn:</strong> {loan.loanDate || "—"}
              </Typography>
              <Typography variant="body2">
                <strong>Hạn trả:</strong> {loan.dueDate || "—"}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography fontWeight={600} sx={{ mb: 1 }}>
                Danh sách tài liệu:
              </Typography>

       <Box sx={{ ml: 2 }}>
  {loan.details?.map((d, idx) => {
    const doc = d.bookInfo; // ⭐ dùng bookInfo
    const img = doc?.coverPhoto || "/no-image.png";

    return (
      <Stack
        key={idx}
        direction="row"
        alignItems="center"
        spacing={2}
        sx={{ mb: 1 }}
      >
        <img
          src={img}
          alt={doc?.title}
          style={{
            width: 60,
            height: 80,
            objectFit: "cover",
            borderRadius: 6,
            border: "1px solid #eee",
          }}
        />

        <Typography sx={{ minWidth: 200 }}>
          {doc?.title || "—"}
        </Typography>

        <Chip
          label={statusLabel[d.status] || d.status}
          size="small"
          color={statusColor[d.status] || "default"}
        />
      </Stack>
    );
  })}
</Box>

            </Paper>
          ))
        )}
      </Box>
    </>
  );
}
