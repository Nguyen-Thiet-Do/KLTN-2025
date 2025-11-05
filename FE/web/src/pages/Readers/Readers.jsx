import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Pagination,
  Stack,
  Card,
  CardContent,
} from "@mui/material";
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  LockReset as ResetIcon,
} from "@mui/icons-material";

import { getReaders, deleteReader, resetReaderPassword } from "../../services/readerService";
import AddReader from "./AddReader";
import EditReader from "./EditReader";

export default function Readers() {
  const [readers, setReaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingReader, setEditingReader] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const fetchData = async () => {
    try {
      const token = sessionStorage.getItem("accessToken");
      if (!token) {
        setError("Không tìm thấy token. Vui lòng đăng nhập lại.");
        setLoading(false);
        return;
      }
      const res = await getReaders(token);
      if (res.success) setReaders(res.readers || []);
      else setError("Không thể tải danh sách độc giả.");
    } catch (err) {
      console.error("Chi tiết lỗi:", err.response || err);
      if (err.response?.status === 401) {
        setError("Token không hợp lệ hoặc đã hết hạn.");
        sessionStorage.removeItem("accessToken");
        sessionStorage.removeItem("refreshToken");
      } else {
        setError("Lỗi khi tải dữ liệu: " + (err.response?.data?.message || err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getGenderDisplay = (gender) => {
    if (!gender) return "-";
    if (typeof gender === "object") {
      const value = gender?.data?.[0] ?? (gender instanceof Uint8Array ? gender[0] : undefined);
      if (value === 1) return "Nam";
      if (value === 0) return "Nữ";
      return "Khác";
    }
    const g = gender.toString().trim().toLowerCase();
    if (["male", "nam", "1"].includes(g)) return "Nam";
    if (["female", "nu", "nữ", "0"].includes(g)) return "Nữ";
    if (["other", "khac", "khác"].includes(g)) return "Khác";
    return "-";
  };

  const handleDelete = async (id, name) => {
    const confirmed = window.confirm(`Bạn có chắc chắn muốn xóa độc giả "${name}" không?`);
    if (!confirmed) return;
    try {
      const token = sessionStorage.getItem("accessToken");
      const res = await deleteReader(id, token);
      if (res.success) {
        alert("Đã xóa độc giả thành công!");
        fetchData();
      } else {
        alert(res.message || "Không thể xóa độc giả.");
      }
    } catch (err) {
      alert("Xóa thất bại: " + (err.response?.data?.message || err.message));
    }
  };

  // 🔐 Đặt lại mật khẩu thủ công
  const handleResetPassword = async (reader) => {
    const newPassword = prompt(`Nhập mật khẩu mới cho "${reader.fullName}":`);
    if (!newPassword || newPassword.trim() === "") return alert("Mật khẩu không hợp lệ.");
    try {
      const token = sessionStorage.getItem("accessToken");
      const res = await resetReaderPassword(reader.readerId, newPassword, token);
      if (res.success) alert("✅ Đặt lại mật khẩu thành công.");
      else alert(res.message || "Không thể đặt lại mật khẩu.");
    } catch (err) {
      alert("Lỗi khi đặt lại mật khẩu: " + (err.response?.data?.message || err.message));
    }
  };

  const filteredReaders = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return readers;
    return readers.filter(
      (r) => r.fullName?.toLowerCase().includes(keyword) || r.email?.toLowerCase().includes(keyword)
    );
  }, [readers, searchQuery]);

  const totalPages = Math.ceil(filteredReaders.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentReaders = filteredReaders.slice(startIndex, startIndex + itemsPerPage);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          fontWeight={700}
          gutterBottom
          sx={{
            background: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Quản lý Độc giả
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Quản lý hồ sơ độc giả và thông tin liên hệ trong hệ thống
        </Typography>
      </Box>

      <Card sx={{ mb: 3, borderRadius: 3, boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems="center"
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchData}
                sx={{
                  borderRadius: 2,
                  borderColor: "#667EEA",
                  color: "#667EEA",
                  fontWeight: 600,
                  "&:hover": {
                    borderColor: "#5A67D8",
                    backgroundColor: "rgba(102,126,234,0.04)",
                  },
                }}
              >
                Làm mới
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setShowAddModal(true)}
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
                Thêm Độc giả
              </Button>
            </Stack>

            <TextField
              placeholder="Tìm kiếm theo tên hoặc email..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small">
                      <FilterIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                minWidth: 300,
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                  "&:hover fieldset": { borderColor: "#667EEA" },
                },
              }}
            />
          </Stack>
        </CardContent>
      </Card>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && (
        <Card sx={{ borderRadius: 3, boxShadow: "0 8px 32px rgba(0,0,0,0.1)", overflow: "hidden" }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: "rgba(102,126,234,0.08)" }}>
                  <TableCell sx={{ fontWeight: 700 }}>Mã độc giả</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Họ tên</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Giới tính</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Ngày sinh</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>SĐT</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>CCCD</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Địa chỉ</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: "center" }}>Hành động</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {currentReaders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} sx={{ textAlign: "center", py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        Không có dữ liệu độc giả
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  currentReaders.map((r) => (
                    <TableRow
                      key={r.readerId}
                      sx={{ "&:hover": { backgroundColor: "rgba(102,126,234,0.02)" } }}
                    >
                      <TableCell>
                        <Chip
                          label={`DG${r.readerId}`}
                          size="small"
                          sx={{
                            backgroundColor: "rgba(102,126,234,0.1)",
                            color: "#667EEA",
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight={600}>{r.fullName}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getGenderDisplay(r.gender)}
                          size="small"
                          variant="outlined"
                          color={
                            getGenderDisplay(r.gender) === "Nam"
                              ? "primary"
                              : getGenderDisplay(r.gender) === "Nữ"
                              ? "secondary"
                              : "default"
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {r.dateOfBirth ? new Date(r.dateOfBirth).toLocaleDateString("vi-VN") : "-"}
                      </TableCell>
                      <TableCell>{r.phoneNumber || "-"}</TableCell>
                      <TableCell>{r.cccd || "-"}</TableCell>
                      <TableCell>{r.address || "-"}</TableCell>
                      <TableCell>{r.email}</TableCell>

                      <TableCell sx={{ textAlign: "center" }}>
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <IconButton
                            size="small"
                            onClick={() => setEditingReader(r)}
                            sx={{
                              color: "#667EEA",
                              "&:hover": { backgroundColor: "rgba(102,126,234,0.1)" },
                            }}
                          >
                            <EditIcon />
                          </IconButton>

                          {/* ✅ Nút đặt lại mật khẩu */}
                          <IconButton
                            size="small"
                            onClick={() => handleResetPassword(r)}
                            sx={{
                              color: "#ED8936",
                              "&:hover": { backgroundColor: "rgba(237,137,54,0.1)" },
                            }}
                            title="Đặt lại mật khẩu"
                          >
                            <ResetIcon />
                          </IconButton>

                          <IconButton
                            size="small"
                            onClick={() => handleDelete(r.readerId, r.fullName)}
                            sx={{
                              color: "#E53E3E",
                              "&:hover": { backgroundColor: "rgba(229,62,62,0.1)" },
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {totalPages > 1 && (
            <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={(_, page) => setCurrentPage(page)}
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
      )}

      {showAddModal && (
        <AddReader
          open={showAddModal}
          onSuccess={() => {
            setShowAddModal(false);
            fetchData();
          }}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      {editingReader && (
        <EditReader
          reader={editingReader}
          open={!!editingReader}
          onSuccess={() => {
            setEditingReader(null);
            fetchData();
          }}
          onCancel={() => setEditingReader(null)}
        />
      )}
    </Box>
  );
}
