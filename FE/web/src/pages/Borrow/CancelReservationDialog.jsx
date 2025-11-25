import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
} from "@mui/material";
import { cancelReservation } from "../../services/loanSlips";
import { useSnackbar } from "notistack";

export default function CancelReservationDialog({
  open,
  onClose,
  slip,
  librarianId, // số (bắt buộc)
  onCancelled, // callback khi thành công
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const slipId = slip?.loanSlipId ?? null;

  useEffect(() => {
    if (!open) {
      setReason("");
      setLoading(false);
    }
  }, [open]);

  async function handleConfirm() {
    if (!slipId) return;
    if (!librarianId) {
      enqueueSnackbar("Không xác định thủ thư (librarianId). Vui lòng đăng nhập lại.", { variant: "warning" });
      return;
    }
    setLoading(true);
    try {
      const resp = await cancelReservation(slipId, { librarianId, reason });
      if (resp && resp.success) {
        enqueueSnackbar("Hủy phiếu đặt trước thành công.", { variant: "success" });
        onCancelled?.(resp);
      } else {
        const msg = resp?.message || "Hủy phiếu thất bại";
        enqueueSnackbar(msg, { variant: "error" });
      }
    } catch (err) {
      console.error("cancelReservation error", err);
      const msg = err?.message || err?.response?.data?.message || "Lỗi khi hủy phiếu";
      enqueueSnackbar(msg, { variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={Boolean(open)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Hủy phiếu đặt trước #{slipId}</DialogTitle>
      <DialogContent>
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            Hủy phiếu đặt trước sẽ xóa các bản ghi đặt (LoanDetail) liên quan và gửi thông báo tới độc giả.
            Vui lòng nhập lý do (không bắt buộc).
          </Typography>

          <TextField
            label="Lý do hủy (tùy chọn)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            multiline
            minRows={3}
            fullWidth
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>Đóng</Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleConfirm}
          disabled={loading}
        >
          {loading ? "Đang xử lý..." : "Xác nhận hủy"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
