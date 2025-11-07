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

  useEffect(() => {
    (async () => {
      const allStats = await statisticApi.getAll();
      const monthlyStats = await statisticApi.getMonthly();
      setStats(allStats);
      setMonthly(monthlyStats.data);
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
    { label: "Tổng lượt mượn", value: stats.totalLoans },
    { label: "Lượt mượn tháng này", value: stats.monthlyLoans },
    { label: "Đang được mượn", value: stats.borrowedCopies },
    { label: "Sách quá hạn", value: stats.overdueLoans },
    { label: "Thể loại phổ biến", value: stats.mostPopularGenre || "N/A" },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight={700} mb={3}>
        Thống kê thư viện
      </Typography>

      {/* ====== Thẻ thống kê ====== */}
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

      {/* ====== Biểu đồ lượt mượn 12 tháng ====== */}
      <Card elevation={3}>
        <CardContent>
          <Typography variant="h6" mb={2}>
            Biểu đồ lượt mượn theo tháng ({new Date().getFullYear()})
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
                <Tooltip
                  formatter={(v) => `${v} lượt`}
                  labelFormatter={(m) => `Tháng ${m}`}
                />
                <Bar dataKey="total" fill="#1976d2" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
