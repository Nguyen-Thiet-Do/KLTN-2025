import React, { useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Stack, Typography, TextField, Button } from "@mui/material";
import { deleteLoanDetail } from "../../services/loanSlips";
import { useSnackbar } from "notistack";

/**
 * Dialog xóa 1 tài liệu khỏi phiếu
 * DELETE /api/loans/admin/slips/:loanSlipId/details/:loanDetailId with body { librarianId, reason? }
 */
export default function DeleteDetailDialog({ open, onClose, slip, detail, librarianId, onDeleted }) {
    const { enqueueSnackbar } = useSnackbar();
    const [reason, setReason] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!open) { setReason(""); setSubmitting(false); }
    }, [open]);

    async function handleConfirm() {
        if (!slip?.loanSlipId || !detail?.loanDetailId) return;
        if (!librarianId) {
            enqueueSnackbar("Không xác định thủ thư. Vui lòng đăng nhập lại.", { variant: "warning" });
            return;
        }
        setSubmitting(true);
        try {
            const res = await deleteLoanDetail(slip.loanSlipId, detail.loanDetailId, { librarianId, reason });
            if (res?.success) {
                enqueueSnackbar("Xóa tài liệu khỏi phiếu thành công.", { variant: "success" });
                onDeleted?.(res);
            } else {
                const msg = res?.message || "Xóa tài liệu thất bại";
                enqueueSnackbar(msg, { variant: "error" });
            }
        } catch (err) {
            console.error("deleteLoanDetail error", err);
            const msg = err?.message || err?.response?.data?.message || "Lỗi khi xóa tài liệu";
            enqueueSnackbar(msg, { variant: "error" });
        } finally {
            setSubmitting(false);
        }
    }

    const title = detail?.DocumentCopy?.Document?.title || detail?.DocumentCopy?.barCode || detail?.loanDetailId;

    return (
        <Dialog open={Boolean(open)} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Xóa tài liệu khỏi phiếu #{slip?.loanSlipId ?? ""}</DialogTitle>
            <DialogContent>
                <Stack spacing={1} sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        Bạn sẽ xóa tài liệu <strong>{title}</strong> khỏi phiếu.
                        Vui lòng nhập lý do hủy để thông báo đến độc giả.

                    </Typography>

                    <TextField
                        label="Lý do "
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        multiline
                        minRows={2}
                        fullWidth
                        sx={{ mt: 1 }}
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} disabled={submitting}>Đóng</Button>
                <Button variant="contained" color="error" onClick={handleConfirm} disabled={submitting}>
                    {submitting ? "Đang xử lý..." : "Xóa tài liệu"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
