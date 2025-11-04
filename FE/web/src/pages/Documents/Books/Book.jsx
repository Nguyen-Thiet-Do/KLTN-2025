import { useEffect, useMemo, useState } from "react";
import {
  Box, Typography, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, Paper, IconButton, Alert, Pagination, Stack, Tooltip,
  Link as MuiLink, Chip, Collapse, LinearProgress, Menu, MenuItem, Divider
} from "@mui/material";
import {
  Add as AddIcon, Search as SearchIcon, FilterList as FilterIcon,
  Refresh as RefreshIcon, KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon, MoreVert as MoreVertIcon,
} from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { getAllBooks, getBookCopies, addBookCopies } from "../../../services/bookService";
import ButtonLoader from "../../../components/Loading/ButtonLoader";
import BookDetailPanel from "./BookDetailPanel";
import BookCreateDialog from "./BookCreateDialog";
import AddCopyDialog from "./AddCopyDialog";
import EditBookDialog from "./EditBookDialog";

const ITEMS_PER_PAGE = 5;

const formatVND = (v) =>
  v === null || v === undefined
    ? "—"
    : new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v);

function authorNames(authors = []) {
  if (!authors.length) return "Chưa cập nhật";
  return [...authors].sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0)).map((a) => a.fullName).join(", ");
}

const statusColor = (s) => {
  switch (String(s || "").toUpperCase()) {
    case "AVAILABLE": return "success";
    case "BORROWED": return "warning";
    case "MAINTENANCE":
    case "REPAIR": return "info";
    case "LOST": return "error";
    default: return "default";
  }
};

