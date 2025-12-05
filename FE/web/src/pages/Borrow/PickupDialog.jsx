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
  Tooltip,
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
 * LEVEL_LABELS nâng cao (mô tả chi tiết, penalty info)
 * - value: representative percent (100,90,...,0)
 * - label: nhãn ngắn
 * - description: mô tả chi tiết để hướng dẫn thủ thư
 * - penalty: boolean (có phạt không)
 * - penaltyRate: tỉ lệ áp dụng trên coverPrice hoặc deposit (0..1)
 *
 * Phiên bản này làm cho mức từ 60 trở xuống có mô tả nặng hơn như bạn yêu cầu.
 */
const LEVEL_LABELS = [
  {
    value: 100,
    label: "Mới",
    description: "Sách nguyên vẹn hoàn toàn, như mới xuất bản. Không có vết trầy, không cong mép.",
    penalty: false,
    penaltyRate: 0,
  },
  {
    value: 90,
    label: "Rất tốt",
    description: "Hầu như không có dấu hiệu sử dụng. Một vài vết xước cực nhỏ không đáng kể.",
    penalty: false,
    penaltyRate: 0,
  },
  {
    value: 80,
    label: "Tốt",
    description: "Có dấu hiệu sử dụng nhẹ: trầy nhỏ trên bìa, mép hơi quăn. Các trang vẫn nguyên vẹn.",
    penalty: false,
    penaltyRate: 0,
  },
  {
    value: 70,
    label: "Khá",
    description: "Sách đã dùng nhiều: tróc nhẹ mép bìa, cong gáy. Tuy nhiên vẫn đảm bảo đọc tốt.",
    penalty: false,
    penaltyRate: 0,
  },
  // TỪ ĐÂY TRỞ XUỐNG: mô tả nặng hơn
  {
    value: 60,
    label: "Trầy nhiều",
    description:
      "Bìa bị trầy xước rõ rệt, mất màu, bong lớp cán. Mép bìa có dấu hiệu rách nhỏ hoặc gãy góc. Một số trang nhàu nhẹ.",
    penalty: true,
    penaltyRate: 0.2,
  },
  {
    value: 50,
    label: "Hư nhẹ",
    description:
      "Nhiều vết trầy lớn, quăn mép mạnh, có thể gãy gáy một phần. Một vài trang bị quăn hoặc nhăn mạnh.",
    penalty: true,
    penaltyRate: 0.4,
  },
  {
    value: 40,
    label: "Rách nhẹ",
    description:
      "Có vết rách nhỏ (2–5 cm) ở bìa hoặc trang bên trong. Gáy sách yếu, dễ bung nếu không sửa chữa.",
    penalty: true,
    penaltyRate: 0.6,
  },
  {
    value: 30,
    label: "Rách nặng",
    description:
      "Nhiều trang bị rách lớn, bìa rách hoặc tróc hoàn toàn một phần. Gáy bị gãy mạnh, sách có nguy cơ bung rời.",
    penalty: true,
    penaltyRate: 0.8,
  },
  {
    value: 20,
    label: "Hư nặng",
    description:
      "Nhiều trang bị mất hoặc rách lớn, giấy bị quăn mạnh hoặc thấm nước. Gáy bung khỏi thân sách. Gần như không thể sử dụng.",
    penalty: true,
    penaltyRate: 1.0,
  },
  {
    value: 10,
    label: "Rất hư",
    description:
      "Sách rất hư hỏng: mất nhiều trang, giấy rời hoàn toàn, bìa không còn gắn với ruột sách. Không thể phục hồi.",
    penalty: true,
    penaltyRate: 1.0,
  },
  {
    value: 0,
    label: "Hỏng hoàn toàn",
    description:
      "Sách hỏng nặng đến mức không thể sửa chữa: mất phần lớn trang, nát bìa, giấy mục hoặc biến dạng do nước. Cần thay thế.",
    penalty: true,
    penaltyRate: 1.0,
  },
];

/**
 * Chuyển phần trăm thực sang object level dùng FLOOR theo hàng chục.
 * Ví dụ: 94 -> 90, 89 -> 80, 100 -> 100, 0 -> 0
 */
