// src/components/Borrow/CreateOnsiteDialog.jsx
import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Typography,
    Box,
    CircularProgress,
    Card,
    CardContent,
    CardHeader,
    Grid,
    Stack,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Paper,
    IconButton,
    Avatar,
    Alert,
    Slide
} from "@mui/material";
import { Add, Delete, Close } from "@mui/icons-material";
import { useSnackbar } from "notistack";

import { useAuth } from "../../contexts/AuthContext";
import { getReaderById } from "../../services/readerService";
import {
    createOnsiteLoanSlip,
    getCopyWithDeposit
} from "../../services/loanSlips";

const Transition = (props) => <Slide direction="up" {...props} />;

/* ========== Helpers (copied/adapted from AddLoanSlipDialog) ========== */
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

/**
 * CreateOnsiteDialog (UI giống AddLoanSlipDialog)
 *
 * Props:
 *  - open
 *  - onClose
 *  - onCreated
 */
export default function CreateOnsiteDialog({ open, onClose, onCreated }) {
    const notify = useNotify();
    const { user } = useAuth();

    // form state
    const [readerId, setReaderId] = useState("");
    const [readerInfo, setReaderInfo] = useState(null);

    const [librarianId, setLibrarianId] = useState("");
    const [loanDate, setLoanDate] = useState(() => new Date().toISOString().slice(0, 10));
    // On-site thường không cần dueDate, nhưng vẫn giữ nếu muốn
    const [dueDate, setDueDate] = useState("");

    // items: { documentCopyId, note, copyDoc }
    const [items, setItems] = useState([{ documentCopyId: "", note: "", copyDoc: null }]);

    // ui state
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");
    const [created, setCreated] = useState(null);

    // auto-fill librarianId from user
    useEffect(() => {
        if (open && user) {
            const derived = user?.librarianId ?? user?.accountId ?? user?.id ?? "";
            setLibrarianId(derived || "");
        }
    }, [open, user]);

    useEffect(() => {
        if (!open) {
            resetForm();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

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

    // fetch reader by id
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
            setReaderInfo(reader);
            setError("");
        } catch (e) {
            const msg = serverErrorMsg(e, "Không lấy được thông tin độc giả.");
            setReaderInfo(null);
            setError(msg);
            notify.err(e, "Không lấy được thông tin độc giả.");
        }
    };

    // fetch copy info for a row (validate AVAILABLE)
    const fetchCopyForRow = async (idx) => {
        const id = items[idx]?.documentCopyId;
        if (!id) {
            setItems(prev => prev.map((it, i) => (i === idx ? { ...it, copyDoc: null } : it)));
            return;
        }
        try {
            const data = await getCopyWithDeposit(id, { withDoc: 1, withAuthors: 1, withSubtype: 1 });
            // backend returns data.copy/data.document or similar; try to normalize
            const copy = data?.copy ?? data?.data?.copy ?? data?.copyData ?? data;
            const doc = data?.document ?? data?.data?.document ?? data?.documentData ?? data;
            // check status if provided
            const status = (copy?.status || "").toUpperCase();
            if (status && status !== "AVAILABLE") {
                throw { response: { data: { error: `Bản sao #${id} hiện không khả dụng (${status}).` } } };
            }
            setItems(prev => prev.map((it, i) => {
                if (i !== idx) return it;
                return {
                    ...it,
                    copyDoc: {
                        title: doc?.title ?? data?.document?.title ?? "",
                        coverPhoto: doc?.coverPhoto ?? data?.document?.coverPhoto ?? "",
                        barCode: copy?.barCode ?? data?.copy?.barCode ?? "",
                        documentId: copy?.documentId ?? data?.copy?.documentId ?? data?.document?.documentId ?? null,
                        coverPrice: copy?.coverPrice ?? data?.copy?.coverPrice ?? data?.document?.coverPrice ?? null,
                        status: copy?.status ?? data?.copy?.status ?? null
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
            const msg = "Cần ít nhất 1 đầu mục đọc tại chỗ.";
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

    const handleCreate = async () => {
        if (!validate()) return null;
        setCreating(true);
        try {
            const payload = {
                readerId: Number(readerId),
                librarianId: Number(librarianId),
                loanDate: loanDate || undefined,
                dueDate: dueDate || undefined,
                items: items.map(it => ({
                    documentCopyId: Number(it.documentCopyId),
                    note: it.note || undefined,
                }))
            };
            const res = await createOnsiteLoanSlip(payload);
            // backend may return { success: true, data: { ... } } or other shape
            const success = res?.success ?? (res && !res?.error);
            if (!success) {
                const msg = serverErrorMsg(res, "Tạo phiếu đọc tại chỗ thất bại");
                setError(msg);
                notify.err(res, "Tạo phiếu đọc tại chỗ thất bại");
                return null;
            }
            setCreated(res);
            notify.ok(res, "Tạo phiếu đọc tại chỗ thành công");
            onCreated && onCreated(res);
            resetForm();
            onClose && onClose();
            return res;
        } catch (e) {
            const msg = serverErrorMsg(e, "Không tạo được phiếu đọc tại chỗ");
            setError(msg);
            notify.err(e, "Không tạo được phiếu đọc tại chỗ");
            return null;
        } finally {
            setCreating(false);
        }
    };

    const handleCloseAll = () => {
        resetForm();
        onClose && onClose();
    };

    const totalItems = items.length;
    const readerDisplayName = readerInfo?.fullName ? `${readerInfo.fullName}` : "";

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
                    Tạo phiếu đọc tại chỗ
                </Typography>
                <IconButton onClick={handleCloseAll}><Close /></IconButton>
            </DialogTitle>

            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

                {/* Thông tin phiếu */}
                <Card variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
                    <CardHeader title="Thông tin phiếu" subheader="Nhập ID độc giả và chọn bản sao để đọc tại chỗ" />
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

                            <Grid item xs={6} md={2} sx={{ display: "none" }}>
                                <TextField
                                    label="Hạn (tuỳ chọn)"
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
                                            <Typography variant="subtitle1" fontWeight={700}>{readerDisplayName || `Reader #${readerInfo.readerId}`}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {readerInfo.cccd ? `CCCD: ${readerInfo.cccd}` : ""}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                {readerInfo.email ? `Email: ${readerInfo.email}` : ""}{readerInfo.phoneNumber ? ` • SĐT: ${readerInfo.phoneNumber}` : ""}
                                            </Typography>
                                        </Box>

                                        <Box sx={{ ml: "auto", textAlign: "right" }}>
                                            <Typography variant="subtitle2">Tổng đầu mục</Typography>
                                            <Typography variant="h6" fontWeight={800}>{totalItems}</Typography>
                                        </Box>
                                    </Stack>
                                ) : (
                                    <Typography variant="body2" color="text.secondary">Chưa nhập/không tìm thấy độc giả.</Typography>
                                )}
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>

                {/* Bảng các bản sao */}
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardHeader title="Danh sách bản sao đọc tại chỗ" />
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

                                        <TableCell sx={{ minWidth: 220, maxWidth: 300 }}>
                                            {it.copyDoc ? (
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    {it.copyDoc.coverPhoto ? (
                                                        <img src={it.copyDoc.coverPhoto} alt={it.copyDoc.title} style={{ width: 36, height: 48, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                                                    ) : (
                                                        <Box sx={{ width: 36, height: 48, bgcolor: "grey.200", borderRadius: 1, flexShrink: 0 }} />
                                                    )}
                                                    <Box sx={{ overflow: "hidden", minWidth: 0, flex: 1 }}>
                                                        <Typography variant="body2" fontWeight={700} noWrap sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                                                            {it.copyDoc.title || "-"}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary" noWrap>
                                                            BarCode: {it.copyDoc.barCode || "-"}
                                                        </Typography>
                                                    </Box>
                                                </Stack>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">Chưa có dữ liệu</Typography>
                                            )}
                                        </TableCell>

                                        <TableCell>
                                            <TextField
                                                placeholder="Ghi chú (tuỳ chọn)"
                                                fullWidth
                                                value={it.note}
                                                onChange={(e) => setItems(prev => prev.map((x, i) => i === idx ? { ...x, note: e.target.value } : x))}
                                            />
                                        </TableCell>

                                        <TableCell align="right">
                                            <IconButton color="error" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} disabled={items.length === 1} size="small">
                                                <Delete />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}

                                <TableRow>
                                    <TableCell colSpan={5}>
                                        <Button startIcon={<Add />} onClick={() => setItems(prev => [...prev, { documentCopyId: "", note: "", copyDoc: null }])} sx={{ fontWeight: 700 }}>
                                            Thêm bản sao
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
                    <Button onClick={handleCreate} variant="contained" disabled={creating} sx={{ fontWeight: 700 }}>
                        {creating ? (<><CircularProgress size={18} sx={{ mr: 1 }} />Đang xử lý...</>) : "Tạo phiếu đọc tại chỗ"}
                    </Button>
                </Stack>
            </DialogActions>
        </Dialog>
    );
}

CreateOnsiteDialog.propTypes = {
    open: PropTypes.bool,
    onClose: PropTypes.func,
    onCreated: PropTypes.func,
};
