import { useEffect, useState } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
} from "@mui/material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { statisticApi } from "../../services/statisticApi";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [categories, setCategories] = useState([]);
  const [topBooks, setTopBooks] = useState([]);
const [topReaders, setTopReaders] = useState([]);

  useEffect(() => {
    (async () => {
      const allStats = await statisticApi.getAll();
      const monthlyStats = await statisticApi.getMonthly();
      const categoryStats = await statisticApi.getCategory();
      const topBookStats = await statisticApi.getTopBooks();
 const topReaderStats = await statisticApi.getTopReaders();
      setStats(allStats);
      setMonthly(monthlyStats.data);
      setCategories(categoryStats);
      setTopBooks(topBookStats);
      setTopReaders(topReaderStats);
    })();
  }, []);

  if (!stats) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  const cards = [
    { label: "Tổng đầu sách", value: stats.totalDocuments },
    { label: "Bản sao sách", value: stats.totalCopies },
    { label: "Người đọc", value: stats.totalReaders },
    { label: "Tổng phiếu mượn", value: stats.totalLoans },
    // { label: "Số phiếu mượn tháng này", value: stats.monthlyLoans },

    // ⭐ Thêm 2 card mới
    { label: "Tổng số cuốn sách được mượn", value: stats.totalBorrowedBooks },
    // { label: "Số cuốn sách được mượn tháng này", value: stats.monthlyBorrowedBooks },

    // { label: "Số sách đang được mượn", value: stats.borrowedCopies },
    { label: "Sách quá hạn", value: stats.overdueLoans },
    { label: "Thể loại phổ biến", value: stats.mostPopularGenre || "N/A" },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight={700} mb={3}>
        Thống kê thư viện
      </Typography>

      <Grid container spacing={2} mb={3}>
        {cards.map((c, i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  {c.label}
                </Typography>
                <Typography variant="h5" fontWeight={600}>
                  {c.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Biểu đồ mượn theo tháng */}
      <Card elevation={3}>
        <CardContent>
          <Typography variant="h6" mb={2}>
            Biểu đồ phiếu mượn theo tháng ({new Date().getFullYear()})
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
                <Bar dataKey="total" fill="#1976d2" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>
  {/* Top 5 sách */}
      <Card elevation={3} sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} mb={2}>
            Top 5 sách được mượn nhiều nhất
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
      {/* Top 5 độc giả mượn nhiều nhất */}
<Card elevation={3} sx={{ mt: 3 }}>
  <CardContent>
    <Typography variant="h6" fontWeight={700} mb={2}>
      Top 5 độc giả mượn nhiều nhất
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

      {/* Biểu đồ danh mục */}
      <Card elevation={3} sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} mb={2}>
            Thống kê số lượng sách theo danh mục
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

      
    </Box>
  );
}
