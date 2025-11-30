import { useEffect, useState } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Tabs,
  Tab,
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

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  
  const [summary, setSummary] = useState(null);
  const [borrowByDay, setBorrowByDay] = useState([]);
  const [neverBorrowed, setNeverBorrowed] = useState([]);
  const [inactiveReaders, setInactiveReaders] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [summaryData, dayData, neverData, inactiveData] = await Promise.all([
        statisticApi.getReportSummary(),
        statisticApi.getBorrowByDay(),
        statisticApi.getNeverBorrowed(),
        statisticApi.getInactiveReaders()
      ]);
      
      console.log('📊 Summary:', summaryData);
      console.log('📅 Day data:', dayData);
      console.log('📚 Never borrowed:', neverData);
      console.log('👥 Inactive readers:', inactiveData);
      
      setSummary(summaryData);
      setBorrowByDay(dayData);
      setNeverBorrowed(neverData);
      setInactiveReaders(inactiveData);
    } catch (error) {
      console.error("❌ Lỗi tải báo cáo:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight={700} mb={3}>
        📋 Báo cáo chi tiết
      </Typography>

      {/* Tổng quan nhanh */}
      <Grid container spacing={2} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3} sx={{ borderTop: "4px solid #f44336" }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Sách chưa từng được mượn
              </Typography>
              <Typography variant="h4" fontWeight={600} color="#f44336">
                {summary?.totalNeverBorrowedBooks || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3} sx={{ borderTop: "4px solid #ff9800" }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Độc giả không hoạt động
              </Typography>
              <Typography variant="h4" fontWeight={600} color="#ff9800">
                {summary?.totalInactiveReaders || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3} sx={{ borderTop: "4px solid #4caf50" }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Ngày đông nhất
              </Typography>
              <Typography variant="h6" fontWeight={600} color="#4caf50">
                {summary?.busiestDay?.name || 'N/A'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {summary?.busiestDay?.count || 0} lượt mượn
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3} sx={{ borderTop: "4px solid #2196f3" }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Ngày vắng nhất
              </Typography>
              <Typography variant="h6" fontWeight={600} color="#2196f3">
                {summary?.quietestDay?.name || 'N/A'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {summary?.quietestDay?.count || 0} lượt mượn
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card elevation={3}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="📅 Mượn theo ngày" />
          <Tab label="📚 Sách chưa mượn" />
          <Tab label="👥 Độc giả không hoạt động" />
        </Tabs>

        {/* Tab 1: Biểu đồ theo ngày */}
        <TabPanel value={tabValue} index={0}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} mb={2}>
              📊 Lượt mượn theo ngày trong tuần
            </Typography>
            {borrowByDay.length > 0 ? (
              <>
                <Box sx={{ height: 350 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={borrowByDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip formatter={(v) => `${v} lượt`} />
                      <Bar dataKey="total" fill="#1976d2" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  💡 <strong>Gợi ý:</strong> Bố trí thêm nhân viên vào{" "}
                  <strong>{summary?.busiestDay?.name}</strong> để phục vụ tốt hơn.
                </Typography>
              </>
            ) : (
              <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 5 }}>
                Chưa có dữ liệu mượn sách trong năm nay
              </Typography>
            )}
          </CardContent>
        </TabPanel>

        {/* Tab 2: Sách chưa mượn */}
        <TabPanel value={tabValue} index={1}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} mb={2}>
              📚 Danh sách sách chưa từng được mượn ({neverBorrowed.length})
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Tiêu đề</strong></TableCell>
                    <TableCell><strong>Tác giả</strong></TableCell>
                    <TableCell align="center"><strong>Năm XB</strong></TableCell>
                    <TableCell align="center"><strong>Số bản sao</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {neverBorrowed.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        🎉 Tất cả sách đều đã được mượn ít nhất 1 lần!
                      </TableCell>
                    </TableRow>
                  ) : (
                    neverBorrowed.map((book) => (
                      <TableRow key={book.documentId} hover>
                        <TableCell>{book.title}</TableCell>
                        <TableCell>{book.author || 'N/A'}</TableCell>
                        <TableCell align="center">{book.publishYear}</TableCell>
                        <TableCell align="center">
                          <Chip label={book.totalCopies} size="small" color="primary" />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            {neverBorrowed.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                💡 <strong>Gợi ý:</strong> Cân nhắc quảng bá hoặc loại bỏ các đầu sách này.
              </Typography>
            )}
          </CardContent>
        </TabPanel>

        {/* Tab 3: Độc giả không hoạt động */}
        <TabPanel value={tabValue} index={2}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} mb={2}>
              👥 Độc giả không hoạt động &gt;3 tháng ({inactiveReaders.length})
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Họ tên</strong></TableCell>
                    <TableCell><strong>Địa chỉ</strong></TableCell>
                    <TableCell align="center"><strong>Lần mượn cuối</strong></TableCell>
                    <TableCell align="center"><strong>Số ngày</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {inactiveReaders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        🎉 Tất cả độc giả đều hoạt động tích cực!
                      </TableCell>
                    </TableRow>
                  ) : (
                    inactiveReaders.map((reader) => (
                      <TableRow key={reader.readerId} hover>
                        <TableCell>{reader.fullName}</TableCell>
                        <TableCell>{reader.phoneNumber || 'N/A'}</TableCell>
                        <TableCell align="center">
                          {reader.lastBorrowDate 
                            ? new Date(reader.lastBorrowDate).toLocaleDateString("vi-VN")
                            : "Chưa từng mượn"}
                        </TableCell>
                        <TableCell align="center">
                          <Chip 
                            label={reader.daysSinceLastBorrow > 365 
                              ? ">1 năm" 
                              : `${reader.daysSinceLastBorrow} ngày`
                            }
                            size="small"
                            color={reader.daysSinceLastBorrow > 180 ? "error" : "warning"}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            {inactiveReaders.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                💡 <strong>Gợi ý:</strong> Gửi email/SMS nhắc nhở hoặc khuyến mãi để kích hoạt lại độc giả.
              </Typography>
            )}
          </CardContent>
        </TabPanel>
      </Card>
    </Box>
  );
}