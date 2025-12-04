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
  Tabs,
  Tab,
  Tooltip,
  Badge,
} from "@mui/material";
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  LockReset as ResetIcon,
  Restore as RestoreIcon,
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  CreditCard as CardIcon,
  Book as BookIcon,
  Warning as WarningIcon,
  
} from "@mui/icons-material";

import {
  getReaders,
  deleteReader,
  resetReaderPassword,
  restoreReader,
  lockReaderAccount,
  unlockReaderAccount,
} from "../../services/readerService";
import AddReader from "./AddReader";
import EditReader from "./EditReader";
import ViewReaderDetail from "./ViewReaderDetail";
import ReaderBalanceModal from "./ReaderBalanceModal";
import { AccountBalanceWallet } from "@mui/icons-material";
import QRPaymentModal from "./QRPaymentModal";
import { completeRegistration } from "../../services/authService";

export default function Readers() {
  const [readers, setReaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingReader, setEditingReader] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [tabValue, setTabValue] = useState(0);
  const itemsPerPage = 5;

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [currentPaymentData, setCurrentPaymentData] = useState(null);
const [viewingReader, setViewingReader] = useState(null);
const [balanceReader, setBalanceReader] = useState(null);
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

  const handleRestore = async (id, name) => {
    const confirmed = window.confirm(`Khôi phục độc giả "${name}"?`);
    if (!confirmed) return;
    try {
      const token = sessionStorage.getItem("accessToken");
      const res = await restoreReader(id, token);
      if (res.success) {
        alert("Đã khôi phục độc giả thành công!");
        fetchData();
      } else {
        alert(res.message || "Không thể khôi phục độc giả.");
      }
    } catch (err) {
      alert("Lỗi khi khôi phục: " + (err.response?.data?.message || err.message));
    }
  };

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

  const handleLockAccount = async (readerId, name) => {
    if (!window.confirm(`Khoá tài khoản của "${name}"?`)) return;
    try {
      const token = sessionStorage.getItem("accessToken");
      const res = await lockReaderAccount(readerId, token);
      alert(res.message || "Đã khoá tài khoản");
      fetchData();
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.message || err.message));
    }
  };

  const handleUnlockAccount = async (readerId, name) => {
    if (!window.confirm(`Mở khoá tài khoản của "${name}"?`)) return;
    try {
      const token = sessionStorage.getItem("accessToken");
      const res = await unlockReaderAccount(readerId, token);
      alert(res.message || "Đã mở khoá tài khoản");
      fetchData();
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.message || err.message));
    }
  };

  // ✅ Tạo thẻ thành viên - CẢI THIỆN với xử lý lỗi đầy đủ
  const handleCreateMemberCard = async (readerId) => {
    if (!window.confirm("Tạo thẻ thành viên cho độc giả này?")) return;

    try {
      const token = sessionStorage.getItem("accessToken");
      setLoading(true);

      console.log("📤 Đang gọi API tạo thanh toán cho reader:", readerId);

      const res = await completeRegistration(
        {
          readerId: readerId,
          cardTypeId: 2, // PREMIUM card
          action: "PAY"
        },
        token
      );

      console.log("✅ API response (full):", JSON.stringify(res, null, 2));

      // ✅ Backend response structure:
      // {
      //   ok: true,
      //   data: {
      //     ok: true,
      //     paymentId: 392,
      //     orderCode: "1764270896699",
      //     amount: 10000,
      //     payos: {
      //       checkoutUrl: "https://pay.payos.vn/...",
      //       qrCode: "00020101021238570010A000000727...",
      //       paymentLinkId: "9528374d4b6d4b7a92a2619aaa3337d9"
      //     }
      //   }
      // }
      
      const responseData = res.data || res;
      
      console.log("💾 Response data:", JSON.stringify(responseData, null, 2));
      
      // ✅ Lấy thông tin thanh toán
      const paymentId = responseData.paymentId;
      const amount = responseData.amount;
      const qrCode = responseData.payos?.qrCode;
      const checkoutUrl = responseData.payos?.checkoutUrl;
      
      console.log("💳 Payment info:", { paymentId, amount, qrCode: qrCode?.substring(0, 50) + '...', checkoutUrl });
      
      if (!paymentId) {
        throw new Error("Không nhận được paymentId từ server");
      }
// ✅ Chuẩn bị dữ liệu cho modal
const paymentInfo = {
  paymentId: paymentId,
  qrCode: qrCode || null,        // ✅ ĐỔI TÊN
  checkoutUrl: checkoutUrl || null,
  amount: amount || 10000
};

console.log("🎯 Final payment info for modal:", paymentInfo);

// Validate có thông tin thanh toán
if (!paymentInfo.qrCode && !paymentInfo.checkoutUrl) {  // ✅ ĐỔI TÊN
  throw new Error("Không có thông tin thanh toán (QR hoặc link). Vui lòng kiểm tra cấu hình PayOS.");
}

      // ✅ Mở modal hiển thị QR
      setCurrentPaymentData(paymentInfo);
      setPaymentModalOpen(true);
      setLoading(false);

    } catch (err) {
      setLoading(false);
      console.error("❌ Lỗi tạo thẻ:", err);
      
      // ✅ Xử lý lỗi chi tiết
      let errorMessage = "Không thể tạo thẻ thành viên";
      
      if (err.response) {
        const serverError = err.response.data;
        
        // Xử lý các loại lỗi cụ thể
        if (serverError.message === "PAYOS_CREATE_FAILED") {
          errorMessage = `⚠️ Không thể kết nối với cổng thanh toán PayOS.

Nguyên nhân có thể:
- PayOS API Key không hợp lệ
- PayOS Service đang bảo trì
- Cấu hình backend chưa đúng

Vui lòng liên hệ quản trị viên hoặc thử lại sau.`;
        } else if (serverError.message === "Reader already has an active member card") {
          errorMessage = "⚠️ Độc giả này đã có thẻ thành viên rồi!";
        } else if (serverError.message) {
          errorMessage = serverError.message;
        }
        
        // Log chi tiết để debug
        console.error("Server error details:", {
          status: err.response.status,
          data: serverError
        });
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      alert(`❌ ${errorMessage}`);
    }
  };

  // ✅ Xử lý sau khi thanh toán thành công
  const handlePaymentSuccess = async () => {
    console.log("✅ Thanh toán thành công - Đang reload data...");
    
    // Reload danh sách độc giả
    await fetchData();
    
    // Tự động chuyển sang tab "Đã có thẻ"
    setTabValue(0);
    
    // Đóng modal
    setPaymentModalOpen(false);
    setCurrentPaymentData(null);
    
    // Hiển thị thông báo
    alert("🎉 Thẻ thành viên đã được kích hoạt thành công!");
  };

  const filteredReaders = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    let filtered = readers;

    if (keyword) {
      filtered = filtered.filter(
        (r) =>
          r.fullName?.toLowerCase().includes(keyword) ||
          r.email?.toLowerCase().includes(keyword) ||
          r.cccd?.toLowerCase().includes(keyword)
      );
    }

    if (tabValue === 0) {
      filtered = filtered.filter((r) => r.memberCard !== null);
    } else if (tabValue === 1) {
      filtered = filtered.filter((r) => r.memberCard === null);
    }

    return filtered;
  }, [readers, searchQuery, tabValue]);

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
              placeholder="Tìm kiếm theo tên, email, CCCD..."
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

          <Box sx={{ mt: 2, borderBottom: 1, borderColor: "divider" }}>
            <Tabs
              value={tabValue}
              onChange={(e, newValue) => {
                setTabValue(newValue);
                setCurrentPage(1);
              }}
              sx={{
                "& .MuiTab-root": { fontWeight: 600 },
                "& .Mui-selected": { color: "#667EEA" },
              }}
            >
              <Tab label="Đã có thẻ" />
              <Tab label="Chưa có thẻ" />
            </Tabs>
          </Box>
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
    <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>

    {tabValue === 0 && (
      <>
        <TableCell sx={{ fontWeight: 700 }}>Đang mượn</TableCell>
        <TableCell sx={{ fontWeight: 700 }}>Đang chờ</TableCell>
        <TableCell sx={{ fontWeight: 700 }}>Quá hạn</TableCell>
      </>
    )}

    <TableCell sx={{ fontWeight: 700, textAlign: "center" }}>Hành động</TableCell>
  </TableRow>
