// src/pages/Borrow/Borrow.jsx
import { useEffect, useMemo, useState } from "react";
import {
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
} from "@mui/material";
import { ExpandMore, ExpandLess } from "@mui/icons-material";
import { fetchLoanSlips, getDocumentDetail } from "../../services/loanSlips";

const TABS = [
  { key: "PENDING", label: "Chờ duyệt" },
  { key: "OPEN", label: "Đang mượn" },
  { key: "CLOSED", label: "Đã trả" },
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
      return <Chip color="warning" label="Chờ duyệt" size="small" />;
    case "OPEN":
      return <Chip color="primary" label="Đang mượn" size="small" />;
    case "CLOSED":
      return <Chip color="success" label="Đã trả" size="small" />;
    case "OVERDUE":
      return <Chip color="error" label="Quá hạn" size="small" />;
    default:
      return <Chip label={status || "Không rõ"} size="small" />;
  }
}

function parseRequestedDocumentId(note) {
  const m = String(note || "").match(/REQUEST_DOCUMENT_ID=(\d+)/i);
  return m ? Number(m[1]) : null;
}

function Row({ row, titleCache }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow hover>
        <TableCell width={56}>
          <IconButton size="small" onClick={() => setOpen((v) => !v)}>
            {open ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </TableCell>
        <TableCell>#{row.loanSlipId}</TableCell>
        <TableCell>{row.Reader?.fullName || `Reader #${row.readerId}`}</TableCell>
        <TableCell>{formatDate(row.loanDate)}</TableCell>
        <TableCell>{formatDate(row.dueDate)}</TableCell>
        <TableCell>{chipForSlipStatus(row.status)}</TableCell>
        <TableCell align="center">
          {Array.isArray(row.details) ? row.details.length : 0}
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={7} sx={{ p: 0, border: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, bgcolor: "grey.50" }}>
              <Typography variant="subtitle2" gutterBottom>
                Chi tiết phiếu
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#Chi tiết</TableCell>
                    <TableCell>ID tài liệu</TableCell>
                    <TableCell>Tên tài liệu</TableCell>
                    <TableCell>Mã vạch bản sao</TableCell>
                    <TableCell>Trạng thái chi tiết</TableCell>
                    <TableCell>Ngày trả</TableCell>
                    <TableCell>Tiền cọc</TableCell>
                    <TableCell>Tiền phạt</TableCell>
                    <TableCell>Ghi chú</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(row.details || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        Chưa có bản ghi
                      </TableCell>
                    </TableRow>
                  ) : (
                    row.details.map((d) => {
                      // PENDING: lấy id từ note và tiêu đề từ cache
                      const requestedId =
                        row.status === "PENDING"
                          ? parseRequestedDocumentId(d.note)
                          : null;

                      const copy = d.DocumentCopy;
                      const doc = copy?.Document;

                      const documentId = requestedId ?? doc?.documentId ?? null;
                      const title =
                        row.status === "PENDING"
                          ? documentId
                            ? titleCache.get(documentId) ?? "Đang tải..."
                            : "-"
                          : doc?.title || "-";

                      return (
                        <TableRow key={d.loanDetailId}>
                          <TableCell>{d.loanDetailId}</TableCell>
                          <TableCell>{documentId ?? "-"}</TableCell>
                          <TableCell>{title}</TableCell>
                          <TableCell>{copy?.barCode || "-"}</TableCell>
                          <TableCell>{d.status}</TableCell>
                          <TableCell>{formatDate(d.returnDate)}</TableCell>
                          <TableCell>
                            {d.depositAmount != null
                              ? nf.format(d.depositAmount)
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {d.fineAmount != null ? nf.format(d.fineAmount) : "-"}
                          </TableCell>
                          <TableCell>{d.note || "-"}</TableCell>
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
  const [tab, setTab] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [totalPages, setTotalPages] = useState(1);

  // cache tiêu đề tài liệu cho các chi tiết PENDING
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
        // gom danh sách documentId cần tra cứu
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

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
        Quản lý Mượn – Trả
      </Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ pt: 1 }}>
          <Tabs
            value={tab}
            onChange={(_e, v) => setTab(v)}
            variant="scrollable"
            allowScrollButtonsMobile
          >
            {TABS.map((t) => (
              <Tab key={t.key} value={t.key} label={t.label} />
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        {loading && <LinearProgress />}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>ID Phiếu</TableCell>
                <TableCell>Độc giả</TableCell>
                <TableCell>Ngày tạo</TableCell>
                <TableCell>Hạn trả</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell align="center">Số đầu mục</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    Không có dữ liệu
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <Row key={r.loanSlipId} row={r} titleCache={titleCache} />
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="center"
          sx={{ py: 2 }}
        >
          <Pagination
            page={page}
            count={totalPages}
            onChange={(_e, val) => setPage(val)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Stack>
      </Card>
    </Box>
  );
}
