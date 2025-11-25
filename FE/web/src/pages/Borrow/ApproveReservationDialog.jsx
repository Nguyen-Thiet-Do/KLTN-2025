import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { approveReservation, fetchBorrowableCopies } from "../../services/loanSlips";
import { useAuth } from "../../contexts/AuthContext";

function parseRequestedDocumentId(note) {
    const m = String(note || "").match(/REQUEST_DOCUMENT_ID=(\d+)/i);
    return m ? Number(m[1]) : null;
}

function todayPlus(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

export default function ApproveReservationDialog({
    open,
    onClose,
    slip,
    librarianId: librarianIdProp,
    onApproved,
}) {
    const { enqueueSnackbar } = useSnackbar();
    const { user } = useAuth();

    // Prefer librarianId from logged-in user (try multiple places), fallback to accountId if necessary
    const contextLibrarianId = useMemo(() => {
        return (
            Number(user?.librarianId) ||
            Number(user?.profile?.librarianId) ||
            Number(user?.Librarian?.librarianId) ||
            Number(user?.accountId) || // fallback: accountId (if your BE accepts it)
            null
        );
    }, [user]);

    const effectiveLibrarianId = useMemo(() => {
        const idFromProp = Number(librarianIdProp) || null;
        return idFromProp || contextLibrarianId || null;
    }, [contextLibrarianId, librarianIdProp]);

    const PRICING_MODE = "AUTO_MIN";
    const defaultDueDate = useMemo(() => todayPlus(30), [open]);

    const pendingDetails = useMemo(() => {
        return (slip?.details || []).filter((d) => String(d.status).toUpperCase() === "PENDING");
    }, [slip]);

    const rows = useMemo(() => {
        return pendingDetails.map((d) => ({
            loanDetailId: d.loanDetailId,
            requestedDocumentId: parseRequestedDocumentId(d.note),
            note: d.note || "",
        }));
    }, [pendingDetails]);

    const [assignmentMap, setAssignmentMap] = useState({});
    const [copiesByDoc, setCopiesByDoc] = useState({});
    const [loadingByDoc, setLoadingByDoc] = useState({});
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setAssignmentMap({});
            setCopiesByDoc({});
            setLoadingByDoc({});
            setError("");
        }
    }, [open, slip]);

    const loadCopiesForDoc = async (documentId) => {
        if (!documentId) return;
        if (copiesByDoc[documentId]) return;
        try {
            setLoadingByDoc((s) => ({ ...s, [documentId]: true }));
            const res = await fetchBorrowableCopies(documentId, { page: 1, limit: 50 });
            setCopiesByDoc((prev) => ({ ...prev, [documentId]: res }));
        } catch (e) {
            setError("Không tải được danh sách bản sao khả dụng. Vui lòng thử lại.");
            enqueueSnackbar("Không tải được danh sách bản sao khả dụng.", { variant: "error" });
        } finally {
            setLoadingByDoc((s) => ({ ...s, [documentId]: false }));
        }
    };

    useEffect(() => {
        if (!open) return;
        const uniqDocIds = Array.from(
            new Set(rows.map((r) => r.requestedDocumentId).filter(Boolean))
        );
        if (!uniqDocIds.length) return;
        (async () => {
            for (const docId of uniqDocIds) {
                await loadCopiesForDoc(docId);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, rows.length]);

    const handleAssignCopy = (loanDetailId, documentCopyId) => {
        setAssignmentMap((prev) => ({
            ...prev,
            [loanDetailId]: Number(documentCopyId) || undefined,
        }));
    };

    const handleSubmit = async () => {
        setError("");
        setSubmitting(true);
        try {
            const lid = Number(effectiveLibrarianId);
            if (!Number.isFinite(lid) || lid <= 0) {
                const msg = "Không xác định được thủ thư. Vui lòng kiểm tra tài khoản đăng nhập.";
                setError(msg);
                enqueueSnackbar(msg, { variant: "warning" });
                setSubmitting(false);
                return;
            }

            const assignments = Object.entries(assignmentMap)
                .filter(([, v]) => !!v)
                .map(([loanDetailId, documentCopyId]) => ({
                    loanDetailId: Number(loanDetailId),
                    documentCopyId: Number(documentCopyId),
                }));

            const body = {
                loanSlipId: slip.loanSlipId,
                librarianId: lid,
                dueDate: defaultDueDate,
                pricingMode: PRICING_MODE,
                createPayment: false,
                assignments,
            };

            const resp = await approveReservation(body);
            if (resp?.success) {
                enqueueSnackbar("Duyệt đặt trước thành công.", { variant: "success" });
                onApproved?.();
                onClose();
            } else {
                const msg = resp?.message || "Duyệt thất bại";
                setError(msg);
                enqueueSnackbar(msg, { variant: "error" });
            }
        } catch (e) {
            const msg = e?.response?.data?.message || e?.message || "Có lỗi xảy ra khi duyệt phiếu.";
            setError(msg);
            enqueueSnackbar(msg, { variant: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ fontWeight: 800 }}>
                Duyệt đặt trước
            </DialogTitle>

            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                {!effectiveLibrarianId && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        Không xác định được thông tin thủ thư — bạn cần đăng nhập bằng tài khoản thủ thư để duyệt.
                    </Alert>
                )}

                <Stack spacing={2}>
                    <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                            Phiếu #{slip?.loanSlipId} • Độc giả #{slip?.readerId}
                        </Typography>
                        <Typography variant="body1" sx={{ mt: 0.5 }}>
                            Số dòng chờ duyệt: <strong>{rows.length}</strong>
                        </Typography>
                    </Box>

                    <Divider />

                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>DocID yêu cầu</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Bản sao (chọn)</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Ghi chú</TableCell>
                                </TableRow>
                            </TableHead>

                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} align="center">
                                            Không có dòng cần duyệt.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rows.map((r) => {
                                        const docId = r.requestedDocumentId;
                                        const copiesResp = copiesByDoc[docId] ?? {};
                                        const copies = copiesResp?.data ?? [];
                                        const totalAvail = copiesResp?.pagination?.total ?? copies.length ?? 0;
                                        const loading = !!loadingByDoc[docId];

                                        return (
                                            <TableRow key={r.loanDetailId} hover>
                                                <TableCell>#{r.loanDetailId}</TableCell>

                                                <TableCell>
                                                    <Chip label={docId ?? "-"} size="small" />
                                                </TableCell>

                                                <TableCell>
                                                    {docId ? (
                                                        <Stack spacing={0.5}>
                                                            <FormControl fullWidth size="small">
                                                                <InputLabel id={`select-copy-${r.loanDetailId}`}>Chọn bản sao</InputLabel>
                                                                <Select
                                                                    labelId={`select-copy-${r.loanDetailId}`}
                                                                    value={assignmentMap[r.loanDetailId] ?? ""}
                                                                    label="Chọn bản sao"
                                                                    onChange={(e) => handleAssignCopy(r.loanDetailId, e.target.value)}
                                                                    renderValue={(val) => (val ? `#${val}` : "Chọn bản sao")}
                                                                    sx={{ borderRadius: 1 }}
                                                                >
                                                                    <MenuItem value="">
                                                                        <em>Giao tự động (hệ thống chọn)</em>
                                                                    </MenuItem>

                                                                    {loading ? (
                                                                        <MenuItem disabled>
                                                                            <CircularProgress size={20} />
                                                                            <Box component="span" sx={{ ml: 1 }}>Đang tải...</Box>
                                                                        </MenuItem>
                                                                    ) : copies.length === 0 ? (
                                                                        <MenuItem disabled>Không có bản sao khả dụng</MenuItem>
                                                                    ) : (
                                                                        copies.map((c) => (
                                                                            <MenuItem key={c.documentCopyId} value={c.documentCopyId}>
                                                                                #{c.documentCopyId} · {c.barCode || "(no barcode)"}
                                                                            </MenuItem>
                                                                        ))
                                                                    )}
                                                                </Select>
                                                            </FormControl>

                                                            <Typography variant="caption" color="text.secondary">
                                                                {loading ? "Đang tải danh sách bản sao..." : `${totalAvail} bản sao khả dụng`}
                                                            </Typography>
                                                        </Stack>
                                                    ) : (
                                                        <Typography variant="caption" color="text.secondary">Không có DocID</Typography>
                                                    )}
                                                </TableCell>

                                                <TableCell>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {r.note || "-"}
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Hủy</Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={submitting || !effectiveLibrarianId}
                >
                    {submitting ? "Đang duyệt..." : "Duyệt"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
