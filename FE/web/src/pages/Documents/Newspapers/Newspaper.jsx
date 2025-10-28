import { useEffect, useMemo, useState } from "react";
import {
  Box, Typography, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, Paper, IconButton, Alert, Pagination, Stack, Tooltip,
  Link as MuiLink, Chip, Collapse, LinearProgress,
} from "@mui/material";
import {
  Add as AddIcon, Search as SearchIcon, FilterList as FilterIcon,
  Refresh as RefreshIcon, OpenInNew as OpenInNewIcon,
  KeyboardArrowDown as ArrowDownIcon, KeyboardArrowUp as ArrowUpIcon,
  MoreVert as MoreVertIcon,
} from "@mui/icons-material";
import ButtonLoader from "../../../components/Loading/ButtonLoader";
import NewspaperDetailPanel from "./NewspaperDetailPanel";
import {
  getAllNewspapers,
  getNewspaperCopies,
} from "../../../services/newpaperService";

const ITEMS_PER_PAGE = 5;

const formatVND = (v) =>
  v === null || v === undefined
    ? "—"
    : new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v);

function statusColor(s) {
  switch (String(s || "").toUpperCase()) {
    case "AVAILABLE": return "success";
    case "BORROWED": return "warning";
    case "MAINTENANCE":
    case "REPAIR": return "info";
    case "LOST": return "error";
    default: return "default";
  }
}

const toDateVN = (s) => {
  if (!s) return "—";
  // "2025-10-24 00:00:00" → "2025-10-24T00:00:00"
  const d = new Date(s.replace(" ", "T"));
  return isNaN(d) ? s : d.toLocaleDateString("vi-VN");
};

