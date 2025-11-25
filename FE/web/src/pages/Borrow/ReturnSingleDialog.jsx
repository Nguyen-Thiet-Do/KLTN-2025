import React, { useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Stack,
    TextField,
    FormControlLabel,
    Checkbox,
    Typography,
    Divider,
    Box,
    Alert,
} from "@mui/material";
import { useAuth } from "../../contexts/AuthContext";
import { returnSingleItem } from "../../services/loanSlips";
import { useSnackbar } from "notistack";

const nf = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

function parseDateOnly(d = null) {
    if (!d) return null;
    return String(d).slice(0, 10);
}

/** Helpers client-side (ước lượng) */
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

export default function ReturnSingleDialog({ open, onClose, loanDetail, onReturned }) {
    const { enqueueSnackbar } = useSnackbar();
    const { user } = useAuth();

    // derive librarianId robustly
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
    const [conditionReturn, setConditionReturn] = useState(100);
    const [isLost, setIsLost] = useState(false);
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    useEffect(() => {
        if (open) {
            setReturnDate(parseDateOnly(new Date().toISOString()));
            setConditionReturn(loanDetail?.conditionBorrow ? Number(loanDetail.conditionBorrow) : 100);
            setIsLost(false);
            setNote("");
            setErrorMsg(null);
            setSuccessMsg(null);
        }
    }, [open, loanDetail]);

    const preview = useMemo(() => {
        if (!loanDetail) return null;
        const slipDue = loanDetail?.LoanSlip?.dueDate || loanDetail?.dueDate;
        const borrowCond = loanDetail?.conditionBorrow;
        const coverPrice = loanDetail?.DocumentCopy?.Document?.coverPrice ?? 0;
        const over = calculateOverdueFine(slipDue, returnDate);
        const lost = isLost ? calculateLostFine(coverPrice) : 0;
        const damage = isLost ? 0 : calculateDamageFine(borrowCond, conditionReturn, coverPrice);
        const totalFine = over + lost + damage;
        const deposit = Number(loanDetail.depositAmount) || 0;
        const refund = Math.max(0, deposit - totalFine);
        const extra = Math.max(0, totalFine - deposit);
        return { over, lost, damage, totalFine, deposit, refund, extra, coverPrice, borrowCond };
    }, [loanDetail, returnDate, conditionReturn, isLost]);

    async function handleConfirm() {
        if (!loanDetail) return;
        setErrorMsg(null);
        setSuccessMsg(null);

        if (!returnDate) {
            setErrorMsg("Vui lòng chọn ngày trả");
            return;
        }
        if (!isLost) {
            const c = Number(conditionReturn);
            if (isNaN(c) || c < 0 || c > 100) {
                setErrorMsg("Tình trạng trả phải là số từ 0 - 100");
                return;
            }
        }

        setLoading(true);
        try {
            const payload = {
                loanDetailId: loanDetail.loanDetailId,
                returnDate,
                conditionReturn: isLost ? 0 : Number(conditionReturn),
                isLost: !!isLost,
                note: note || undefined,
            };

            if (librarianIdFromAuth) {
                payload.librarianId = Number(librarianIdFromAuth);
            }

            const res = await returnSingleItem(payload);
            if (res?.success) {
                const msg = res?.message || "Trả thành công";
                enqueueSnackbar(msg, { variant: "success" });
                onReturned && onReturned(res);
                onClose?.();
            } else {
                const msg = res?.message || "Trả thất bại";
                setErrorMsg(msg);
                enqueueSnackbar(msg, { variant: "error" });
            }
        } catch (err) {
            console.error(err);
            const msg = err?.response?.data?.message || err?.message || "Lỗi khi trả";
            setErrorMsg(msg);
            enqueueSnackbar(msg, { variant: "error" });
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={Boolean(open)} onClose={() => onClose?.()} fullWidth maxWidth="sm">
            <DialogTitle>Trả tài liệu - {loanDetail ? `#${loanDetail.loanDetailId}` : ""}</DialogTitle>
            <DialogContent dividers>
                {!loanDetail ? (
                    <Typography>Không có thông tin chi tiết.</Typography>
                ) : (
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="subtitle2">Tài liệu</Typography>
                            <Typography>{loanDetail.DocumentCopy?.Document?.title || `Copy #${loanDetail.documentCopyId}`}</Typography>
                            <Typography variant="caption" color="text.secondary">Mã vạch: {loanDetail.DocumentCopy?.barCode || "-"}</Typography>
                        </Box>

                        {/* Hiển thị thông tin thủ thư đang xử lý */}
                        {user && (
                            <Box sx={{ p: 1.5, bgcolor: "rgba(102,126,234,0.08)", borderRadius: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                    Thủ thư xử lý: <strong>{user.fullName || `#${librarianIdFromAuth}`}</strong>
                                </Typography>
                            </Box>
                        )}

                        <Stack direction="row" spacing={2}>
                            <TextField
                                label="Ngày trả"
                                type="date"
                                value={returnDate}
                                onChange={(e) => setReturnDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                sx={{ minWidth: 180 }}
                            />
                            <TextField
                                label="Tình trạng trả (0-100)"
                                type="number"
                                value={conditionReturn}
                                onChange={(e) => setConditionReturn(e.target.value)}
                                disabled={isLost}
                                InputProps={{ inputProps: { min: 0, max: 100 } }}
                                sx={{ width: 180 }}
                            />
                            <FormControlLabel
                                control={<Checkbox checked={isLost} onChange={(e) => setIsLost(e.target.checked)} />}
                                label="Mất sách"
                            />
                        </Stack>

                        <TextField
                            label="Ghi chú (tuỳ chọn)"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            multiline
                            rows={2}
                        />

                        <Divider />

                        <Box>
                            <Typography variant="subtitle2">Ước tính phí</Typography>
                            <Stack spacing={1}>
                                <Typography variant="body2">Tiền cọc: {nf.format(preview?.deposit ?? 0)}₫</Typography>
                                <Typography variant="body2">Phạt trễ: {nf.format(preview?.over ?? 0)}₫</Typography>
                                <Typography variant="body2">Phạt hư hỏng: {nf.format(preview?.damage ?? 0)}₫</Typography>
                                <Typography variant="body2">Phạt mất: {nf.format(preview?.lost ?? 0)}₫</Typography>
                                <Typography variant="body2" fontWeight={700}>Tổng phạt: {nf.format(preview?.totalFine ?? 0)}₫</Typography>
                                <Typography variant="body2">Hoàn cọc: {nf.format(preview?.refund ?? 0)}₫ • Phải trả thêm: {nf.format(preview?.extra ?? 0)}₫</Typography>
                            </Stack>
                        </Box>

                        {errorMsg && <Alert severity="error">{errorMsg}</Alert>}
                        {successMsg && <Alert severity="success">{successMsg}</Alert>}
                    </Stack>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={() => onClose?.()} disabled={loading}>Huỷ</Button>
                <Button variant="contained" onClick={handleConfirm} disabled={loading || !loanDetail}>
                    Xác nhận trả
                </Button>
            </DialogActions>
        </Dialog>
    );
}