export default function Book() {
  const { enqueueSnackbar } = useSnackbar();

  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);

  // Sửa sách
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const [expanded, setExpanded] = useState({});
  const [copiesMap, setCopiesMap] = useState({});

  const [createOpen, setCreateOpen] = useState(false);

  // Row menu
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuRow, setMenuRow] = useState(null);

  // Add-copy dialog
  const [addDlgOpen, setAddDlgOpen] = useState(false);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");
      const list = await getAllBooks();
      setBooks(list);
      setCurrentPage(1);
    } catch (e) {
      setError(e.message || "Không tải được danh sách sách.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(() => {
    const kw = searchQuery.trim().toLowerCase();
    if (!kw) return books;
    return books.filter((b) => {
      const title = b.title?.toLowerCase() || "";
      const authors = authorNames(b.authors).toLowerCase();
      return title.includes(kw) || authors.includes(kw);
    });
  }, [books, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const start = (currentPage - 1) * itemsPerPage;
  const pageItems = filtered.slice(start, start + itemsPerPage);

  const openDetail = (book) => {
    setSelectedId(book.documentId);
    setSelectedBook(book);
    setDetailOpen(true);
  };

  const toggleExpand = async (book) => {
    const id = book.documentId;
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
    if (!copiesMap[id]) {
      setCopiesMap((p) => ({ ...p, [id]: { loading: true, error: "", data: null } }));
      try {
        const data = await getBookCopies(id);
        setCopiesMap((p) => ({ ...p, [id]: { loading: false, error: "", data } }));
      } catch (e) {
        setCopiesMap((p) => ({ ...p, [id]: { loading: false, error: e.message || "Lỗi tải copies", data: null } }));
      }
    }
  };

  // Row menu
  const openMenu = (event, row) => { setMenuAnchor(event.currentTarget); setMenuRow(row); };
  const closeMenu = () => { setMenuAnchor(null); /* giữ menuRow cho AddCopy & Edit */ };

  const onMenuViewEbook = () => {
    closeMenu();
    if (!menuRow?.ebookUrl) { enqueueSnackbar("Chưa có eBook.", { variant: "info" }); return; }
    window.open(menuRow.ebookUrl, "_blank", "noopener");
  };

  const onMenuAddCopy = () => { setAddDlgOpen(true); closeMenu(); };
  const onMenuEdit = () => {
    setEditRow(menuRow);
    setEditOpen(true);
    closeMenu();
  };
  const onMenuDelete = () => { enqueueSnackbar("Chức năng xoá đang phát triển.", { variant: "info" }); closeMenu(); };

  // === Optimistic update cho thêm bản sao ===
  const handleAddCopiesSubmit = async (copies) => {
    if (!menuRow?.documentId) return;
    const id = menuRow.documentId;

    // 1) Optimistic: tăng số bản trên bảng chính
    setBooks(prev =>
      prev.map(b => b.documentId === id
        ? { ...b, numberOfCopy: (b.numberOfCopy ?? 0) + copies.length }
        : b
      )
    );

    // 2) Nếu đang mở vùng copies, chèn tạm bản sao mới
    setCopiesMap(p => {
      const cur = p[id] || { loading: false, error: '', data: { copies: [] } };
      const now = new Date().toISOString();
      const tempCopies = copies.map((c, idx) => ({
        documentCopyId: `temp-${Date.now()}-${idx}`,
        barCode: c.barCode || '',
        status: (c.status || 'AVAILABLE').toUpperCase(),
        conditionNote: String(c.conditionNote ?? '100'),
        entryDate: c.entryDate || now,
        deposit: null,
        __optimistic: true,
      }));
      return {
        ...p,
        [id]: { ...cur, data: { copies: [...(cur.data?.copies || []), ...tempCopies] } }
      };
    });

    try {
      await addBookCopies(id, copies);
      setAddDlgOpen(false);
      setMenuRow(null);

      // 3) Đồng bộ lại chỉ phần copies của cuốn này (nhẹ)
      if (expanded[id]) {
        setCopiesMap(p => ({ ...p, [id]: { loading: true, error: "", data: null } }));
        try {
          const fresh = await getBookCopies(id);
          setCopiesMap(p => ({ ...p, [id]: { loading: false, error: "", data: fresh } }));
        } catch (e) {
          setCopiesMap(p => ({ ...p, [id]: { loading: false, error: e.message || "Lỗi tải copies", data: null } }));
        }
      }

      enqueueSnackbar('Thêm bản sao thành công!', { variant: 'success' });
    } catch (e) {
      // rollback: giảm lại số bản
      setBooks(prev =>
        prev.map(b => b.documentId === id
          ? { ...b, numberOfCopy: Math.max(0, (b.numberOfCopy ?? 0) - copies.length) }
          : b
        )
      );
      // rollback bản sao tạm
      setCopiesMap(p => {
        const cur = p[id];
        if (!cur?.data?.copies?.length) return p;
        return {
          ...p,
          [id]: { ...cur, data: { copies: cur.data.copies.filter(x => !x.__optimistic) } }
        };
      });
      enqueueSnackbar(e?.response?.data?.message || e.message || 'Thêm bản sao thất bại', { variant: 'error' });
    }
  };

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
          Quản lý Sách
        </Typography>
      </Box>

      <Card sx={{ mb: 3, borderRadius: 3, boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchAll}
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
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateOpen(true)}
                sx={{
                  borderRadius: 2,
                  background: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
                  fontWeight: 600,
                  boxShadow: "0 4px 12px rgba(102,126,234,0.3)",
                  "&:hover": {
                    background: "linear-gradient(135deg, #5A67D8 0%, #6B46C1 100%)",
                    boxShadow: "0 6px 16px rgba(102,126,234,0.4)",
                    transform: "translateY(-1px)",
                  },
                }}
              >
                Thêm Sách
              </Button>
            </Stack>

            <TextField
              placeholder="Tìm theo tiêu đề, tác giả…"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              InputProps={{
                startAdornment: (<InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>),
                endAdornment: (<InputAdornment position="end"><IconButton size="small"><FilterIcon /></IconButton></InputAdornment>),
              }}
              sx={{
                minWidth: 320,
                "& .MuiOutlinedInput-root": { borderRadius: 2, "&:hover fieldset": { borderColor: "#667EEA" } },
              }}
            />
          </Stack>
        </CardContent>
      </Card>

      {loading && <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}><ButtonLoader inline size={350} /></Box>}
      {!!error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      {!loading && !error && (
        <Card sx={{ borderRadius: 3, boxShadow: "0 8px 32px rgba(0,0,0,0.1)", overflow: "hidden" }}>
          <TableContainer component={Paper} elevation={0}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "rgba(102,126,234,0.08)" }}>
                  <TableCell />
                  <TableCell sx={{ fontWeight: 700, color: "#2D3748" }}>Id</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: "#2D3748" }}>Bìa</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: "#2D3748" }}>Tiêu đề</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: "#2D3748" }} align="center">Năm</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: "#2D3748" }} align="center">Số bản</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: "#2D3748" }} align="center">Hành động</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {pageItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ textAlign: "center", py: 4 }}>
                      <Typography variant="body1" color="text.secondary">Không có dữ liệu sách</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  pageItems.map((b) => {
                    const id = b.documentId;
                    const isOpen = !!expanded[id];
                    const copiesState = copiesMap[id] || { loading: false, error: "", data: null };

                    return (
                      <FragmentRow
                        key={id}
                        book={b}
                        isOpen={isOpen}
                        onToggle={() => toggleExpand(b)}
                        onOpenDetail={() => openDetail(b)}
                        copiesState={copiesState}
                        onOpenMenu={(e) => openMenu(e, b)}
                      />
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {totalPages > 1 && (
            <Box sx={{ p: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="body2" color="text.secondary">
                Tổng: {filtered.length} sách • Trang {currentPage}/{totalPages}
              </Typography>

              <Stack direction="row" spacing={2} alignItems="center">
                <Stack direction="row" spacing={1}>
                  {[5, 10, 20].map((n) => (
                    <Button
                      key={n}
                      size="small"
                      variant={itemsPerPage === n ? "contained" : "outlined"}
                      onClick={() => { setItemsPerPage(n); setCurrentPage(1); }}
                      sx={{ borderRadius: 2 }}
                    >
                      {n}/trang
                    </Button>
                  ))}
                </Stack>
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  onChange={(_, p) => setCurrentPage(p)}
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
              </Stack>
            </Box>
          )}
        </Card>
      )}

      {/* Menu ba chấm */}
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeMenu}>
        <MenuItem onClick={onMenuViewEbook} disabled={!menuRow?.ebookUrl}>Xem eBook</MenuItem>
        <MenuItem onClick={onMenuAddCopy}>Thêm bản sao</MenuItem>
        <Divider />
        <MenuItem onClick={onMenuEdit}>Sửa thông tin</MenuItem>
        <MenuItem onClick={onMenuDelete}>Xóa sách</MenuItem>
      </Menu>

      {/* Panel chi tiết */}
      <BookDetailPanel open={detailOpen} onClose={() => setDetailOpen(false)} id={selectedId} initialBook={selectedBook} />

      {/* Dialog tạo sách */}
      <BookCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(newBook) => {
          // Không reload: thêm ngay vào đầu danh sách
          setBooks(prev => [newBook, ...prev]);
        }}
      />

      {/* Dialog thêm bản sao */}
      <AddCopyDialog
        key={menuRow?.documentId || "addcopy"}
        open={addDlgOpen}
        onClose={() => setAddDlgOpen(false)}
        onSubmit={handleAddCopiesSubmit}
      />

      {/* Dialog sửa sách (ĐÃ DI CHUYỂN RA NGOÀI FragmentRow) */}
      <EditBookDialog
        open={editOpen}
        id={editRow?.documentId}
        initialBook={editRow}
        onClose={() => setEditOpen(false)}
        onUpdated={(updated) => {
          // cập nhật ngay item trong bảng
          setBooks(prev => prev.map(b => b.documentId === updated.documentId ? { ...b, ...updated } : b));
          // nếu đang mở panel chi tiết, đồng bộ luôn
          if (selectedId === updated.documentId) setSelectedBook(updated);
        }}
      />
    </Box>
  );
}

