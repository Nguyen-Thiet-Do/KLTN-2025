import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
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

  // trạng thái cho popup huỷ / yêu cầu huỷ
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [submittingCancel, setSubmittingCancel] = useState(false);

  const [snackbar, setSnackbar] = useState({
    open: false,
    type: "success",
    message: "",
  });

  const loadLoans = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/loans/reader/loans/my");
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

  // mở dialog huỷ cả phiếu (PENDING)
  const handleOpenCancelLoan = (loan) => {
    setSelectedLoan(loan);
    setSelectedDetail(null);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  // mở dialog yêu cầu huỷ 1 dòng tài liệu (WAITING_FOR_PICKUP)
  const handleOpenCancelDetail = (loan, detail) => {
    setSelectedLoan(loan);
    setSelectedDetail(detail);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  const handleCloseCancelDialog = () => {
    if (submittingCancel) return;
    setCancelDialogOpen(false);
    setSelectedLoan(null);
    setSelectedDetail(null);
    setCancelReason("");
  };

  const handleSubmitCancel = async () => {
    if (!selectedLoan) return;

    try {
      setSubmittingCancel(true);

      const body = {
        reason: cancelReason || undefined,
      };

      if (selectedDetail?.loanDetailId) {
        body.loanDetailId = selectedDetail.loanDetailId;
      }

      await api.post(
        `/loans/reader/loans/${selectedLoan.loanSlipId}/cancel-request`,
        body
      );

      setSnackbar({
        open: true,
        type: "success",
        message: selectedDetail
          ? "Đã gửi yêu cầu huỷ tài liệu cho thủ thư xử lý."
          : selectedLoan.status === "PENDING"
            ? "Đã huỷ phiếu đặt mượn."
            : "Đã gửi yêu cầu huỷ phiếu cho thủ thư xử lý.",
      });

      setCancelDialogOpen(false);
      setSelectedLoan(null);
      setSelectedDetail(null);
      setCancelReason("");

      // tải lại danh sách
      await loadLoans();
    } catch (err) {
      setSnackbar({
        open: true,
        type: "error",
        message:
          err?.response?.data?.message ||
          err.message ||
          "Không thực hiện được yêu cầu huỷ.",
      });
    } finally {
      setSubmittingCancel(false);
    }
  };

  // text hiển thị trong dialog
  const getDialogTitle = () => {
    if (!selectedLoan) return "";
    if (selectedDetail) {
      return `Yêu cầu huỷ tài liệu trong phiếu #${selectedLoan.loanSlipId}`;
    }
    return `Huỷ / yêu cầu huỷ phiếu #${selectedLoan.loanSlipId}`;
  };

  const getDialogDescription = () => {
    if (!selectedLoan) return "";
    if (selectedDetail) {
      return `Bạn muốn gửi yêu cầu huỷ tài liệu "${selectedDetail?.bookInfo?.title}"? ` +
        `Thủ thư sẽ xem xét và xử lý.`;
    }

    if (selectedLoan.status === "PENDING") {
      return "Phiếu đang ở trạng thái CHỜ DUYỆT. Bạn có thể huỷ phiếu này hoàn toàn.";
    }

    if (selectedLoan.status === "WAITING_FOR_PICKUP") {
      return "Phiếu đang CHỜ ĐẾN LẤY. Bạn không thể tự huỷ trực tiếp, hệ thống sẽ gửi yêu cầu để thủ thư xử lý.";
    }

    return "Bạn muốn gửi yêu cầu huỷ cho phiếu này?";
  };

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
                sx={{ mb: 1 }}
              >
                <Typography variant="h6" fontWeight={700}>
                  Phiếu mượn #{loan.loanSlipId}
                </Typography>

                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={statusLabel[loan.status] || loan.status}
                    size="small"
                    color={statusColor[loan.status] || "default"}
                  />

                  {/* nút huỷ / yêu cầu huỷ phiếu */}
                  {(loan.status === "PENDING" ||
                    loan.status === "WAITING_FOR_PICKUP") && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleOpenCancelLoan(loan)}
                      >
                        {loan.status === "PENDING"
                          ? "Huỷ phiếu"
                          : "Yêu cầu huỷ phiếu"}
                      </Button>
                    )}
                </Stack>
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
                  const doc = d.bookInfo;
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

                      <Box sx={{ flex: 1, minWidth: 200 }}>
                        <Typography>{doc?.title || "—"}</Typography>
                      </Box>

                      <Chip
                        label={statusLabel[d.status] || d.status}
                        size="small"
                        color={statusColor[d.status] || "default"}
                        sx={{ mr: 1 }}
                      />

                      {/* nút yêu cầu huỷ từng tài liệu khi phiếu đang chờ đến lấy */}
                      {loan.status === "WAITING_FOR_PICKUP" &&
                        d.status === "WAITING_FOR_PICKUP" && (
                          <Button
                            variant="text"
                            size="small"
                            onClick={() => handleOpenCancelDetail(loan, d)}
                          >
                            Yêu cầu huỷ
                          </Button>
                        )}

                      {/* nếu muốn, bạn có thể cho huỷ từng tài liệu khi PENDING:
                      {loan.status === "PENDING" && d.status === "PENDING" && (
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => handleOpenCancelDetail(loan, d)}
                        >
                          Huỷ tài liệu
                        </Button>
                      )} */}
                    </Stack>
                  );
                })}
              </Box>
            </Paper>
          ))
        )}
      </Box>

      {/* Dialog huỷ / yêu cầu huỷ */}
      <Dialog open={cancelDialogOpen} onClose={handleCloseCancelDialog} fullWidth>
        <DialogTitle>{getDialogTitle()}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {getDialogDescription()}
          </Typography>

          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Lý do (không bắt buộc)"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCancelDialog} disabled={submittingCancel}>
            Đóng
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitCancel}
            disabled={submittingCancel}
          >
            {submittingCancel ? "Đang xử lý..." : "Xác nhận"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Thông báo nhỏ */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert
          severity={snackbar.type}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
