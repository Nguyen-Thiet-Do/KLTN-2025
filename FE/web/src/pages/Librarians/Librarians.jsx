import { useEffect, useState, useMemo } from "react";
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
  Paper,
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
import {
  getLibrarians,
  deleteLibrarian,
  resetLibrarianPassword,
  restoreLibrarian,
} from "../../services/librarianService";
import AddLibrarian from "./AddLibrarian";
import EditLibrarian from "./EditLibrarian";
import ViewLibrarianDetail from "./ViewLibrarianDetail";

import ButtonLoader from "../../components/Loading/ButtonLoader";

export default function Librarians() {
  const [librarians, setLibrarians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLibrarian, setEditingLibrarian] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingLibrarian, setViewingLibrarian] = useState(null);

  const itemsPerPage = 5;

  // 🔄 Lấy danh sách thủ thư
  const fetchData = async () => {
    try {
      const token = sessionStorage.getItem("accessToken");
      if (!token) {
        setError("Không tìm thấy token. Vui lòng đăng nhập lại.");
        setLoading(false);
        return;
      }

      const data = await getLibrarians(token);
      if (data.success) setLibrarians(data.librarians);
      else setError("Không thể tải danh sách thủ thư.");
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

  // 👀 Hiển thị giới tính
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

  // 🗑️ Xóa mềm thủ thư
  const handleDelete = async (id, name) => {
    const confirmed = window.confirm(`Bạn có chắc chắn muốn xóa thủ thư "${name}" không?`);
    if (!confirmed) return;

    try {
      const token = sessionStorage.getItem("accessToken");
      const res = await deleteLibrarian(id, token);
      if (res.success) {
        alert("✅ Đã xóa thủ thư thành công!");
        fetchData();
      } else alert(res.message || "Không thể xóa thủ thư.");
    } catch (err) {
      alert("Xóa thất bại: " + (err.response?.data?.message || err.message));
    }
  };

  // ♻️ Khôi phục thủ thư
  const handleRestore = async (id, name) => {
    const confirmed = window.confirm(`Bạn có chắc chắn muốn khôi phục thủ thư "${name}" không?`);
    if (!confirmed) return;

    try {
      const token = sessionStorage.getItem("accessToken");
      const res = await restoreLibrarian(id, token);
      if (res.success) {
        alert("✅ Khôi phục thủ thư thành công!");
        fetchData();
      } else alert(res.message || "Không thể khôi phục thủ thư.");
    } catch (err) {
      alert("Lỗi khi khôi phục: " + (err.response?.data?.message || err.message));
    }
  };

  // 🔐 Đặt lại mật khẩu thủ thư
  const handleResetPassword = async (librarian) => {
    const newPassword = prompt(`Nhập mật khẩu mới cho "${librarian.fullName}":`);
    if (!newPassword || newPassword.trim() === "") return alert("Mật khẩu không hợp lệ.");

    try {
      const token = sessionStorage.getItem("accessToken");
      const res = await resetLibrarianPassword(librarian.librarianId, newPassword, token);
      if (res.success) alert("✅ Đặt lại mật khẩu thành công!");
      else alert(res.message || "Không thể đặt lại mật khẩu.");
    } catch (err) {
      alert("Lỗi khi đặt lại mật khẩu: " + (err.response?.data?.message || err.message));
    }
  };

  // 🔎 Lọc thủ thư theo tên hoặc email
  const filteredLibrarians = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return librarians;
    return librarians.filter(
      (lib) =>
        lib.fullName?.toLowerCase().includes(keyword) ||
        lib.email?.toLowerCase().includes(keyword)
    );
  }, [librarians, searchQuery]);

  // 📄 Phân trang
  const totalPages = Math.ceil(filteredLibrarians.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentLibrarians = filteredLibrarians.slice(startIndex, startIndex + itemsPerPage);

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
          Quản lý Thủ thư
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Quản lý thông tin và tài khoản của các thủ thư trong hệ thống
        </Typography>
      </Box>

      {/* Thanh công cụ */}
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
                Thêm Thủ thư
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

      {/* Loading / Error */}
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
          <ButtonLoader inline size={350} />
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Bảng dữ liệu */}
      {!loading && !error && (
        <Card sx={{ borderRadius: 3, boxShadow: "0 8px 32px rgba(0,0,0,0.1)", overflow: "hidden" }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: "rgba(102,126,234,0.08)" }}>
                  <TableCell sx={{ fontWeight: 700 }}>Mã thủ thư</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Họ tên</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Giới tính</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Ngày sinh</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Số điện thoại</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>CCCD</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Địa chỉ</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: "center" }}>Hành động</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {currentLibrarians.map((lib) => (
                  <TableRow
                    key={lib.librarianId}
                    sx={{
                      opacity: lib.deleted ? 0.5 : 1,
                      backgroundColor: lib.deleted ? "rgba(255,0,0,0.03)" : "inherit",
                    }}
                  >
                    <TableCell>
                      <Chip
                        label={lib.librarianCode || `TT${lib.librarianId}`}
                        size="small"
                        sx={{
                          backgroundColor: "rgba(102,126,234,0.1)",
                          color: "#667EEA",
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell>{lib.fullName}</TableCell>
                    <TableCell>
                      <Chip label={getGenderDisplay(lib.gender)} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      {lib.dateOfBirth ? new Date(lib.dateOfBirth).toLocaleDateString("vi-VN") : "-"}
                    </TableCell>
                    <TableCell>{lib.phoneNumber || "-"}</TableCell>
                    <TableCell>{lib.cccd || "-"}</TableCell>
                    <TableCell>{lib.address || "-"}</TableCell>
                    <TableCell>{lib.email || "-"}</TableCell>

                    {/* Hành động */}
                    <TableCell sx={{ textAlign: "center" }}>
                      <Stack direction="row" spacing={1} justifyContent="center">

                        {/* Xem chi tiết */}
                        <IconButton
                          size="small"
                          onClick={() => setViewingLibrarian(lib)}
                          sx={{ color: "#3182CE" }}
                          title="Xem chi tiết"
                        >
                          <SearchIcon />
                        </IconButton>

                        {/* Sửa thông tin */}
                        <IconButton
                          size="small"
                          onClick={() => setEditingLibrarian(lib)}
                          sx={{ color: "#667EEA" }}
                          disabled={lib.deleted}
                          title="Sửa thông tin"
                        >
                          <EditIcon />
                        </IconButton>

                        {/* Đặt lại mật khẩu */}
                        <IconButton
                          size="small"
                          onClick={() => handleResetPassword(lib)}
                          sx={{ color: "#ED8936" }}
                          disabled={lib.deleted}
                          title="Đặt lại mật khẩu"
                        >
                          <ResetIcon />
                        </IconButton>

                        {!lib.deleted ? (
                          /* Xóa thủ thư */
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(lib.librarianId, lib.fullName)}
                            sx={{ color: "#E53E3E" }}
                            title="Xóa thủ thư"
                          >
                            <DeleteIcon />
                          </IconButton>
                        ) : (
                          /* Khôi phục */
                          <IconButton
                            size="small"
                            onClick={() => handleRestore(lib.librarianId, lib.fullName)}
                            sx={{ color: "#38A169" }}
                            title="Khôi phục thủ thư"
                          >
                            <RefreshIcon />
                          </IconButton>
                        )}
                      </Stack>
                    </TableCell>

                  </TableRow>

                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Phân trang */}
          {totalPages > 1 && (
            <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={(event, page) => setCurrentPage(page)}
                color="primary"
                showFirstButton
                showLastButton
              />
            </Box>
          )}
        </Card>
      )}

      {/* Modal thêm */}
      {showAddModal && (
        <AddLibrarian
          open={showAddModal}
          onSuccess={() => {
            setShowAddModal(false);
            fetchData();
          }}
          onCancel={() => setShowAddModal(false)}
        />
      )}
      {viewingLibrarian && (
        <ViewLibrarianDetail
          open={!!viewingLibrarian}
          librarian={viewingLibrarian}
          onClose={() => setViewingLibrarian(null)}
        />
      )}

      {/* Modal sửa */}
      {editingLibrarian && (
        <EditLibrarian
          librarian={editingLibrarian}
          open={!!editingLibrarian}
          onSuccess={() => {
            setEditingLibrarian(null);
            fetchData();
          }}
          onCancel={() => setEditingLibrarian(null)}
        />
      )}
    </Box>
  );
}