function FragmentRow({ book, isOpen, onToggle, onOpenDetail, copiesState, onOpenMenu }) {
  const id = book.documentId;

  return (
    <>
      <TableRow hover>
        <TableCell width={40}>
          <IconButton size="small" onClick={onToggle} aria-label="expand row">
            {isOpen ? <ArrowUpIcon /> : <ArrowDownIcon />}
          </IconButton>
        </TableCell>

        <TableCell width={240}>
          <MuiLink
            component="button"
            type="button"
            onClick={onOpenDetail}
            underline="hover"
            sx={{ fontFamily: "monospace", fontSize: 13, cursor: "pointer" }}
            title="Xem chi tiết"
          >
            {id}
          </MuiLink>
        </TableCell>

        <TableCell width={76}>
          <img
            src={book.coverPhoto || "https://via.placeholder.com/48x64?text=No+Cover"}
            alt="cover"
            loading="lazy"
            style={{ width: 48, height: 64, objectFit: "cover", borderRadius: 4, display: "block" }}
          />
        </TableCell>

        <TableCell sx={{ maxWidth: 520 }}>
          <Typography fontWeight={600} noWrap title={book.title}>{book.title}</Typography>
        </TableCell>

        <TableCell align="center" width={90}>{book.publicationYear || "—"}</TableCell>
        <TableCell align="center" width={90}>{book.numberOfCopy ?? 0}</TableCell>

        <TableCell align="center" width={64}>
          <IconButton size="small" onClick={onOpenMenu}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={7} sx={{ p: 0, border: 0 }}>
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
                        const condition = Number(c.conditionNote) || 0;
                        const dateStr = c.entryDate ? new Date(c.entryDate).toLocaleDateString("vi-VN") : "—";
                        const statusLabel = String(c.status || '').toUpperCase();
                        return (
                          <TableRow key={c.documentCopyId} hover>
                            <TableCell>{c.documentCopyId}</TableCell>
                            <TableCell><Typography fontFamily="monospace">{c.barCode}</Typography></TableCell>
                            <TableCell><Chip size="small" color={statusColor(statusLabel)} label={statusLabel} /></TableCell>
                            <TableCell sx={{ minWidth: 160 }}>
                              <Stack spacing={0.5}>
                                <Typography variant="body2">{condition}%</Typography>
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.max(0, Math.min(100, condition))}
                                  sx={{ height: 6, borderRadius: 1.5 }}
                                />
                              </Stack>
                            </TableCell>
                            <TableCell>{dateStr}</TableCell>
                            <TableCell align="right" >{formatVND(c.deposit)}</TableCell>
                            <TableCell align="center" width={64}>—</TableCell>
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
