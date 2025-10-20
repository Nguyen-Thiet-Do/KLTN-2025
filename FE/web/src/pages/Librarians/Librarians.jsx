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
} from "@mui/icons-material";
import { getLibrarians, deleteLibrarian } from "../../services/librarianService";
import AddLibrarian from "./AddLibrarian";
import EditLibrarian from "./EditLibrarian";

export default function Librarians() {
  const [librarians, setLibrarians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLibrarian, setEditingLibrarian] = useState(null);

  // 🔍 Tìm kiếm
  const [searchQuery, setSearchQuery] = useState("");

  // 🔢 Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
      const value =
        gender?.data?.[0] ??
        (gender instanceof Uint8Array ? gender[0] : undefined);
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

  // 🗑️ Xóa thủ thư
  const handleDelete = async (id, name) => {
    const confirmed = window.confirm(`Bạn có chắc chắn muốn xóa thủ thư "${name}" không?`);
    if (!confirmed) return;

    try {
      const token = sessionStorage.getItem("accessToken");
      const res = await deleteLibrarian(id, token);
      if (res.success) {
        alert("Đã xóa thủ thư thành công!");
        fetchData();
      } else alert(res.message || "Không thể xóa thủ thư.");
    } catch (err) {
      alert("Xóa thất bại: " + (err.response?.data?.message || err.message));
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
            background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Quản lý Thủ thư
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Quản lý thông tin và tài khoản của các thủ thư trong hệ thống
        </Typography>
      </Box>

      {/* Thanh công cụ */}
      <Card sx={{ mb: 3, borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchData}
                sx={{
                  borderRadius: 2,
                  borderColor: '#667EEA',
                  color: '#667EEA',
                  fontWeight: 600,
                  '&:hover': {
                    borderColor: '#5A67D8',
                    backgroundColor: 'rgba(102,126,234,0.04)',
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
                  background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(102,126,234,0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5A67D8 0%, #6B46C1 100%)',
                    boxShadow: '0 6px 16px rgba(102,126,234,0.4)',
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                Thêm Thủ thư
              </Button>
            </Stack>

            {/* Ô tìm kiếm */}
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
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&:hover fieldset': {
                    borderColor: '#667EEA',
                  },
                },
              }}
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Loading và Error */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}
      
      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 3,
            borderRadius: 2,
          }}
        >
          {error}
        </Alert>
      )}

      {/* Bảng dữ liệu */}
      {!loading && !error && (
        <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: 'rgba(102,126,234,0.08)' }}>
                  <TableCell sx={{ fontWeight: 700, color: '#2D3748' }}>Mã thủ thư</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#2D3748' }}>Họ tên</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#2D3748' }}>Giới tính</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#2D3748' }}>Ngày sinh</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#2D3748' }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#2D3748', textAlign: 'center' }}>Hành động</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentLibrarians.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        Không có dữ liệu thủ thư
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  currentLibrarians.map((lib) => (
                    <TableRow 
                      key={lib.librarianId}
                      sx={{ 
                        '&:hover': {
                          backgroundColor: 'rgba(102,126,234,0.02)',
                        },
                      }}
                    >
                      <TableCell>
                        <Chip 
                          label={lib.librarianCode || `TT${lib.librarianId}`}
                          size="small"
                          sx={{
                            backgroundColor: 'rgba(102,126,234,0.1)',
                            color: '#667EEA',
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight={600}>
                          {lib.fullName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={getGenderDisplay(lib.gender)}
                          size="small"
                          variant="outlined"
                          color={
                            getGenderDisplay(lib.gender) === 'Nam' ? 'primary' : 
                            getGenderDisplay(lib.gender) === 'Nữ' ? 'secondary' : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {lib.dateOfBirth
                          ? new Date(lib.dateOfBirth).toLocaleDateString("vi-VN")
                          : "-"}
                      </TableCell>
                      <TableCell>{lib.email}</TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <IconButton
                            size="small"
                            onClick={() => setEditingLibrarian(lib)}
                            sx={{
                              color: '#667EEA',
                              '&:hover': {
                                backgroundColor: 'rgba(102,126,234,0.1)',
                              },
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(lib.librarianId, lib.fullName)}
                            sx={{
                              color: '#E53E3E',
                              '&:hover': {
                                backgroundColor: 'rgba(229,62,62,0.1)',
                              },
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

          {/* Phân trang */}
          {totalPages > 1 && (
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={(event, page) => setCurrentPage(page)}
                color="primary"
                showFirstButton
                showLastButton
                sx={{
                  '& .MuiPaginationItem-root': {
                    borderRadius: 2,
                    fontWeight: 600,
                  },
                  '& .MuiPaginationItem-root.Mui-selected': {
                    background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
                    color: 'white',
                  },
                }}
              />
            </Box>
          )}
        </Card>
      )}

      {/* Modal thêm thủ thư */}
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

      {/* Modal sửa thủ thư */}
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