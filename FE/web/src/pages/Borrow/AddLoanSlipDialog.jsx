// src/components/AddLoanSlipDialog.jsx
import { useMemo, useState, useEffect } from "react";
import {
    Box, Button, Card, CardContent, CardHeader, Grid, IconButton, Stack,
    TextField, Typography, Alert, Dialog, DialogTitle, DialogContent,
    DialogActions, Table, TableBody, TableCell, TableHead, TableRow, Paper, Slide,
    Avatar
} from "@mui/material";
import { Add, Delete, Close } from "@mui/icons-material";
import { useSnackbar } from "notistack";

import { useAuth } from "../../contexts/AuthContext";
import { getReaderById } from "../../services/readerService";
import {
    createLoanSlip,
    getCopyWithDeposit // tên giữ nguyên cho backward compat
} from "../../services/loanSlips";

const Transition = (props) => <Slide direction="up" {...props} />;

/* ===========================
   Helpers để hiển thị lỗi/thông báo (giữ nguyên logic)
   =========================== */
const valToText = (v) => {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v.map(valToText).filter(Boolean).join("; ");
    if (typeof v === "object") return Object.values(v).map(valToText).filter(Boolean).join("; ");
    return String(v);
};

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
        valToText(data?.message) ||
        valToText(r?.message);
    return more || fallback;
};

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

const isSuccessPayload = (src) => {
    const r = src?.response ?? src;
    const data = r?.data ?? r;
    const status = r?.status;
    if (status != null && Number(status) >= 400) return false;
    if (data && Object.prototype.hasOwnProperty.call(data, "success")) {
        return data.success !== false;
    }
    return true;
};

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

/* ===========================
   Component
   =========================== */
