import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, IconButton, Stack, Box, Alert
} from "@mui/material";
import { Close, QrCode2, Save } from "@mui/icons-material";
import { useEffect, useState } from "react";
import { useSnackbar } from "notistack";
import { createLoanSlipPaymentQR, confirmLoanSlipPaymentBySlip } from "../../services/loanSlips";

const nf = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

function Money({ value }) {
  if (value == null || value === "") return "-";
  const n = Number(value);
  return isNaN(n) ? String(value) : `${nf.format(n)}₫`;
}

export default function PayLoanSlipDialog({ open, loanSlip, onClose, onConfirmed }) {
  const { enqueueSnackbar } = useSnackbar();
  const [loadingQR, setLoadingQR] = useState(false);
  const [qrInfo, setQrInfo] = useState(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  const notify = {
    ok: (msg) => enqueueSnackbar(msg, { variant: "success" }),
    err: (msg) => enqueueSnackbar(msg, { variant: "error" }),
  };

  useEffect(() => {
    setQrInfo(null);
    setError("");
  }, [open, loanSlip]);

  const createQR = async () => {
    if (!loanSlip?.loanSlipId) return;
    const totalAmount = loanSlip?.details?.reduce((s, d) => s + (Number(d.depositAmount || 0)), 0);

    setLoadingQR(true);
    try {
      const qr = await createLoanSlipPaymentQR({
        loanSlipId: loanSlip.loanSlipId,
        amount: totalAmount,
        description: `Thanh toán phiếu mượn #${loanSlip.loanSlipId}`,
      });

      if (qr?.qr) {
        setQrInfo(qr);
        notify.ok("Tạo QR thanh toán thành công.");
      } else {
        throw new Error("Không nhận được dữ liệu QR.");
      }
    } catch (e) {
      setError("Không tạo được mã QR.");
      notify.err("Không tạo được mã QR.");
    } finally {
      setLoadingQR(false);
    }
  };

  const confirmPayment = async () => {
    if (!loanSlip?.loanSlipId) return;
    setConfirming(true);
    try {
      const res = await confirmLoanSlipPaymentBySlip(loanSlip.loanSlipId);
      if (res?.message) {
        notify.ok("Đã xác nhận thanh toán.");
        onConfirmed?.(res);
      } else {
        throw new Error("Không thể xác nhận.");
      }
    } catch (e) {
      setError("Không xác nhận được thanh toán.");
      notify.err("Không xác nhận được thanh toán.");
    } finally {
      setConfirming(false);
    }
  };

  if (!loanSlip) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography fontWeight={700}>Thanh toán phiếu #{loanSlip.loanSlipId}</Typography>
        <IconButton onClick={onClose}><Close /></IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}

          <Typography><b>Độc giả:</b> {loanSlip.Reader?.fullName || `#${loanSlip.readerId}`}</Typography>
          <Typography><b>Thủ thư:</b> {loanSlip.Librarian?.fullName || `#${loanSlip.librarianId}`}</Typography>
          <Typography><b>Số đầu mục:</b> {loanSlip.details?.length || 0}</Typography>
          <Typography><b>Tổng tiền cọc:</b> <Money value={loanSlip.details?.reduce((s, d) => s + (Number(d.depositAmount) || 0), 0)} /></Typography>

          {qrInfo ? (
            <Stack spacing={2} alignItems="center">
              <Typography><b>PaymentId:</b> #{qrInfo.paymentId}</Typography>
              <Typography><b>Số tiền:</b> <Money value={qrInfo.amount} /></Typography>
              <Typography><b>Mã giao dịch:</b> {qrInfo.transactionCode}</Typography>
              {qrInfo.qr?.type === "data-url" && (
                <img src={qrInfo.qr.content} alt="QR Code" style={{ width: 240, height: 240 }} />
              )}
              <Alert severity="info">Quét QR để thanh toán, sau đó bấm "Xác nhận thanh toán"</Alert>
            </Stack>
          ) : (
            <Button variant="contained" onClick={createQR} startIcon={<QrCode2 />} disabled={loadingQR}>
              Tạo mã QR thanh toán
            </Button>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ justifyContent: "space-between" }}>
        <Button onClick={onClose}>Hủy</Button>
        <Button
          onClick={confirmPayment}
          variant="outlined"
          disabled={confirming || !qrInfo}
          startIcon={<Save />}
        >
          Xác nhận thanh toán
        </Button>
      </DialogActions>
    </Dialog>
  );
}
