import React, { useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Stack, Typography, TextField, Button } from "@mui/material";
import { cancelLoanSlip } from "../../services/loanSlips";
import { useSnackbar } from "notistack";

/**
 * Dialog hủy toàn bộ phiếu (dành cho WAITING_FOR_PICKUP)
 * DELETE /api/loans/admin/slips/:loanSlipId with body { librarianId, reason? }
 */
export default function CancelSlipDialog({ open, onClose, slip, librarianId, onCancelled }) {
    const { enqueueSnackbar } = useSnackbar();
    const [reason, setReason] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!open) {
            setReason("");
            setSubmitting(false);
        }
    }, [open]);

    async function handleConfirm() {
        if (!slip?.loanSlipId) return;
        if (!librarianId) {
            enqueueSnackbar("Không xác định thủ thư. Vui lòng đăng nhập lại.", { variant: "warning" });
            return;
        }
        setSubmitting(true);
        try {
            const res = await cancelLoanSlip(slip.loanSlipId, { librarianId, reason });
            if (res?.success) {
                enqueueSnackbar("Hủy phiếu thành công.", { variant: "success" });
                onCancelled?.(res);
            } else {
                const msg = res?.message || "Hủy phiếu thất bại";
                enqueueSnackbar(msg, { variant: "error" });
            }
        } catch (err) {
            console.error("cancelLoanSlip error", err);
            const msg = err?.message || err?.response?.data?.message || "Lỗi khi hủy phiếu";
            enqueueSnackbar(msg, { variant: "error" });
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={Boolean(open)} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Hủy phiếu #{slip?.loanSlipId ?? ""}</DialogTitle>
            <DialogContent>
                <Stack spacing={1} sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        Bạn sẽ hủy toàn bộ phiếu mượn/đặt trước này. Hành động này không thể hoàn tác.
                    </Typography>

                    <TextField
                        label="Lý do hủy"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        multiline
                        minRows={3}
                        fullWidth
                        sx={{ mt: 1 }}
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} disabled={submitting}>Đóng</Button>
                <Button variant="contained" color="error" onClick={handleConfirm} disabled={submitting}>
                    {submitting ? "Đang xử lý..." : "Xác nhận hủy phiếu"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