export default function AddLoanSlipDialog({ open, onClose, onCreated }) {
    const notify = useNotify();
    const { user } = useAuth();

    // ---- FORM STATE ----
    const [readerId, setReaderId] = useState("");
    const [readerInfo, setReaderInfo] = useState(null);

    const [librarianId, setLibrarianId] = useState("");
    const [loanDate, setLoanDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [dueDate, setDueDate] = useState("");

    // items: { documentCopyId, note, copyDoc }
    const [items, setItems] = useState([
        { documentCopyId: "", note: "", copyDoc: null },
    ]);

    // ---- UI / RESULT STATE ----
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");
    const [created, setCreated] = useState(null);

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
        setItems([{ documentCopyId: "", note: "", copyDoc: null }]);
        setError("");
        setCreated(null);
        setCreating(false);
    };

    // Kiểm tra độc giả có được phép mượn không
    const readerCanBorrow = (r) => {
        if (!r) return false;
        // Quy ước hệ thống: nếu không có memberCard hoặc cardType.typeName !== 'PREMIUM' thì KHÔNG được mượn.
        const typeName = r?.memberCard?.cardType?.typeName;
        if (!typeName) return false;
        return String(typeName).toUpperCase() === "PREMIUM";
    };

    // ---- Fetch độc giả theo ID ----
    const fetchReader = async (id) => {
        if (!id) { setReaderInfo(null); return; }
        try {
            const data = await getReaderById(id);
            const reader = data?.data ?? data;
            if (!reader) {
                setReaderInfo(null);
                const msg = "Không tìm thấy độc giả với ID đã nhập.";
                setError(msg);
                notify.warn(msg);
                return;
            }

            // Chuẩn hoá: nếu memberCard không tồn tại -> hiển thị như 'chưa có thẻ'
            // Nhưng lưu nguyên dữ liệu thực vào readerInfo để có thể dùng memberCard nếu có.
            setReaderInfo(reader);

            // Nếu độc giả không đủ điều kiện mượn, báo warn (vẫn show thông tin)
            if (!readerCanBorrow(reader)) {
                // không set error blocking ở đây, chỉ cảnh báo; validate khi tạo phiếu sẽ chặn
                const msg = "Độc giả hiện chưa có thẻ hợp lệ để mượn (chỉ thẻ PREMIUM được phép).";
                setError(msg);
                notify.warn(msg);
            } else {
                setError("");
            }
        } catch (e) {
            const msg = serverErrorMsg(e, "Không lấy được thông tin độc giả.");
            setReaderInfo(null);
            setError(msg);
            notify.err(e, "Không lấy được thông tin độc giả.");
        }
    };

    // ---- Fetch copy + document cho 1 dòng ----
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
                throw { response: { data: { error: `Bản sao #${id} hiện không khả dụng (${st}).` } } };
            }

            setItems(prev => prev.map((it, i) => {
                if (i !== idx) return it;
                return {
                    ...it,
                    copyDoc: {
                        title: data?.document?.title ?? "",
                        coverPhoto: data?.document?.coverPhoto ?? "",
                        barCode: data?.copy?.barCode ?? "",
                        documentId: data?.copy?.documentId ?? data?.document?.documentId ?? null,
                        coverPrice: data?.copy?.coverPrice ?? data?.document?.coverPrice ?? null,
                    }
                };
            }));
        } catch (e) {
            const msg = serverErrorMsg(e, "Không lấy được thông tin bản sao.");
            setError(msg);
            notify.err(e, "Không lấy được thông tin bản sao.");
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

        // MỚI: kiểm tra loại thẻ - chỉ cho phép khi là PREMIUM
        if (!readerCanBorrow(readerInfo)) {
            const msg = "Độc giả hiện không có thẻ hợp lệ để mượn. (Chỉ thẻ PREMIUM được phép mượn.)";
            setError(msg); notify.warn(msg); return false;
        }

        if (!items.length) {
            const msg = "Cần ít nhất 1 đầu mục mượn.";
            setError(msg); notify.warn(msg); return false;
        }
        for (const [i, it] of items.entries()) {
            if (!it.documentCopyId) {
                const msg = `Hàng #${i + 1}: thiếu ID bản sao.`; setError(msg); notify.warn(msg); return false;
            }
            if (!it.copyDoc) {
                const msg = `Hàng #${i + 1}: thông tin bản sao chưa được lấy (nhấn Enter hoặc rời ô để tải).`; setError(msg); notify.warn(msg); return false;
            }
        }
        setError("");
        return true;
    };

    // ---- Tạo phiếu ----
    const createSlip = async () => {
        if (!validate()) return null;
        setCreating(true);
        try {
            const payload = {
                readerId: Number(readerId),
                librarianId: Number(librarianId),
                loanDate: loanDate || undefined,
                dueDate: dueDate || undefined,
                items: items.map((it) => ({
                    documentCopyId: Number(it.documentCopyId),
                    note: it.note || undefined,
                })),
            };
            const res = await createLoanSlip(payload);
            if (!isSuccessPayload(res)) {
                throw { response: { data: res, status: 200 } };
            }
            setCreated(res);
            notify.ok(res, "Tạo phiếu mượn thành công");
            onCreated && onCreated(res);
            resetForm();
            onClose && onClose();
            return res;
        } catch (e) {
            const msg = serverErrorMsg(e, "Không tạo được phiếu");
            setError(msg);
            notify.err(e, "Không tạo được phiếu");
            return null;
        } finally {
            setCreating(false);
        }
    };

    // ---- Close ----
    const handleCloseAll = () => {
        resetForm();
        onClose && onClose();
    };

    const totalItems = items.length;
    const readerDisplayName = readerInfo?.fullName ? `${readerInfo.fullName}` : "";
    const canBorrow = readerCanBorrow(readerInfo);

    // Helper hiển thị văn bản thể hiện trạng thái thẻ (theo yêu cầu: hiển thị "Độc giả chưa có thẻ" thay vì "FREE")
    const cardDisplayText = (r) => {
        if (!r) return "";
        if (!r?.memberCard || !r?.memberCard?.cardType) return "Độc giả chưa có thẻ";
        // nếu có memberCard nhưng type không phải PREMIUM, vẫn coi như chưa có thẻ (theo yêu cầu hiển thị)
        const typeName = String(r.memberCard.cardType.typeName || "").toUpperCase();
        if (typeName !== "PREMIUM") return "Độc giả chưa có thẻ";
        return "Độc giả có thẻ";
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
                <Typography variant="h6" fontWeight={800} sx={{ color: "primary.main" }}>
                    Tạo phiếu mượn
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
                    <CardHeader title="Thông tin phiếu" subheader="Nhập ID độc giả và chọn bản sao mượn" />
                    <CardContent>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={4}>
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

                            <Grid item xs={12} md={4}>
                                <TextField
                                    label="Thủ thư (đã đăng nhập)"
                                    type="text"
                                    value={String(librarianId || "")}
                                    disabled
                                    helperText={user?.fullName ? `Bạn: ${user.fullName}` : ""}
                                    fullWidth
                                />
                            </Grid>

                            <Grid item xs={6} md={2}>
                                <TextField
                                    label="Ngày tạo"
                                    type="date"
                                    value={loanDate}
                                    onChange={(e) => setLoanDate(e.target.value)}
                                    fullWidth
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Grid>
                            <Grid item xs={6} md={2}>
                                <TextField
                                    label="Hạn trả"
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    fullWidth
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Grid>

                            <Grid item xs={12}>
                                {readerInfo ? (
                                    <Stack direction="row" spacing={2} alignItems="center" sx={{ p: 1, borderRadius: 1, bgcolor: "action.hover" }}>
                                        <Avatar sx={{ bgcolor: "primary.main" }}>{(readerDisplayName || "?").slice(0, 1)}</Avatar>
                                        <Box>
                                            <Typography variant="subtitle1" fontWeight={700}>
                                                {readerDisplayName || `Reader #${readerInfo.readerId}`}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {/* Hiển thị CCCD nếu có */}
                                                {readerInfo.cccd ? `CCCD: ${readerInfo.cccd}` : cardDisplayText(readerInfo)}
                                            </Typography>

                                            {/* Hiển thị thông tin account (email / phone) nếu có */}
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                {readerInfo.email ? `Email: ${readerInfo.email}` : ""}
                                                {readerInfo.phoneNumber ? ` ${readerInfo.phoneNumber ? ` • SĐT: ${readerInfo.phoneNumber}` : ""}` : ""}
                                            </Typography>

                                            {/* Hiển thị trạng thái có/không có thẻ (không hiện ngày/thông tin chi tiết) */}
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                {readerInfo?.memberCard && readerInfo?.memberCard?.cardType && String(readerInfo.memberCard.cardType.typeName).toUpperCase() === "PREMIUM"
                                                    ? "Độc giả có thẻ"
                                                    : "Độc giả chưa có thẻ"}
                                            </Typography>

                                        </Box>

                                        {/* Thống kê trạng thái mượn */}
                                        <Box sx={{ ml: "auto", textAlign: "right" }}>
                                            <Typography variant="subtitle2">Trạng thái</Typography>
                                            <Typography variant="caption" display="block" color="text.secondary">
                                                Đang chờ duyệt: {readerInfo.stats?.pendingCount ?? 0}
                                            </Typography>
                                            <Typography variant="caption" display="block" color="text.secondary">
                                                Đang chờ lấy: {readerInfo.stats?.waitingForPickupCount ?? 0}
                                            </Typography>
                                            <Typography variant="caption" display="block" color="text.secondary">
                                                Đang mượn: {readerInfo.stats?.borrowedCount ?? 0}
                                            </Typography>
                                            <Typography variant="caption" display="block" color="error">
                                                Quá hạn: {readerInfo.stats?.overdueCount ?? 0}
                                            </Typography>
                                            <Typography variant="h6" fontWeight={800}></Typography>
                                        </Box>
                                    </Stack>
                                ) : (
                                    <Typography variant="body2" color="text.secondary">
                                        {/* Trống khi chưa tìm độc giả */}
                                    </Typography>
                                )}
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>

                {/* Đầu mục mượn */}
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardHeader title="Đầu mục mượn" />
                    <CardContent>
                        <Table component={Paper} size="small" sx={{ borderRadius: 2, overflow: "hidden" }}>
                            <TableHead>
                                <TableRow sx={{ backgroundColor: "rgba(102,126,234,0.06)" }}>
                                    <TableCell width={56}>#</TableCell>
                                    <TableCell>ID bản sao</TableCell>
                                    <TableCell>Tiêu đề</TableCell>
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
                                                placeholder="Nhập ID bản sao"
                                                fullWidth
                                                type="number"
                                                value={it.documentCopyId}
                                                onChange={(e) => setItems(prev => prev.map((x, i) => i === idx ? { ...x, documentCopyId: e.target.value } : x))}
                                                onKeyDown={(e) => { if (e.key === 'Enter') fetchCopyForRow(idx); }}
                                                onBlur={() => fetchCopyForRow(idx)}
                                            />
                                        </TableCell>

                                        <TableCell sx={{ minWidth: 220 }}>
                                            {it.copyDoc ? (
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    {it.copyDoc.coverPhoto ? (
                                                        <img
                                                            src={it.copyDoc.coverPhoto}
                                                            alt={it.copyDoc.title}
                                                            style={{ width: 36, height: 48, objectFit: "cover", borderRadius: 4 }}
                                                        />
                                                    ) : (
                                                        <Box sx={{ width: 36, height: 48, bgcolor: "grey.200", borderRadius: 1 }} />
                                                    )}
                                                    <Box sx={{ overflow: "hidden" }}>
                                                        <Typography variant="body2" fontWeight={700} noWrap>{it.copyDoc.title || "-"}</Typography>
                                                        <Typography variant="caption" color="text.secondary" noWrap>BarCode: {it.copyDoc.barCode || "-"}</Typography>
                                                    </Box>
                                                </Stack>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">Chưa có dữ liệu</Typography>
                                            )}
                                        </TableCell>

                                        <TableCell>
                                            <TextField
                                                placeholder="Ghi chú (tùy chọn)"
                                                fullWidth
                                                value={it.note}
                                                onChange={(e) => setItems(prev => prev.map((x, i) => i === idx ? { ...x, note: e.target.value } : x))}
                                            />
                                        </TableCell>

                                        <TableCell align="right">
                                            <IconButton
                                                color="error"
                                                onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                                                disabled={items.length === 1}
                                                size="small"
                                            >
                                                <Delete />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}

                                <TableRow>
                                    <TableCell colSpan={5}>
                                        <Button
                                            startIcon={<Add />}
                                            onClick={() => setItems(prev => [...prev, { documentCopyId: "", note: "", copyDoc: null }])}
                                            sx={{ fontWeight: 700 }}
                                        >
                                            Thêm đầu mục
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </DialogContent>

            <DialogActions sx={{ justifyContent: "space-between", px: 3, py: 2 }}>
                <Box>
                    <Button onClick={handleCloseAll}>Hủy</Button>
                </Box>
                <Stack direction="row" spacing={1}>
                    <Button
                        onClick={createSlip}
                        variant="contained"
                        disabled={creating || !canBorrow}
                        sx={{ fontWeight: 700 }}
                    >
                        {creating ? "Đang xử lý..." : "Tạo phiếu"}
                    </Button>
                </Stack>
            </DialogActions>
        </Dialog>
    );
}
