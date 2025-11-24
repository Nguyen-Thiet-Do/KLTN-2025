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
 * DeleteMagazineDialog — giống DeleteBookDialog
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onConfirm: () => Promise<void>
 *  - item: { documentId, title }
 */
export default function DeleteMagazineDialog({ open, onClose, onConfirm, item }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (open) {
            setError("");
            setLoading(false);
        }
    }, [open, item?.documentId]);

    const handleConfirm = async () => {
        setLoading(true);
        setError("");
        try {
            await onConfirm?.();
        } catch (e) {
            setError(
                e?.response?.data?.message ||
                e.message ||
                "Xoá thất bại."
            );
            return;
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={loading ? undefined : onClose}
            maxWidth="xs"
            fullWidth
        >
            <DialogTitle>Xoá tạp chí</DialogTitle>

            <DialogContent>
                <Stack spacing={2} sx={{ mt: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">
                        Bạn có chắc muốn xoá tài liệu{" "}
                        <strong>#{item?.documentId}</strong>
                        {item?.title ? (
                            <>
                                {" — "}
                                <em>{item.title}</em>
                            </>
                        ) : null}
                        ?
                    </Typography>

                    {!!error && <Alert severity="error">{error}</Alert>}

                    <Alert severity="warning">
                        Thao tác này không thể hoàn tác ngay trên giao diện.
                    </Alert>
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={loading}>
                    Huỷ
                </Button>

                <Button
                    onClick={handleConfirm}
                    variant="contained"
                    color="error"
                    disabled={loading}
                >
                    {loading ? "Đang xoá…" : "Xoá"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
