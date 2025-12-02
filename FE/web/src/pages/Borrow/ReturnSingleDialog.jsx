// src/components/Borrow/ReturnSingleDialog.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
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
    MenuItem,
} from "@mui/material";
import { useAuth } from "../../contexts/AuthContext";
import {
    previewBulkReturnFines,
    initBulkReturnPayment,
    confirmBulkReturnAfterPayment,
} from "../../services/loanSlips";
import { useSnackbar } from "notistack";
import QRCode from "react-qr-code";


const nf = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

function parseDateOnly(d = null) {
    if (!d) return null;
    return String(d).slice(0, 10);
}

// Các mốc trạng thái để hiển thị nhãn nhưng lưu giá trị representative (upper)
const CONDITION_RANGES = [
    { key: "100-90", label: "Mới", upper: 100, lower: 90 },
    { key: "90-70", label: "Tốt/ Trầy nhẹ", upper: 90, lower: 70 },
    { key: "70-50", label: "Rách bìa, trang", upper: 70, lower: 50 },
    { key: "50-0", label: "Hư nặng", upper: 50, lower: 0 },
];

function getConditionLabelFromNumber(n) {
    if (n == null || isNaN(Number(n))) return "-";
    const v = Number(n);
    const found = CONDITION_RANGES.find((r) => v <= r.upper && v >= r.lower);
    return found ? found.label : `${v}`;
}

function getRepresentativeFromNumber(n) {
    if (n == null || isNaN(Number(n))) return null;
    const v = Number(n);
    const found = CONDITION_RANGES.find((r) => v <= r.upper && v >= r.lower);
    return found ? found.upper : null;
}

// giống helper trong ReturnBulkDialog
function getLibrarianIdFromUser(user) {
    try {
        if (user?.librarianId) return Number(user.librarianId);
        if (user?.profile?.librarianId) return Number(user.profile.librarianId);
        if (user?.Librarian?.librarianId) return Number(user.Librarian.librarianId);

        const profRaw = sessionStorage.getItem("profile");
        if (profRaw) {
            const prof = JSON.parse(profRaw);
            if (prof?.librarianId) return Number(prof.librarianId);
        }
    } catch (e) {
        // ignore
    }
    return null;
}

