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
import {
  fetchLoanSlips,
  getDocumentDetail,
  cancelReservation,
} from "../../services/loanSlips";
import AddLoanSlipDialog from "../Borrow/AddLoanSlipDialog";
import ApproveReservationDialog from "./ApproveReservationDialog";
import ReturnSingleDialog from "./ReturnSingleDialog";
import ReturnBulkDialog from "./ReturnBulkDialog";
import PickupDialog from "./PickupDialog";
import CancelSlipDialog from "./CancelSlipDialog";
import DeleteDetailDialog from "./DeleteDetailDialog";
import { useAuth } from "../../contexts/AuthContext"; // điều chỉnh path nếu khác

const TABS = [
  { key: "PENDING", label: "Chờ duyệt" },
  { key: "WAITING_FOR_PICKUP", label: "Chờ đến lấy" },
  { key: "BORROWING", label: "Đang mượn" },
  { key: "RETURNED", label: "Đã trả" },
  { key: "OVERDUE", label: "Quá hạn" },
];

const nf = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

function formatDate(d) {
  if (!d) return "-";
  const s = String(d).slice(0, 19).replace(" ", "T");
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? String(d) : dt.toLocaleString("vi-VN");
}

function chipForSlipStatus(status) {
  switch (status) {
    case "PENDING":
      return <Chip color="warning" label="Chờ duyệt" size="small" sx={{ fontWeight: 600 }} />;
    case "WAITING_FOR_PICKUP":
      return <Chip color="info" label="Chờ đến lấy" size="small" sx={{ fontWeight: 600 }} />;
    case "BORROWING":
      return <Chip color="primary" label="Đang mượn" size="small" sx={{ fontWeight: 600 }} />;
    case "RETURNED":
      return <Chip color="success" label="Đã trả" size="small" sx={{ fontWeight: 600 }} />;
    case "OVERDUE":
      return <Chip color="error" label="Quá hạn" size="small" sx={{ fontWeight: 600 }} />;
    default:
      return <Chip label={status || "Không rõ"} size="small" sx={{ fontWeight: 600 }} />;
  }
}

