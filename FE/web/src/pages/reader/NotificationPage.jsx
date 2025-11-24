import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Tooltip,
  Pagination,
  Paper,
  Button,
} from "@mui/material";

import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import DoneAllIcon from "@mui/icons-material/DoneAll";

import api from "../../services/api";
import { useNotification } from "../../contexts/NotificationContext";

import ReaderHeader from "../../components/layouts/ReaderHeader";
import ReaderFooter from "../../components/layouts/ReaderFooter";

// >>> THÊM
import { useNavigate } from "react-router-dom";

export default function NotificationPage() {
  const { markRead, markUnread, markAllRead } = useNotification();
  const navigate = useNavigate(); // >>> THÊM

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  const load = async () => {
    setLoading(true);

    try {
      const res = await api.get("/notifications", {
        page,
        limit,
        sortDir: "DESC",
        sortBy: "created_at",
      });

      setItems(res.data?.data || []);
      setTotal(res.data?.total || 0);
    } catch {
      setItems([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [page]);

  return (
    <>
      <ReaderHeader />

      <Box
        sx={{
          maxWidth: 900,
          mx: "auto",
          mt: 4,
          px: 2,
          mb: 8,
        }}
      >
        <Box
          sx={{
            mb: 3,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="h4" fontWeight={700}>
            Thông báo của bạn
          </Typography>

          <Button
            variant="outlined"
            size="small"
            startIcon={<DoneAllIcon />}
            onClick={async () => {
              await markAllRead();
              await load();
            }}
          >
            Đánh dấu tất cả đã đọc
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ textAlign: "center", py: 5 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {items.length === 0 ? (
              <Typography sx={{ textAlign: "center", py: 5 }}>
                Không có thông báo nào.
              </Typography>
            ) : (
              items.map((n) => (
                <Paper
                  key={n.notificationID}
                  elevation={0}
                  sx={{
                    p: 2,
                    mb: 2,
                    borderRadius: 3,
                    border: "1px solid #e5e7eb",
                    backgroundColor: n.isRead ? "#f9fafb" : "#e8f0fe",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 2,
                    cursor: "pointer", // >>> THÊM
                    "&:hover": { backgroundColor: "#e2e8f0" }, // >>> THÊM hiệu ứng hover
                  }}
                  onClick={() => navigate(`/notifications/${n.notificationID}`)} // >>> THÊM
                >
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography fontWeight={700} sx={{ fontSize: "1rem", mb: 0.5 }}>
                      {n.title}
                    </Typography>

                    {n.content && (
                      <Typography
                        sx={{ whiteSpace: "pre-line", fontSize: "0.9rem" }}
                        color="text.secondary"
                      >
                        {n.content}
                      </Typography>
                    )}

                    <Typography
                      sx={{ fontSize: "0.75rem", mt: 1 }}
                      color="text.disabled"
                    >
                      {new Date(n.created_at).toLocaleString("vi-VN")}
                    </Typography>
                  </Box>

                  <Tooltip title={n.isRead ? "Đánh dấu chưa đọc" : "Đánh dấu đã đọc"}>
                    <IconButton
                      onClick={async (e) => {
                        e.stopPropagation(); // >>> NGĂN MỞ TRANG CHI TIẾT
                        if (n.isRead) await markUnread(n.notificationID);
                        else await markRead(n.notificationID);
                        await load();
                      }}
                      sx={{
                        backgroundColor: "rgba(0,0,0,0.05)",
                        "&:hover": { backgroundColor: "rgba(0,0,0,0.1)" },
                      }}
                    >
                      {n.isRead ? (
                        <MarkEmailReadIcon color="primary" />
                      ) : (
                        <MarkEmailUnreadIcon color="action" />
                      )}
                    </IconButton>
                  </Tooltip>
                </Paper>
              ))
            )}

            {total > limit && (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
                <Pagination
                  count={Math.ceil(total / limit)}
                  page={page}
                  onChange={(e, val) => setPage(val)}
                  color="primary"
                />
              </Box>
            )}
          </>
        )}
      </Box>

      <ReaderFooter />
    </>
  );
}
