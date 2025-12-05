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

    setLoading(true);

    try {
      // 🟦 1) Lấy librarianId từ sessionStorage
      let resolvedLibrarianId = null;

      const rawProfile = sessionStorage.getItem("profile");
      if (rawProfile) {
        try {
          const profile = JSON.parse(rawProfile);
          resolvedLibrarianId = profile?.librarianId ?? null;
        } catch (e) {
          console.warn("Không parse được profile từ sessionStorage", e);
        }
      }

      // 🟥 2) Nếu không có librarianId -> báo lỗi + không gọi API
      if (!resolvedLibrarianId) {
        enqueueSnackbar("Không xác định thủ thư. Vui lòng đăng nhập lại.", { variant: "warning" });
        setLoading(false);
        return;
      }

      console.debug("CancelReservation =>", {
        slipId,
        librarianId: resolvedLibrarianId,
        reason,
      });

      // 🟩 3) Gọi API
      const resp = await cancelReservation(slipId, {
        librarianId: resolvedLibrarianId,
        reason,
      });

      // 🟩 4) Thành công
      if (resp && resp.success) {
        enqueueSnackbar("Hủy phiếu thành công.", { variant: "success" });
        onCancelled?.(resp);
      } else {
        const msg = resp?.message || "Hủy phiếu thất bại";
        enqueueSnackbar(msg, { variant: "error" });
      }
    } catch (err) {
      console.error("cancelReservation error", err);
      const msg =
        err?.message ||
        err?.response?.data?.message ||
        "Lỗi khi hủy phiếu";
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
            Vui lòng nhập lý do hủy để thông báo đến độc giả.
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
