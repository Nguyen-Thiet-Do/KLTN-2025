import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "../../fonts/Roboto"; 

import {
  Box,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Divider,
  Stack,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import {
  TrendingUp,
  MenuBook,
  CheckCircle,
  HourglassEmpty,
  Assessment,
  Warning,
  Payment,
  Cancel,
  AttachMoney,
  PersonOff,
  AccountBalance,
} from "@mui/icons-material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { statisticApi } from "../../services/statisticApi";

export default function BorrowReturnReport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [fineData, setFineData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
const handleExportPDF = () => {
  if (!data && !fineData) return;

 
 const doc = new jsPDF();
doc.setFont("Roboto-VariableFont_wdth,wght", "normal"); 
doc.setFontSize(12);


  const title = `BÁO CÁO MƯỢN – TRẢ & TIỀN PHẠT\nTừ ${formatDate(from)} đến ${formatDate(to)}`;
  doc.setFontSize(16);
  doc.text(title, 105, 15, { align: "center" });

  // ----- SECTION 1: MƯỢN TRẢ -----
  doc.setFontSize(14);
  doc.text("I. Báo cáo Mượn – Trả", 14, 30);

  autoTable(doc, {
    startY: 35,
    head: [["Chi so", "Gia tri"]],
    body: [
      ["Tổng số sách mượn", data.totalBooks],
      ["Đã trả", data.returned],
      ["Đang mượn", data.borrowing],
      ["Chờ đến lấy", data.waitingPickup],
      ["Mất sách", data.lost],
      ["Đặt chỗ", data.pending],
      ["Sách quá hạn", data.overdue],
    ],
    theme: "striped",
    styles: { font: "Roboto-VariableFont_wdth,wght", fontSize: 10 },
    headStyles: { fillColor: [25, 118, 210] },
  });

  let y = doc.lastAutoTable.finalY + 10;

  // ----- SECTION 2: TIỀN PHẠT -----
  doc.setFontSize(14);
  doc.text("II. Báo cáo Tiền phạt", 14, y);

   autoTable(doc, {
    startY: y + 5,
    head: [["Chi so", "Gia tri"]],
    body: [
      ["Tổng số vi phạm", fineData.fineCount],
      ["Tổng tiền phạt", formatMoney(fineData.fineTotal)],
      ["Đã thu", formatMoney(fineData.finePaid)],
      ["Còn nợ", formatMoney(fineData.fineUnpaid)],
      ["Tiền phạt trung bình", formatMoney(fineData.fineAvg)],
      ["Số độc giả vi phạm", fineData.fineReaders],
    ],
    theme: "striped",
     styles: { font: "Roboto-VariableFont_wdth,wght", fontSize: 10 },
    headStyles: { fillColor: [244, 67, 54] },
  });

  y = doc.lastAutoTable.finalY + 15;

  // ----- SECTION 3: LOẠI VI PHẠM -----
  doc.setFontSize(13);
  doc.text("III. Tổng hợp theo loại vi phạm", 14, y);

  autoTable(doc, {
    startY: y + 5,
    head: [["Loai vi pham", "So tien", "Ty le (%)"]],
    body: [
      [
        "Trả muộn",
        formatMoney(fineData.overdueFine),
        calculatePercentage(fineData.overdueFine, fineData.fineTotal),
      ],
      [
        "Mất sách",
        formatMoney(fineData.lostFine),
        calculatePercentage(fineData.lostFine, fineData.fineTotal),
      ],
      [
        "Hư hỏng",
        formatMoney(fineData.damagedFine),
        calculatePercentage(fineData.damagedFine, fineData.fineTotal),
      ],
    ],
    theme: "grid",
    styles: { font: "Roboto-VariableFont_wdth,wght", fontSize: 10 },
  });

  y = doc.lastAutoTable.finalY + 15;

  // ----- SECTION 4: TOP VIOLATORS -----
  if (fineData.topViolators && fineData.topViolators.length > 0) {
    doc.setFontSize(13);
    doc.text("IV. Top 5 độc giả vi phạm", 14, y);

    const violatorData = fineData.topViolators.map((r, i) => [
      i + 1,
      r.readerId,
      r.fullName,
      r.soLanViPham,
      formatMoney(r.tongTienPhat),
      formatMoney(r.daThu),
      formatMoney(r.conNo),
    ]);

  autoTable(doc, {
      startY: y + 5,
      head: [["#", "Ma docgia", "Ho ten", "SL vi pham", "Tien phat", "Da thu", "CCon no"]],
      body: violatorData,
      theme: "grid",
      styles: { font: "Roboto-VariableFont_wdth,wght", fontSize: 10 },
    });
  }

  doc.save(`Bao_cao_muon_tra_tien_phat_${from}_den_${to}.pdf`);
};

  const handleLoad = async () => {
    if (!from || !to) {
      setError("Vui lòng chọn đầy đủ thời gian");
      return;
    }

    if (new Date(from) > new Date(to)) {
      setError("Ngày bắt đầu phải trước ngày kết thúc");
      return;
    }

    setError("");
    setData(null);
    setFineData(null);
    setLoading(true);

    try {
      console.log('🔍 Sending request with:', { from, to });
      
      // Gọi cả 2 API song song
      const [loanRes, fineRes] = await Promise.all([
        statisticApi.getReportLoans(from, to),
        statisticApi.getFineReport(from, to)
      ]);
      
      console.log('✅ Loan data:', loanRes);
      console.log('✅ Fine data:', fineRes);
      
      setData(loanRes);
      setFineData(fineRes);
    } catch (e) {
      console.error('❌ Error details:', e);
      setError(e.message || "Không lấy được dữ liệu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount || 0);
  };

  const calculatePercentage = (value, total) => {
    if (total === 0) return 0;
    return ((value / total) * 100).toFixed(1);
  };

  const StatCard = ({ title, value, icon, color, percentage, isMoney }) => (
    <Card
      elevation={3}
      sx={{
        height: "100%",
        background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
        border: `2px solid ${color}30`,
        transition: "all 0.3s",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: 6,
        },
      }}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1}>
            <Typography variant="body2" color="text.secondary" fontWeight={500} mb={1}>
              {title}
            </Typography>
            <Typography variant="h3" fontWeight={700} color={color} mb={1}>
              {isMoney ? formatMoney(value) : value.toLocaleString()}
            </Typography>
            {percentage !== undefined && (
              <Chip
                label={`${percentage}%`}
                size="small"
                sx={{
                  bgcolor: `${color}20`,
                  color: color,
                  fontWeight: 600,
                }}
              />
            )}
          </Box>
          <Box sx={{ color: color, opacity: 0.7 }}>{icon}</Box>
        </Stack>
      </CardContent>
    </Card>
  );

  // Màu sắc cho biểu đồ
  const FINE_TYPE_COLORS = {
    'Trả muộn': '#ff9800',
    'Mất sách': '#f44336',
    'Hư hỏng': '#9c27b0'
  };

  // Chuẩn bị dữ liệu cho biểu đồ tiền phạt theo loại
  const prepareFineTypeData = () => {
    if (!fineData) return [];
    
    return [
      { name: 'Trả muộn', value: fineData.overdueFine || 0, color: FINE_TYPE_COLORS['Trả muộn'] },
      { name: 'Mất sách', value: fineData.lostFine || 0, color: FINE_TYPE_COLORS['Mất sách'] },
      { name: 'Hư hỏng', value: fineData.damagedFine || 0, color: FINE_TYPE_COLORS['Hư hỏng'] }
    ].filter(item => item.value > 0);
  };

  return (
    <Box sx={{ p: 3, bgcolor: "#f5f7fa", minHeight: "100vh" }}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={3}>
          <Assessment sx={{ fontSize: 40, color: "primary.main" }} />
          <Box>
            <Typography variant="h4" fontWeight={700} color="primary.main">
              Báo cáo hoạt động mượn – trả & Tiền phạt
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Thống kê chi tiết về hoạt động mượn trả sách và tiền phạt theo khoảng thời gian
            </Typography>
          </Box>
        </Stack>

        <Divider sx={{ mb: 3 }} />

        {/* Date Range Selection */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={5}>
            <TextField
              label="Từ ngày"
              type="date"
              fullWidth
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  "&:hover fieldset": { borderColor: "primary.main" },
                },
              }}
            />
          </Grid>

          <Grid item xs={12} sm={5}>
            <TextField
              label="Đến ngày"
              type="date"
              fullWidth
              value={to}
              onChange={(e) => setTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  "&:hover fieldset": { borderColor: "primary.main" },
                },
              }}
            />
          </Grid>

          <Grid item xs={12} sm={2}>
            <Button
              variant="contained"
              fullWidth
              onClick={handleLoad}
              disabled={loading || !from || !to}
              sx={{
                height: "56px",
                fontWeight: 600,
                fontSize: "1rem",
              }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "Tạo báo cáo"
              )}
            </Button>
          </Grid>
          <Grid item xs={12} sm={2}>
  <Button
    variant="outlined"
    fullWidth
    onClick={handleExportPDF}
    disabled={!data && !fineData}
    sx={{
      height: "56px",
      fontWeight: 600,
      fontSize: "1rem",
    }}
  >
    Xuất PDF
  </Button>
