import { useEffect, useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Alert,
    Stack,
    Typography
} from "@mui/material";

/**
 * DeleteBookDialog (simple confirm)
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onConfirm: () => Promise<void>   // Xoá mềm với các tuỳ chọn mặc định (all = 1)
 *  - book: optional { documentId, title }
 */
export default function DeleteBookDialog({ open, onClose, onConfirm, book }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (open) { setError(""); setLoading(false); }
    }, [open, book?.documentId]);

    const handleConfirm = async () => {
        setLoading(true); setError("");
        try {
            await onConfirm?.();
        } catch (e) {
            setError(e?.response?.data?.message || e.message || "Xoá thất bại.");
            return;
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
            <DialogTitle>Xoá sách</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">
                        Bạn có chắc muốn xoá tài liệu <strong>#{book?.documentId}</strong>
                        {book?.title ? (<> — <em>{book.title}</em></>) : null}?
                    </Typography>
                    {!!error && <Alert severity="error">{error}</Alert>}
                    <Alert severity="warning">
                        Thao tác này không thể hoàn tác ngay trên giao diện.
                    </Alert>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={loading}>Huỷ</Button>
                <Button onClick={handleConfirm} variant="contained" color="error" disabled={loading}>
                    {loading ? 'Đang xoá…' : 'Xoá'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
