import React, { useEffect, useState, useMemo } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Stack, Typography, TextField, Button } from "@mui/material";
import { pickupLoanSlip } from "../../services/loanSlips";
import { useSnackbar } from "notistack";
import { useAuth } from "../../contexts/AuthContext";

/**
 * Dialog xác nhận độc giả đến lấy (PICKUP)
 * body: { librarianId, pickupDate?, dueDate?, items?, preserveLoanDate? }
 */
export default function PickupDialog({ open, onClose, slip, librarianId: librarianIdProp, onPicked }) {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();

  const [dueDate, setDueDate] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [preserveLoanDate, setPreserveLoanDate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // derive effective librarianId similar to Approve dialog (prop > user.librarianId > profile > accountId)
  const contextLibrarianId = useMemo(() => {
    return (
      Number(user?.librarianId) ||
      Number(user?.profile?.librarianId) ||
      Number(user?.Librarian?.librarianId) ||
      Number(user?.accountId) ||
      null
    );
  }, [user]);

  const effectiveLibrarianId = useMemo(() => {
    const fromProp = Number(librarianIdProp) || null;
    return fromProp || contextLibrarianId || null;
  }, [librarianIdProp, contextLibrarianId]);

  useEffect(() => {
    if (!open) {
      setDueDate("");
      setPickupDate("");
      setPreserveLoanDate(false);
      setSubmitting(false);
    }
  }, [open]);

  async function handleConfirm() {
    if (!slip?.loanSlipId) return;
    const lid = Number(effectiveLibrarianId);
    if (!Number.isFinite(lid) || lid <= 0) {
      enqueueSnackbar("Không xác định thủ thư. Vui lòng đăng nhập bằng tài khoản thủ thư.", { variant: "warning" });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        librarianId: lid,
        pickupDate: pickupDate || undefined,
        dueDate: dueDate || undefined,
        preserveLoanDate,
      };
      const res = await pickupLoanSlip(slip.loanSlipId, payload);
      if (res?.success) {
        enqueueSnackbar("Xác nhận lấy thành công — phiếu chuyển sang Đang mượn.", { variant: "success" });
        onPicked?.(res);
      } else {
        const msg = res?.message || "Xác nhận lấy thất bại";
        enqueueSnackbar(msg, { variant: "error" });
      }
    } catch (err) {
      console.error("pickup error", err);
      const msg = err?.response?.data?.message || err?.message || "Lỗi khi xác nhận lấy";
      enqueueSnackbar(msg, { variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={Boolean(open)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Xác nhận độc giả đến lấy #{slip?.loanSlipId ?? ""}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Hành động này sẽ chuyển phiếu sang trạng thái <strong>BORROWING</strong> và gán loanDate/dueDate (nếu gửi).
          </Typography>

          <TextField
            type="date"
            label="Ngày đến lấy (tùy chọn)"
            value={pickupDate}
            onChange={(e) => setPickupDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            type="date"
            label="Hạn trả (tùy chọn)"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={preserveLoanDate} onChange={(e) => setPreserveLoanDate(e.target.checked)} />
            <span>Giữ nguyên loanDate nếu backend đã gán</span>
          </label>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>Đóng</Button>
        <Button variant="contained" onClick={handleConfirm} disabled={submitting}>
          {submitting ? "Đang xử lý..." : "Xác nhận lấy"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