export default function Newspaper() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE);

  // Drawer
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  // Expand rows + copies
  const [expanded, setExpanded] = useState({});
  const [copiesMap, setCopiesMap] = useState({});

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");
      const list = await getAllNewspapers();
      setItems(list);
      setCurrentPage(1);
    } catch (e) {
      setError(e.message || "Không tải được danh sách báo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Lọc theo tiêu đề / số phát hành / NXB
  const filtered = useMemo(() => {
    const kw = searchQuery.trim().toLowerCase();
    if (!kw) return items;
    return items.filter((n) => {
      const title = (n.title || "").toLowerCase();
      const issue = String(n.newspaper?.issueNumber || "").toLowerCase();
      const publisher = (n.publisher?.name || "").toLowerCase();
      const issn = (n.newspaper?.issn || "").toLowerCase();
      return (
        title.includes(kw) ||
        issue.includes(kw) ||
        publisher.includes(kw) ||
        issn.includes(kw)
      );
    });
  }, [items, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const start = (currentPage - 1) * itemsPerPage;
  const pageItems = filtered.slice(start, start + itemsPerPage);

  const openDetail = (it) => {
    setSelectedId(it.documentId);
    setSelectedItem(it);
    setDetailOpen(true);
  };

  const toggleExpand = async (it) => {
    const id = it.documentId;
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
    if (!copiesMap[id]) {
      setCopiesMap((p) => ({ ...p, [id]: { loading: true, error: "", data: null } }));
      try {
        const data = await getNewspaperCopies(id);
        setCopiesMap((p) => ({ ...p, [id]: { loading: false, error: "", data } }));
      } catch (e) {
        setCopiesMap((p) => ({ ...p, [id]: { loading: false, error: e.message || "Lỗi tải copies", data: null } }));
      }
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
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
          Quản lý Báo
        </Typography>
      </Box>

      {/* Toolbar */}
      <Card sx={{ mb: 3, borderRadius: 3, boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={2}>
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchAll}
                sx={{ borderRadius: 2, borderColor: "#667EEA", color: "#667EEA", fontWeight: 600,
                  "&:hover": { borderColor: "#5A67D8", backgroundColor: "rgba(102,126,234,0.04)" }, }}>
                Làm mới
              </Button>
              <Button variant="contained" startIcon={<AddIcon />} disabled
                sx={{ borderRadius: 2, background: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
                  fontWeight: 600, boxShadow: "0 4px 12px rgba(102,126,234,0.3)" }}>
                Thêm Báo (ẩn)
              </Button>
            </Stack>

            <TextField
              placeholder="Tìm theo tiêu đề, số phát hành, NXB, ISSN…"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small"><FilterIcon /></IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 360, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Loading & Error */}
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
          <ButtonLoader inline size={350} />
        </Box>
      )}
      {!!error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      {/* Table */}
      {!loading && !error && (
        <Card sx={{ borderRadius: 3, boxShadow: "0 8px 32px rgba(0,0,0,0.1)", overflow: "hidden" }}>
          <TableContainer component={Paper} elevation={0}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "rgba(102,126,234,0.08)" }}>
                  <TableCell />
                  <TableCell sx={{ fontWeight: 700 }}>Id</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Bìa</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Tiêu đề</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Số PH</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Ngày PH</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Số bản</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Hành động</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageItems.length === 0 ? (
                  <TableRow><TableCell colSpan={8} sx={{ textAlign: "center", py: 4 }}>
                    <Typography color="text.secondary">Không có dữ liệu báo</Typography>
                  </TableCell></TableRow>
                ) : (
                  pageItems.map((n) => {
                    const id = n.documentId;
                    const isOpen = !!expanded[id];
                    const copiesState = copiesMap[id] || { loading: false, error: "", data: null };
                    return (
                      <FragmentRow
                        key={id}
                        item={n}
                        isOpen={isOpen}
                        onToggle={() => toggleExpand(n)}
                        onOpenDetail={() => openDetail(n)}
                        copiesState={copiesState}
                      />
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ p: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="body2" color="text.secondary">
                Tổng: {filtered.length} báo • Trang {currentPage}/{totalPages}
              </Typography>

              <Stack direction="row" spacing={2} alignItems="center">
                <Stack direction="row" spacing={1}>
                  {[5, 10, 20].map((n) => (
                    <Button key={n} size="small"
                      variant={itemsPerPage === n ? "contained" : "outlined"}
                      onClick={() => { setItemsPerPage(n); setCurrentPage(1); }}
                      sx={{ borderRadius: 2 }}>
                      {n}/trang
                    </Button>
                  ))}
                </Stack>
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  onChange={(_, p) => setCurrentPage(p)}
                  color="primary" showFirstButton showLastButton
                  sx={{ "& .MuiPaginationItem-root": { borderRadius: 2, fontWeight: 600 } }}
                />
              </Stack>
            </Box>
          )}
        </Card>
      )}

      {/* Panel chi tiết */}
      <NewspaperDetailPanel open={detailOpen} onClose={() => setDetailOpen(false)} id={selectedId} initialItem={selectedItem} />
    </Box>
  );
}

/** -------- Hàng + Collapse -------- */
function FragmentRow({ item, isOpen, onToggle, onOpenDetail, copiesState }) {
  const id = item.documentId;
  return (
    <>
      <TableRow hover>
        <TableCell width={40}>
          <IconButton size="small" onClick={onToggle} aria-label="expand row">
            {isOpen ? <ArrowUpIcon /> : <ArrowDownIcon />}
          </IconButton>
        </TableCell>

        <TableCell width={240}>
          <MuiLink component="button" type="button" onClick={onOpenDetail} underline="hover"
            sx={{ fontFamily: "monospace", fontSize: 13, cursor: "pointer" }} title="Xem chi tiết">
            {id}
          </MuiLink>
        </TableCell>

        <TableCell width={76}>
          <img
            src={item.coverPhoto || "https://via.placeholder.com/48x64?text=No+Cover"}
            alt="cover" loading="lazy"
            style={{ width: 48, height: 64, objectFit: "cover", borderRadius: 4, display: "block" }}
          />
        </TableCell>

        <TableCell sx={{ maxWidth: 520 }}>
          <Typography fontWeight={600} noWrap title={item.title}>{item.title}</Typography>
        </TableCell>

        <TableCell align="center" width={90}>{item.newspaper?.issueNumber ?? "—"}</TableCell>
        <TableCell align="center" width={120}>{toDateVN(item.newspaper?.issueDate)}</TableCell>
        <TableCell align="center" width={90}>{item.numberOfCopy ?? 0}</TableCell>

        <TableCell align="center" width={100}>
          <Tooltip title={item.ebookUrl ? "Mở eBook" : "Chưa có eBook"}>
            <span>
              <IconButton size="small" href={item.ebookUrl || undefined} target="_blank" rel="noopener"
                disabled={!item.ebookUrl} sx={{ color: "#667EEA" }}>
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={8} sx={{ p: 0, border: 0 }}>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <Box sx={{ px: 2, py: 1.5, bgcolor: "rgba(0,0,0,0.02)" }}>
              {copiesState.loading && (
                <Box sx={{ py: 2, textAlign: "center" }}>
                  <Typography variant="body2" color="text.secondary">Đang tải danh sách bản sao…</Typography>
                </Box>
              )}
              {!!copiesState.error && <Alert severity="error" sx={{ mb: 1 }}>{copiesState.error}</Alert>}

              {!copiesState.loading && !copiesState.error && (
                <Table
                  size="small"
                  sx={{
                    border: (t) => `1px solid ${t.palette.divider}`,
                    borderRadius: 1.5,
                    overflow: "hidden",
                    "& thead th": { fontWeight: 700, backgroundColor: "rgba(102,126,234,0.06)" },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell>Copy ID</TableCell>
                      <TableCell>BarCode</TableCell>
                      <TableCell>Trạng thái</TableCell>
                      <TableCell>Tình trạng</TableCell>
                      <TableCell>Ngày nhập</TableCell>
                      <TableCell align="right">Tiền cọc</TableCell>
                      <TableCell align="center" width={64}>Hành động</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(copiesState?.data?.copies || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} sx={{ textAlign: "center", py: 2 }}>
                          <Typography variant="body2" color="text.secondary">Chưa có bản sao</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      copiesState.data.copies.map((c) => {
                        const percent = Number(c.conditionNote) || 0;
                        const d = c.entryDate ? new Date(c.entryDate).toLocaleDateString("vi-VN") : "—";
                        return (
                          <TableRow key={c.documentCopyId} hover>
                            <TableCell>{c.documentCopyId}</TableCell>
                            <TableCell><Typography fontFamily="monospace">{c.barCode}</Typography></TableCell>
                            <TableCell><Chip size="small" color={statusColor(c.status)} label={c.status} /></TableCell>
                            <TableCell sx={{ minWidth: 160 }}>
                              <Stack spacing={0.5}>
                                <Typography variant="body2">{percent}%</Typography>
                                <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, percent))} sx={{ height: 6, borderRadius: 1.5 }} />
                              </Stack>
                            </TableCell>
                            <TableCell>{d}</TableCell>
                            <TableCell align="right">{formatVND(c.deposit)}</TableCell>
                            <TableCell align="center" width={64}>
                              <Tooltip title="Tùy chọn">
                                <IconButton size="small" onClick={() => console.log("More actions for copy:", c.documentCopyId)}>
                                  <MoreVertIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}