function percentToLevel(percent) {
  if (percent == null || isNaN(Number(percent))) return null;
  const n = Math.max(0, Math.min(100, Number(percent)));
  const stepped = Math.floor(n / 10) * 10;
  // tìm exact match
  let found = LEVEL_LABELS.find((l) => l.value === stepped);
  if (found) return found;
  // fallback: tìm first with value <= stepped
  for (let i = 0; i < LEVEL_LABELS.length; i++) {
    if (stepped >= LEVEL_LABELS[i].value) {
      return LEVEL_LABELS[i];
    }
  }
  return LEVEL_LABELS[LEVEL_LABELS.length - 1];
}

/**
 * Tính tiền phạt cho một bản sao
 * - base: ưu tiên document.coverPrice, fallback deposit (tên trường có thể tùy chỉnh)
 * - penaltyRate lấy từ level.penaltyRate
 * - options: { fallbackDepositField, minFine }
 *
 * Trả về object: { shouldPenalize, rate, fineAmount, base, levelLabel, levelValue, percent }
 */
function computeFine(copyObj, documentObj, options = {}) {
  const { fallbackDepositField = "deposit", minFine = 0 } = options;

  // Lấy percent (dùng cùng hàm conditionToPercent trong file)
  const percent = conditionToPercent(copyObj, documentObj);
  if (percent == null) {
    return { shouldPenalize: false, fineAmount: 0, reason: "Không có dữ liệu tình trạng", percent: null };
  }

  const level = percentToLevel(percent);
  const shouldPenalize = Boolean(level?.penalty);
  const rate = shouldPenalize ? Number(level.penaltyRate ?? 0) : 0;

  // base price: ưu tiên coverPrice
  const coverPrice = Number(documentObj?.coverPrice ?? documentObj?.book?.coverPrice ?? 0) || 0;
  const deposit = Number(copyObj?.[fallbackDepositField] ?? documentObj?.deposit ?? 0) || 0;
  const base = coverPrice > 0 ? coverPrice : deposit > 0 ? deposit : 0;

  let fine = Math.max(0, Math.round(base * rate));
  if (fine < minFine) fine = minFine;

  return {
    shouldPenalize,
    rate,
    fineAmount: fine,
    base,
    levelLabel: level?.label ?? null,
    levelValue: level?.value ?? null,
    percent,
  };
}

/**
 * Hàm chuyển các field trạng thái sang % (giữ như trước để lưu số)
 */
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

/**
 * PickupDialog
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

  // helper format tiền (VND)
  function formatCurrency(n) {
    if (!n && n !== 0) return "-";
    try {
      return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
    } catch {
      return `${n}đ`;
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
                    const levelObj = percent == null ? null : percentToLevel(percent);
                    const fineInfo = computeFine(copy, document, { fallbackDepositField: "depositAmount", minFine: 0 });

                    return (
                      <TableRow key={idx}>
                        <TableCell>{copyId || "-"}</TableCell>
                        <TableCell>
                          <Avatar variant="rounded" src={coverUrl} alt={title} sx={{ width: 48, height: 64 }} />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 360 }}>{title || "-"}</TableCell>
                        <TableCell sx={{ fontFamily: "monospace" }}>{barCode || "-"}</TableCell>
                        <TableCell>
                          {error ? (
                            <Typography color="error">Không tải được</Typography>
                          ) : levelObj == null ? (
                            <Typography color="text.secondary">Không có dữ liệu</Typography>
                          ) : (
                            <Box>
                              <Tooltip title={<React.Fragment><Typography variant="subtitle2">{levelObj.label} ({levelObj.value}%)</Typography><Typography variant="body2" sx={{ maxWidth: 360 }}>{LEVEL_LABELS.find(l=>l.value===levelObj.value)?.description}</Typography></React.Fragment>}>
                                <Typography sx={{ fontWeight: 600 }}>{levelObj.label}</Typography>
                              </Tooltip>

                              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                {percent}%{/* hiện phần trăm thực */}
                              </Typography>

                              {levelObj.penalty ? (
                                <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
                                  Phạt: {formatCurrency(fineInfo.fineAmount)} ({Math.round((fineInfo.rate || 0) * 100)}% của {fineInfo.base > 0 ? formatCurrency(fineInfo.base) : "giá bìa/đặt cọc"})
                                </Typography>
                              ) : null}
                            </Box>
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