</TableHead>


              <TableBody>
                {currentReaders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={tabValue === 0 ? 12 : 9} sx={{ textAlign: "center", py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        Không có dữ liệu độc giả
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  currentReaders.map((r) => {
                    const stats = r.stats || {};
                    const borrowedCount = stats.borrowedCount || 0;
                    const pendingCount = stats.pendingCount || 0;
                    const waitingForPickupCount = stats.waitingForPickupCount || 0;
                    const overdueCount = stats.overdueCount || 0;
                    const isLocked = r.status === "locked";

                    return (
                     <TableRow
  key={r.readerId}
  sx={{
    "&:hover": { backgroundColor: "rgba(102,126,234,0.02)" },
    opacity: r.deleted ? 0.6 : 1,
  }}
>
  {/* Mã độc giả */}
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

  {/* Họ tên */}
  <TableCell>
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography fontWeight={600}>{r.fullName}</Typography>
      {r.status === "locked" && (
        <Tooltip title="Tài khoản đã bị khoá">
          <LockIcon fontSize="small" color="error" />
        </Tooltip>
      )}
    </Stack>
  </TableCell>

  {/* Email */}
  <TableCell>{r.email || "-"}</TableCell>

  {/* Nếu đã có thẻ → hiện thống kê */}
  {tabValue === 0 && (
    <>
      <TableCell>
        <Chip
          icon={<BookIcon />}
          label={r.stats?.borrowedCount || 0}
          size="small"
          color={(r.stats?.borrowedCount || 0) > 0 ? "primary" : "default"}
        />
      </TableCell>

      <TableCell>
        <Chip
          label={(r.stats?.pendingCount || 0) + (r.stats?.waitingForPickupCount || 0)}
          size="small"
          color={
            (r.stats?.pendingCount || 0) + (r.stats?.waitingForPickupCount || 0) > 0
              ? "info"
              : "default"
          }
        />
      </TableCell>

      <TableCell>
        {(r.stats?.overdueCount || 0) > 0 ? (
          <Badge badgeContent={r.stats.overdueCount} color="error">
            <Chip icon={<WarningIcon />} label="Quá hạn" size="small" color="error" />
          </Badge>
        ) : (
          <Chip label="0" size="small" color="default" />
        )}
      </TableCell>
    </>
  )}

  {/* Hành động */}
  <TableCell sx={{ textAlign: "center" }}>
  <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap">

    {/* Xem chi tiết */}
  <Tooltip title="Xem chi tiết">
  <IconButton
    size="small"
    onClick={() => setViewingReader(r)}
    sx={{ color: "#3182CE" }}
  >
    <SearchIcon />
  </IconButton>
</Tooltip>

{/* ✅ THÊM NÚT XEM SỐ DƯ - Chỉ hiện cho reader có thẻ */}
{r.memberCard && !r.deleted && (
  <Tooltip title="Xem số dư & Nạp tiền">
    <IconButton
      size="small"
      onClick={() => setBalanceReader(r)}
      sx={{
        color: "#38A169",
        "&:hover": { backgroundColor: "rgba(56,161,105,0.1)" },
      }}
    >
      <AccountBalanceWallet />
    </IconButton>
  </Tooltip>
)}
    {/* Tạo thẻ thành viên (chỉ hiện ở tab 'Chưa có thẻ') */}
    {tabValue === 1 && !r.deleted && (
      <Tooltip title="Tạo thẻ thành viên">
        <IconButton
          size="small"
          onClick={() => handleCreateMemberCard(r.readerId)}
          sx={{
            color: "#7B3FE4",
            "&:hover": { backgroundColor: "rgba(123,63,228,0.1)" },
          }}
        >
          <CardIcon />
        </IconButton>
      </Tooltip>
    )}

    {/* Sửa thông tin */}
    {!r.deleted && (
      <Tooltip title="Sửa thông tin">
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
      </Tooltip>
    )}

    {/* Reset mật khẩu */}
    {!r.deleted && (
      <Tooltip title="Đặt lại mật khẩu">
        <IconButton
          size="small"
          onClick={() => handleResetPassword(r)}
          sx={{
            color: "#ED8936",
            "&:hover": { backgroundColor: "rgba(237,137,54,0.1)" },
          }}
        >
          <ResetIcon />
        </IconButton>
      </Tooltip>
    )}

    {/* Khoá tài khoản */}
    {!r.deleted && r.status !== "locked" && (
      <Tooltip title="Khoá tài khoản">
        <IconButton
          size="small"
          onClick={() => handleLockAccount(r.readerId, r.fullName)}
          sx={{
            color: "#E53E3E",
            "&:hover": { backgroundColor: "rgba(229,62,62,0.1)" },
          }}
        >
          <LockIcon />
        </IconButton>
      </Tooltip>
    )}

    {/* Mở khoá tài khoản */}
    {!r.deleted && r.status === "locked" && (
      <Tooltip title="Mở khoá tài khoản">
        <IconButton
          size="small"
          onClick={() => handleUnlockAccount(r.readerId, r.fullName)}
          sx={{
            color: "#38A169",
            "&:hover": { backgroundColor: "rgba(56,161,105,0.1)" },
          }}
        >
          <UnlockIcon />
        </IconButton>
      </Tooltip>
    )}

    {/* Khôi phục độc giả */}
    {r.deleted ? (
      <Tooltip title="Khôi phục độc giả">
        <IconButton
          size="small"
          onClick={() => handleRestore(r.readerId, r.fullName)}
          sx={{
            color: "#38A169",
            "&:hover": { backgroundColor: "rgba(56,161,105,0.1)" },
          }}
        >
          <RestoreIcon />
        </IconButton>
      </Tooltip>
    ) : (
      /* Xóa độc giả */
      <Tooltip title="Xóa độc giả">
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
      </Tooltip>
    )}

  </Stack>
</TableCell>

</TableRow>

                    );
                  })
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
{/* Modal xem số dư */}
{balanceReader && (
  <ReaderBalanceModal
    open={!!balanceReader}
    reader={balanceReader}
    onClose={() => setBalanceReader(null)}
    onSuccess={fetchData}
  />
)}
      {paymentModalOpen && currentPaymentData && (
        <QRPaymentModal
          open={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setCurrentPaymentData(null);
          }}
          paymentData={currentPaymentData}
          onPaymentSuccess={handlePaymentSuccess}
        />
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
      {viewingReader && (
  <ViewReaderDetail
    open={!!viewingReader}
    reader={viewingReader}
    onClose={() => setViewingReader(null)}
  />
)}

    </Box>
  );
}