</Grid>

        </Grid>

        {/* Info Alert */}
        {from && to && !loading && !data && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Chọn khoảng thời gian từ <strong>{formatDate(from)}</strong> đến{" "}
            <strong>{formatDate(to)}</strong> và nhấn "Tạo báo cáo"
          </Alert>
        )}

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}
      </Paper>

      {/* ========== PHẦN THỐNG KÊ MƯỢN TRẢ ========== */}
      {data && (
        <>
          <Typography variant="h5" fontWeight={700} mb={2} color="primary.main">
            📚 Thống kê Mượn - Trả
          </Typography>

          {/* Statistics Cards - Row 1 */}
          <Grid container spacing={2} mb={2}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Tổng số cuốn sách được mượn"
                value={data.totalBooks}
                icon={<Assessment sx={{ fontSize: 40 }} />}
                color="#1976d2"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Đã trả"
                value={data.returned || 0}
                icon={<CheckCircle sx={{ fontSize: 40 }} />}
                color="#4caf50"
                percentage={calculatePercentage(data.returned, data.totalBooks)}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Đang mượn"
                value={data.borrowing || 0}
                icon={<MenuBook sx={{ fontSize: 40 }} />}
                color="#ff9800"
                percentage={calculatePercentage(data.borrowing, data.totalBooks)}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Chờ đến lấy"
                value={data.waitingPickup || 0}
                icon={<HourglassEmpty sx={{ fontSize: 40 }} />}
                color="#2196f3"
                percentage={calculatePercentage(data.waitingPickup, data.totalBooks)}
              />
            </Grid>
          </Grid>

          {/* Statistics Cards - Row 2 */}
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Mất sách"
                value={data.lost || 0}
                icon={<Cancel sx={{ fontSize: 40 }} />}
                color="#f44336"
                percentage={calculatePercentage(data.lost, data.totalBooks)}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Đặt Chỗ"
                value={data.pending || 0}
                icon={<Warning sx={{ fontSize: 40 }} />}
                color="#9c27b0"
                percentage={calculatePercentage(data.pending, data.totalBooks)}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Sách quá hạn"
                value={data.overdue || 0}
                icon={<Warning sx={{ fontSize: 40 }} />}
                color="#d32f2f"
                percentage={calculatePercentage(data.overdue, data.totalBooks)}
              />
            </Grid>

            {/* <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Chờ thanh toán"
                value={data.pendingPayment || 0}
                icon={<Payment sx={{ fontSize: 40 }} />}
                color="#ff5722"
                percentage={calculatePercentage(data.pendingPayment, data.totalBooks)}
              />
            </Grid> */}
          </Grid>

          {/* Loan Summary Section */}
          <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" fontWeight={600} mb={2} color="primary.main">
              📊 Tóm tắt báo cáo mượn - trả
            </Typography>

            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap mb={3}>
              <Chip
                label={`Khoảng thời gian: ${formatDate(from)} - ${formatDate(to)}`}
                color="primary"
                variant="outlined"
                icon={<Assessment />}
              />
              <Chip
                label={`Tỷ lệ hoàn trả: ${calculatePercentage(data.returned, data.totalBooks)}%`}
                color="success"
                variant="outlined"
                icon={<CheckCircle />}
              />
              {data.overdue > 0 && (
                <Chip
                  label={`Quá hạn: ${data.overdue} cuốn`}
                  color="error"
                  variant="outlined"
                  icon={<Warning />}
                />
              )}
            </Stack>

            <Divider sx={{ my: 2 }} />

            {/* Progress Bar */}
            <Typography variant="subtitle1" fontWeight={600} mb={2}>
              Tiến độ hoàn trả
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" mb={1}>
                    <Typography variant="body2" color="text.secondary" fontWeight={600}>
                      Tỷ lệ trả sách
                    </Typography>
                    <Typography variant="body2" fontWeight={700} color="success.main">
                      {calculatePercentage(data.returned, data.totalBooks)}%
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={parseFloat(calculatePercentage(data.returned, data.totalBooks))}
                    sx={{
                      height: 12,
                      borderRadius: 2,
                      bgcolor: "#e0e0e0",
                      "& .MuiLinearProgress-bar": {
                        bgcolor: "#4caf50",
                        borderRadius: 2,
                      },
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" mt={1}>
                    {data.returned} / {data.totalBooks} cuốn đã được trả
                  </Typography>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </>
      )}

      {/* ========== PHẦN THỐNG KÊ TIỀN PHẠT ========== */}
      {fineData && (
        <>
          <Divider sx={{ my: 4 }} />
          
          <Typography variant="h5" fontWeight={700} mb={2} color="error.main">
            💰 Thống kê Tiền phạt
          </Typography>

          {/* Fine Overview Cards */}
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Tổng số vi phạm"
                value={fineData.fineCount || 0}
                icon={<Warning sx={{ fontSize: 40 }} />}
                color="#d32f2f"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Tổng tiền phạt"
                value={fineData.fineTotal || 0}
                icon={<AttachMoney sx={{ fontSize: 40 }} />}
                color="#f44336"
                isMoney
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Đã thu được"
                value={fineData.finePaid || 0}
                icon={<AccountBalance sx={{ fontSize: 40 }} />}
                color="#4caf50"
                isMoney
                percentage={calculatePercentage(fineData.finePaid, fineData.fineTotal)}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Còn phải thu"
                value={fineData.fineUnpaid || 0}
                icon={<PersonOff sx={{ fontSize: 40 }} />}
                color="#ff9800"
                isMoney
              />
            </Grid>
          </Grid>

          <Grid container spacing={2} mb={4}>
            <Grid item xs={12} sm={6} md={4}>
              <StatCard
                title="Tiền phạt trung bình"
                value={fineData.fineAvg || 0}
                icon={<TrendingUp sx={{ fontSize: 40 }} />}
                color="#9c27b0"
                isMoney
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <StatCard
                title="Số độc giả vi phạm"
                value={fineData.fineReaders || 0}
                icon={<PersonOff sx={{ fontSize: 40 }} />}
                color="#0288d1"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Card
                elevation={3}
                sx={{
                  height: "100%",
                  background: "linear-gradient(135deg, #4caf5015 0%, #4caf5005 100%)",
                  border: "2px solid #4caf5030",
                }}
              >
                <CardContent>
                  <Typography variant="body2" color="text.secondary" fontWeight={500} mb={1}>
                    Tỷ lệ thu hồi
                  </Typography>
                  <Typography variant="h3" fontWeight={700} color="#4caf50" mb={1}>
                    {calculatePercentage(fineData.finePaid, fineData.fineTotal)}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={parseFloat(calculatePercentage(fineData.finePaid, fineData.fineTotal))}
                    sx={{
                      height: 8,
                      borderRadius: 2,
                      bgcolor: "#e0e0e0",
                      "& .MuiLinearProgress-bar": {
                        bgcolor: "#4caf50",
                        borderRadius: 2,
                      },
                    }}
                  />
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Fine Type Breakdown */}
          <Grid container spacing={3} mb={4}>
            {/* Biểu đồ tròn phân loại tiền phạt */}
            <Grid item xs={12} md={6}>
              <Card elevation={3}>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} mb={2}>
                    📊 Phân loại tiền phạt
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={prepareFineTypeData()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value, percent }) => 
                            `${name}: ${formatMoney(value)} (${(percent * 100).toFixed(0)}%)`
                          }
                          outerRadius={100}
                          dataKey="value"
                        >
                          {prepareFineTypeData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatMoney(value)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Bảng chi tiết loại vi phạm */}
            <Grid item xs={12} md={6}>
              <Card elevation={3}>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} mb={2}>
                    💵 Chi tiết theo loại vi phạm
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Loại vi phạm</strong></TableCell>
                          <TableCell align="right"><strong>Số tiền</strong></TableCell>
                          <TableCell align="right"><strong>Tỷ lệ</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell>
                            <Chip 
                              label="Trả muộn"
                              size="small"
                              sx={{ bgcolor: '#ff9800', color: 'white' }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {formatMoney(fineData.overdueFine)}
                          </TableCell>
                          <TableCell align="right">
                            {calculatePercentage(fineData.overdueFine, fineData.fineTotal)}%
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>
                            <Chip 
                              label="Mất sách"
                              size="small"
                              sx={{ bgcolor: '#f44336', color: 'white' }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {formatMoney(fineData.lostFine)}
                          </TableCell>
                          <TableCell align="right">
                            {calculatePercentage(fineData.lostFine, fineData.fineTotal)}%
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>
                            <Chip 
                              label="Hư hỏng"
                              size="small"
                              sx={{ bgcolor: '#9c27b0', color: 'white' }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {formatMoney(fineData.damagedFine)}
                          </TableCell>
                          <TableCell align="right">
                            {calculatePercentage(fineData.damagedFine, fineData.fineTotal)}%
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Top Violators */}
          {fineData.topViolators && fineData.topViolators.length > 0 && (
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} mb={2}>
                  🏆 Top 5 độc giả vi phạm
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                        <TableCell><strong>#</strong></TableCell>
                        <TableCell><strong>Mã độc giả</strong></TableCell>
                        <TableCell><strong>Họ tên</strong></TableCell>
                        <TableCell align="center"><strong>Số lần vi phạm</strong></TableCell>
                        <TableCell align="right"><strong>Tổng tiền phạt</strong></TableCell>
                        <TableCell align="right"><strong>Đã thu</strong></TableCell>
                        <TableCell align="right"><strong>Còn nợ</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {fineData.topViolators.map((reader, idx) => (
                        <TableRow key={reader.readerId} hover>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>{reader.readerId}</TableCell>
                          <TableCell>{reader.fullName}</TableCell>
                          <TableCell align="center">
                            <Chip 
                              label={reader.soLanViPham}
                              size="small"
                              color="error"
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {formatMoney(reader.tongTienPhat)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'green' }}>
                            {formatMoney(reader.daThu)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'red', fontWeight: 600 }}>
                            {formatMoney(reader.conNo)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
}