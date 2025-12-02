// DeleteCopyDialog.jsx
import React, { useState } from "react";
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Typography
} from "@mui/material";
import { useSnackbar } from "notistack";
import { deleteCopy } from "../../../services/bookService"; // điều chỉnh đường dẫn

export default function DeleteCopyDialog({ open, onClose, copy, onDeleted }) {
    const { enqueueSnackbar } = useSnackbar();
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        if (!copy?.documentCopyId) return;
        setLoading(true);
        try {
            const res = await deleteCopy(copy.documentCopyId);
            enqueueSnackbar("Xoá bản sao thành công", { variant: "success" });
            onDeleted && onDeleted(res?.data ?? res);
            onClose();
        } catch (e) {
            const msg = e?.response?.data?.message || e?.message || "Xoá thất bại";
            enqueueSnackbar(msg, { variant: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={!!open} onClose={onClose}>
            <DialogTitle>Xác nhận xoá bản sao</DialogTitle>
            <DialogContent>
                <Typography>Bạn chắc chắn muốn xoá bản sao <strong>{copy?.barCode || `#${copy?.documentCopyId}`}</strong> không?</Typography>

            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={loading}>Huỷ</Button>
                <Button color="error" variant="contained" onClick={handleConfirm} disabled={loading}>
                    Xoá
                </Button>
            </DialogActions>
        </Dialog>
    );
}
