// src/components/AddLoanSlipDialog.jsx
import { useMemo, useState, useEffect } from "react";
import {
    Box, Button, Card, CardContent, CardHeader, Divider, Grid, IconButton, Stack,
    TextField, Typography, Alert, Snackbar, Dialog, DialogTitle, DialogContent,
    DialogActions, Table, TableBody, TableCell, TableHead, TableRow, Paper, Slide,
    Avatar, Tooltip
} from "@mui/material";
import {
    Add, Delete, QrCode2, Save, Close,
    Search as SearchIcon, InfoOutlined
} from "@mui/icons-material";

import { useAuth } from "../../contexts/AuthContext"; // đổi path nếu cần
import { getReaderById } from "../../services/readerService"; // thêm hàm này
import {
    createLoanSlip,
    createLoanSlipPaymentQR,
    confirmLoanSlipPaymentBySlip, // thêm hàm này trong loanSlips service
    getCopyWithDeposit  
} from "../../services/loanSlips";

const Transition = (props) => <Slide direction="up" {...props} />;
const nf = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

function Money({ value }) {
    if (value == null || value === "") return "-";
    const n = Number(value);
    return Number.isNaN(n) ? String(value) : `${nf.format(n)}₫`;
}

/**
 * Dialog tạo phiếu mượn (PENDING_PAYMENT) + Thanh toán qua QR
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onCreated?: (payload) => void // gọi sau khi xác nhận thanh toán để reload list
 */
