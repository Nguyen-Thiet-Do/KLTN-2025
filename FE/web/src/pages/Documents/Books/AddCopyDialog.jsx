import { useState, useEffect, useCallback } from "react";
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Box, Stack, TextField, MenuItem, Button, IconButton, Tooltip,
    Typography, Divider, Chip, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Paper, InputAdornment,
} from "@mui/material";
import { Add as AddIcon, Delete as DeleteIcon } from "@mui/icons-material";

const STATUS_OPTIONS = ["AVAILABLE", "BORROWED", "MAINTENANCE", "LOST"];

// ĐẶT TRƯỚC: function declaration được hoisted
function makeDefaultRow() {
    return {
        barCode: "",
        status: "AVAILABLE",
        conditionNote: "100",
        entryDate: new Date().toISOString().slice(0, 10),
    };
}

export default function AddCopyDialog({ open, onClose, onSubmit }) {
    // Lazy init để không gọi lại mỗi render
    const [rows, setRows] = useState(() => [makeDefaultRow()]);
    const [saving, setSaving] = useState(false);

    // --- Reset helpers ---
    const resetForm = useCallback(() => {
        setRows([makeDefaultRow()]);
        setSaving(false);
    }, []);

    // Mỗi lần mở dialog -> reset để luôn sạch dữ liệu cũ
    useEffect(() => {
        if (open) resetForm();
    }, [open, resetForm]);

    const addRow = () => setRows((p) => [...p, makeDefaultRow()]);
    const rmRow = (i) => setRows((p) => p.filter((_, idx) => idx !== i));
    const up = (i, k, v) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));

    const submit = async () => {
        setSaving(true);
        try {
            const payload = rows.map((r) => ({
                barCode: r.barCode?.trim() || undefined,
                status: r.status || "AVAILABLE",
                conditionNote: r.conditionNote ? String(r.conditionNote) : "100",
                entryDate: r.entryDate || new Date().toISOString().slice(0, 10),
            }));
            await onSubmit?.(payload);
            // Sau khi submit thành công, lần mở sau sẽ sạch
            resetForm();
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        if (!saving) onClose?.();
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            fullWidth
            maxWidth="lg"
            scroll="paper"
            // Reset state ngay khi dialog đóng hẳn
            TransitionProps={{ onExited: resetForm }}
            PaperProps={{ sx: { borderRadius: 2, overflow: "hidden" } }}
        >
            <DialogTitle sx={{ pb: 1 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                        <Typography variant="h6">Thêm bản sao tài liệu</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Nhập thông tin rõ ràng: mã vạch (nếu có), trạng thái, tình trạng (%) và ngày nhập kho.
                        </Typography>
                    </Box>
                    <Chip label={`Tổng dòng: ${rows.length}`} color="primary" variant="outlined" />
                </Stack>
            </DialogTitle>

            <Divider />

            <DialogContent sx={{ p: 0 }}>
                <TableContainer component={Paper} elevation={0} sx={{ maxHeight: 520 }}>
                    <Table stickyHeader size="medium" aria-label="Bảng thêm bản sao">
                        <TableHead>
                            <TableRow>
                                <TableCell width={320}>BarCode (tuỳ chọn)</TableCell>
                                <TableCell width={220}>Trạng thái</TableCell>
                                <TableCell width={220}>Tình trạng (%)</TableCell>
                                <TableCell width={240}>Ngày nhập</TableCell>
                                <TableCell width={80} align="center">Xoá</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((r, i) => (
                                <TableRow key={i} hover>
                                    <TableCell>
                                        <TextField
                                            fullWidth
                                            placeholder="Ví dụ: 893850597..."
                                            value={r.barCode}
                                            onChange={(e) => up(i, "barCode", e.target.value)}
                                            inputProps={{ "aria-label": `barcode-${i}` }}
                                        />
                                    </TableCell>

                                    <TableCell>
                                        <TextField
                                            fullWidth
                                            select
                                            value={r.status}
                                            onChange={(e) => up(i, "status", e.target.value)}
                                        >
                                            {STATUS_OPTIONS.map((s) => (
                                                <MenuItem key={s} value={s}>{s}</MenuItem>
                                            ))}
                                        </TextField>
                                    </TableCell>

                                    <TableCell>
                                        <TextField
                                            fullWidth
                                            type="number"
                                            value={r.conditionNote}
                                            onChange={(e) => up(i, "conditionNote", e.target.value)}
                                            inputProps={{ min: 0, max: 100 }}
                                            helperText="Độ mới của bản sao"
                                            InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                                        />
                                    </TableCell>

                                    <TableCell>
                                        <TextField
                                            fullWidth
                                            type="date"
                                            value={r.entryDate}
                                            onChange={(e) => up(i, "entryDate", e.target.value)}
                                            InputLabelProps={{ shrink: true }}
                                            helperText="Ngày nhập kho"
                                        />
                                    </TableCell>

                                    <TableCell align="center">
                                        <Tooltip title={rows.length === 1 ? "Cần ít nhất 1 dòng" : "Xoá dòng này"}>
                                            <span>
                                                <IconButton
                                                    aria-label={`delete-row-${i}`}
                                                    onClick={() => rmRow(i)}
                                                    disabled={rows.length === 1}
                                                    size="small"
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>

                <Box sx={{ p: 2 }}>
                    <Button variant="outlined" startIcon={<AddIcon />} onClick={addRow}>
                        Thêm dòng
                    </Button>
                </Box>
            </DialogContent>

            <Divider />

            <DialogActions sx={{ px: 2, py: 1.5 }}>
                <Button onClick={handleClose} disabled={saving} size="large">Huỷ</Button>
                <Button variant="contained" onClick={submit} disabled={saving} size="large">Lưu</Button>
            </DialogActions>
        </Dialog>
    );
}
