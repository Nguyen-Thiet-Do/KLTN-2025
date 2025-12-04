// ==========================================
// 📁 pages/FineStatisticsDashboard.jsx
// ==========================================
import { useEffect, useState } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
} from "@mui/material";
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
  LineChart,
  Line,
} from "recharts";
import { fineStatisticApi } from "../../services/fineStatisticApi";

export default function FineStatisticsDashboard() {
  const [overview, setOverview] = useState(null);
  const [byStatus, setByStatus] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [topViolators, setTopViolators] = useState([]);
  const [byType, setByType] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [overviewData, statusData, monthlyData, violatorsData, typeData] = 
        await Promise.all([
          fineStatisticApi.getOverview(),
          fineStatisticApi.getByStatus(),
          fineStatisticApi.getMonthly(),
          fineStatisticApi.getTopViolators(),
          fineStatisticApi.getByType(),
        ]);
      
      setOverview(overviewData);
      setByStatus(statusData);
      setMonthly(monthlyData);
      setTopViolators(violatorsData);
      setByType(typeData);
    } catch (error) {
      console.error("❌ Lỗi tải dữ liệu:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !overview) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  // 🎨 Màu sắc cho biểu đồ
  const STATUS_COLORS = {
    'Đã thanh toán': '#4caf50',
    'Chưa thanh toán': '#f44336',
    'Đang xử lý': '#ff9800'
  };

  // Format tiền VND
  const formatMoney = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  // Cards tổng quan
  const overviewCards = [
    { 
      label: "Tổng số vi phạm", 
      value: overview.tongSoViPham || 0,
      color: "#1976d2",
      icon: "📋"
    },
    { 
      label: "Tổng tiền phạt", 
      value: formatMoney(overview.tongTienPhat || 0),
      color: "#d32f2f",
      icon: "💰"
    },
    { 
      label: "Đã thu được", 
      value: formatMoney(overview.daThuDuoc || 0),
      subtitle: `Tỷ lệ: ${overview.tyLeThuHoi || 0}%`,
      color: "#388e3c",
      icon: "✅"
    },
    { 
      label: "Còn phải thu", 
      value: formatMoney(overview.conPhaiThu || 0),
      color: "#f57c00",
      icon: "⏳"
    },
    { 
      label: "Tiền phạt trung bình", 
      value: formatMoney(overview.tienPhatTrungBinh || 0),
      color: "#7b1fa2",
      icon: "📊"
    },
    { 
      label: "Số độc giả vi phạm", 
      value: overview.soDocGiaViPham || 0,
      color: "#0288d1",
      icon: "👥"
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* HEADER */}
      <Typography variant="h4" fontWeight={700} mb={3}>
        💸 Thống kê tiền phạt
      </Typography>

      {/* 1. TỔNG QUAN */}
      <Typography variant="h6" fontWeight={600} mb={2}>
        📊 Tổng quan
      </Typography>
      <Grid container spacing={2} mb={4}>
        {overviewCards.map((c, i) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={i}>
            <Card 
              elevation={3} 
              sx={{ 
                borderTop: `4px solid ${c.color}`,
                height: '100%'
              }}
            >
              <CardContent>
                <Typography variant="h4" sx={{ mb: 0.5 }}>
                  {c.icon}
                </Typography>
                <Typography variant="subtitle2" color="text.secondary">
                  {c.label}
                </Typography>
                <Typography variant="h5" fontWeight={600} color={c.color}>
                  {c.value}
                </Typography>
                {c.subtitle && (
                  <Typography variant="caption" color="text.secondary">
                    {c.subtitle}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* 2. BIỂU ĐỒ TRẠNG THÁI THANH TOÁN */}
      <Grid container spacing={3} mb={4}>
        {/* Biểu đồ tròn */}
        <Grid item xs={12} md={6}>
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} mb={2}>
                🎯 Tỷ lệ thanh toán
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ trangThai, soLuong, percent }) => 
                        `${trangThai}: ${soLuong} (${(percent * 100).toFixed(0)}%)`
                      }
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="soLuong"
                    >
                      {byStatus.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={STATUS_COLORS[entry.trangThai] || '#999'} 
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name, props) => [
                        `${value} vi phạm - ${formatMoney(props.payload.tongTien)}`,
                        props.payload.trangThai
                      ]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Bảng chi tiết */}
        <Grid item xs={12} md={6}>
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} mb={2}>
                📝 Chi tiết theo trạng thái
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Trạng thái</strong></TableCell>
                      <TableCell align="right"><strong>Số lượng</strong></TableCell>
                      <TableCell align="right"><strong>Tổng tiền</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {byStatus.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Chip 
                            label={row.trangThai}
                            size="small"
                            sx={{ 
                              backgroundColor: STATUS_COLORS[row.trangThai],
                              color: 'white'
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">{row.soLuong}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {formatMoney(row.tongTien)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

   
   
{/* 3. BIỂU ĐỒ TIỀN PHẠT THEO THÁNG */}
<Card elevation={3} sx={{ mb: 3 }}>
  <CardContent>
    <Typography variant="h6" fontWeight={700} mb={2}>
      💰 Tiền phạt theo tháng
    </Typography>
    <Box sx={{ height: 400 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={monthly}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="month" 
            tickFormatter={(m) => `T${m}`}
            interval={0}
          />
          <YAxis 
            tickFormatter={(value) => {
              if (value >= 1000000) return `${(value / 1000000).toFixed(1)}tr`;
              if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
              return value;
            }}
          />
          <Tooltip 
            formatter={(value, name) => [
              formatMoney(value),
              name === 'tongTienPhat' ? 'Tổng tiền phạt' : 'Đã thu'
            ]}
            labelFormatter={(month) => `Tháng ${month}`}
          />
          <Legend 
            formatter={(value) => 
              value === 'tongTienPhat' ? 'Tổng tiền phạt' : 'Đã thu'
            }
          />
          <Line 
            type="monotone" 
            dataKey="tongTienPhat" 
            stroke="#d32f2f" 
            strokeWidth={3}
            name="tongTienPhat"
            dot={{ r: 5 }}
            activeDot={{ r: 8 }}
          />
          <Line 
            type="monotone" 
            dataKey="daThu" 
            stroke="#4caf50" 
            strokeWidth={3}
            name="daThu"
            dot={{ r: 5 }}
            activeDot={{ r: 8 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  </CardContent>
</Card>

{/* 4. BIỂU ĐỒ SỐ VI PHẠM THEO THÁNG */}
<Card elevation={3} sx={{ mb: 3 }}>
  <CardContent>
    <Typography variant="h6" fontWeight={700} mb={2}>
      📊 Số vi phạm theo tháng
    </Typography>
    <Box sx={{ height: 400 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={monthly}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="month" 
            tickFormatter={(m) => `T${m}`}
            interval={0}
          />
          <YAxis 
            label={{ value: 'Số vi phạm', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            formatter={(value) => [`${value} vi phạm`, 'Số vi phạm']}
            labelFormatter={(month) => `Tháng ${month}`}
          />
          <Bar 
            dataKey="soViPham" 
            fill="#9c27b0"
            name="Số vi phạm"
            radius={[8, 8, 0, 0]}
          >
            {monthly.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.soViPham > 0 ? '#9c27b0' : '#e0e0e0'} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  </CardContent>
</Card>

      {/* 4. TOP 10 ĐỘC GIẢ VI PHẠM */}
      <Card elevation={3} sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} mb={2}>
            🏆 Top 10 độc giả vi phạm nhiều nhất
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell><strong>#</strong></TableCell>
                  <TableCell><strong>Họ tên</strong></TableCell>
                  <TableCell><strong>CCCD</strong></TableCell>
                  <TableCell align="center"><strong>Số lần vi phạm</strong></TableCell>
                  <TableCell align="right"><strong>Tổng tiền phạt</strong></TableCell>
                  <TableCell align="right"><strong>Đã thu</strong></TableCell>
                  <TableCell align="right"><strong>Còn nợ</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {topViolators.map((reader, idx) => (
                  <TableRow key={reader.readerId} hover>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>{reader.fullName}</TableCell>
                    <TableCell>{reader.cccd}</TableCell>
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

      {/* 5. THỐNG KÊ THEO LOẠI VI PHẠM */}
      <Card elevation={3}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} mb={2}>
            📋 Thống kê theo loại vi phạm
          </Typography>
          {byType.length > 0 ? (
            <Box sx={{ height: byType.length * 60 + 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={byType}
                  layout="vertical"
                  margin={{ top: 20, right: 30, left: 100, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis 
                    dataKey="loaiViPham" 
                    type="category" 
                    width={150}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(value, name) => [
                      formatMoney(value),
                      name === 'tongTienPhat' ? 'Tổng tiền phạt' :
                      name === 'tienPhatTrungBinh' ? 'Trung bình' : name
                    ]}
                  />
                  <Legend />
                  <Bar 
                    dataKey="tongTienPhat" 
                    fill="#ff9800" 
                    name="Tổng tiền phạt"
                    barSize={20}
                  />
                  <Bar 
                    dataKey="tienPhatTrungBinh" 
                    fill="#2196f3" 
                    name="Trung bình"
                    barSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          ) : (
            <Alert severity="info">Chưa có dữ liệu vi phạm</Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}