// src/components/AddLoanSlipDialog.jsx
import { useMemo, useState, useEffect } from "react";
import {
    Box, Button, Card, CardContent, CardHeader, Grid, IconButton, Stack,
    TextField, Typography, Alert, Dialog, DialogTitle, DialogContent,
    DialogActions, Table, TableBody, TableCell, TableHead, TableRow, Paper, Slide,
    Avatar, Tooltip
} from "@mui/material";
import { Add, Delete, QrCode2, Save, Close, InfoOutlined } from "@mui/icons-material";
import { useSnackbar } from "notistack";

import { useAuth } from "../../contexts/AuthContext";
import { getReaderById } from "../../services/readerService";
import {
    createLoanSlip,
    createLoanSlipPaymentQR,
    confirmLoanSlipPaymentBySlip,
    getCopyWithDeposit
} from "../../services/loanSlips";

const Transition = (props) => <Slide direction="up" {...props} />;
const nf = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

function Money({ value }) {
    if (value == null || value === "") return "-";
    const n = Number(value);
    return Number.isNaN(n) ? String(value) : `${nf.format(n)}₫`;
}

/* ===========================
   Helpers lấy message / error
   =========================== */
const valToText = (v) => {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v.map(valToText).filter(Boolean).join("; ");
    if (typeof v === "object") return Object.values(v).map(valToText).filter(Boolean).join("; ");
    return String(v);
};

// Thành công -> lấy message (không trộn error)
const serverSuccessMsg = (src, fallback) => {
    const r = src?.response ?? src;
    const data = r?.data ?? r;
    return (
        valToText(data?.message) ||
        valToText(data?.msg) ||
        valToText(data?.Message) ||
        valToText(data?.Msg) ||
        valToText(r?.message) ||
        fallback
    );
};

// Lỗi -> lấy error (nếu không có thì mới rơi về details/errors/message)
const serverErrorMsg = (src, fallback) => {
    const r = src?.response ?? src;
    const data = r?.data ?? r;

    const err =
        valToText(data?.error) ||
        valToText(data?.Error);
    if (err) return err;

    const more =
        valToText(data?.details) ||
        valToText(data?.Details) ||
        valToText(data?.errors) ||
        valToText(data?.Errors) ||
        valToText(data?.message) || // dự phòng cuối
        valToText(r?.message);
    return more || fallback;
};

// Xác định có phải "thành công" theo quy ước: success !== false và không có status >= 400
const isSuccessPayload = (src) => {
    const r = src?.response ?? src;
    const data = r?.data ?? r;
    const status = r?.status;
    if (status != null && Number(status) >= 400) return false;
    if (data && Object.prototype.hasOwnProperty.call(data, "success")) {
        return data.success !== false;
    }
    // nếu không có trường success, coi là thành công nếu không phải lỗi HTTP
    return true;
};

/* ===========================
   Hook notify ngắn gọn
   =========================== */
const useNotify = () => {
    const { enqueueSnackbar } = useSnackbar();
    return {
        ok: (payload, fallback = "Thành công") =>
            enqueueSnackbar(serverSuccessMsg(payload, fallback), { variant: "success" }),
        err: (payload, fallback = "Có lỗi xảy ra") =>
            enqueueSnackbar(serverErrorMsg(payload, fallback), { variant: "error" }),
        warn: (text) => enqueueSnackbar(text, { variant: "warning" }),
        info: (text) => enqueueSnackbar(text, { variant: "info" }),
    };
};

