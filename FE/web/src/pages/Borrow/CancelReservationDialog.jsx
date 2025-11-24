// src/components/Borrow/CancelReservationDialog.jsx
import React, { useState } from "react";
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

export default function CancelReservationDialog({
  open,
  onClose,
  slip,
  librarianId, // số (bắt buộc)
  onCancelled, // callback khi thành công
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const slipId = slip?.loanSlipId ?? null;

  React.useEffect(() => {
    if (!open) {
      setReason("");
      setLoading(false);
    }
  }, [open]);

  async function handleConfirm() {
    if (!slipId) return;
    if (!librarianId) {
      // nếu thiếu librarianId có thể báo lỗi người dùng hoặc dùng fallback
      alert("Không xác định thủ thư (librarianId). Vui lòng đăng nhập lại.");
      return;
    }
    setLoading(true);
    try {
      const resp = await cancelReservation(slipId, { librarianId, reason });
      if (resp && resp.success) {
        if (onCancelled) onCancelled(resp);
      } else {
        // show error message from server if any
        alert(resp?.message || "Hủy phiếu thất bại");
      }
    } catch (err) {
      console.error("cancelReservation error", err);
      alert(err?.message || "Lỗi khi hủy phiếu");
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
