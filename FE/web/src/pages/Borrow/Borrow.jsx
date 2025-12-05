// src/components/Borrow/Borrow.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  LinearProgress,
  Pagination,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  IconButton,
  Paper,
  Button,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  ExpandMore,
  ExpandLess,
  Refresh as RefreshIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import QRCode from "react-qr-code";

import {
  fetchLoanSlips,
  getDocumentDetail,
  cancelReservation,
  createViolationPaymentForSlip,
} from "../../services/loanSlips";
import AddLoanSlipDialog from "./AddLoanSlipDialog";
import ApproveReservationDialog from "./ApproveReservationDialog";
import ReturnSingleDialog from "./ReturnSingleDialog";
import ReturnBulkDialog from "./ReturnBulkDialog";
import PickupDialog from "./PickupDialog";
import CancelSlipDialog from "./CancelSlipDialog";
import DeleteDetailDialog from "./DeleteDetailDialog";
import { useAuth } from "../../contexts/AuthContext"; // điều chỉnh path nếu khác
import CancelReservationDialog from "./CancelReservationDialog";

// IMPORT: two new dialogs (paste these files into same folder)
import CreateOnsiteDialog from "./CreateOnsiteDialog";
import OnsiteReturnDialog from "./OnsiteReturnDialog";

const TABS = [
  { key: "PENDING", label: "Chờ duyệt" },
  { key: "WAITING_FOR_PICKUP", label: "Chờ đến lấy" },
  { key: "BORROWING", label: "Đang mượn" },
  { key: "ON_SITE", label: "Đọc tại chỗ" }, // <-- new tab
  { key: "RETURNED", label: "Đã trả" },
  { key: "OVERDUE", label: "Quá hạn" },
];

const nf = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

function formatDate(d) {
  if (!d) return "-";
  const s = String(d).slice(0, 19).replace(" ", "T");
  const dt = new Date(s);
  // chỉ hiển thị ngày: dd/MM/yyyy
  return isNaN(dt.getTime())
    ? String(d).slice(0, 10)
    : dt.toLocaleDateString("vi-VN");
}

function chipForSlipStatus(status) {
  switch (String(status || "").toUpperCase()) {
    case "PENDING":
      return (
        <Chip
          color="warning"
          label="Chờ duyệt"
          size="small"
          sx={{ fontWeight: 600 }}
        />
      );
    case "WAITING_FOR_PICKUP":
      return (
        <Chip
          color="info"
          label="Chờ đến lấy"
          size="small"
          sx={{ fontWeight: 600 }}
        />
      );
    case "BORROWING":
      return (
        <Chip
          color="primary"
          label="Đang mượn"
          size="small"
          sx={{ fontWeight: 600 }}
        />
      );
    case "ON_SITE":
      return (
        <Chip
          color="secondary"
          label="Đọc tại chỗ"
          size="small"
          sx={{
            fontWeight: 600,
            background: "linear-gradient(135deg,#FFB86B 0%, #FF7A59 100%)",
            color: "white",
          }}
        />
      );
    case "RETURNED":
      return (
        <Chip
          color="success"
          label="Đã trả"
          size="small"
          sx={{ fontWeight: 600 }}
        />
      );
    case "OVERDUE":
      return (
        <Chip
          color="error"
          label="Quá hạn"
          size="small"
          sx={{ fontWeight: 600 }}
        />
      );
    default:
      return (
        <Chip
          label={status || "Không rõ"}
          size="small"
          sx={{ fontWeight: 600 }}
        />
      );
  }
}

function chipForDetailStatus(status) {
  switch (String(status || "").toUpperCase()) {
    case "PENDING":
      return (
        <Chip
          size="small"
          color="warning"
          label="Chờ duyệt"
          sx={{ fontWeight: 600 }}
        />
      );
    case "BORROWED":
      return (
        <Chip
          size="small"
          color="primary"
          label="Đang mượn"
          sx={{ fontWeight: 600 }}
        />
      );
    case "RETURNED":
      return (
        <Chip
          size="small"
          color="success"
          label="Đã trả"
          sx={{ fontWeight: 600 }}
        />
      );
    case "OVERDUE":
      return (
        <Chip
          size="small"
          color="error"
          label="Quá hạn"
          sx={{ fontWeight: 600 }}
        />
      );
    default:
      return (
        <Chip
          size="small"
          label={status || "-"}
          sx={{ fontWeight: 600 }}
        />
      );
  }
}

function parseRequestedDocumentId(note) {
  const m = String(note || "").match(/REQUEST_DOCUMENT_ID=(\d+)/i);
  return m ? Number(m[1]) : null;
}

function Money({ value }) {
  if (value == null || value === "") return "-";
  const n = Number(value);
  return isNaN(n) ? String(value) : `${nf.format(n)}₫`;
}

/**
 * Dialog xem / thanh toán vi phạm cho 1 phiếu
 * (giữ nguyên từ file gốc)
 */
