// src/components/Borrow/ReturnBulkDialog.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
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

// helper: ưu tiên profile.librarianId, KHÔNG dùng accountId
function getLibrarianIdFromUser(user) {
  try {
    if (user?.librarianId) return Number(user.librarianId);
    if (user?.profile?.librarianId) return Number(user.profile.librarianId);
    if (user?.Librarian?.librarianId) return Number(user.Librarian.librarianId);

    const profRaw = sessionStorage.getItem("profile");
    if (profRaw) {
      try {
        const prof = JSON.parse(profRaw);
        if (prof?.librarianId) return Number(prof.librarianId);
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

export default function ReturnBulkDialog({ open, onClose, slip, onReturned }) {
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
  const [items, setItems] = useState([]); // { loanDetailId, conditionReturn, isLost, note, ... }
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // kết quả preview từ backend
  const [preview, setPreview] = useState(null); // { loanSlipId, returnDate, totals, items, paymentPreview }

  // thông tin payment đang chờ thanh toán (khi cần PayOS)
  const [pendingPayment, setPendingPayment] = useState(null); // { paymentId, orderCode, amount, checkoutUrl, qrCode }
  const [showQr, setShowQr] = useState(false);

  // auto preview state + debounce
  const [autoPreviewing, setAutoPreviewing] = useState(false);
  const previewTimeoutRef = useRef(null);

  useEffect(() => {
    if (open && slip) {
      setReturnDate(parseDateOnly(new Date().toISOString()));

      const borroweds = (slip.details || []).filter(
        (d) => String(d.status).toUpperCase() === "BORROWED"
      );

      setItems(
        borroweds.map((d) => ({
          loanDetailId: d.loanDetailId,
          conditionReturn:
            d.conditionBorrow != null ? Number(d.conditionBorrow) : 100,
          isLost: false,
          note: d.note || "",
          depositAmount: Number(d.depositAmount) || 0,
          borrowCond: d.conditionBorrow,
          coverPrice: d.DocumentCopy?.Document?.coverPrice || 0,
          barCode: d.DocumentCopy?.barCode || null,
        }))
      );

      setErrorMsg(null);
      setPreview(null);
      setPendingPayment(null);
      setShowQr(false);
    } else if (!open) {
      setItems([]);
      setErrorMsg(null);
      setPreview(null);
      setPendingPayment(null);
      setShowQr(false);
    }
  }, [open, slip]);

  function updateItem(id, patch) {
    setItems((prev) =>
      prev.map((it) => (it.loanDetailId === id ? { ...it, ...patch } : it))
    );
  }

  // ---------- GỌI API PREVIEW (dùng chung cho auto + manual) ----------
  async function doPreview(options = { showSnackbar: true }) {
    const { showSnackbar } = options;

    if (!slip) return;
    if (!returnDate) {
      setErrorMsg("Chọn ngày trả");
      return;
    }
    if (!items.length) {
      setErrorMsg("Không có item BORROWED để trả");
      return;
    }

    const payload = {
      loanSlipId: slip.loanSlipId,
      returnDate,
      items: items.map((it) => ({
        loanDetailId: it.loanDetailId,
        conditionReturn: it.isLost ? 0 : Number(it.conditionReturn),
        isLost: !!it.isLost,
        note: it.note || undefined,
      })),
    };

    if (showSnackbar) {
      setLoading(true);
    } else {
      setAutoPreviewing(true);
    }

    setErrorMsg(null);
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

      const out = res.data || res; // controller trả { success, data }
      setPreview(out);

      if (showSnackbar) {
        enqueueSnackbar("Đã tính phí preview thành công.", {
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

  // ---------- AUTO PREVIEW chỉ khi toggle checkbox "Mất sách" ----------
  useEffect(() => {
    if (!open) return;
    if (!slip) return;
    if (!returnDate) return;
    if (!items.length) return;

    // Chỉ tự động preview khi thay đổi isLost
    // Không tự động khi thay đổi conditionReturn, note, hoặc returnDate
    const isLostStates = items.map(it => it.isLost).join(',');

    // debounce 500ms
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
  }, [items.map(it => it.isLost).join(','), slip, open]);

  // ---------- GỌI MANUAL PREVIEW (nếu vẫn muốn dùng nút) ----------
  async function handlePreview() {
    await doPreview({ showSnackbar: true });
  }

  // ---------- XÁC NHẬN TRẢ (BƯỚC 1: INIT + tạo QR nếu cần) ----------
  async function handleConfirm() {
    if (!slip) return;
    if (!returnDate) {
      setErrorMsg("Chọn ngày trả");
      return;
    }
    if (!items.length) {
      setErrorMsg("Không có item để trả");
      return;
    }
    if (!preview) {
      setErrorMsg(
        "Chưa có dữ liệu phí preview. Vui lòng để hệ thống tính phí xong trước khi xác nhận."
      );
      return;
    }

    const baseItems = items.map((it) => ({
      loanDetailId: it.loanDetailId,
      conditionReturn: it.isLost ? 0 : Number(it.conditionReturn),
      isLost: !!it.isLost,
      note: it.note || undefined,
    }));

    const librarianId = getLibrarianIdFromUser(user) ?? librarianIdFromAuth;
    if (!librarianId) {
      setErrorMsg(
        "Không xác định được librarianId. Vui lòng đăng nhập bằng tài khoản thủ thư."
      );
      return;
    }

    const payload = {
      loanSlipId: slip.loanSlipId,
      returnDate,
      items: baseItems,
      librarianId: Number(librarianId),
    };

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await initBulkReturnPayment(payload);
      if (!res?.success) {
        const msg = res?.message || "Khởi tạo trả phiếu thất bại";
        setErrorMsg(msg);
        enqueueSnackbar(msg, { variant: "error" });
        return;
      }

      // Trường hợp không cần thanh toán thêm -> BE đã xử lý trả phiếu luôn
      if (!res.needPayment) {
        enqueueSnackbar("Trả toàn bộ thành công.", { variant: "success" });
        onReturned && onReturned(res.finalResult || res);
        onClose && onClose();
        return;
      }

      // Cần thanh toán thêm -> hiển thị QR
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
        "Đã tạo QR/link thanh toán. Vui lòng thanh toán rồi bấm 'Tôi đã thanh toán'.",
        { variant: "info" }
      );
    } catch (err) {
      console.error("initBulkReturnPayment error:", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Lỗi khi khởi tạo trả phiếu";
      setErrorMsg(msg);
      enqueueSnackbar(msg, { variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  // ---------- XÁC NHẬN SAU KHI THANH TOÁN (BƯỚC 2: CONFIRM) ----------
  async function handleConfirmAfterPaid() {
    if (!slip || !pendingPayment) return;

    const librarianId = getLibrarianIdFromUser(user) ?? librarianIdFromAuth;
    if (!librarianId) {
      enqueueSnackbar("Không xác định được librarianId.", { variant: "error" });
      return;
    }

    const baseItems = items.map((it) => ({
      loanDetailId: it.loanDetailId,
      conditionReturn: it.isLost ? 0 : Number(it.conditionReturn),
      isLost: !!it.isLost,
      note: it.note || undefined,
    }));

    const payload = {
      loanSlipId: slip.loanSlipId,
      returnDate,
      items: baseItems,
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
      console.error("confirmBulkReturnAfterPayment error:", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Lỗi khi xác nhận sau thanh toán";
      enqueueSnackbar(msg, { variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  // ---------- TÓM TẮT TỪ PREVIEW ----------
  const summary = useMemo(() => {
    if (!preview) {
      return {
        totalOver: 0,
        totalDamage: 0,
        totalLost: 0,
        totalFine: 0,
        cardBalance: 0,
        canPayFromCard: 0,
        needExternalPay: 0,
        hasMemberCard: false,
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

  function handleLostToggle(it, checked) {
    updateItem(it.loanDetailId, {
      isLost: checked,
    });
  }

  return (
    <Dialog
      open={Boolean(open)}
      onClose={() => onClose?.()}
      fullWidth
      maxWidth="lg"
    >
      <DialogTitle>Trả toàn bộ phiếu #{slip?.loanSlipId}</DialogTitle>
      <DialogContent dividers>
        {!slip ? (
          <Typography>Không có thông tin</Typography>
        ) : (
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                label="Ngày trả"
                type="date"
                value={returnDate}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 180 }}
                disabled
              />
              <Typography variant="body2" color="text.secondary">
                Độc giả: {slip.Reader?.fullName || slip.readerId}
              </Typography>
            </Stack>

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

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#Detail</TableCell>
                  <TableCell>Tài liệu</TableCell>
                  <TableCell>Mã vạch</TableCell>
                  <TableCell>Tình trạng mượn</TableCell>
                  <TableCell>Tình trạng trả</TableCell>
                  <TableCell>Mất sách</TableCell>
                  <TableCell>Ghi chú</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      Không có item BORROWED để trả
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((it) => {
                    const detail = (slip.details || []).find(d => d.loanDetailId === it.loanDetailId);
                    const copy = detail?.DocumentCopy;
                    const doc = copy?.Document;
                    const title = doc?.title || "-";
                    const cover = doc?.coverPhoto || null;

                    return (
                      <TableRow key={it.loanDetailId}>
                        <TableCell>{it.loanDetailId}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            {cover && (
                              <img
                                src={cover}
                                alt={title}
                                loading="lazy"
                                style={{ width: 36, height: 48, objectFit: "cover", borderRadius: 4, display: "block", flexShrink: 0 }}
                              />
                            )}
                            <Typography variant="body2" fontWeight={600} sx={{ maxWidth: 300 }}>
                              {title}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ fontFamily: "monospace" }}>
                          {it.barCode || "-"}
                        </TableCell>
                        <TableCell>{it.borrowCond ?? "-"}</TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            value={it.conditionReturn}
                            onChange={(e) =>
                              updateItem(it.loanDetailId, {
                                conditionReturn: Number(e.target.value),
                              })
                            }
                            onBlur={() => doPreview({ showSnackbar: false })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                doPreview({ showSnackbar: false });
                              }
                            }}
                            size="small"
                            sx={{ width: 120 }}
                            disabled={it.isLost}
                            inputProps={{ min: 0, max: 100 }}
                          />
                        </TableCell>
                        <TableCell>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={it.isLost}
                                onChange={(e) =>
                                  handleLostToggle(it, e.target.checked)
                                }
                              />
                            }
                            label="Mất"
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            value={it.note}
                            onChange={(e) =>
                              updateItem(it.loanDetailId, { note: e.target.value })
                            }
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            <Divider />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
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
                    Phạt trễ tổng: {nf.format(summary.totalOver)}₫
                  </Typography>
                  <Typography>
                    Phạt hư hỏng tổng: {nf.format(summary.totalDamage)}₫
                  </Typography>
                  <Typography>
                    Phạt mất tổng: {nf.format(summary.totalLost)}₫
                  </Typography>
                  <Typography fontWeight={700}>
                    Tổng phạt: {nf.format(summary.totalFine)}₫
                  </Typography>

                  <Divider sx={{ my: 1 }} />

                  {summary.hasMemberCard ? (
                    <>
                      <Typography>
                        Số dư thẻ hiện tại: {nf.format(summary.cardBalance)}₫
                      </Typography>
                      <Typography>
                        Có thể trừ từ thẻ: {nf.format(summary.canPayFromCard)}₫
                      </Typography>
                      <Typography>
                        Cần thanh toán thêm (QR):{" "}
                        {nf.format(summary.needExternalPay)}₫
                      </Typography>
                    </>
                  ) : (
                    <Typography color="text.secondary">
                      Độc giả chưa có thẻ hội viên hoặc thẻ không hợp lệ – toàn
                      bộ {nf.format(summary.totalFine)}₫ sẽ thanh toán bằng QR.
                    </Typography>
                  )}
                </Stack>
              )}
            </Box>

            {errorMsg && <Alert severity="error">{errorMsg}</Alert>}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={() => onClose?.()} disabled={loading}>
          Huỷ
        </Button>

        {/* Nút này giờ chỉ là tùy chọn, không bắt buộc dùng nữa */}
        {/* <Button
          variant="outlined"
          onClick={handlePreview}
          disabled={loading || !items.length}
        >
          Tính phí (preview)
        </Button> */}

        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={loading || !items.length}
        >
          Xác nhận trả toàn bộ
        </Button>
      </DialogActions>

      {/* Dialog hiển thị QR PayOS */}
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
                {slip?.loanSlipId}.
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