export default function AddLoanSlipDialog({ open, onClose, onCreated }) {
    const notify = useNotify();
    const { user } = useAuth();

    // ---- FORM STATE ----
    const [readerId, setReaderId] = useState("");
    const [readerInfo, setReaderInfo] = useState(null);

    const [librarianId, setLibrarianId] = useState("");
    const [loanDate, setLoanDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [dueDate, setDueDate] = useState("");
    const [useManualTotal, setUseManualTotal] = useState(false);
    const [totalAmount, setTotalAmount] = useState("");

    // Mỗi item: { documentCopyId, depositAmount, note, copyDoc }
    const [items, setItems] = useState([
        { documentCopyId: "", depositAmount: "", note: "", copyDoc: null },
    ]);

    // ---- UI / RESULT STATE ----
    const [creatingPayment, setCreatingPayment] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState("");

    const [created, setCreated] = useState(null); // { loanSlip, items, payment }
    const [qrInfo, setQrInfo] = useState(null);   // { paymentId, amount, status, transactionCode, qr }

    // Auto điền librarianId theo user đăng nhập
    useEffect(() => {
        if (open && user) {
            const derivedId = user?.librarianId ?? user?.accountId ?? user?.id ?? "";
            setLibrarianId(derivedId || "");
        }
    }, [open, user]);

    // Reset form
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
        setCreatingPayment(false);
        setConfirming(false);
    };

    // Tổng cọc
    const computedTotal = useMemo(() => {
        if (useManualTotal) return Number(totalAmount || 0) || 0;
        return items.reduce((s, it) => s + (Number(it.depositAmount) || 0), 0);
    }, [useManualTotal, totalAmount, items]);

    // ---- Fetch độc giả theo ID ----
    const fetchReader = async (id) => {
        if (!id) { setReaderInfo(null); return; }
        try {
            const data = await getReaderById(id);
            const reader = data?.data ?? data;
            setReaderInfo(reader || null);
            if (!reader) {
                const msg = "Không tìm thấy độc giả theo ID đã nhập.";
                setError(msg);
                notify.warn(msg);
            }
        } catch (e) {
            const msg = serverErrorMsg(e, "Không lấy được thông tin độc giả.");
            setReaderInfo(null);
            setError(msg);
            notify.err(e, "Không lấy được thông tin độc giả.");
        }
    };

    // ---- Fetch copy + document + deposit cho 1 dòng ----
    const fetchCopyForRow = async (idx) => {
        const id = items[idx]?.documentCopyId;
        if (!id) {
            setItems(prev => prev.map((it, i) => (i === idx ? { ...it, copyDoc: null } : it)));
            return;
        }
        try {
            const data = await getCopyWithDeposit(id, { withDoc: 1, withAuthors: 1, withSubtype: 1 });
            const st = String(data?.copy?.status || "").toUpperCase();
            if (st && st !== "AVAILABLE") {
                // bọc theo format response-like để helper đọc được
                throw { response: { data: { error: `Bản sao #${id} đang ở trạng thái ${st}` } } };
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
            const msg = serverErrorMsg(e, "Không lấy được thông tin bản sao");
            setError(msg);
            notify.err(e, "Không lấy được thông tin bản sao");
            setItems(prev => prev.map((it, i) => (i === idx ? { ...it, copyDoc: null } : it)));
        }
    };

    // ---- Validate ----
    const validate = () => {
        if (!readerId || !librarianId) {
            const msg = "Vui lòng nhập đầy đủ độc giả và thủ thư.";
            setError(msg); notify.warn(msg); return false;
        }
        if (!readerInfo?.readerId) {
            const msg = "Không tìm thấy thông tin độc giả theo ID đã nhập.";
            setError(msg); notify.warn(msg); return false;
        }
        if (!items.length) {
            const msg = "Cần ít nhất 1 đầu mục mượn.";
            setError(msg); notify.warn(msg); return false;
        }
        for (const [i, it] of items.entries()) {
            if (!it.documentCopyId) {
                const msg = `Hàng #${i + 1}: thiếu ID bản sao.`;
                setError(msg); notify.warn(msg); return false;
            }
            if (it.depositAmount !== "" && Number(it.depositAmount) < 0) {
                const msg = `Hàng #${i + 1}: tiền cọc không hợp lệ.`;
                setError(msg); notify.warn(msg); return false;
            }
        }
        if (useManualTotal && (totalAmount === "" || Number(totalAmount) < 0)) {
            const msg = "Tổng tiền cọc nhập tay không hợp lệ.";
            setError(msg); notify.warn(msg); return false;
        }
        setError("");
        return true;
    };

    // ---- Tạo phiếu ----
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

        // Nếu success:false (kể cả HTTP 200) => coi là lỗi để đi vào catch
        if (!isSuccessPayload(res)) {
            throw { response: { data: res, status: 200 } };
        }
        setCreated(res);
        return res;
    };

    // ---- Thanh toán: tạo phiếu (nếu chưa có) -> tạo QR ----
    const onPay = async () => {
        if (!validate()) return;
        setCreatingPayment(true);
        try {
            const data = created || (await createSlip());

            // Thành công -> hiện message
            notify.ok(data, "Tạo phiếu mượn thành công");

            const slipId = data?.loanSlip?.loanSlipId;
            if (!slipId) throw { response: { data: { error: "Không xác định được loanSlipId" } } };

            const qr = await createLoanSlipPaymentQR({
                loanSlipId: slipId,
                amount: computedTotal,
                description: `Tien coc phieu muon #${slipId}`,
            });

            if (!isSuccessPayload(qr)) {
                const msg = serverErrorMsg(qr, "Không tạo được QR");
                setError(msg);
                notify.err(qr, "Không tạo được QR");
                return;
            }

            setQrInfo(qr);
            // Thành công -> chỉ hiện message
            notify.ok(qr, "Đã tạo QR thanh toán. Vui lòng quét để thanh toán.");
        } catch (e) {
            // Lỗi -> chỉ hiện error
            const msg = serverErrorMsg(e, "Không tạo được phiếu/QR");
            setError(msg);
            notify.err(e, "Không tạo được phiếu/QR");
        } finally {
            setCreatingPayment(false);
        }
    };

    // ---- Xác nhận thanh toán & lưu ----
    const onConfirmPaymentAndSave = async () => {
        try {
            if (!created?.loanSlip?.loanSlipId) {
                throw { response: { data: { error: "Chưa có phiếu mượn để xác nhận" } } };
            }
            setConfirming(true);
            const res = await confirmLoanSlipPaymentBySlip(created.loanSlip.loanSlipId);

            if (!isSuccessPayload(res)) {
                const msg = serverErrorMsg(res, "Không xác nhận được thanh toán");
                setError(msg);
                notify.err(res, "Không xác nhận được thanh toán");
                return;
            }

            // Thành công -> hiện message
            notify.ok(res, "Đã xác nhận thanh toán và lưu phiếu.");
            onCreated && onCreated({ ...created, confirmed: true });
        } catch (e) {
            const msg = serverErrorMsg(e, "Không xác nhận được thanh toán");
            setError(msg);
            notify.err(e, "Không xác nhận được thanh toán");
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
                <Typography
                    variant="h6"
                    fontWeight={800}
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
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
                        {error}
                    </Alert>
                )}

                {/* Thông tin chung */}
                <Card variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
                    <CardHeader title="Thông tin chung" sx={{ pb: 0 }} />
                    <CardContent>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={3}>
                                <TextField
                                    label="ID độc giả"
                                    type="number"
                                    value={readerId}
                                    onChange={(e) => setReaderId(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') fetchReader(readerId); }}
                                    onBlur={() => fetchReader(readerId)}
                                    fullWidth
                                />
                            </Grid>

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
                                                {readerInfo.cccd ? `CCCD: ${readerInfo.cccd}` : ""}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                ) : (
                                    <Typography variant="body2" color="text.secondary">
                                        Nhập ID độc giả để tự tra cứu.
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

                                        <TableCell>
                                            <TextField
                                                placeholder="VD: 130010"
                                                fullWidth
                                                type="number"
                                                value={it.documentCopyId}
                                                onChange={(e) => setItems(prev => prev.map((x, i) => i === idx ? { ...x, documentCopyId: e.target.value } : x))}
                                                onKeyDown={(e) => { if (e.key === 'Enter') fetchCopyForRow(idx); }}
                                                onBlur={() => fetchCopyForRow(idx)}
                                            />
                                        </TableCell>

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

                                        <TableCell>
                                            <TextField
                                                placeholder="VD: 50000"
                                                fullWidth
                                                type="number"
                                                value={it.depositAmount}
                                                onChange={(e) => setItems(prev => prev.map((x, i) => i === idx ? { ...x, depositAmount: e.target.value } : x))}
                                            />
                                        </TableCell>

                                        <TableCell>
                                            <TextField
                                                placeholder="Ghi chú"
                                                fullWidth
                                                value={it.note}
                                                onChange={(e) => setItems(prev => prev.map((x, i) => i === idx ? { ...x, note: e.target.value } : x))}
                                            />
                                        </TableCell>

                                        <TableCell align="right">
                                            <IconButton color="error" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} disabled={items.length === 1}>
                                                <Delete />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        <Button startIcon={<Add />} onClick={() => setItems(prev => [...prev, { documentCopyId: "", depositAmount: "", note: "", copyDoc: null }])} sx={{ fontWeight: 700 }}>
                                            Thêm dòng
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>

                        {/* Tổng cọc */}
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

                        {/* QR */}
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
                        disabled={creatingPayment}
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
        </Dialog>
    );
}