export default function ReturnSingleDialog({
    open,
    onClose,
    slip,
    loanDetail,
    onReturned,
}) {
    const { enqueueSnackbar } = useSnackbar();
    const { user } = useAuth();

    const librarianIdFromAuth = useMemo(() => {
        return (
            Number(user?.librarianId) ||
            Number(user?.profile?.librarianId) ||
            Number(user?.Librarian?.librarianId) ||
            null
        );
    }, [user]);

    const [returnDate, setReturnDate] = useState(() =>
        parseDateOnly(new Date().toISOString())
    );
    // conditionReturn lưu số representative (100,90,70,50)
    const [conditionReturn, setConditionReturn] = useState(100);
    const [isLost, setIsLost] = useState(false);
    const [note, setNote] = useState("");

    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    // preview từ BE (giống bulk): { totals, paymentPreview, items, ... }
    const [preview, setPreview] = useState(null);

    // payment đang chờ thanh toán PayOS
    const [pendingPayment, setPendingPayment] = useState(null);
    const [showQr, setShowQr] = useState(false);

    // auto preview state
    const [autoPreviewing, setAutoPreviewing] = useState(false);
    const previewTimeoutRef = useRef(null);

    useEffect(() => {
        if (open && loanDetail) {
            setReturnDate(parseDateOnly(new Date().toISOString()));
            // khởi tạo conditionReturn = representative của borrowCond nếu có
            setConditionReturn(
                loanDetail?.conditionBorrow != null
                    ? (getRepresentativeFromNumber(Number(loanDetail.conditionBorrow)) ?? Number(loanDetail.conditionBorrow))
                    : 100
            );
            setIsLost(false);
            setNote("");
            setErrorMsg(null);
            setSuccessMsg(null);
            setPreview(null);
            setPendingPayment(null);
            setShowQr(false);
        }
        if (!open) {
            setPreview(null);
            setPendingPayment(null);
            setShowQr(false);
            setErrorMsg(null);
            setSuccessMsg(null);
        }
    }, [open, loanDetail]);

    // Tóm tắt từ preview (dùng đúng kiểu với ReturnBulkDialog)
    const summary = useMemo(() => {
        if (!preview) {
            return {
                totalOver: 0,
                totalDamage: 0,
                totalLost: 0,
                totalFine: 0,
                hasMemberCard: false,
                cardBalance: 0,
                canPayFromCard: 0,
                needExternalPay: 0,
            };
        }
        const t = preview.totals || {};
        const p = preview.paymentPreview || {};
        return {
            totalOver: Number(t.overdue || 0),
            totalDamage: Number(t.damage || 0),
            totalLost: Number(t.lost || 0),
            totalFine: Number(t.total || 0),
            hasMemberCard: !!p.hasMemberCard,
            cardBalance: Number(p.cardBalance || 0),
            canPayFromCard: Number(p.canPayFromCard || 0),
            needExternalPay: Number(p.needExternalPay || 0),
        };
    }, [preview]);

    const slipId = useMemo(() => {
        return (
            slip?.loanSlipId ||
            loanDetail?.loanSlipId ||
            loanDetail?.LoanSlip?.loanSlipId ||
            null
        );
    }, [slip, loanDetail]);

    // ---------- GỌI API PREVIEW ----------
    async function doPreview(options = { showSnackbar: true }) {
        const { showSnackbar } = options;

        if (!loanDetail) return;

        setErrorMsg(null);
        setSuccessMsg(null);

        if (!slipId) {
            setErrorMsg("Không xác định được loanSlipId.");
            return;
        }
        if (!returnDate) {
            setErrorMsg("Vui lòng chọn ngày trả");
            return;
        }
        if (!isLost) {
            const c = Number(conditionReturn);
            if (isNaN(c) || c < 0 || c > 100) {
                setErrorMsg("Tình trạng trả không hợp lệ");
                return;
            }
        }

        const payload = {
            loanSlipId: slipId,
            returnDate,
            items: [
                {
                    loanDetailId: loanDetail.loanDetailId,
                    conditionReturn: isLost ? 0 : Number(conditionReturn),
                    isLost: !!isLost,
                    note: note || undefined,
                },
            ],
        };

        if (showSnackbar) {
            setLoading(true);
        } else {
            setAutoPreviewing(true);
        }

        try {
            const res = await previewBulkReturnFines(payload);
            if (!res?.success) {
                const msg = res?.message || "Preview tiền phạt thất bại";
                setErrorMsg(msg);
                if (showSnackbar) {
                    enqueueSnackbar(msg, { variant: "error" });
                }
                return;
            }

            const data = res.data || res;
            setPreview(data);
            if (showSnackbar) {
                enqueueSnackbar("Đã tính phí preview từ server.", {
                    variant: "info",
                });
            }
        } catch (err) {
            console.error("previewBulkReturnFines error:", err);
            const msg =
                err?.response?.data?.message ||
                err?.message ||
                "Lỗi khi tính tiền preview";
            setErrorMsg(msg);
            if (showSnackbar) {
                enqueueSnackbar(msg, { variant: "error" });
            }
        } finally {
            if (showSnackbar) {
                setLoading(false);
            } else {
                setAutoPreviewing(false);
            }
        }
    }

    // ---------- AUTO PREVIEW chỉ khi toggle checkbox "Mất sách" hoặc thay conditionReturn ----------
    useEffect(() => {
        if (!open) return;
        if (!loanDetail) return;
        if (!slipId) return;
        if (!returnDate) return;

        if (previewTimeoutRef.current) {
            clearTimeout(previewTimeoutRef.current);
        }

        previewTimeoutRef.current = setTimeout(() => {
            doPreview({ showSnackbar: false });
        }, 500);

        return () => {
            if (previewTimeoutRef.current) {
                clearTimeout(previewTimeoutRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLost, conditionReturn, loanDetail, slipId, open]);

    // ---------- PREVIEW MANUAL (nếu vẫn muốn dùng nút) ----------
    async function handlePreview() {
        await doPreview({ showSnackbar: true });
    }

    // ---------- XÁC NHẬN TRẢ (INIT + tạo QR nếu cần) ----------
    async function handleConfirm() {
        if (!loanDetail) return;

        setErrorMsg(null);
        setSuccessMsg(null);

        if (!slipId) {
            setErrorMsg("Không xác định được loanSlipId.");
            return;
        }
        if (!returnDate) {
            setErrorMsg("Vui lòng chọn ngày trả");
            return;
        }
        if (!isLost) {
            const c = Number(conditionReturn);
            if (isNaN(c) || c < 0 || c > 100) {
                setErrorMsg("Tình trạng trả không hợp lệ");
                return;
            }
        }
        if (!preview) {
            setErrorMsg("Vui lòng để hệ thống tính phí xong trước khi xác nhận.");
            return;
        }

        const librarianId =
            getLibrarianIdFromUser(user) ?? librarianIdFromAuth ?? null;
        if (!librarianId) {
            setErrorMsg(
                "Không xác định được librarianId. Vui lòng đăng nhập bằng tài khoản thủ thư."
            );
            return;
        }

        const items = [
            {
                loanDetailId: loanDetail.loanDetailId,
                conditionReturn: isLost ? 0 : Number(conditionReturn),
                isLost: !!isLost,
                note: note || undefined,
            },
        ];

        const payload = {
            loanSlipId: slipId,
            returnDate,
            items,
            librarianId: Number(librarianId),
        };

        setLoading(true);
        try {
            const res = await initBulkReturnPayment(payload);
            if (!res?.success) {
                const msg = res?.message || "Khởi tạo trả tài liệu thất bại";
                setErrorMsg(msg);
                enqueueSnackbar(msg, { variant: "error" });
                return;
            }

            // Không cần thanh toán thêm => BE đã trừ thẻ & xử lý trả luôn
            if (!res.needPayment) {
                const msg = res?.message || "Trả tài liệu thành công.";
                enqueueSnackbar(msg, { variant: "success" });
                setSuccessMsg(msg);
                onReturned && onReturned(res.finalResult || res);
                onClose && onClose();
                return;
            }

            // Cần thanh toán thêm => hiển thị QR
            const p = res.payment || {};
            setPendingPayment({
                paymentId: p.paymentId,
                orderCode: p.orderCode,
                amount: p.amount,
                checkoutUrl: p.checkoutUrl,
                qrCode: p.qrCode,
            });
            setShowQr(true);
            enqueueSnackbar(
                "Đã tạo QR/link thanh toán. Vui lòng thanh toán rồi bấm 'Tôi đã thanh toán' hoặc chọn 'Thanh toán tiền mặt'.",
                { variant: "info" }
            );
        } catch (err) {
            console.error("initBulkReturnPayment (single) error:", err);
            const msg =
                err?.response?.data?.message ||
                err?.message ||
                "Lỗi khi khởi tạo trả tài liệu";
            setErrorMsg(msg);
            enqueueSnackbar(msg, { variant: "error" });
        } finally {
            setLoading(false);
        }
    }

    // ---------- XÁC NHẬN SAU KHI ĐÃ THANH TOÁN ----------
    async function handleConfirmAfterPaid() {
        if (!slipId || !pendingPayment || !loanDetail) return;

        const librarianId =
            getLibrarianIdFromUser(user) ?? librarianIdFromAuth ?? null;
        if (!librarianId) {
            enqueueSnackbar("Không xác định được librarianId.", {
                variant: "error",
            });
            return;
        }

        const items = [
            {
                loanDetailId: loanDetail.loanDetailId,
                conditionReturn: isLost ? 0 : Number(conditionReturn),
                isLost: !!isLost,
                note: note || undefined,
            },
        ];

        const payload = {
            loanSlipId: slipId,
            returnDate,
            items,
            librarianId: Number(librarianId),
            paymentId: pendingPayment.paymentId,
            orderCode: pendingPayment.orderCode,
        };

        setLoading(true);
        try {
            const res = await confirmBulkReturnAfterPayment(payload);
            if (!res?.success) {
                const msg =
                    res?.message ||
                    "Xác nhận sau khi thanh toán thất bại hoặc chưa thanh toán.";
                enqueueSnackbar(msg, { variant: "error" });
                return;
            }

            enqueueSnackbar("Thanh toán thành công, đã cập nhật phiếu mượn.", {
                variant: "success",
            });
            setShowQr(false);
            setPendingPayment(null);
            onReturned && onReturned(res.finalResult || res);
            onClose && onClose();
        } catch (err) {
            console.error("confirmBulkReturnAfterPayment (single) error:", err);
            const msg =
                err?.response?.data?.message ||
                err?.message ||
                "Lỗi khi xác nhận sau thanh toán";
            enqueueSnackbar(msg, { variant: "error" });
        } finally {
            setLoading(false);
        }
    }

    // ------------------ MỚI: XÁC NHẬN THANH TOÁN TIỀN MẶT (SINGLE) ------------------
    async function handleCashPayment() {
        if (!slipId || !loanDetail) return;

        const librarianId = getLibrarianIdFromUser(user) ?? librarianIdFromAuth ?? null;
        if (!librarianId) {
            enqueueSnackbar("Không xác định được librarianId.", { variant: "error" });
            return;
        }

        const items = [
            {
                loanDetailId: loanDetail.loanDetailId,
                conditionReturn: isLost ? 0 : Number(conditionReturn),
                isLost: !!isLost,
                note: note || undefined,
            },
        ];

        const payload = {
            loanSlipId: slipId,
            returnDate,
            items,
            librarianId: Number(librarianId),
            paidByCash: true,
        };

        setLoading(true);
        try {
            const res = await confirmBulkReturnAfterPayment(payload);
            if (!res?.success) {
                const msg = res?.message || "Xác nhận trả bằng tiền mặt thất bại.";
                enqueueSnackbar(msg, { variant: "error" });
                return;
            }

            enqueueSnackbar("Đã xác nhận thanh toán tiền mặt và cập nhật phiếu.", { variant: "success" });
            setShowQr(false);
            setPendingPayment(null);
            onReturned && onReturned(res.finalResult || res);
            onClose && onClose();
        } catch (err) {
            console.error("handleCashPayment (single) error:", err);
            const msg = err?.response?.data?.message || err?.message || "Lỗi khi xác nhận trả bằng tiền mặt";
            enqueueSnackbar(msg, { variant: "error" });
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog
            open={Boolean(open)}
            onClose={() => onClose?.()}
            fullWidth
            maxWidth="sm"
        >
            <DialogTitle>
                Trả tài liệu -{" "}
                {loanDetail ? `#${loanDetail.loanDetailId}` : ""}
            </DialogTitle>
            <DialogContent dividers>
                {!loanDetail ? (
                    <Typography>Không có thông tin chi tiết.</Typography>
                ) : (
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="subtitle2">Tài liệu</Typography>
                            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1 }}>
                                {loanDetail.DocumentCopy?.Document?.coverPhoto && (
                                    <img
                                        src={loanDetail.DocumentCopy.Document.coverPhoto}
                                        alt={loanDetail.DocumentCopy?.Document?.title || ""}
                                        loading="lazy"
                                        style={{ width: 48, height: 64, objectFit: "cover", borderRadius: 4, display: "block", flexShrink: 0 }}
                                    />
                                )}
                                <Box>
                                    <Typography variant="body1" fontWeight={600}>
                                        {loanDetail.DocumentCopy?.Document?.title ||
                                            `Copy #${loanDetail.documentCopyId}`}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Mã vạch: {loanDetail.DocumentCopy?.barCode || "-"}
                                    </Typography>
                                </Box>
                            </Stack>
                        </Box>

                        {user && (
                            <Box
                                sx={{
                                    p: 1.5,
                                    bgcolor: "rgba(102,126,234,0.08)",
                                    borderRadius: 1,
                                }}
                            >
                                <Typography variant="caption" color="text.secondary">
                                    Thủ thư xử lý:{" "}
                                    <strong>
                                        {user.fullName || `#${librarianIdFromAuth || "unknown"}`}
                                    </strong>
                                </Typography>
                            </Box>
                        )}

                        <Divider />

                        <Stack direction="row" spacing={2}>
                            <TextField
                                label="Ngày trả"
                                type="date"
                                value={returnDate || ""}
                                InputLabelProps={{ shrink: true }}
                                sx={{ minWidth: 180 }}
                                disabled
                            />
                            {/* Thay input số bằng select hiển thị label nhưng lưu số representative */}
                            <TextField
                                label="Tình trạng trả"
                                select
                                value={String(conditionReturn ?? 100)}
                                onChange={(e) => {
                                    const v = Number(e.target.value);
                                    setConditionReturn(v);
                                }}
                                onBlur={() => doPreview({ showSnackbar: false })}
                                size="small"
                                disabled={isLost}
                                sx={{ width: 220 }}
                            >
                                {CONDITION_RANGES.map((r) => (
                                    <MenuItem key={r.key} value={r.upper}>
                                        {r.label}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={isLost}
                                        onChange={(e) => {
                                            setIsLost(e.target.checked);
                                        }}
                                    />
                                }
                                label="Mất sách"
                            />
                        </Stack>

                        {/* Cảnh báo nếu representative < 70 */}
                        {!isLost && Number(conditionReturn) < 70 && (
                            <Alert severity="warning">Lưu ý: ở mức dưới 70% sẽ tính phạt hư hỏng.</Alert>
                        )}

                        <TextField
                            label="Ghi chú (tuỳ chọn)"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            multiline
                            rows={2}
                        />

                        <Divider />

                        <Box>
                            <Typography variant="subtitle2">
                                Tóm tắt phí
                            </Typography>

                            {!preview && !autoPreviewing && (
                                <Typography variant="body2" color="text.secondary">
                                </Typography>
                            )}

                            {autoPreviewing && (
                                <Typography variant="caption" color="text.secondary">
                                    Đang cập nhật phí...
                                </Typography>
                            )}

                            {preview && (
                                <Stack spacing={0.5}>
                                    <Typography>
                                        Phạt trễ: {nf.format(summary.totalOver)}₫
                                    </Typography>
                                    <Typography>
                                        Phạt hư hỏng: {nf.format(summary.totalDamage)}₫
                                    </Typography>
                                    <Typography>
                                        Phạt mất: {nf.format(summary.totalLost)}₫
                                    </Typography>
                                    <Typography fontWeight={700}>
                                        Tổng phạt: {nf.format(summary.totalFine)}₫
                                    </Typography>

                                    <Divider sx={{ my: 1 }} />

                                    {summary.hasMemberCard ? (
                                        <>
                                            <Typography>
                                                Số dư thẻ hiện tại:{" "}
                                                {nf.format(summary.cardBalance)}₫
                                            </Typography>
                                            <Typography>
                                                Có thể trừ từ thẻ:{" "}
                                                {nf.format(summary.canPayFromCard)}₫
                                            </Typography>
                                            <Typography>
                                                Cần thanh toán thêm (QR):{" "}
                                                {nf.format(summary.needExternalPay)}₫
                                            </Typography>
                                        </>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary">
                                            Độc giả chưa có thẻ hội viên hoặc thẻ không hợp lệ – toàn
                                            bộ {nf.format(summary.totalFine)}₫ sẽ thanh toán bằng QR.
                                        </Typography>
                                    )}
                                </Stack>
                            )}
                        </Box>

                        {errorMsg && <Alert severity="error">{errorMsg}</Alert>}
                        {successMsg && <Alert severity="success">{successMsg}</Alert>}
                    </Stack>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={() => onClose?.()} disabled={loading}>
                    Huỷ
                </Button>
                <Button
                    variant="contained"
                    onClick={handleConfirm}
                    disabled={loading || !loanDetail}
                >
                    Xác nhận trả
                </Button>
            </DialogActions>

            {/* Dialog QR giống ReturnBulkDialog */}
            <Dialog
                open={showQr && !!pendingPayment}
                onClose={() => setShowQr(false)}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>Thanh toán tiền phạt</DialogTitle>
                <DialogContent dividers>
                    {pendingPayment ? (
                        <Stack spacing={2} alignItems="center">
                            <Typography>
                                Vui lòng thanh toán số tiền{" "}
                                <strong>{nf.format(pendingPayment.amount)}₫</strong> cho phiếu #
                                {slipId}.
                            </Typography>

                            {pendingPayment?.qrCode && (
                                <Box
                                    sx={{
                                        p: 2,
                                        borderRadius: 2,
                                        border: "1px solid #E2E8F0",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <QRCode value={pendingPayment.qrCode} size={220} />
                                </Box>
                            )}

                            {pendingPayment.checkoutUrl && (
                                <Button
                                    variant="outlined"
                                    onClick={() =>
                                        window.open(pendingPayment.checkoutUrl, "_blank")
                                    }
                                >
                                    Mở trang thanh toán
                                </Button>
                            )}

                            <Typography variant="body2" color="text.secondary">
                                Sau khi thanh toán xong, hãy bấm nút{" "}
                                <strong>"Tôi đã thanh toán"</strong> bên dưới để hệ thống kiểm
                                tra và cập nhật phiếu.
                            </Typography>
                        </Stack>
                    ) : (
                        <Typography>Không có thông tin thanh toán.</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowQr(false)}>Đóng</Button>

                    {/* Nút thanh toán tiền mặt */}
                    <Button
                        variant="outlined"
                        onClick={handleCashPayment}
                        disabled={loading}
                    >
                        Thanh toán tiền mặt
                    </Button>

                    <Button
                        variant="contained"
                        onClick={handleConfirmAfterPaid}
                        disabled={loading || !pendingPayment}
                    >
                        Tôi đã thanh toán
                    </Button>
                </DialogActions>
            </Dialog>
        </Dialog>
    );
}