function ViolationDialog({
  open,
  onClose,
  slip,
  payment,
  paying,
  payError,
  onPay,
}) {
  const slipId = slip?.loanSlipId ?? null;

  // Gom tất cả violation theo từng chi tiết
  const rows = [];
  (slip?.details || []).forEach((d) => {
    const violations = d.Violations || d.violations || [];
    const copy = d.DocumentCopy;
    const doc = copy?.Document;

    violations.forEach((v) => {
      rows.push({
        loanDetailId: d.loanDetailId,
        documentTitle: doc?.title || "-",
        barCode: copy?.barCode || "-",
        type: v.type,
        severity: v.severity,
        description: v.violationDescription,
        fineAmount: v.fineAmount,
        paymentStatus: v.paymentStatus,
        createdAt: v.created_at || v.createdAt,
      });
    });
  });

  const hasData = rows.length > 0;
  const hasUnpaid = rows.some(
    (r) => String(r.paymentStatus || "").toUpperCase() !== "PAID"
  );

  return (
    <Dialog open={Boolean(open)} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Vi phạm của phiếu #{slipId ?? ""}</DialogTitle>

      <DialogContent dividers>
        {!hasData ? (
          <Typography variant="body2" color="text.secondary">
            Phiếu này không có vi phạm nào.
          </Typography>
        ) : (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#Detail</TableCell>
                  <TableCell>Tài liệu</TableCell>
                  <TableCell>Mã vạch</TableCell>
                  <TableCell>Loại</TableCell>
                  <TableCell>Mức độ</TableCell>
                  <TableCell>Mô tả</TableCell>
                  <TableCell>Tiền phạt</TableCell>
                  <TableCell>Thanh toán</TableCell>
                  <TableCell>Ngày tạo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r, idx) => (
                  <TableRow key={`${r.loanDetailId}-${idx}`} hover>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {r.loanDetailId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        noWrap
                        sx={{ maxWidth: 200 }}
                      >
                        {r.documentTitle}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {r.barCode}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={r.type || "-"}
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={r.severity || "-"}
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {r.description || "-"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        <Money value={r.fineAmount} />
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {String(r.paymentStatus || "").toUpperCase() === "PAID" ? (
                        <Chip
                          size="small"
                          color="success"
                          label="Đã thanh toán"
                          sx={{ fontWeight: 600 }}
                        />
                      ) : (
                        <Chip
                          size="small"
                          color="warning"
                          label="Chưa thanh toán"
                          sx={{ fontWeight: 600 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(r.createdAt)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Thanh toán vi phạm */}
            {hasUnpaid && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Thanh toán các vi phạm chưa thanh toán
                </Typography>

                {payError && (
                  <Typography
                    variant="body2"
                    color="error"
                    sx={{ mb: 1 }}
                  >
                    {payError}
                  </Typography>
                )}

                {payment && payment.checkoutUrl ? (
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={2}
                    alignItems={{ xs: "flex-start", md: "center" }}
                    sx={{ mt: 1 }}
                  >
                    <Box
                      sx={{
                        p: 2,
                        bgcolor: "white",
                        borderRadius: 2,
                        border: "1px solid rgba(0,0,0,0.08)",
                      }}
                    >
                      <QRCode
                        value={payment.checkoutUrl}
                        size={160}
                        style={{ display: "block" }}
                      />
                    </Box>

                    <Box>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        Số tiền cần thanh toán:{" "}
                        <strong>
                          <Money value={payment.amount} />
                        </strong>
                      </Typography>
                      <Button
                        variant="contained"
                        href={payment.checkoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ textTransform: "none", mr: 1, mb: { xs: 1, md: 0 } }}
                      >
                        Mở trang thanh toán
                      </Button>
                    </Box>
                  </Stack>
                ) : (
                  <Button
                    variant="contained"
                    disabled={paying}
                    onClick={onPay}
                    sx={{ mt: 1, textTransform: "none" }}
                  >
                    {paying ? "Đang tạo QR..." : "Tạo QR thanh toán vi phạm"}
                  </Button>
                )}
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Row component
 * thêm props: onPickup, onDeleteDetail, isReturnedTab, onViewViolations, onOpenFinishOnsite
 */
function Row({
  row,
  titleCache,
  onApprove,
  onSingleReturn,
  onBulkReturn,
  onCancel,
  onPickup,
  onDeleteDetail,
  isReturnedTab,
  onViewViolations,
  onOpenFinishOnsite, // NEW
}) {
  const [open, setOpen] = useState(false);
  const librarianName =
    row?.Librarian?.fullName || (row?.librarianId ? `#${row.librarianId}` : "-");

  // check phiếu có bất kỳ yêu cầu hủy nào:
  const hasReaderCancelRequest =
    String(row.note || "").includes("[READER_CANCEL_REQUEST") ||
    String(row.note || "").includes("[READER_CANCEL_DETAIL_REQUEST") ||
    (row.details || []).some((d) =>
      String(d.note || "").includes("[READER_CANCEL_REQUEST")
    );

  // Gom tất cả Violation từ các LoanDetail của phiếu
  const allViolations = [];
  for (const d of row.details || []) {
    const vs = d.Violations || d.violations;
    if (Array.isArray(vs)) {
      allViolations.push(...vs);
    }
  }

  const hasViolations = allViolations.length > 0;
  const hasUnresolvedViolations = allViolations.some(
    (v) => String(v.paymentStatus || "").toUpperCase() !== "PAID"
  );

  function renderViolationStatusChip() {
    if (!hasViolations) {
      return (
        <Chip
          size="small"
          label="Không có"
          sx={{ fontWeight: 600 }}
        />
      );
    }

    if (hasUnresolvedViolations) {
      return (
        <Chip
          size="small"
          color="warning"
          label="Chưa xử lý"
          sx={{ fontWeight: 600 }}
        />
      );
    }

    return (
      <Chip
        size="small"
        color="success"
        label="Đã xử lý"
        sx={{ fontWeight: 600 }}
      />
    );
  }

  return (
    <>
      <TableRow
        hover
        sx={
          hasReaderCancelRequest
            ? {
              backgroundColor: "rgba(254, 215, 215, 0.6)",
              borderLeft: "4px solid #E53E3E",
              "&:hover": {
                backgroundColor: "rgba(252, 129, 129, 0.25)",
              },
            }
            : {}
        }
      >
        <TableCell width={40}>
          <IconButton
            size="small"
            onClick={() => setOpen((v) => !v)}
            sx={{
              color: "#667EEA",
              "&:hover": { backgroundColor: "rgba(102,126,234,0.08)" },
            }}
            aria-label={open ? "Thu gọn" : "Mở rộng"}
          >
            {open ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </TableCell>

        <TableCell>
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{ fontFamily: "monospace", fontSize: 13 }}
          >
            #{row.loanSlipId}
          </Typography>
        </TableCell>

        <TableCell>
          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar
              sx={{
                width: 24,
                height: 24,
                background:
                  "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {(row.Reader?.fullName || "?").slice(0, 1)}
            </Avatar>
            <Box>
              <Typography variant="body2" fontWeight={600}>
                {row.Reader?.fullName || `Reader #${row.readerId}`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ID: {row.readerId}
              </Typography>
            </Box>
          </Stack>
        </TableCell>

        <TableCell>
          <Typography variant="body2">{librarianName}</Typography>
        </TableCell>

        <TableCell>
          <Typography variant="body2">
            {formatDate(row.loanDate)}
          </Typography>
        </TableCell>

        <TableCell>
          <Typography variant="body2">
            {formatDate(row.dueDate)}
          </Typography>
        </TableCell>

        <TableCell>
          <Stack direction="row" spacing={1} alignItems="center">
            {chipForSlipStatus(row.status)}
            {hasReaderCancelRequest && (
              <Chip
                size="small"
                color="error"
                label="Độc giả yêu cầu hủy"
                sx={{
                  fontWeight: 700,
                  backgroundColor: "rgba(229,62,62,0.12)",
                }}
              />
            )}
          </Stack>
        </TableCell>

        {/* Trạng thái vi phạm (chỉ áp dụng tab ĐÃ TRẢ) */}
        <TableCell>
          {isReturnedTab ? renderViolationStatusChip() : "-"}
        </TableCell>

        <TableCell align="center">
          <Chip
            label={Array.isArray(row.details) ? row.details.length : 0}
            size="small"
            sx={{
              background:
                "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
              color: "white",
              fontWeight: 700,
            }}
          />
        </TableCell>

        <TableCell align="right">
          {String(row.status).toUpperCase() === "PENDING" && (
            <>
              <Button
                size="small"
                variant="contained"
                onClick={() => onApprove?.(row)}
              >
                Duyệt
              </Button>

              <Button
                size="small"
                variant="outlined"
                color="error"
                sx={{ ml: 1 }}
                onClick={() => onCancel?.(row)}
              >
                Hủy
              </Button>
            </>
          )}

          {String(row.status).toUpperCase() === "WAITING_FOR_PICKUP" && (
            <>
              <Button
                size="small"
                variant="contained"
                onClick={() => onPickup?.(row)}
              >
                Xác nhận lấy
              </Button>

              <Button
                size="small"
                variant="outlined"
                color="error"
                sx={{ ml: 1 }}
                onClick={() => onCancel?.(row)}
              >
                Hủy phiếu
              </Button>
            </>
          )}

          {["BORROWING", "OVERDUE"].includes(
            String(row.status).toUpperCase()
          ) && (
              <Button
                size="small"
                variant="outlined"
                sx={{ ml: 1 }}
                onClick={() => onBulkReturn?.(row)}
              >
                Trả toàn bộ
              </Button>
            )}

          {/* NEW: nếu phiếu là ON_SITE, show nút Kết thúc đọc */}
          {String(row.status).toUpperCase() === "ON_SITE" && (
            <Button
              size="small"
              variant="contained"
              color="secondary"
              sx={{ ml: 1 }}
              onClick={() => onOpenFinishOnsite?.(row)}
            >
              Kết thúc đọc
            </Button>
          )}

          {isReturnedTab && hasViolations && (
            <Button
              size="small"
              variant="outlined"
              sx={{ ml: 1 }}
              onClick={() => onViewViolations?.(row)}
            >
              Xem vi phạm
            </Button>
          )}
        </TableCell>
      </TableRow>

      <TableRow>
        {/* colSpan = số cột header = 10 */}
        <TableCell colSpan={10} sx={{ p: 0, border: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ px: 2, py: 1.5, bgcolor: "rgba(0,0,0,0.02)" }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
                sx={{ mb: 2 }}
              >
                <Typography variant="subtitle2" fontWeight={700}>
                  Chi tiết phiếu
                </Typography>
                <Stack direction="row" spacing={2}>
                  <Typography variant="caption" color="text.secondary">
                    Tạo: {formatDate(row.created_at)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Cập nhật: {formatDate(row.updated_at)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Thủ thư: {librarianName}
                  </Typography>
                </Stack>
              </Stack>

              <Table
                size="small"
                sx={{
                  border: (t) => `1px solid ${t.palette.divider}`,
                  borderRadius: 1.5,
                  overflow: "hidden",
                  "& thead th": {
                    fontWeight: 700,
                    backgroundColor: "rgba(102,126,234,0.06)",
                    color: "#2D3748",
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>ID tài liệu</TableCell>
                    <TableCell>Tên tài liệu</TableCell>
                    <TableCell>Bìa</TableCell>
                    <TableCell>Mã vạch</TableCell>
                    <TableCell>Trạng thái</TableCell>
                    <TableCell>Ngày trả</TableCell>
                    <TableCell>Tiền phạt</TableCell>
                    <TableCell>Lượt gia hạn</TableCell>
                    <TableCell>Ghi chú</TableCell>
                    <TableCell align="right">Thao tác</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {(!row.details || row.details.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={11} align="center">
                        <Typography
                          variant="body2"
                          color="text.secondary"
                        >
                          Không có chi tiết
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    row.details.map((d) => {
                      const copy = d.DocumentCopy;
                      const doc = copy?.Document;

                      const documentId =
                        row.status === "PENDING"
                          ? parseRequestedDocumentId(d.note)
                          : doc?.documentId;

                      const title =
                        row.status === "PENDING"
                          ? documentId
                            ? titleCache.get(documentId) ?? "Đang tải..."
                            : "-"
                          : doc?.title || "-";

                      const cover =
                        row.status === "PENDING"
                          ? null
                          : doc?.coverPhoto || null;

                      // 🔥 xác định document nào đang yêu cầu hủy
                      const detailCancel = String(d.note || "").includes("[READER_CANCEL_REQUEST");

                      return (
                        <TableRow
                          key={d.loanDetailId}
                          hover
                          sx={
                            detailCancel
                              ? {
                                backgroundColor: "rgba(255,120,120,0.18)",
                                borderLeft: "4px solid #E53E3E",
                                "&:hover": { backgroundColor: "rgba(255,120,120,0.28)" },
                              }
                              : {}
                          }
                        >
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {d.loanDetailId}
                            </Typography>
                          </TableCell>

                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">
                              {documentId ?? "-"}
                            </Typography>
                          </TableCell>

                          <TableCell>
                            <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 200 }}>
                              {title}
                            </Typography>
                          </TableCell>

                          <TableCell>
                            {cover ? (
                              <img
                                src={cover}
                                alt={title}
                                loading="lazy"
                                style={{
                                  width: 36,
                                  height: 48,
                                  objectFit: "cover",
                                  borderRadius: 4,
                                  display: "block",
                                }}
                              />
                            ) : "-"}
                          </TableCell>

                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">
                              {copy?.barCode || "-"}
                            </Typography>
                          </TableCell>

                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              {chipForDetailStatus(d.status)}
                              {detailCancel && (
                                <Chip
                                  size="small"
                                  label="Độc giả yêu cầu hủy"
                                  color="error"
                                  sx={{ fontWeight: 700 }}
                                />
                              )}
                            </Stack>
                          </TableCell>

                          <TableCell>
                            <Typography variant="body2">{formatDate(d.returnDate)}</Typography>
                          </TableCell>

                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              <Money value={d.fineAmount} />
                            </Typography>
                          </TableCell>

                          <TableCell align="center">
                            <Chip label={d.renewalCount ?? 0} size="small" color="primary" sx={{ fontWeight: 600 }} />
                          </TableCell>

                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {d.note || "-"}
                            </Typography>
                          </TableCell>

                          <TableCell align="right">
                            {["BORROWED", "OVERDUE"].includes(String(d.status).toUpperCase()) && (
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => onSingleReturn?.(row, d)}
                                sx={{ mr: 1 }}
                              >
                                Trả
                              </Button>
                            )}
                            {row.status === "WAITING_FOR_PICKUP" && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                onClick={() => onDeleteDetail?.(row, d)}
                              >
                                Xóa
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function CancelReservationDialog1({ open, onClose, slip, onCancelled, librarianId: propLibrarianId }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const slipId = slip?.loanSlipId;

  async function handleSubmit() {
    if (!slipId) return;
    setLoading(true);
    setErrorMsg("");

    try {
      // Resolve librarianId: ưu tiên prop, fallback sessionStorage.profile
      let resolvedLibrarianId = null;

      if (typeof propLibrarianId !== "undefined" && propLibrarianId !== null) {
        resolvedLibrarianId = Number(propLibrarianId);
      } else {
        const raw = sessionStorage.getItem("profile");
        if (raw) {
          try {
            const profile = JSON.parse(raw);
            if (profile && (profile.librarianId || profile.librarian_id)) {
              resolvedLibrarianId = Number(profile.librarianId ?? profile.librarian_id);
            }
          } catch (e) {
            console.warn("CancelReservationDialog: cannot parse profile from sessionStorage", e);
          }
        }
      }

      if (resolvedLibrarianId == null) {
        setErrorMsg("Không xác định thủ thư (librarianId). Vui lòng đăng nhập lại.");
        setLoading(false);
        return;
      }

      const res = await cancelReservation(slipId, {
        librarianId: resolvedLibrarianId,
        reason: reason || undefined,
      });

      if (!res?.success) {
        setErrorMsg(res?.message || "Hủy phiếu thất bại");
        return;
      }

      onCancelled?.(res);
    } catch (e) {
      console.error("cancelReservation error", e);
      setErrorMsg(e?.message || "Lỗi khi hủy phiếu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) {
      setReason("");
      setLoading(false);
      setErrorMsg("");
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth>
      <DialogTitle>Hủy phiếu đặt trước #{slipId}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Bạn có chắc muốn hủy phiếu đặt trước này? Hành động này không thể
          hoàn tác.
        </Typography>
        <TextField
          label="Lý do hủy (tuỳ chọn)"
          fullWidth
          multiline
          minRows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          sx={{ mt: 1 }}
        />
        {errorMsg && (
          <Typography
            variant="body2"
            color="error"
            sx={{ mt: 1 }}
          >
            {errorMsg}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button disabled={loading} onClick={onClose}>
          Đóng
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={loading}
          onClick={handleSubmit}
        >
          {loading ? "Đang hủy..." : "Xác nhận hủy"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}


export default function Borrow() {
  const { user } = useAuth(); // lấy user từ AuthContext

  // ---------- helper: resolve librarianId from user/session ----------
  function resolveLibrarianId() {
    // 1) ưu tiên user.librarianId
    if (user && (user.librarianId || user.librarian_id)) {
      return Number(user.librarianId ?? user.librarian_id);
    }

    // 2) check sessionStorage.profile
    try {
      const profileRaw = sessionStorage.getItem("profile");
      if (profileRaw) {
        const profile = JSON.parse(profileRaw);
        if (profile && (profile.librarianId || profile.librarian_id)) {
          return Number(profile.librarianId ?? profile.librarian_id);
        }
      }
    } catch (e) {
      // ignore parse error
    }

    // 3) check sessionStorage.account (rare, if account contains librarianId)
    try {
      const accountRaw = sessionStorage.getItem("account");
      if (accountRaw) {
        const account = JSON.parse(accountRaw);
        if (account && (account.librarianId || account.librarian_id)) {
          return Number(account.librarianId ?? account.librarian_id);
        }
      }
    } catch (e) { }

    // not found
    return null;
  }

  // ---------- state ----------
  const [openCreate, setOpenCreate] = useState(false);
  const [openApprove, setOpenApprove] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState(null);

  const [openReturnSingle, setOpenReturnSingle] = useState(false);
  const [selectedDetailForReturn, setSelectedDetailForReturn] = useState(null);

  const [openReturnBulk, setOpenReturnBulk] = useState(false);
  const [selectedSlipForBulkReturn, setSelectedSlipForBulkReturn] =
    useState(null);

  // Cancel reservation (PENDING)
  const [openCancel, setOpenCancel] = useState(false);
  const [selectedSlipForCancel, setSelectedSlipForCancel] = useState(null);

  // Pickup dialog (WAITING_FOR_PICKUP)
  const [openPickup, setOpenPickup] = useState(false);
  const [selectedSlipForPickup, setSelectedSlipForPickup] = useState(null);

  // Cancel full slip (WAITING_FOR_PICKUP)
  const [openCancelSlip, setOpenCancelSlip] = useState(false);
  const [selectedSlipForCancelSlip, setSelectedSlipForCancelSlip] =
    useState(null);

  // Delete single detail (from waiting slip)
  const [openDeleteDetail, setOpenDeleteDetail] = useState(false);
  const [selectedDetailToDelete, setSelectedDetailToDelete] = useState(null);
  const [selectedSlipForDelete, setSelectedSlipForDelete] = useState(null);

  // Violation dialog (xem vi phạm của phiếu đã trả)
  const [openViolationDialog, setOpenViolationDialog] = useState(false);
  const [selectedSlipForViolations, setSelectedSlipForViolations] =
    useState(null);

  // Thanh toán vi phạm
  const [violationPaying, setViolationPaying] = useState(false);
  const [violationPayment, setViolationPayment] = useState(null);
  const [violationPayError, setViolationPayError] = useState("");

  // ----- NEW: states for On-site dialogs -----
  const [openCreateOnsite, setOpenCreateOnsite] = useState(false);
  const [openFinishOnsite, setOpenFinishOnsite] = useState(false);
  const [selectedSlipForFinish, setSelectedSlipForFinish] = useState(null);

  const [tab, setTab] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [totalPages, setTotalPages] = useState(1);

  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [titleCache, setTitleCache] = useState(() => new Map());

  const apiStatus = useMemo(() => tab, [tab]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchLoanSlips({
        page,
        limit,
        status: apiStatus,
        sortBy: "created_at", // sắp xếp theo createAt mới nhất
        sortDir: "DESC",
      });

      const data = Array.isArray(res?.data) ? res.data : [];
      setRows(data);
      setTotalPages(res?.pagination?.totalPages || 1);

      if (apiStatus === "PENDING") {
        const ids = new Set();
        for (const r of data) {
          for (const d of r.details || []) {
            const id = parseRequestedDocumentId(d.note);
            if (id) ids.add(id);
          }
        }
        if (ids.size) {
          const newCache = new Map(titleCache);
          await Promise.all(
            [...ids].map(async (id) => {
              if (!newCache.has(id)) {
                const doc = await getDocumentDetail(id);
                newCache.set(id, doc?.title || "(không tìm thấy)");
              }
            })
          );
          setTitleCache(newCache);
        } else {
          setTitleCache(new Map());
        }
      } else {
        setTitleCache(new Map());
      }
    } catch (e) {
      console.error(e);
      setRows([]);
      setTotalPages(1);
      setTitleCache(new Map());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page]);

  const filteredRows = useMemo(() => {
    let result = [...rows]; // FIX: clone rows

    if (searchQuery.trim()) {
      const kw = searchQuery.trim().toLowerCase();
      result = result.filter((r) => {
        const readerName = r.Reader?.fullName?.toLowerCase() || "";
        const readerId = String(r.readerId || "");
        return readerName.includes(kw) || readerId.includes(kw);
      });
    }

    if (startDate || endDate) {
      result = result.filter((r) => {
        if (!r.loanDate) return false;
        const loanDateStr = String(r.loanDate).slice(0, 10);
        if (startDate && loanDateStr < startDate) return false;
        if (endDate && loanDateStr > endDate) return false;
        return true;
      });
    }

    return result;
  }, [rows, searchQuery, startDate, endDate]);

  const displayRows = filteredRows;

  function handleOpenSingleReturn(slip, detail) {
    setSelectedDetailForReturn({ slip, detail });
    setOpenReturnSingle(true);
  }
  function handleCloseSingleReturn() {
    setOpenReturnSingle(false);
    setSelectedDetailForReturn(null);
  }

  function handleOpenBulkReturn(slip) {
    setSelectedSlipForBulkReturn(slip);
    setOpenReturnBulk(true);
  }
  function handleCloseBulkReturn() {
    setOpenReturnBulk(false);
    setSelectedSlipForBulkReturn(null);
  }

  // Cancel handlers (PENDING)
  function handleOpenCancel(slip) {
    setSelectedSlipForCancel(slip);
    setOpenCancel(true);
  }
  function handleCloseCancel() {
    setOpenCancel(false);
    setSelectedSlipForCancel(null);
  }

  // Pickup handlers - CHECK librarianId before opening dialog
  function handleOpenPickup(slip) {
    const libId = resolveLibrarianId();
    if (!libId) {
      alert(
        "Không xác định thủ thư. Tài khoản của bạn chưa được cấu hình là thủ thư. Vui lòng liên hệ quản trị viên."
      );
      return;
    }
    setSelectedSlipForPickup(slip);
    setOpenPickup(true);
  }
  function handleClosePickup() {
    setOpenPickup(false);
    setSelectedSlipForPickup(null);
  }

  // Cancel full slip (WAITING_FOR_PICKUP) - CHECK librarianId
  function handleOpenCancelSlip(slip) {
    const libId = resolveLibrarianId();
    if (!libId) {
      alert(
        "Không xác định thủ thư. Tài khoản của bạn chưa được cấu hình là thủ thư. Vui lòng liên hệ quản trị viên."
      );
      return;
    }
    setSelectedSlipForCancelSlip(slip);
    setOpenCancelSlip(true);
  }
  function handleCloseCancelSlip() {
    setOpenCancelSlip(false);
    setSelectedSlipForCancelSlip(null);
  }

  // Delete single detail handlers - CHECK librarianId
  function handleOpenDeleteDetail(slip, detail) {
    const libId = resolveLibrarianId();
    if (!libId) {
      alert(
        "Không xác định thủ thư. Tài khoản của bạn chưa được cấu hình là thủ thư. Vui lòng liên hệ quản trị viên."
      );
      return;
    }
    setSelectedSlipForDelete(slip);
    setSelectedDetailToDelete(detail);
    setOpenDeleteDetail(true);
  }
  function handleCloseDeleteDetail() {
    setOpenDeleteDetail(false);
    setSelectedSlipForDelete(null);
    setSelectedDetailToDelete(null);
  }

  function handleOpenViolationDialog(slip) {
    setSelectedSlipForViolations(slip);
    setViolationPayment(null);
    setViolationPayError("");
    setOpenViolationDialog(true);
  }
  function handleCloseViolationDialog() {
    setOpenViolationDialog(false);
    setSelectedSlipForViolations(null);
    setViolationPayment(null);
    setViolationPayError("");
  }

  async function handlePayViolations() {
    if (!selectedSlipForViolations) return;
    const resolvedLibrarianId = resolveLibrarianId();
    if (!resolvedLibrarianId) {
      alert(
        "Không xác định thủ thư. Vui lòng đăng nhập lại hoặc liên hệ admin."
      );
      return;
    }

    setViolationPaying(true);
    setViolationPayError("");
    setViolationPayment(null);

    try {
      const res = await createViolationPaymentForSlip(
        selectedSlipForViolations.loanSlipId,
        { librarianId: resolvedLibrarianId }
      );

      if (!res?.success) {
        setViolationPayError(
          res?.message || "Tạo thanh toán vi phạm thất bại"
        );
        return;
      }

      if (!res.needPayment) {
        await load();
        alert(res.message || "Các vi phạm của phiếu đã được thanh toán đủ.");
        handleCloseViolationDialog();
        return;
      }

      setViolationPayment(res.payment || null);
    } catch (err) {
      console.error("createViolationPaymentForSlip error", err);
      setViolationPayError(
        err?.message || "Lỗi khi tạo thanh toán vi phạm"
      );
    } finally {
      setViolationPaying(false);
    }
  }

  // Lấy librarianId đã resolve để truyền vào dialog/hàm service khác
  const resolvedLibrarianId = resolveLibrarianId();

  // ---------- NEW handlers for On-site flows ----------
  function handleOpenCreateOnsite() {
    if (!resolvedLibrarianId) {
      alert("Không xác định librarianId. Đăng nhập thủ thư hoặc lưu librarianId vào session.");
      return;
    }
    setOpenCreateOnsite(true);
  }
  function handleCloseCreateOnsite() {
    setOpenCreateOnsite(false);
  }
  function handleCreatedOnsite() {
    // reload list
    load();
  }

  function handleOpenFinishOnsite(slip) {
    if (!resolvedLibrarianId) {
      alert("Không xác định librarianId. Đăng nhập thủ thư hoặc lưu librarianId vào session.");
      return;
    }
    setSelectedSlipForFinish(slip);
    setOpenFinishOnsite(true);
  }
  function handleCloseFinishOnsite() {
    setSelectedSlipForFinish(null);
    setOpenFinishOnsite(false);
  }
  function handleFinishedOnsite() {
    load();
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          fontWeight="700"
          gutterBottom
          sx={{
            background: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Quản lý Mượn – Trả
        </Typography>
      </Box>

      <Card
        sx={{
          mb: 3,
          borderRadius: 3,
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
        }}
      >
        <CardContent>
          <Stack spacing={2}>
            {/* HÀNG ĐẦU TIÊN: TABS + NÚT HÀNH ĐỘNG */}
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={2}
              sx={{ width: "100%" }}
            >
              {/* LEFT — TABS */}
              <Tabs
                value={tab}
                onChange={(_e, v) => setTab(v)}
                variant="scrollable"
                allowScrollButtonsMobile
                sx={{
                  "& .MuiTab.root": {
                    fontWeight: 600,
                    textTransform: "none",
                    minHeight: 48,
                    "&.Mui-selected": { color: "#667EEA" },
                  },
                  "& .MuiTabs-indicator": {
                    background:
                      "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
                    height: 3,
                    borderRadius: "3px 3px 0 0",
                  },
                }}
              >
                {TABS.map((t) => (
                  <Tab key={t.key} value={t.key} label={t.label} />
                ))}
              </Tabs>

              {/* RIGHT — ACTION BUTTONS */}
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="contained"
                  onClick={() => setOpenCreate(true)}
                  sx={{
                    borderRadius: 2,
                    fontWeight: 700,
                    height: 40,
                    textTransform: "none",
                  }}
                >
                  Tạo phiếu mượn
                </Button>

                {/* NEW: Tạo phiếu đọc tại chỗ */}
                <Button
                  variant="contained"
                  color="warning"
                  onClick={handleOpenCreateOnsite}
                  sx={{
                    borderRadius: 2,
                    fontWeight: 700,
                    height: 40,
                    textTransform: "none",
                  }}
                >
                  Tạo phiếu đọc tại chỗ
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={load}
                  sx={{
                    borderRadius: 2,
                    borderColor: "#667EEA",
                    color: "#667EEA",
                    fontWeight: 600,
                    height: 40,
                    textTransform: "none",
                    "&:hover": {
                      borderColor: "#5A67D8",
                      backgroundColor: "rgba(102,126,234,0.04)",
                    },
                  }}
                >
                  Làm mới
                </Button>
              </Stack>
            </Stack>

            <Divider />

            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems="center"
            >
              <TextField
                placeholder="Tìm theo tên độc giả hoặc ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  flex: 1,
                  minWidth: { xs: "100%", md: 320 },
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    "&:hover fieldset": { borderColor: "#667EEA" },
                    "&.Mui-focused fieldset": { borderColor: "#667EEA" },
                  },
                }}
              />

              <TextField
                type="date"
                label="Từ ngày"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{
                  minWidth: { xs: "100%", md: 180 },
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    "&:hover fieldset": { borderColor: "#667EEA" },
                    "&.Mui-focused fieldset": { borderColor: "#667EEA" },
                  },
                }}
              />

              <TextField
                type="date"
                label="Đến ngày"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{
                  minWidth: { xs: "100%", md: 180 },
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    "&:hover fieldset": { borderColor: "#667EEA" },
                    "&.Mui-focused fieldset": { borderColor: "#667EEA" },
                  },
                }}
              />

              {(searchQuery || startDate || endDate) && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setSearchQuery("");
                    setStartDate("");
                    setEndDate("");
                  }}
                  sx={{
                    borderRadius: 2,
                    borderColor: "#E53E3E",
                    fontWeight: 600,
                    minWidth: { xs: "100%", md: "auto" },
                    "&:hover": {
                      borderColor: "#C53030",
                      backgroundColor: "rgba(229,62,62,0.04)",
                    },
                  }}
                >
                  Xóa bộ lọc
                </Button>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card
        sx={{
          borderRadius: 3,
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
          overflow: "hidden",
        }}
      >
        {loading && (
          <LinearProgress
            sx={{
              "& .MuiLinearProgress-bar": {
                background:
                  "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
              },
            }}
          />
        )}

        <TableContainer component={Paper} elevation={0}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "rgba(102,126,234,0.08)" }}>
                <TableCell />
                <TableCell sx={{ fontWeight: 700, color: "#2D3748" }}>
                  ID Phiếu
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#2D3748" }}>
                  Độc giả
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#2D3748" }}>
                  Thủ thư
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#2D3748" }}>
                  Ngày tạo
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#2D3748" }}>
                  Hạn trả
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#2D3748" }}>
                  Trạng thái
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#2D3748" }}>
                  Trạng thái VP
                </TableCell>
                <TableCell
                  align="center"
                  sx={{ fontWeight: 700, color: "#2D3748" }}
                >
                  Số đầu mục
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ fontWeight: 700, color: "#2D3748" }}
                >
                  Thao tác
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {displayRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
                    <Typography
                      variant="body1"
                      color="text.secondary"
                    >
                      {rows.length === 0
                        ? "Không có dữ liệu"
                        : "Không tìm thấy kết quả phù hợp"}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                displayRows.map((r) => (
                  <Row
                    key={r.loanSlipId}
                    row={r}
                    titleCache={titleCache}
                    onApprove={(slip) => {
                      setSelectedSlip(slip);
                      setOpenApprove(true);
                    }}
                    onCancel={(slip) => {
                      // phân biệt: nếu đang PENDING => cancelReservation; nếu WAITING_FOR_PICKUP => cancelLoanSlip
                      if (
                        String(slip.status).toUpperCase() === "PENDING"
                      )
                        handleOpenCancel(slip);
                      else handleOpenCancelSlip(slip);
                    }}
                    onPickup={(slip) => handleOpenPickup(slip)}
                    onSingleReturn={(slip, detail) =>
                      handleOpenSingleReturn(slip, detail)
                    }
                    onBulkReturn={(slip) => handleOpenBulkReturn(slip)}
                    onDeleteDetail={(slip, detail) =>
                      handleOpenDeleteDetail(slip, detail)
                    }
                    isReturnedTab={tab === "RETURNED"}
                    onViewViolations={handleOpenViolationDialog}
                    onOpenFinishOnsite={(slip) => {
                      // open finish onsite dialog
                      setSelectedSlipForFinish(slip);
                      setOpenFinishOnsite(true);
                    }}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {totalPages > 1 && (
          <Box
            sx={{
              p: 1.5,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Tổng: {rows.length} phiếu • Hiển thị: {displayRows.length} •
              Trang {page}/{totalPages}
            </Typography>

            <Pagination
              page={page}
              count={totalPages}
              onChange={(_e, val) => setPage(val)}
              color="primary"
              showFirstButton
              showLastButton
              sx={{
                "& .MuiPaginationItem-root": {
                  borderRadius: 2,
                  fontWeight: 600,
                },
                "& .MuiPaginationItem-root.Mui-selected": {
                  background:
                    "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
                  color: "white",
                },
              }}
            />
          </Box>
        )}
      </Card>

      <AddLoanSlipDialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreated={() => {
          setOpenCreate(false);
          load();
        }}
      />

      <ApproveReservationDialog
        open={openApprove}
        onClose={() => {
          setOpenApprove(false);
          setSelectedSlip(null);
        }}
        slip={selectedSlip}
        onApproved={() => {
          setOpenApprove(false);
          setSelectedSlip(null);
          load();
        }}
      />

      <ReturnSingleDialog
        open={openReturnSingle}
        onClose={() => handleCloseSingleReturn()}
        slip={selectedDetailForReturn?.slip}
        loanDetail={selectedDetailForReturn?.detail}
        onReturned={() => {
          handleCloseSingleReturn();
          load();
        }}
      />

      <ReturnBulkDialog
        open={openReturnBulk}
        onClose={() => handleCloseBulkReturn()}
        slip={selectedSlipForBulkReturn}
        onReturned={() => {
          handleCloseBulkReturn();
          load();
        }}
      />

      {/* Cancel Reservation Dialog (embedded) - dùng cho PENDING */}
      <CancelReservationDialog
        open={openCancel}
        onClose={() => handleCloseCancel()}
        slip={selectedSlipForCancel}
        librarianId={resolvedLibrarianId}
        onCancelled={() => {
          handleCloseCancel();
          load();
        }}
      />


      {/* Pickup dialog (WAITING_FOR_PICKUP) */}
      <PickupDialog
        open={openPickup}
        onClose={() => handleClosePickup()}
        slip={selectedSlipForPickup}
        librarianId={resolvedLibrarianId}
        onPicked={() => {
          handleClosePickup();
          load();
        }}
      />

      {/* Cancel full slip (WAITING_FOR_PICKUP) */}
      <CancelSlipDialog
        open={openCancelSlip}
        onClose={() => handleCloseCancelSlip()}
        slip={selectedSlipForCancelSlip}
        librarianId={resolvedLibrarianId}
        onCancelled={() => {
          handleCloseCancelSlip();
          load();
        }}
      />

      {/* Delete single detail dialog */}
      <DeleteDetailDialog
        open={openDeleteDetail}
        onClose={() => handleCloseDeleteDetail()}
        slip={selectedSlipForDelete}
        detail={selectedDetailToDelete}
        librarianId={resolvedLibrarianId}
        onDeleted={() => {
          handleCloseDeleteDetail();
          load();
        }}
      />

      {/* Violation dialog */}
      <ViolationDialog
        open={openViolationDialog}
        onClose={handleCloseViolationDialog}
        slip={selectedSlipForViolations}
        payment={violationPayment}
        paying={violationPaying}
        payError={violationPayError}
        onPay={handlePayViolations}
      />

      {/* ----------------- NEW: On-site dialogs ----------------- */}
      <CreateOnsiteDialog
        open={openCreateOnsite}
        onClose={handleCloseCreateOnsite}
        librarianId={resolvedLibrarianId}
        onCreated={() => {
          handleCloseCreateOnsite();
          load();
        }}
      />

      <OnsiteReturnDialog
        open={openFinishOnsite}
        onClose={handleCloseFinishOnsite}
        slip={selectedSlipForFinish}
        librarianId={resolvedLibrarianId}
        onFinished={() => {
          handleCloseFinishOnsite();
          load();
        }}
      />
    </Box>
  );
}
