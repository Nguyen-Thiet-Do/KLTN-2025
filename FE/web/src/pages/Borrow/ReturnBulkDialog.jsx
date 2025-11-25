import React, { useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Stack,
    TextField,
    Checkbox,
    FormControlLabel,
    Typography,
    Divider,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Alert,
    Box,
} from "@mui/material";
import { useAuth } from "../../contexts/AuthContext";
import { returnBulkItems } from "../../services/loanSlips";
import { useSnackbar } from "notistack";

const nf = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

function parseDateOnly(d = null) {
    if (!d) return null;
    return String(d).slice(0, 10);
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function daysDiff(a, b) {
    if (!a || !b) return 0;
    const da = new Date(`${a}T00:00:00Z`);
    const db = new Date(`${b}T00:00:00Z`);
    return Math.round((db.getTime() - da.getTime()) / ONE_DAY_MS);
}

function calculateOverdueFine(dueDate, returnDate) {
    const overdueDays = daysDiff(dueDate, returnDate);
    if (overdueDays <= 0) return 0;
    let fine = 0;
    if (overdueDays <= 7) fine = overdueDays * 2000;
    else if (overdueDays <= 15) fine = 7 * 2000 + (overdueDays - 7) * 3000;
    else fine = 7 * 2000 + 8 * 3000 + (overdueDays - 15) * 5000;
    return Math.min(fine, 50000);
}

function calculateDamageFine(conditionBorrow, conditionReturn, coverPrice) {
    const borrow = Number(conditionBorrow) || 100;
    const ret = Number(conditionReturn) || 100;
    const price = Number(coverPrice) || 0;
    if (ret >= borrow) return 0;
    const degradation = borrow - ret;
    return Math.round((degradation / 100) * price);
}

function calculateLostFine(coverPrice) {
    return Number(coverPrice) || 0;
}

export default function ReturnBulkDialog({ open, onClose, slip, onReturned }) {
    const { enqueueSnackbar } = useSnackbar();
    const { user } = useAuth();

    // derive librarianId robustly (prioritize explicit librarianId fields, fallback accountId)
    const librarianIdFromAuth = useMemo(() => {
        return (
            Number(user?.librarianId) ||
            Number(user?.profile?.librarianId) ||
            Number(user?.Librarian?.librarianId) ||
            Number(user?.accountId) ||
            null
        );
    }, [user]);

    const [returnDate, setReturnDate] = useState(() => parseDateOnly(new Date().toISOString()));
    const [items, setItems] = useState([]); // [{loanDetailId, conditionReturn, isLost, note, depositAmount, borrowCond, coverPrice}]
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    useEffect(() => {
        if (open && slip) {
            setReturnDate(parseDateOnly(new Date().toISOString()));
            const borroweds = (slip.details || []).filter(d => String(d.status).toUpperCase() === "BORROWED");
            setItems(borroweds.map(d => ({
                loanDetailId: d.loanDetailId,
                conditionReturn: d.conditionBorrow != null ? Number(d.conditionBorrow) : 100,
                isLost: false,
                note: d.note || "",
                depositAmount: Number(d.depositAmount) || 0,
                borrowCond: d.conditionBorrow,
                coverPrice: d.DocumentCopy?.Document?.coverPrice || 0,
                barCode: d.DocumentCopy?.barCode || null,
            })));
            setErrorMsg(null);
        } else if (!open) {
            setItems([]);
            setErrorMsg(null);
        }
    }, [open, slip]);

    const summary = useMemo(() => {
        let totalOver = 0, totalDamage = 0, totalLost = 0, totalDeposit = 0;
        for (const it of items) {
            const over = calculateOverdueFine(slip?.dueDate, returnDate);
            const lost = it.isLost ? calculateLostFine(it.coverPrice) : 0;
            const damage = it.isLost ? 0 : calculateDamageFine(it.borrowCond, it.conditionReturn, it.coverPrice);
            totalOver += over;
            totalDamage += damage;
            totalLost += lost;
            totalDeposit += Number(it.depositAmount || 0);
        }
        const totalFine = totalOver + totalDamage + totalLost;
        return {
            totalOver, totalDamage, totalLost, totalFine, totalDeposit,
            refund: Math.max(0, totalDeposit - totalFine),
            extra: Math.max(0, totalFine - totalDeposit)
        };
    }, [items, returnDate, slip]);

    function updateItem(id, patch) {
        setItems((prev) => prev.map(it => it.loanDetailId === id ? { ...it, ...patch } : it));
    }

    async function handleConfirm() {
        if (!slip) return;
        if (!returnDate) { setErrorMsg("Chọn ngày trả"); return; }
        if (!items.length) { setErrorMsg("Không có item để trả"); return; }

        const payload = {
            loanSlipId: slip.loanSlipId,
            returnDate,
            items: items.map(it => ({
                loanDetailId: it.loanDetailId,
                conditionReturn: it.isLost ? 0 : Number(it.conditionReturn),
                isLost: !!it.isLost,
                note: it.note || undefined
            }))
        };

        // Gửi librarianId nếu có
        if (librarianIdFromAuth) {
            payload.librarianId = Number(librarianIdFromAuth);
        }

        setLoading(true);
        setErrorMsg(null);
        try {
            const res = await returnBulkItems(payload);
            if (res?.success) {
                enqueueSnackbar("Trả toàn bộ thành công.", { variant: "success" });
                onReturned && onReturned(res);
                onClose && onClose();
            } else {
                const msg = res?.message || "Trả toàn bộ thất bại";
                setErrorMsg(msg);
                enqueueSnackbar(msg, { variant: "error" });
            }
        } catch (err) {
            console.error(err);
            const msg = err?.response?.data?.message || err?.message || "Lỗi khi trả toàn bộ";
            setErrorMsg(msg);
            enqueueSnackbar(msg, { variant: "error" });
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={Boolean(open)} onClose={() => onClose?.()} fullWidth maxWidth="lg">
            <DialogTitle>Trả toàn bộ phiếu #{slip?.loanSlipId}</DialogTitle>
            <DialogContent dividers>
                {!slip ? <Typography>Không có thông tin</Typography> : (
                    <Stack spacing={2}>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <TextField
                                label="Ngày trả"
                                type="date"
                                value={returnDate}
                                onChange={(e) => setReturnDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                sx={{ minWidth: 180 }}
                            />
                            <Typography variant="body2" color="text.secondary">
                                Độc giả: {slip.Reader?.fullName || slip.readerId}
                            </Typography>
                        </Stack>

                        {/* Hiển thị thông tin thủ thư đang xử lý */}
                        {user && (
                            <Box sx={{ p: 1.5, bgcolor: "rgba(102,126,234,0.08)", borderRadius: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                    Thủ thư xử lý: <strong>{user.fullName || `#${librarianIdFromAuth}`}</strong>
                                </Typography>
                            </Box>
                        )}

                        <Divider />

                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>#Detail</TableCell>
                                    <TableCell>Mã vạch</TableCell>
                                    <TableCell>Tựa</TableCell>
                                    <TableCell>Tiền cọc</TableCell>
                                    <TableCell>Trạng thái mượn</TableCell>
                                    <TableCell>Tình trạng trả</TableCell>
                                    <TableCell>Mất sách</TableCell>
                                    <TableCell>Ghi chú</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {items.length === 0 ? (
                                    <TableRow><TableCell colSpan={8} align="center">Không có item BORROWED để trả</TableCell></TableRow>
                                ) : items.map(it => (
                                    <TableRow key={it.loanDetailId}>
                                        <TableCell>{it.loanDetailId}</TableCell>
                                        <TableCell sx={{ fontFamily: "monospace" }}>{it.barCode || "-"}</TableCell>
                                        <TableCell>{/* title không có ở đây */}</TableCell>
                                        <TableCell>{nf.format(it.depositAmount)}₫</TableCell>
                                        <TableCell>{it.borrowCond ?? "-"}</TableCell>
                                        <TableCell>
                                            <TextField
                                                type="number"
                                                value={it.conditionReturn}
                                                onChange={(e) => updateItem(it.loanDetailId, { conditionReturn: Number(e.target.value) })}
                                                size="small"
                                                sx={{ width: 120 }}
                                                disabled={it.isLost}
                                                inputProps={{ min: 0, max: 100 }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormControlLabel
                                                control={<Checkbox checked={it.isLost} onChange={(e) => updateItem(it.loanDetailId, { isLost: e.target.checked })} />}
                                                label="Mất"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                value={it.note}
                                                onChange={(e) => updateItem(it.loanDetailId, { note: e.target.value })}
                                                size="small"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        <Divider />

                        <Box>
                            <Typography variant="subtitle2">Tóm tắt ước lượng</Typography>
                            <Typography>Tiền cọc tổng: {nf.format(summary.totalDeposit)}₫</Typography>
                            <Typography>Phạt trễ tổng: {nf.format(summary.totalOver)}₫</Typography>
                            <Typography>Phạt hư hỏng tổng: {nf.format(summary.totalDamage)}₫</Typography>
                            <Typography>Phạt mất tổng: {nf.format(summary.totalLost)}₫</Typography>
                            <Typography fontWeight={700}>Tổng phạt: {nf.format(summary.totalFine)}₫</Typography>
                            <Typography>Hoàn cọc: {nf.format(summary.refund)}₫ • Phải trả thêm: {nf.format(summary.extra)}₫</Typography>
                        </Box>

                        {errorMsg && <Alert severity="error">{errorMsg}</Alert>}
                    </Stack>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={() => onClose?.()} disabled={loading}>Huỷ</Button>
                <Button variant="contained" onClick={handleConfirm} disabled={loading || items.length === 0}>
                    Xác nhận trả toàn bộ
                </Button>
            </DialogActions>
        </Dialog>
    );
}