export default function AddLoanSlipDialog({ open, onClose, onCreated }) {
    const { user } = useAuth();

    // ---- FORM STATE ----
    const [readerId, setReaderId] = useState("");
    const [readerInfo, setReaderInfo] = useState(null);

    const [librarianId, setLibrarianId] = useState(""); // auto từ user đăng nhập
    const [loanDate, setLoanDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [dueDate, setDueDate] = useState("");
    const [useManualTotal, setUseManualTotal] = useState(false);
    const [totalAmount, setTotalAmount] = useState("");

    // Mỗi item: { documentCopyId, depositAmount, note, copyDoc }
    const [items, setItems] = useState([
        { documentCopyId: "", depositAmount: "", note: "", copyDoc: null },
    ]);

    // ---- UI / RESULT STATE ----
    const [submitting, setSubmitting] = useState(false);
    const [creatingPayment, setCreatingPayment] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState("");
    const [toast, setToast] = useState("");

    const [created, setCreated] = useState(null); // { loanSlip, items, payment }
    const [qrInfo, setQrInfo] = useState(null);   // { paymentId, amount, status, transactionCode, qr }

    // Tự điền librarianId khi mở dialog theo user đăng nhập
    useEffect(() => {
        if (open && user) {
            // Đổi field theo dữ liệu thực tế của bạn:
            // ví dụ user.librarianId hoặc user.accountId
            const derivedId = user?.librarianId ?? user?.accountId ?? user?.id ?? "";
            setLibrarianId(derivedId || "");
        }
    }, [open, user]);

    // Reset form khi đóng
    const resetForm = () => {
        setReaderId("");
        setReaderInfo(null);
        setLibrarianId(user?.librarianId ?? user?.accountId ?? user?.id ?? "");
        setLoanDate(new Date().toISOString().slice(0, 10));
        setDueDate("");
        setUseManualTotal(false);
        setTotalAmount("");
        setItems([{ documentCopyId: "", depositAmount: "", note: "", copyDoc: null }]);
        setError("");
        setCreated(null);
        setQrInfo(null);
        setSubmitting(false);
        setCreatingPayment(false);
        setConfirming(false);
    };

    // Tính tổng cọc
    const computedTotal = useMemo(() => {
        if (useManualTotal) return Number(totalAmount || 0) || 0;
        return items.reduce((s, it) => s + (Number(it.depositAmount) || 0), 0);
    }, [useManualTotal, totalAmount, items]);

    // ---- Fetch độc giả theo ID ----
    const fetchReader = async (id) => {
        if (!id) { setReaderInfo(null); return; }
        try {
            const data = await getReaderById(id);
            // BE có thể trả {success,data} hoặc object
            const reader = data?.data ?? data;
            setReaderInfo(reader || null);
            if (!reader) setError("Không tìm thấy độc giả theo ID đã nhập.");
        } catch (e) {
            setReaderInfo(null);
            setError("Không lấy được thông tin độc giả.");
        }
    };

    // ---- Fetch copy + document + deposit cho 1 dòng ----
    const fetchCopyForRow = async (idx) => {
        const id = items[idx]?.documentCopyId;
        if (!id) return;
        try {
            const data = await getCopyWithDeposit(id, { withDoc: 1, withAuthors: 1, withSubtype: 1 });
            const st = String(data?.copy?.status || "").toUpperCase();
            if (st && st !== "AVAILABLE") {
                throw new Error(`Bản sao #${id} đang ở trạng thái ${st}`);
            }

            setItems(prev => prev.map((it, i) => {
                if (i !== idx) return it;
                const apiDeposit = data?.copy?.deposit ?? (
                    data?.copy?.coverPrice != null && data?.copy?.depositRate != null
                        ? Number(data.copy.coverPrice) * Number(data.copy.depositRate)
                        : null
                );

                const nextDeposit = (it.depositAmount === "" || it.depositAmount == null)
                    ? (apiDeposit != null ? Math.round(apiDeposit) : it.depositAmount)
                    : it.depositAmount;

                return {
                    ...it,
                    depositAmount: nextDeposit,
                    copyDoc: {
                        title: data?.document?.title ?? "",
                        coverPhoto: data?.document?.coverPhoto ?? "",
                        barCode: data?.copy?.barCode ?? "",
                        documentId: data?.copy?.documentId ?? data?.document?.documentId ?? null,
                        depositSuggest: apiDeposit != null ? Math.round(apiDeposit) : null,
                        coverPrice: data?.copy?.coverPrice ?? data?.document?.coverPrice ?? null,
                    }
                };
            }));
        } catch (e) {
            setError(e?.message || "Không lấy được thông tin bản sao");
            setItems(prev => prev.map((it, i) => (i === idx ? { ...it, copyDoc: null } : it)));
        }
    };

    // ---- Validate ----
    const validate = () => {
        if (!readerId || !librarianId) { setError("Vui lòng nhập đầy đủ độc giả và thủ thư."); return false; }
        if (!readerInfo?.readerId) { setError("Không tìm thấy thông tin độc giả theo ID đã nhập."); return false; }
        if (!items.length) { setError("Cần ít nhất 1 đầu mục mượn."); return false; }
        for (const [i, it] of items.entries()) {
            if (!it.documentCopyId) { setError(`Hàng #${i + 1}: thiếu ID bản sao.`); return false; }
            if (it.depositAmount !== "" && Number(it.depositAmount) < 0) { setError(`Hàng #${i + 1}: tiền cọc không hợp lệ.`); return false; }
        }
        if (useManualTotal && (totalAmount === "" || Number(totalAmount) < 0)) {
            setError("Tổng tiền cọc nhập tay không hợp lệ."); return false;
        }
        setError("");
        return true;
    };

    // ---- Helpers items ----
    const handleAddRow = () => setItems(prev => [...prev, { documentCopyId: "", depositAmount: "", note: "", copyDoc: null }]);
    const handleRemoveRow = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));
    const updateItem = (idx, field, value) =>
        setItems(prev => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));

    // ---- Tạo phiếu (PENDING_PAYMENT) ----
    const createSlip = async () => {
        const payload = {
            readerId: Number(readerId),
            librarianId: Number(librarianId),
            loanDate: loanDate || undefined,
            dueDate: dueDate || undefined,
            items: items.map((it) => ({
                documentCopyId: Number(it.documentCopyId),
                depositAmount: it.depositAmount === "" ? undefined : Number(it.depositAmount),
                note: it.note || undefined,
            })),
            totalAmount: useManualTotal ? Number(totalAmount) : undefined,
        };
        const res = await createLoanSlip(payload);
        setCreated(res);
        return res;
    };

    // ---- Thanh toán: tạo phiếu (nếu chưa có) -> tạo QR ----
    const onPay = async () => {
        if (!validate()) return;
        setCreatingPayment(true);
        try {
            const data = created || (await createSlip());
            const slipId = data?.loanSlip?.loanSlipId;
            if (!slipId) throw new Error("Không xác định được loanSlipId");

            const qr = await createLoanSlipPaymentQR({
                loanSlipId: slipId,
                amount: computedTotal,
                description: `Tien coc phieu muon #${slipId}`,
            });
            setQrInfo(qr);
            setToast("Đã tạo QR thanh toán. Vui lòng quét để thanh toán.");
        } catch (e) {
            const msg = e?.response?.data?.message || e?.message || "Không tạo được QR";
            setError(msg);
        } finally {
            setCreatingPayment(false);
        }
    };

    // ---- Xác nhận thanh toán & lưu (confirm theo loanSlipId) ----
    const onConfirmPaymentAndSave = async () => {
        try {
            if (!created?.loanSlip?.loanSlipId) throw new Error("Chưa có phiếu mượn để xác nhận.");
            setConfirming(true);
            await confirmLoanSlipPaymentBySlip(created.loanSlip.loanSlipId);
            setToast("Đã xác nhận thanh toán và lưu phiếu.");
            onCreated && onCreated({ ...created, confirmed: true });
            // (tuỳ chọn) đóng dialog:
            // onClose?.();
        } catch (e) {
            const msg = e?.response?.data?.message || e?.message || "Không xác nhận được thanh toán";
            setError(msg);
        } finally {
            setConfirming(false);
        }
    };

    // ---- Close ----
    const handleCloseAll = () => {
        resetForm();
        onClose && onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={handleCloseAll}
            maxWidth="md"
            fullWidth
            TransitionComponent={Transition}
            keepMounted
        >
            <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="h6" fontWeight={800}
                    sx={{
                        background: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
                        backgroundClip: "text",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}
                >
                    Tạo phiếu mượn (PENDING_PAYMENT)
                </Typography>
                <IconButton onClick={handleCloseAll}><Close /></IconButton>
            </DialogTitle>

            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

                {/* Thông tin chung */}
                <Card variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
                    <CardHeader title="Thông tin chung" sx={{ pb: 0 }} />
                    <CardContent>
                        <Grid container spacing={2}>
                            {/* ID độc giả + nút tra */}
                            <Grid item xs={12} md={3}>
                                <TextField
                                    label="ID độc giả"
                                    type="number"
                                    value={readerId}
                                    onChange={(e) => setReaderId(e.target.value)}
                                    onBlur={() => fetchReader(readerId)}
                                    InputProps={{
                                        endAdornment: (
                                            <IconButton size="small" onClick={() => fetchReader(readerId)}>
                                                <SearchIcon />
                                            </IconButton>
                                        )
                                    }}
                                    fullWidth
                                />
                            </Grid>

                            {/* ID thủ thư from login (disabled) */}
                            <Grid item xs={12} md={3}>
                                <TextField
                                    label="ID thủ thư (đang đăng nhập)"
                                    type="number"
                                    value={librarianId}
                                    disabled
                                    helperText={user?.fullName ? `Bạn: ${user.fullName}` : "Lấy từ phiên đăng nhập"}
                                    fullWidth
                                />
                            </Grid>

                            <Grid item xs={12} md={3}>
                                <TextField
                                    label="Ngày tạo"
                                    type="date"
                                    value={loanDate}
                                    onChange={(e) => setLoanDate(e.target.value)}
                                    fullWidth
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <TextField
                                    label="Hạn trả (tuỳ chọn)"
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    fullWidth
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Grid>

                            {/* Thẻ thông tin độc giả */}
                            <Grid item xs={12}>
                                {readerInfo ? (
                                    <Stack
                                        direction="row"
                                        spacing={2}
                                        alignItems="center"
                                        sx={{ p: 1.5, border: (t) => `1px dashed ${t.palette.divider}`, borderRadius: 2 }}
                                    >
                                        <Avatar sx={{ bgcolor: "primary.main" }}>
                                            {(readerInfo.fullName || "?").slice(0, 1)}
                                        </Avatar>
                                        <Box>
                                            <Typography variant="subtitle2" fontWeight={700}>
                                                {readerInfo.fullName || `Reader #${readerInfo.readerId}`}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Tổng mượn: {readerInfo.totalBorrow ?? 0}
                                                {readerInfo.address ? ` • ĐC: ${readerInfo.address}` : ""}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                ) : (
                                    <Typography variant="body2" color="text.secondary">
                                        Nhập ID độc giả rồi nhấn biểu tượng tra cứu để xem thông tin.
                                    </Typography>
                                )}
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>

                {/* Đầu mục mượn */}
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardHeader
                        title="Đầu mục mượn"
                        subheader="Nhập ID bản sao (copyId). Hệ thống sẽ tự lấy thông tin sách và gợi ý tiền cọc."
                        sx={{ pb: 0 }}
                    />
                    <CardContent>
                        <Table component={Paper} size="small" sx={{ borderRadius: 2, overflow: "hidden" }}>
                            <TableHead>
                                <TableRow sx={{ backgroundColor: "rgba(102,126,234,0.08)" }}>
                                    <TableCell width={56}>#</TableCell>
                                    <TableCell>ID bản sao</TableCell>
                                    <TableCell>Tiêu đề / Bìa</TableCell>
                                    <TableCell>Tiền cọc</TableCell>
                                    <TableCell>Ghi chú</TableCell>
                                    <TableCell align="right" width={56}></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {items.map((it, idx) => (
                                    <TableRow key={idx} hover>
                                        <TableCell>{idx + 1}</TableCell>

                                        {/* copyId + tra cứu */}
                                        <TableCell>
                                            <TextField
                                                placeholder="VD: 130010"
                                                fullWidth
                                                type="number"
                                                value={it.documentCopyId}
                                                onChange={(e) => updateItem(idx, "documentCopyId", e.target.value)}
                                                onBlur={() => fetchCopyForRow(idx)}
                                                InputProps={{
                                                    endAdornment: (
                                                        <IconButton size="small" onClick={() => fetchCopyForRow(idx)}>
                                                            <SearchIcon fontSize="small" />
                                                        </IconButton>
                                                    )
                                                }}
                                            />
                                        </TableCell>

                                        {/* preview sách + cọc gợi ý */}
                                        <TableCell>
                                            {it.copyDoc ? (
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    {it.copyDoc.coverPhoto ? (
                                                        <img
                                                            src={it.copyDoc.coverPhoto}
                                                            alt={it.copyDoc.title}
                                                            style={{ width: 28, height: 36, objectFit: "cover", borderRadius: 4 }}
                                                        />
                                                    ) : null}
                                                    <Box sx={{ minWidth: 180 }}>
                                                        <Typography variant="body2" fontWeight={700} noWrap>
                                                            {it.copyDoc.title || "-"}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            BarCode: {it.copyDoc.barCode || "-"}
                                                        </Typography>
                                                        {it.copyDoc.depositSuggest != null && (
                                                            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                                                Gợi ý cọc: {nf.format(it.copyDoc.depositSuggest)}₫
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                    <Tooltip title="Dữ liệu từ /documents/admin/copies/:copyId">
                                                        <InfoOutlined fontSize="small" color="action" />
                                                    </Tooltip>
                                                </Stack>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">Chưa có dữ liệu</Typography>
                                            )}
                                        </TableCell>

                                        {/* depositAmount (auto fill nếu trống) */}
                                        <TableCell>
                                            <TextField
                                                placeholder="VD: 50000"
                                                fullWidth
                                                type="number"
                                                value={it.depositAmount}
                                                onChange={(e) => updateItem(idx, "depositAmount", e.target.value)}
                                            />
                                        </TableCell>

                                        {/* note */}
                                        <TableCell>
                                            <TextField
                                                placeholder="Ghi chú"
                                                fullWidth
                                                value={it.note}
                                                onChange={(e) => updateItem(idx, "note", e.target.value)}
                                            />
                                        </TableCell>

                                        <TableCell align="right">
                                            <IconButton color="error" onClick={() => handleRemoveRow(idx)} disabled={items.length === 1}>
                                                <Delete />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        <Button startIcon={<Add />} onClick={handleAddRow} sx={{ fontWeight: 700 }}>
                                            Thêm dòng
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>

                        {/* Tính tổng tiền cọc */}
                        <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={2}
                            alignItems={{ xs: "flex-start", md: "center" }}
                            justifyContent="space-between"
                            sx={{ mt: 2 }}
                        >
                            <Stack direction="row" spacing={2}>
                                <Button
                                    variant={useManualTotal ? "contained" : "outlined"}
                                    onClick={() => setUseManualTotal(v => !v)}
                                >
                                    {useManualTotal ? "Nhập tổng tiền cọc" : "Tự tính theo từng dòng"}
                                </Button>
                                {useManualTotal && (
                                    <TextField
                                        label="Tổng tiền cọc"
                                        type="number"
                                        value={totalAmount}
                                        onChange={(e) => setTotalAmount(e.target.value)}
                                    />
                                )}
                            </Stack>
                            <Typography variant="h6" fontWeight={800}>
                                Tổng cọc: <Money value={computedTotal} />
                            </Typography>
                        </Stack>

                        {/* QR hiển thị sau khi tạo */}
                        {qrInfo && (
                            <Stack spacing={1} alignItems="center" sx={{ mt: 2 }}>
                                <Typography>PaymentId: <b>#{qrInfo.paymentId}</b></Typography>
                                <Typography>Số tiền: <b><Money value={qrInfo.amount} /></b></Typography>
                                <Typography>Mã giao dịch: <b>{qrInfo.transactionCode}</b></Typography>
                                {qrInfo?.qr?.type === "data-url" && (
                                    <img src={qrInfo.qr.content} alt="QR Code" style={{ width: 240, height: 240 }} />
                                )}
                                <Alert severity="info" sx={{ mt: 1 }}>
                                    Quét QR để thanh toán, sau đó bấm “Xác nhận thanh toán & lưu”.
                                </Alert>
                            </Stack>
                        )}
                    </CardContent>
                </Card>
            </DialogContent>

            <DialogActions sx={{ justifyContent: "space-between" }}>
                <Box><Button onClick={handleCloseAll}>Hủy</Button></Box>
                <Stack direction="row" spacing={1}>
                    <Button
                        onClick={onPay}
                        variant="contained"
                        disabled={creatingPayment || submitting}
                        startIcon={<QrCode2 />}
                    >
                        {created ? "Tạo lại QR" : "Thanh toán"}
                    </Button>
                    {qrInfo && (
                        <Button
                            onClick={onConfirmPaymentAndSave}
                            variant="outlined"
                            disabled={confirming}
                            startIcon={<Save />}
                        >
                            Xác nhận thanh toán & lưu
                        </Button>
                    )}
                </Stack>
            </DialogActions>

            <Snackbar open={!!toast} autoHideDuration={2500} onClose={() => setToast("")} message={toast} />
        </Dialog>
    );
}
