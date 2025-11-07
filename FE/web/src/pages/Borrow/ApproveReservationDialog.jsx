import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
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
import { useAuth } from "../../contexts/AuthContext"; // Lấy thủ thư từ context

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
    librarianId: librarianIdProp, // vẫn giữ để tương thích, nhưng ưu tiên context
    onApproved,
}) {
    const { enqueueSnackbar } = useSnackbar();
    const { user } = useAuth();

    // Ưu tiên id từ context (merge account + profile đã lưu trong sessionStorage)
    const contextLibrarianId = useMemo(() => {
        return (
            Number(user?.librarianId) ||
            Number(user?.profile?.librarianId) ||
            Number(user?.Librarian?.librarianId) ||
            null
        );
    }, [user]);

    const effectiveLibrarianId = useMemo(() => {
        const idFromProp = Number(librarianIdProp) || null;
        return contextLibrarianId || idFromProp || null;
    }, [contextLibrarianId, librarianIdProp]);

    // LUÔN dùng AUTO_MIN theo yêu cầu (không hiển thị UI chọn)
    const PRICING_MODE = "AUTO_MIN";

    const [assignmentMap, setAssignmentMap] = useState({});   // loanDetailId -> documentCopyId
    const [loadingCopies, setLoadingCopies] = useState(false);
    const [copiesByDoc, setCopiesByDoc] = useState({});       // documentId -> {success, data, pagination}
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Hạn trả mặc định = hôm nay + 30 ngày (không hiển thị input)
    const defaultDueDate = useMemo(() => todayPlus(30), [open]);

    const pendingDetails = useMemo(() => {
        return (slip?.details || []).filter(d => String(d.status).toUpperCase() === "PENDING");
    }, [slip]);

    const rows = useMemo(() => {
        return pendingDetails.map(d => ({
            loanDetailId: d.loanDetailId,
            requestedDocumentId: parseRequestedDocumentId(d.note),
            note: d.note || "",
        }));
    }, [pendingDetails]);

    useEffect(() => {
        if (open) {
            setAssignmentMap({});
            setCopiesByDoc({});
            setError("");
        }
    }, [open, slip]);

    const loadCopiesForDoc = async (documentId) => {
        setLoadingCopies(true);
        try {
            const res = await fetchBorrowableCopies(documentId, { page: 1, limit: 50 });
            setCopiesByDoc(prev => ({ ...prev, [documentId]: res }));
        } catch (e) {
            setError(e?.message || "Không tải được danh sách bản sao khả dụng");
        } finally {
            setLoadingCopies(false);
        }
    };

    // Nạp danh sách bản sao cho mọi DocID ngay khi mở
    useEffect(() => {
        if (!open) return;
        const uniqDocIds = Array.from(
            new Set(rows.map(r => r.requestedDocumentId).filter(Boolean))
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
        setAssignmentMap(prev => ({ ...prev, [loanDetailId]: Number(documentCopyId) || undefined }));
    };

    const handleSubmit = async () => {
        try {
            setSubmitting(true);
            setError("");

            const lid = Number(effectiveLibrarianId);
            if (!Number.isFinite(lid) || lid <= 0) {
                const msg = "Không xác định được thủ thư hiện tại (librarianId). Vui lòng kiểm tra đăng nhập.";
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
                pricingMode: PRICING_MODE, // cố định AUTO_MIN
                createPayment: false,      // không tạo Payment khi duyệt
                assignments,               // nếu trống, BE tự chọn AVAILABLE
            };

            await approveReservation(body);
            enqueueSnackbar("Duyệt phiếu đặt trước thành công.", { variant: "success" });
            onApproved?.();
            onClose();
        } catch (e) {
            const msg = e?.message || "Có lỗi xảy ra khi duyệt phiếu";
            setError(msg);
            enqueueSnackbar(msg, { variant: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ fontWeight: 800 }}>Duyệt phiếu đặt trước</DialogTitle>
            <DialogContent dividers>
                {!!error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                {!effectiveLibrarianId && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        Không tìm thấy <b>librarianId</b> từ tài khoản đăng nhập. Hãy chắc chắn tài khoản của bạn là thủ thư
                        và đã có bản ghi trong bảng <code>Librarians</code>.
                    </Alert>
                )}

                <Stack spacing={2}>
                    <Typography variant="body2" color="text.secondary">
                        Phiếu #{slip?.loanSlipId} · Độc giả #{slip?.readerId} 
                    </Typography>

                    {/* Không còn UI "Chế độ tiền cọc" */}

                    <Divider />

                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700 }}>#Chi tiết</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>DocID yêu cầu</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Bản sao (chọn thủ công)</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Ghi chú</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} align="center">Không có dòng mượn PENDING</TableCell>
                                    </TableRow>
                                ) : rows.map(r => {
                                    const docId = r.requestedDocumentId;
                                    const copies = copiesByDoc[docId]?.data ?? [];
                                    return (
                                        <TableRow key={r.loanDetailId} hover>
                                            <TableCell>#{r.loanDetailId}</TableCell>
                                            <TableCell>
                                                <Chip size="small" label={docId ?? "-"} />
                                            </TableCell>
                                            <TableCell>
                                                {docId ? (
                                                    <Stack spacing={0.5}>
                                                        {/* Không có ô tìm barcode, chỉ dropdown chọn bản sao */}
                                                        <Box>
                                                            <select
                                                                style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid #e0e0e0" }}
                                                                value={assignmentMap[r.loanDetailId] ?? ""}
                                                                onChange={(e) => handleAssignCopy(r.loanDetailId, e.target.value)}
                                                            >
                                                                <option value="">Chọn bản sao</option>
                                                                {copies.map(c => (
                                                                    <option key={c.documentCopyId} value={c.documentCopyId}>
                                                                        #{c.documentCopyId} · {c.barCode}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </Box>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {(copiesByDoc[docId]?.pagination?.total ?? 0)} bản sao khả dụng
                                                            {loadingCopies && " · đang tải..."}
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
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>HUỶ</Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={submitting || !effectiveLibrarianId}
                >
                    {submitting ? "ĐANG DUYỆT..." : "DUYỆT"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
