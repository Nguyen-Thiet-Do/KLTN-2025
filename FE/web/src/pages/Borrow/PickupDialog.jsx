// PickupDialog.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Typography,
  TextField,
  Button,
  Avatar,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Box,
} from "@mui/material";
import { pickupLoanSlip, getCopyWithDeposit } from "../../services/loanSlips";
import { useSnackbar } from "notistack";
import { useAuth } from "../../contexts/AuthContext";

// helper: today's date in yyyy-mm-dd
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// helper: date + n days in yyyy-mm-dd
function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * PickupDialog
 * - Hiển thị danh sách sách trong phiếu với các trường: mã copy, ảnh bìa, tiêu đề, mã vạch, trạng thái (%)
 * - Lấy thông tin chi tiết bản sao bằng getCopyWithDeposit(copyId, { withDoc: 1 })
 */
export default function PickupDialog({ open, onClose, slip, librarianId: librarianIdProp, onPicked }) {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();

  const [pickupDate, setPickupDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // itemsInfo: array of { copy, document, loanDetail, error? }
  const [itemsInfo, setItemsInfo] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // derive effective librarianId similar to other dialogs
  const contextLibrarianId = useMemo(() => {
    return (
      Number(user?.librarianId) ||
      Number(user?.profile?.librarianId) ||
      Number(user?.Librarian?.librarianId) ||
      Number(user?.accountId) ||
      null
    );
  }, [user]);

  const effectiveLibrarianId = useMemo(() => {
    const fromProp = Number(librarianIdProp) || null;
    return fromProp || contextLibrarianId || null;
  }, [librarianIdProp, contextLibrarianId]);

  useEffect(() => {
    if (open) {
      setPickupDate(todayISO());
      setDueDate(todayPlus(30));
      setSubmitting(false);
      loadItemsInfo();
    } else {
      setPickupDate("");
      setDueDate("");
      setSubmitting(false);
      setItemsInfo([]);
      setLoadingItems(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slip]);

  // Hàm chuyển các field trạng thái sang %
  function conditionToPercent(copy, document) {
    if (!copy && !document) return null;
    const raw =
      (copy && (copy.conditionGrade ?? copy.conditionPercent ?? copy.qualityPercent ?? copy.condition ?? copy.conditionNote)) ??
      (document && (document.qualityPercent ?? document.conditionNote)) ??
      null;

    if (raw == null) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    if (n >= 0 && n <= 100) return Math.round(n);
    if (n >= 1 && n <= 5) return Math.round((n / 5) * 100);
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  // Load chi tiết các bản sao trong phiếu
  async function loadItemsInfo() {
    const details = slip?.details || slip?.loanDetails || slip?.items || [];
    if (!details || details.length === 0) {
      setItemsInfo([]);
      return;
    }

    setLoadingItems(true);
    try {
      const fetches = details.map(async (d) => {
        // nhiều tên có thể chứa id bản sao
        const copyId = d?.documentCopyId || d?.copyId || d?.documentCopy?.documentCopyId || d?.copy?.id;
        if (!copyId) return { error: "missing copyId", loanDetail: d };

        try {
          const res = await getCopyWithDeposit(copyId, { withDoc: 1 });
          const payload = res?.data ?? res;

          // payload có thể là { copy: {...}, document: {...} } hoặc chính object copy (và copy.document)
          let copyObj = null;
          let docObj = null;

          if (payload) {
            if (payload.copy || payload.document) {
              copyObj = payload.copy ?? null;
              docObj = payload.document ?? null;
            } else {
              copyObj = payload ?? null;
              docObj = payload?.document ?? null;
            }
          }

          return { copy: copyObj, document: docObj, loanDetail: d };
        } catch (err) {
          console.error("load copy error", copyId, err);
          return { error: err?.message || "load error", loanDetail: d };
        }
      });

      const results = await Promise.all(fetches);
      setItemsInfo(results);
    } catch (err) {
      console.error("loadItemsInfo", err);
      enqueueSnackbar("Không tải được thông tin sách trong phiếu.", { variant: "error" });
    } finally {
      setLoadingItems(false);
    }
  }

  async function handleConfirm() {
    if (!slip?.loanSlipId) return;
    const lid = Number(effectiveLibrarianId);
    if (!Number.isFinite(lid) || lid <= 0) {
      enqueueSnackbar("Không xác định thủ thư. Vui lòng đăng nhập bằng tài khoản thủ thư.", { variant: "warning" });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        librarianId: lid,
        pickupDate: pickupDate || undefined,
        dueDate: dueDate || undefined,
        // Nếu backend hỗ trợ gửi items cụ thể, có thể thêm:
        // items: itemsInfo.map(i => ({ documentCopyId: i.copy?.documentCopyId || i.copy?.id }))
      };

      const res = await pickupLoanSlip(slip.loanSlipId, payload);
      if (res?.success) {
        enqueueSnackbar("Xác nhận lấy thành công — phiếu chuyển sang Đang mượn.", { variant: "success" });
        onPicked?.(res);
      } else {
        const msg = res?.message || "Xác nhận lấy thất bại";
        enqueueSnackbar(msg, { variant: "error" });
      }
    } catch (err) {
      console.error("pickup error", err);
      const msg = err?.response?.data?.message || err?.message || "Lỗi khi xác nhận lấy";
      enqueueSnackbar(msg, { variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={Boolean(open)} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Xác nhận độc giả đến lấy #{slip?.loanSlipId ?? ""}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            type="date"
            label="Ngày đến lấy"
            InputLabelProps={{ shrink: true }}
            fullWidth
            value={pickupDate}
            disabled
            inputProps={{ "aria-readonly": true }}
            onChange={() => {}}
          />

          <TextField
            type="date"
            label="Hạn trả"
            InputLabelProps={{ shrink: true }}
            fullWidth
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />

          <Box>
            <Typography variant="subtitle1" sx={{ mt: 1, mb: 1 }}>
              Danh sách sách trong phiếu
            </Typography>

            {loadingItems ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <CircularProgress size={20} />
                <Typography>Đang tải thông tin sách...</Typography>
              </Box>
            ) : itemsInfo.length === 0 ? (
              <Typography color="text.secondary">Không có thông tin sách trong phiếu.</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Mã copy</TableCell>
                    <TableCell>Ảnh</TableCell>
                    <TableCell>Tiêu đề</TableCell>
                    <TableCell>Mã vạch</TableCell>
                    <TableCell>Trạng thái</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {itemsInfo.map((row, idx) => {
                    const { copy, document, loanDetail, error } = row || {};
                    const copyId =
                      copy?.documentCopyId ?? copy?.id ?? loanDetail?.documentCopyId ?? loanDetail?.copyId ?? "";
                    const title = document?.title ?? copy?.title ?? loanDetail?.title ?? "-";
                    const barCode = copy?.barCode ?? copy?.barcode ?? copy?.bar_code ?? "-";
                    const coverUrl =
                      document?.coverPhoto ||
                      document?.coverUrl ||
                      copy?.thumbnail ||
                      copy?.cover ||
                      null;
                    const percent = conditionToPercent(copy, document);

                    return (
                      <TableRow key={idx}>
                        <TableCell>{copyId || "-"}</TableCell>
                        <TableCell>
                          <Avatar variant="rounded" src={coverUrl} alt={title} sx={{ width: 48, height: 64 }} />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 360 }}>{title || "-"}</TableCell>
                        <TableCell>{barCode || "-"}</TableCell>
                        <TableCell>
                          {error ? (
                            <Typography color="error">Không tải được</Typography>
                          ) : percent == null ? (
                            <Typography color="text.secondary">Không có dữ liệu</Typography>
                          ) : (
                            <Typography>{percent}%</Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>
          Đóng
        </Button>
        <Button variant="contained" onClick={handleConfirm} disabled={submitting}>
          {submitting ? "Đang xử lý..." : "Xác nhận lấy"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
