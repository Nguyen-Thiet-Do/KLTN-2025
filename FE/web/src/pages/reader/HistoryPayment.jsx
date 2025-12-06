// src/pages/reader/HistoryPayment.jsx
import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableHead,
  Chip,
  Stack,
  Pagination,
  Alert
} from "@mui/material";
import ReaderHeader from "../../components/layouts/ReaderHeader";
import { paymentService } from "../../services/paymentService";

export default function HistoryPayment() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1 });
  const [cashflow, setCashflow] = useState({ inflow: 0, outflow: 0, net: 0 });
  const [error, setError] = useState(null);

  const fetchPayments = async (page = 1) => {
    try {
      const res = await paymentService.getMyPayments({
        page,
        limit: 10,
      });

      setRows(res.data || []);
      setPagination(res.pagination);
      setCashflow(res.cashflow);
    } catch (err) {
      setError("Không thể tải lịch sử thanh toán");
    }
  };

  useEffect(() => {
    fetchPayments(1);
  }, []);

  const renderType = (type) => {
    const colorMap = {
      DEPOSIT: "success",
      CARD_PURCHASE: "success",
      CARD_REGISTER: "success",
      CARD_RENEWAL: "info",
      CARD_UPGRADE: "info",
      FINE: "error",
      VIOLATION: "error",
    };
    return <Chip label={type} size="small" color={colorMap[type] || "default"} />;
  };

  return (
    <>
      <ReaderHeader />

      <Box
        sx={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          py: 6,
          px: 2,
        }}
      >
        <Box sx={{ maxWidth: 900, mx: "auto" }}>
          <Paper
            elevation={0}
            sx={{
              borderRadius: 4,
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            {/* Header */}
            <Box
              sx={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                py: 5,
                px: 4,
                textAlign: "center",
              }}
            >
              <Typography variant="h4" sx={{ color: "white", fontWeight: 700 }}>
                Lịch sử thanh toán
              </Typography>

              <Typography
                variant="body1"
                sx={{ color: "rgba(255,255,255,0.85)", mt: 1 }}
              >
                Theo dõi các giao dịch thẻ thành viên và chi phí phạt (Nếu có)
              </Typography>
            </Box>

            {/* Content */}
            <Box sx={{ p: 4 }}>
              {error && (
                <Alert
                  severity="error"
                  sx={{ mb: 3, borderRadius: 2 }}
                  onClose={() => setError(null)}
                >
                  {error}
                </Alert>
              )}

              {/* CARD – Tổng quan dòng tiền */}
              <Card
                sx={{
                  mb: 4,
                  borderRadius: 3,
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  boxShadow: "0 8px 24px rgba(102, 126, 234, 0.3)",
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Typography sx={{ opacity: 0.9 }}>
                    Tổng tiền vào
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {cashflow.inflow.toLocaleString()} đ
                  </Typography>

                  <Typography sx={{ opacity: 0.9, mt: 2 }}>
                    Tổng tiền Phạt
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {cashflow.outflow.toLocaleString()} đ
                  </Typography>

                  <Typography sx={{ opacity: 0.9, mt: 2 }}>
                    Sô dư
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {cashflow.net.toLocaleString()} đ
                  </Typography>
                </CardContent>
              </Card>

              {/* BẢNG LỊCH SỬ */}
              <Card sx={{ borderRadius: 3, boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
                <CardContent sx={{ p: 3 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Loại</strong></TableCell>
                        <TableCell><strong>Số tiền</strong></TableCell>
                        <TableCell><strong>Phương thức</strong></TableCell>
                        <TableCell><strong>Trạng thái</strong></TableCell>
                        <TableCell><strong>Ngày tạo</strong></TableCell>
                        <TableCell><strong>Phiếu mượn</strong></TableCell>
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {rows.map((item) => (
                        <TableRow key={item.paymentId}>
                          <TableCell>{renderType(item.paymentType)}</TableCell>
                          <TableCell>{item.amount.toLocaleString()} đ</TableCell>
                          <TableCell>{item.paymentMethod || "-"}</TableCell>
                          <TableCell>{item.status}</TableCell>
                          <TableCell>{item.created_at?.slice(0, 19) || "-"}</TableCell>
                          <TableCell>{item.LoanSlip?.loanSlipId || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Stack direction="row" justifyContent="center" sx={{ mt: 3 }}>
                    <Pagination
                      page={pagination.page}
                      count={pagination.totalPages}
                      onChange={(e, p) => fetchPayments(p)}
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          </Paper>
        </Box>
      </Box>
    </>
  );
}