function chipForDetailStatus(status) {
  switch (status) {
    case "PENDING":
      return <Chip size="small" color="warning" label="Chờ duyệt" sx={{ fontWeight: 600 }} />;
    case "BORROWED":
      return <Chip size="small" color="primary" label="Đang mượn" sx={{ fontWeight: 600 }} />;
    case "RETURNED":
      return <Chip size="small" color="success" label="Đã trả" sx={{ fontWeight: 600 }} />;
    default:
      return <Chip size="small" label={status || "-"} sx={{ fontWeight: 600 }} />;
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
 * Row component
 * thêm props: onPickup, onDeleteDetail
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
}) {
  const [open, setOpen] = useState(false);
  const librarianName = row?.Librarian?.fullName || (row?.librarianId ? `#${row.librarianId}` : "-");

  return (
    <>
      <TableRow hover>
        <TableCell width={40}>
          <IconButton
            size="small"
            onClick={() => setOpen((v) => !v)}
            sx={{ color: "#667EEA", "&:hover": { backgroundColor: "rgba(102,126,234,0.08)" } }}
            aria-label={open ? "Thu gọn" : "Mở rộng"}
          >
            {open ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </TableCell>

        <TableCell>
          <Typography variant="body2" fontWeight={600} sx={{ fontFamily: "monospace", fontSize: 13 }}>
            #{row.loanSlipId}
          </Typography>
        </TableCell>

        <TableCell>
          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar
              sx={{
                width: 24,
                height: 24,
                background: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
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
          <Typography variant="body2">{formatDate(row.loanDate)}</Typography>
        </TableCell>

        <TableCell>
          <Typography variant="body2">{formatDate(row.dueDate)}</Typography>
        </TableCell>

        <TableCell>{chipForSlipStatus(row.status)}</TableCell>

        <TableCell align="center">
          <Chip
            label={Array.isArray(row.details) ? row.details.length : 0}
            size="small"
            sx={{
              background: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
              color: "white",
              fontWeight: 700,
            }}
          />
        </TableCell>

        <TableCell align="right">
          {String(row.status).toUpperCase() === "PENDING" && (
            <>
              <Button size="small" variant="contained" onClick={() => onApprove?.(row)}>
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
              <Button size="small" variant="contained" onClick={() => onPickup?.(row)}>
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

          {String(row.status).toUpperCase() === "BORROWING" && (
            <Button
              size="small"
              variant="outlined"
              sx={{ ml: 1 }}
              onClick={() => onBulkReturn?.(row)}
            >
              Trả toàn bộ
            </Button>
          )}
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={9} sx={{ p: 0, border: 0 }}>
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
                    <TableCell>Gia hạn</TableCell>
                    <TableCell>Ghi chú</TableCell>
                    <TableCell align="right">Hành động</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {(row.details || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} align="center" sx={{ py: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Chưa có bản ghi
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    row.details.map((d) => {
                      const requestedId = row.status === "PENDING" ? parseRequestedDocumentId(d.note) : null;
                      const copy = d.DocumentCopy;
                      const doc = copy?.Document;
                      const documentId = requestedId ?? doc?.documentId ?? null;
                      const title =
                        row.status === "PENDING"
                          ? documentId
                            ? titleCache.get(documentId) ?? "Đang tải..."
                            : "-"
                          : doc?.title || "-";
                      const cover = row.status === "PENDING" ? null : doc?.coverPhoto || null;

                      return (
                        <TableRow key={d.loanDetailId} hover>
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
                                style={{ width: 36, height: 48, objectFit: "cover", borderRadius: 4, display: "block" }}
                              />
                            ) : (
                              "-"
                            )}
                          </TableCell>

                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">
                              {copy?.barCode || "-"}
                            </Typography>
                          </TableCell>

                          <TableCell>{chipForDetailStatus(d.status)}</TableCell>

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
                            {String(d.status) === "BORROWED" && (
                              <Button size="small" variant="outlined" onClick={() => onSingleReturn?.(row, d)}>
                                Trả
                              </Button>
                            )}

                            {row.status === "WAITING_FOR_PICKUP" && (
                              <Button size="small" variant="outlined" color="error" onClick={() => onDeleteDetail?.(row, d)}>
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
  const [selectedSlipForBulkReturn, setSelectedSlipForBulkReturn] = useState(null);

  // Cancel reservation (PENDING)
  const [openCancel, setOpenCancel] = useState(false);
  const [selectedSlipForCancel, setSelectedSlipForCancel] = useState(null);

  // Pickup dialog (WAITING_FOR_PICKUP)
  const [openPickup, setOpenPickup] = useState(false);
  const [selectedSlipForPickup, setSelectedSlipForPickup] = useState(null);

  // Cancel full slip (WAITING_FOR_PICKUP)
  const [openCancelSlip, setOpenCancelSlip] = useState(false);
  const [selectedSlipForCancelSlip, setSelectedSlipForCancelSlip] = useState(null);

  // Delete single detail (from waiting slip)
  const [openDeleteDetail, setOpenDeleteDetail] = useState(false);
  const [selectedDetailToDelete, setSelectedDetailToDelete] = useState(null);
  const [selectedSlipForDelete, setSelectedSlipForDelete] = useState(null);

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
        sortBy: "loanDate",
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
  }, [tab, page]);

  const filteredRows = useMemo(() => {
    let result = [...rows];

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
      alert("Không xác định thủ thư. Tài khoản của bạn chưa được cấu hình là thủ thư. Vui lòng liên hệ quản trị viên.");
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
      alert("Không xác định thủ thư. Tài khoản của bạn chưa được cấu hình là thủ thư. Vui lòng liên hệ quản trị viên.");
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
      alert("Không xác định thủ thư. Tài khoản của bạn chưa được cấu hình là thủ thư. Vui lòng liên hệ quản trị viên.");
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

  // Lấy librarianId đã resolve để truyền vào dialog/hàm service
  const resolvedLibrarianId = resolveLibrarianId();

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

      <Card sx={{ mb: 3, borderRadius: 3, boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }}>
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
                    background: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
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
                    "&:hover": { borderColor: "#5A67D8", backgroundColor: "rgba(102,126,234,0.04)" },
                  }}
                >
                  Làm mới
                </Button>
              </Stack>
            </Stack>

            <Divider />

            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
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
                    color: "#E53E3E",
                    fontWeight: 600,
                    minWidth: { xs: "100%", md: "auto" },
                    "&:hover": { borderColor: "#C53030", backgroundColor: "rgba(229,62,62,0.04)" },
                  }}
                >
                  Xóa bộ lọc
                </Button>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3, boxShadow: "0 8px 32px rgba(0,0,0,0.1)", overflow: "hidden" }}>
        {loading && (
          <LinearProgress
            sx={{ "& .MuiLinearProgress-bar": { background: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)" } }}
          />
        )}

        <TableContainer component={Paper} elevation={0}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "rgba(102,126,234,0.08)" }}>
                <TableCell />
                <TableCell sx={{ fontWeight: 700, color: "#2D3748" }}>ID Phiếu</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#2D3748" }}>Độc giả</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#2D3748" }}>Thủ thư</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#2D3748" }}>Ngày tạo</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#2D3748" }}>Hạn trả</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#2D3748" }}>Trạng thái</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: "#2D3748" }}>Số đầu mục</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: "#2D3748" }}>Thao tác</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {displayRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                    <Typography variant="body1" color="text.secondary">
                      {rows.length === 0 ? "Không có dữ liệu" : "Không tìm thấy kết quả phù hợp"}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                displayRows.map((r) => (
                  <Row
                    key={r.loanSlipId}
                    row={r}
                    titleCache={titleCache}
                    onApprove={(slip) => { setSelectedSlip(slip); setOpenApprove(true); }}
                    onCancel={(slip) => {
                      // phân biệt: nếu đang PENDING => cancelReservation; nếu WAITING_FOR_PICKUP => cancelLoanSlip
                      if (String(slip.status).toUpperCase() === "PENDING") handleOpenCancel(slip);
                      else handleOpenCancelSlip(slip);
                    }}
                    onPickup={(slip) => handleOpenPickup(slip)}
                    onSingleReturn={(slip, detail) => handleOpenSingleReturn(slip, detail)}
                    onBulkReturn={(slip) => handleOpenBulkReturn(slip)}
                    onDeleteDetail={(slip, detail) => handleOpenDeleteDetail(slip, detail)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {totalPages > 1 && (
          <Box sx={{ p: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Tổng: {rows.length} phiếu • Hiển thị: {displayRows.length} • Trang {page}/{totalPages}
            </Typography>

            <Pagination
              page={page}
              count={totalPages}
              onChange={(_e, val) => setPage(val)}
              color="primary"
              showFirstButton
              showLastButton
              sx={{
                "& .MuiPaginationItem-root": { borderRadius: 2, fontWeight: 600 },
                "& .MuiPaginationItem-root.Mui-selected": {
                  background: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
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
        onCreated={() => { setOpenCreate(false); load(); }}
      />

      <ApproveReservationDialog
        open={openApprove}
        onClose={() => { setOpenApprove(false); setSelectedSlip(null); }}
        slip={selectedSlip}
        onApproved={() => { setOpenApprove(false); setSelectedSlip(null); load(); }}
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
        onCancelled={(resp) => {
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
        onPicked={() => { handleClosePickup(); load(); }}
      />

      {/* Cancel full slip (WAITING_FOR_PICKUP) */}
      <CancelSlipDialog
        open={openCancelSlip}
        onClose={() => handleCloseCancelSlip()}
        slip={selectedSlipForCancelSlip}
        librarianId={resolvedLibrarianId}
        onCancelled={() => { handleCloseCancelSlip(); load(); }}
      />

      {/* Delete single detail (from waiting slip) */}
      <DeleteDetailDialog
        open={openDeleteDetail}
        onClose={() => handleCloseDeleteDetail()}
        slip={selectedSlipForDelete}
        detail={selectedDetailToDelete}
        librarianId={resolvedLibrarianId}
        onDeleted={() => { handleCloseDeleteDetail(); load(); }}
      />
    </Box>
  );
}

/**
 * CancelReservationDialog (embedded component)
 * Gọi API cancelReservation (DELETE) từ services/loanSlips
 * Dành cho PENDING (phiếu chưa gán bản sao)
 */
function CancelReservationDialog({ open, onClose, slip, librarianId, onCancelled }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const slipId = slip?.loanSlipId ?? null;

  useEffect(() => {
    if (!open) {
      setReason("");
      setSubmitting(false);
    }
  }, [open]);

  async function handleConfirm() {
    if (!slipId) return;
    if (!librarianId) {
      alert("Không xác định thủ thư (librarianId). Vui lòng đăng nhập lại hoặc liên hệ admin.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await cancelReservation(slipId, { librarianId, reason });
      if (res && res.success) {
        if (onCancelled) onCancelled(res);
      } else {
        alert(res?.message || "Hủy phiếu thất bại");
      }
    } catch (err) {
      console.error("cancelReservation error", err);
      alert(err?.message || "Lỗi khi hủy phiếu");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={Boolean(open)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Hủy phiếu đặt trước #{slipId ?? ""}</DialogTitle>
      <DialogContent>
        <Stack spacing={1} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Hủy phiếu đặt trước sẽ xóa các bản ghi đặt (LoanDetail) liên quan và gửi thông báo tới độc giả.
            Vui lòng nhập lý do (tùy chọn) để lưu vào ghi chú phiếu.
          </Typography>
          <TextField
            label="Lý do hủy (tùy chọn)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            sx={{ mt: 1 }}
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>Đóng</Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleConfirm}
          disabled={submitting}
        >
          {submitting ? "Đang xử lý..." : "Xác nhận hủy"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
