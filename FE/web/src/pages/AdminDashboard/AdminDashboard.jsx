import { useEffect, useState } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Divider,
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
} from "recharts";
import { statisticApi } from "../../services/statisticApi";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [categories, setCategories] = useState([]);
  const [topBooks, setTopBooks] = useState([]);
  const [topReaders, setTopReaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [allStats, monthlyStats, categoryStats, topBookStats, topReaderStats] = 
        await Promise.all([
          statisticApi.getAll(),
          statisticApi.getMonthly(),
          statisticApi.getCategory(),
          statisticApi.getTopBooks(),
          statisticApi.getTopReaders(),
        ]);
      
      console.log('📊 Monthly stats:', monthlyStats); // Debug
      
      setStats(allStats);
      setMonthly(monthlyStats); // ✅ SỬA: Không lấy .data nữa
      setCategories(categoryStats);
      setTopBooks(topBookStats);
      setTopReaders(topReaderStats);
    } catch (error) {
      console.error("❌ Lỗi tải dữ liệu:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  // 🎨 Màu cho biểu đồ tròn
  const COLORS = ['#4caf50', '#2196f3', '#ff9800', '#f44336', '#9c27b0', '#ffeb3b'];

  // 📊 Dữ liệu cho biểu đồ tròn trạng thái sách
  const bookStatusData = [
    { name: 'Đã trả', value: stats.returnedBooks, color: '#4caf50' },
    { name: 'Chờ đến lấy', value: stats.waitingPickupBooks, color: '#2196f3' },
    { name: 'Đang mượn', value: stats.borrowingBooks, color: '#ff9800' },
    { name: 'Mất sách', value: stats.lostBooks, color: '#f44336' },
    { name: 'Đặt Chỗ', value: stats.pendingBooks, color: '#9c27b0' },
  ].filter(item => item.value > 0);

  const basicCards = [
    { label: "Tổng đầu sách", value: stats.totalDocuments, color: "#1976d2" },
    { label: "Bản sao sách", value: stats.totalCopies, color: "#388e3c" },
    { label: "Người đọc", value: stats.totalReaders, color: "#f57c00" },
    { label: "Tổng phiếu mượn", value: stats.totalLoans, color: "#7b1fa2" },
  ];

  const borrowStatCards = [
    { 
      label: "Tổng số cuốn sách được mượn", 
      value: stats.totalBorrowedBooks,
      subtitle: `${stats.monthlyBorrowedBooks} sách được mượn tháng này`,
      color: "#0288d1" 
    },
    { label: "Đã trả", value: stats.returnedBooks, color: "#4caf50" },
    { label: "Đang mượn", value: stats.borrowingBooks, color: "#ff9800" },
    { label: "Chờ đến lấy", value: stats.waitingPickupBooks, color: "#2196f3" },
    { label: "Mất sách", value: stats.lostBooks, color: "#f44336" },
    { label: "Đặt Chỗ", value: stats.pendingBooks, color: "#9c27b0" },
    { label: "Sách quá hạn", value: stats.overdueLoans, color: "#d32f2f" },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight={700} mb={3}>
        📊 Thống kê thư viện
      </Typography>

      {/* Thống kê cơ bản */}
      <Typography variant="h6" fontWeight={600} mb={2}>
        Tổng quan hệ thống
      </Typography>
      <Grid container spacing={2} mb={4}>
        {basicCards.map((c, i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <Card elevation={3} sx={{ borderTop: `4px solid ${c.color}` }}>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  {c.label}
                </Typography>
                <Typography variant="h4" fontWeight={600} color={c.color}>
                  {c.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Thống kê mượn sách chi tiết */}
      <Typography variant="h6" fontWeight={600} mb={2}>
        📚 Chi tiết mượn sách
      </Typography>
      <Grid container spacing={2} mb={4}>
        {borrowStatCards.map((c, i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <Card elevation={3} sx={{ 
              borderLeft: `5px solid ${c.color}`,
              height: '100%'
            }}>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {c.label}
                </Typography>
                <Typography variant="h4" fontWeight={700} color={c.color}>
                  {c.value}
                </Typography>
                {c.subtitle && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {c.subtitle}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Biểu đồ tròn trạng thái sách */}
      {bookStatusData.length > 0 && (
        <Card elevation={3} sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} mb={2}>
              📈 Phân bổ trạng thái sách mượn
            </Typography>
            <Box sx={{ height: 350, display: 'flex', alignItems: 'center' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={bookStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => 
                      `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {bookStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} cuốn`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Biểu đồ mượn theo tháng */}
      <Card elevation={3} sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} mb={2}>
            📅 Biểu đồ phiếu mượn theo tháng ({new Date().getFullYear()})
          </Typography>
          <Box sx={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tickFormatter={(m) => `T${m}`}
                  interval={0}
                />
                <YAxis />
                <Tooltip formatter={(v) => `${v} phiếu`} />
                <Bar dataKey="total" fill="#1976d2" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      {/* Top 5 sách */}
      {topBooks.length > 0 && (
        <Card elevation={3} sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} mb={2}>
              🏆 Top 5 sách được mượn nhiều nhất
            </Typography>
            <Box sx={{ width: "100%", height: topBooks.length * 50 + 120 }}>
              <ResponsiveContainer>
                <BarChart
                  data={topBooks}
                  layout="vertical"
                  margin={{ top: 20, right: 30, left: 100, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    dataKey="title"
                    type="category"
                    width={180}
                    tick={{ fontSize: 13 }}
                  />
                  <Tooltip formatter={(v) => `${v} lượt`} />
                  <Bar
                    dataKey="total"
                    fill="#82b1ff"
                    barSize={25}
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Top 5 độc giả */}
      {topReaders.length > 0 && (
        <Card elevation={3} sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} mb={2}>
              👥 Top 5 độc giả mượn nhiều nhất
            </Typography>
            <Box sx={{ width: "100%", height: topReaders.length * 50 + 120 }}>
              <ResponsiveContainer>
                <BarChart
                  data={topReaders}
                  layout="vertical"
                  margin={{ top: 20, right: 30, left: 120, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    dataKey="reader"
                    type="category"
                    width={200}
                    tick={{ fontSize: 13 }}
                  />
                  <Tooltip formatter={(v) => `${v} lượt`} />
                  <Bar
                    dataKey="total"
                    fill="#4fc3f7"
                    barSize={25}
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Biểu đồ danh mục */}
      {categories.length > 0 && (
        <Card elevation={3}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} mb={2}>
              📚 Thống kê số lượng sách theo danh mục
            </Typography>
            <Box sx={{ width: "100%", height: categories.length * 40 + 120 }}>
              <ResponsiveContainer>
                <BarChart
                  data={categories}
                  layout="vertical"
                  margin={{ top: 20, right: 30, left: 80, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    dataKey="category"
                    type="category"
                    width={160}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip formatter={(v) => `${v} sách`} />
                  <Bar
                    dataKey="total"
                    fill="#90caf9"
                    barSize={20}
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}