// src/components/Borrow/OnsiteReturnDialog.jsx
import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    TextField,
    Button,
    Checkbox,
    FormControlLabel,
    Typography,
    Box,
    CircularProgress
} from "@mui/material";
import { finishOnsiteLoanSlip } from "../../services/loanSlips";

/**
 * OnsiteReturnDialog
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - slip: loanSlip object (must include loanSlipId and details)
 *  - librarianId: number (required)
 *  - onFinished: (res) => void
 */
export default function OnsiteReturnDialog({ open, onClose, slip, librarianId, onFinished }) {
    const [rows, setRows] = useState([]); // [{ loanDetailId, documentCopyId, title, conditionReturn, isLost }]
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) {
            setRows([]);
            setError("");
            setLoading(false);
            return;
        }
        // prepare rows from slip.details: only BORROWED without returnDate
        const details = (slip?.details || [])
            .filter(d => String((d.status || "").toUpperCase()) === "BORROWED" && !d.returnDate)
            .map(d => ({
                loanDetailId: d.loanDetailId,
                documentCopyId: d.documentCopy?.documentCopyId ?? d.documentCopyId ?? d.DocumentCopy?.documentCopyId,
                title: d.DocumentCopy?.Document?.title ?? d.Document?.title ?? `#${d.documentCopyId || d.loanDetailId}`,
                conditionReturn: "",
                isLost: false
            }));
        setRows(details);
        setError("");
    }, [open, slip]);

    function updateRow(idx, patch) {
        setRows(prev => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...patch };
            return copy;
        });
    }

    function buildPayload() {
        return {
            librarianId: Number(librarianId),
            returnDate: new Date().toISOString().slice(0, 10),
            items: rows.map(r => ({
                loanDetailId: Number(r.loanDetailId),
                conditionReturn: r.isLost ? null : (r.conditionReturn || null),
                isLost: !!r.isLost
            }))
        };
    }

    async function handleConfirm() {
        setError("");
        if (!slip || !slip.loanSlipId) {
            setError("Thiếu thông tin phiếu.");
            return;
        }
        if (!librarianId) {
            setError("Thiếu librarianId.");
            return;
        }
        if (!rows.length) {
            setError("Không có mục nào để xử lý.");
            return;
        }

        setLoading(true);
        try {
            const payload = buildPayload();
            const resp = await finishOnsiteLoanSlip(slip.loanSlipId, payload);
            if (!resp) {
                setError("Không nhận được phản hồi từ server");
                setLoading(false);
                return;
            }
            if (!resp.success) {
                setError(resp.message || "Kết thúc phiên thất bại");
                setLoading(false);
                return;
            }
            onFinished?.(resp);
            onClose();
        } catch (err) {
            console.error("OnsiteReturnDialog.finish error", err);
            setError(err?.message || "Lỗi gọi API");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={Boolean(open)} onClose={() => { if (!loading) onClose(); }} fullWidth maxWidth="md">
            <DialogTitle>Kết thúc đọc tại chỗ — Phiếu #{slip?.loanSlipId ?? ""}</DialogTitle>
            <DialogContent dividers>
                {!rows.length ? (
                    <Typography variant="body2" color="text.secondary">Phiếu không có mục đang đọc để xử lý.</Typography>
                ) : (
                    <Box sx={{ width: "100%", overflowX: "auto" }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>#Detail</TableCell>
                                    <TableCell>Tài liệu</TableCell>
                                    <TableCell>Mã bản sao</TableCell>
                                    <TableCell>Ghi chú khi trả</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {rows.map((r, idx) => (
                                    <TableRow key={r.loanDetailId}>
                                        <TableCell>{r.loanDetailId}</TableCell>
                                        <TableCell sx={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</TableCell>
                                        <TableCell>{r.documentCopyId ?? "-"}</TableCell>
                                        <TableCell>
                                            <TextField
                                                size="small"
                                                placeholder="Ghi chú (tuỳ chọn)"
                                                value={r.conditionReturn}
                                                onChange={(e) => updateRow(idx, { conditionReturn: e.target.value })}
                                                fullWidth
                                            />
                                        </TableCell>
                                        <TableCell sx={{ display: "none" }}>
                                            <FormControlLabel
                                                control={<Checkbox checked={r.isLost} onChange={(e) => updateRow(idx, { isLost: e.target.checked })} />}
                                                label="Báo mất"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        {error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}
                    </Box>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={() => { if (!loading) onClose(); }} disabled={loading}>Đóng</Button>
                <Button variant="contained" onClick={handleConfirm} disabled={loading} sx={{ textTransform: "none" }}>
                    {loading ? <CircularProgress size={20} /> : "Xác nhận"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

OnsiteReturnDialog.propTypes = {
    open: PropTypes.bool,
    onClose: PropTypes.func,
    slip: PropTypes.object,
    librarianId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    onFinished: PropTypes.func
};
