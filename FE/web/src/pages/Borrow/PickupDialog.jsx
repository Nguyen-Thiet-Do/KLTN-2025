// src/components/Borrow/PickupDialog.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Stack, Typography, TextField, Button } from "@mui/material";
import { pickupLoanSlip } from "../../services/loanSlips";
import { useSnackbar } from "notistack";
import { useAuth } from "../../contexts/AuthContext";

// helper: today's date in yyyy-mm-dd
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// helper: date + n days in yyyy-mm-dd
function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * PickupDialog
 * - pickupDate: mặc định = hôm nay, **không cho sửa** (disabled/readOnly)
 * - dueDate: mặc định = hôm nay + 30, cho phép sửa
 */
export default function PickupDialog({ open, onClose, slip, librarianId: librarianIdProp, onPicked }) {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();

  const [pickupDate, setPickupDate] = useState("");
  const [dueDate, setDueDate] = useState("");
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

  // Khi dialog mở: set mặc định 1 lần
  useEffect(() => {
    if (open) {
      setPickupDate(todayISO());   // ngày đến lấy = hôm nay, không sửa được
      setDueDate(todayPlus(30));   // hạn trả mặc định 30 ngày sau (có thể sửa)
      setSubmitting(false);
    } else {
      setPickupDate("");
      setDueDate("");
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
        // preserveLoanDate: omitted so backend default applies
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
          </Typography>

          <TextField
            type="date"
            label="Ngày đến lấy"
            InputLabelProps={{ shrink: true }}
            fullWidth
            value={pickupDate}
            // disabled để không cho sửa
            disabled
            // thêm aria-readonly để rõ ràng cho accessibility
            inputProps={{ "aria-readonly": true }}
            onChange={() => {
              /* không cho chỉnh, nhưng React yêu cầu onChange không bắt lỗi */
            }}
          />

          <TextField
            type="date"
            label="Hạn trả"
            InputLabelProps={{ shrink: true }}
            fullWidth
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
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
