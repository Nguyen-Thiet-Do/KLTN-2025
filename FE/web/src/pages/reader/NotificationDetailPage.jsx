import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Button,
} from "@mui/material";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";

import api from "../../services/api";
import { useNotification } from "../../contexts/NotificationContext";

import ReaderHeader from "../../components/layouts/ReaderHeader";
import ReaderFooter from "../../components/layouts/ReaderFooter";

export default function NotificationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { markRead, markUnread } = useNotification();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/notifications/${id}`);
      setItem(res.data?.data || null);

      // Auto mark-read nếu đang chưa đọc
      if (res.data?.data && res.data.data.isRead === 0) {
        await markRead(id);
      }
    } catch {
      setItem(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [id]);

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
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/notifications")}
          sx={{ mb: 2 }}
        >
          Quay lại danh sách
        </Button>

        {loading ? (
          <Box sx={{ textAlign: "center", py: 5 }}>
            <CircularProgress />
          </Box>
        ) : !item ? (
          <Typography textAlign="center" color="error">
            Không tìm thấy thông báo.
          </Typography>
        ) : (
          <Paper
            elevation={2}
            sx={{
              p: 3,
              borderRadius: 3,
              backgroundColor: item.isRead ? "#f9fafb" : "#e8f0fe",
            }}
          >
            {/* TITLE */}
            <Typography variant="h5" fontWeight={700} mb={1}>
              {item.title}
            </Typography>

            {/* CONTENT */}
            {item.content && (
              <Typography
                sx={{
                  whiteSpace: "pre-line",
                  fontSize: "0.95rem",
                }}
              >
                {item.content}
              </Typography>
            )}

            {/* TIME */}
            <Typography
              sx={{ fontSize: "0.8rem", mt: 2 }}
              color="text.secondary"
            >
              {new Date(item.created_at).toLocaleString("vi-VN")}
            </Typography>

            {/* ACTION */}
            <Box sx={{ mt: 3 }}>
              {item.isRead ? (
                <Button
                  color="warning"
                  startIcon={<MarkEmailUnreadIcon />}
                  onClick={async () => {
                    await markUnread(item.notificationID);
                    load();
                  }}
                >
                  Đánh dấu chưa đọc
                </Button>
              ) : (
                <Button
                  color="primary"
                  startIcon={<MarkEmailReadIcon />}
                  onClick={async () => {
                    await markRead(item.notificationID);
                    load();
                  }}
                >
                  Đánh dấu đã đọc
                </Button>
              )}
            </Box>
          </Paper>
        )}
      </Box>

      <ReaderFooter />
    </>
  );
}
