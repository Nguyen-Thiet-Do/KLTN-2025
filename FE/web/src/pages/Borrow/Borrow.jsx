// src/pages/Borrow/Borrow.jsx
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
} from "@mui/material";
import {
  ExpandMore,
  ExpandLess,
  Refresh as RefreshIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { fetchLoanSlips, getDocumentDetail } from "../../services/loanSlips";
import AddLoanSlipDialog from "../Borrow/AddLoanSlipDialog";
import ApproveReservationDialog from "./ApproveReservationDialog";

/** Tabs theo chuẩn mới của BE */
const TABS = [
  { key: "PENDING", label: "Chờ duyệt" },
  { key: "PENDING_PAYMENT", label: "Chờ thanh toán" },
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

/** Hiển thị chip cho trạng thái Phiếu (LoanSlip.status) */
function chipForSlipStatus(status) {
  switch (status) {
    case "PENDING":
      return <Chip color="warning" label="Chờ duyệt" size="small" sx={{ fontWeight: 600 }} />;
    case "PENDING_PAYMENT":
      return <Chip color="info" label="Chờ thanh toán" size="small" sx={{ fontWeight: 600 }} />;
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

/** Hiển thị chip cho trạng thái Chi tiết (LoanDetail.status) */
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

function Row({ row, titleCache, onApprove }) {
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
                width: 24, height: 24,
                background: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
                fontSize: 12, fontWeight: 600
              }}
            >
              {(row.Reader?.fullName || "?").slice(0, 1)}
            </Avatar>
            <Box>
              <Typography variant="body2" fontWeight={600}>
                {row.Reader?.fullName || `Reader #${row.readerId}`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ID độc giả: {row.readerId}
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
              fontWeight: 700
            }}
          />
        </TableCell>
        {/* NEW: Thao tác */}
        <TableCell align="right">
          {String(row.status).toUpperCase() === "PENDING" && (
            <Button
              size="small"
              variant="contained"
              onClick={() => onApprove?.(row)}
            >
              Duyệt
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
                <Stack direction="row" spacing={2} divider={<Divider orientation="vertical" flexItem />}>
                  <Typography variant="caption" color="text.secondary">
                    Tạo lúc: {formatDate(row.created_at)}
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
                    color: "#2D3748"
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell>#Chi tiết</TableCell>
                    <TableCell>ID tài liệu</TableCell>
                    <TableCell>Tên tài liệu</TableCell>
                    <TableCell>Bìa</TableCell>
                    <TableCell>Mã vạch</TableCell>
                    <TableCell>Trạng thái</TableCell>
                    <TableCell>Ngày trả</TableCell>
                    <TableCell>Tiền cọc</TableCell>
                    <TableCell>Tiền phạt</TableCell>
                    <TableCell>Tình trạng mượn</TableCell>
                    <TableCell>Tình trạng trả</TableCell>
                    <TableCell>Gia hạn</TableCell>
                    <TableCell>Ghi chú</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(row.details || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} align="center" sx={{ py: 2 }}>
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
                      const title = row.status === "PENDING"
                        ? documentId
                          ? titleCache.get(documentId) ?? "Đang tải..."
                          : "-"
                        : doc?.title || "-";

                      const cover = row.status === "PENDING" ? null : doc?.coverPhoto || null;

                      return (
                        <TableRow key={d.loanDetailId} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>{d.loanDetailId}</Typography>
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
                            ) : "-"}
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
                            <Typography variant="body2" fontWeight={600}><Money value={d.depositAmount} /></Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}><Money value={d.fineAmount} /></Typography>
                          </TableCell>
                          <TableCell><Typography variant="body2">{d.conditionBorrow || "-"}</Typography></TableCell>
                          <TableCell><Typography variant="body2">{d.conditionReturn || "-"}</Typography></TableCell>
                          <TableCell align="center">
                            <Chip label={d.renewalCount ?? 0} size="small" color="primary" sx={{ fontWeight: 600 }} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">{d.note || "-"}</Typography>
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
  const [openCreate, setOpenCreate] = useState(false);

  // NEW: Approve dialog
  const [openApprove, setOpenApprove] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState(null);

  // TODO: Lấy từ auth/state thực tế
  const librarianId = 1;

  // Mặc định đứng ở tab "Chờ duyệt"
  const [tab, setTab] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // cache tiêu đề tài liệu cho các chi tiết PENDING
  const [titleCache, setTitleCache] = useState(() => new Map());

  // BE nhận đúng key theo tab
  const apiStatus = useMemo(() => tab, [tab]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchLoanSlips({
        page,
        limit,
        status: apiStatus,        // 'PENDING'|'PENDING_PAYMENT'|'BORROWING'|'RETURNED'|'OVERDUE'
        sortBy: "loanDate",
        sortDir: "DESC",
      });

      const data = Array.isArray(res?.data) ? res.data : [];
      setRows(data);
      setTotalPages(res?.pagination?.totalPages || 1);

      if (apiStatus === "PENDING") {
        // gom danh sách documentId cần tra cứu từ note
        const ids = new Set();
        for (const r of data) {
          for (const d of r.details || []) {
            const id = parseRequestedDocumentId(d.note);
            if (id) ids.add(id);
          }
        }
        if (ids.size) {
          const newCache = new Map(titleCache); // giữ cache cũ
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
    load(); // load khi đổi tab hoặc trang
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page]);

  // Filter rows client-side
  const filteredRows = useMemo(() => {
    let result = [...rows];

    // Filter theo từ khóa (tên độc giả hoặc ID)
    if (searchQuery.trim()) {
      const kw = searchQuery.trim().toLowerCase();
      result = result.filter((r) => {
        const readerName = r.Reader?.fullName?.toLowerCase() || "";
        const readerId = String(r.readerId || "");
        return readerName.includes(kw) || readerId.includes(kw);
      });
    }

    // Filter theo khoảng ngày (loanDate)
    if (startDate || endDate) {
      result = result.filter((r) => {
        if (!r.loanDate) return false;
        const loanDateStr = String(r.loanDate).slice(0, 10); // YYYY-MM-DD
        if (startDate && loanDateStr < startDate) return false;
        if (endDate && loanDateStr > endDate) return false;
        return true;
      });
    }

    return result;
  }, [rows, searchQuery, startDate, endDate]);

  const displayRows = filteredRows;

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
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems="center"
              justifyContent="space-between"
            >
              <Tabs
                value={tab}
                onChange={(_e, v) => setTab(v)}
                variant="scrollable"
                allowScrollButtonsMobile
                sx={{
                  "& .MuiTab-root": {
                    fontWeight: 600,
                    textTransform: "none",
                    minHeight: 48,
                    "&.Mui-selected": { color: "#667EEA" }
                  },
                  "& .MuiTabs-indicator": {
                    background: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
                    height: 3,
                    borderRadius: "3px 3px 0 0"
                  }
                }}
              >
                {TABS.map((t) => (
                  <Tab key={t.key} value={t.key} label={t.label} />
                ))}
              </Tabs>

              <Button variant="contained" onClick={() => setOpenCreate(true)} sx={{ borderRadius: 2, fontWeight: 700 }}>
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
                  "&:hover": { borderColor: "#5A67D8", backgroundColor: "rgba(102,126,234,0.04)" },
                }}
              >
                Làm mới
              </Button>
            </Stack>

            <Divider />

            {/* Filters */}
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
              <TextField
                placeholder="Tìm theo tên độc giả, ID..."
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
                    "&.Mui-focused fieldset": { borderColor: "#667EEA" }
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
                    "&.Mui-focused fieldset": { borderColor: "#667EEA" }
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
                    "&.Mui-focused fieldset": { borderColor: "#667EEA" }
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
                {/* NEW */}
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

      {/* NEW: Dialog duyệt */}
      <ApproveReservationDialog
        open={openApprove}
        onClose={() => { setOpenApprove(false); setSelectedSlip(null); }}
        slip={selectedSlip}
        librarianId={librarianId}
        onApproved={() => { setOpenApprove(false); setSelectedSlip(null); load(); }}
      />
    </Box>
  );
}
