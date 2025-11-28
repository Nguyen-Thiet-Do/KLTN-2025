// src/contexts/NotificationContext.jsx
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import api from "../services/api";
import { useAuth } from "./AuthContext";

// notistack
import { SnackbarProvider, closeSnackbar } from "notistack";
import { IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const NotificationContext = createContext();

export function useNotification() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef(null);

  // expose closeSnackbar globally (optional)
  window.__closeSnackbar = (id) => closeSnackbar(id);

  const getSocketBaseUrl = () => {
    const socketEnv = import.meta.env.VITE_SOCKET_URL;
    if (socketEnv) return socketEnv;
    const apiUrl = import.meta.env.VITE_API_URL;
    if (apiUrl) return apiUrl.replace(/\/api\/?$/, "");
    return window.location.origin;
  };

  // Load số chưa đọc — chỉ gọi khi đã có auth và token
  const loadUnreadCount = async () => {
    try {
      const res = await api.get("/notifications", {
        params: { page: 1, limit: 1, isRead: 0 },
      });
      setUnreadCount(res.data?.total ?? 0);
    } catch (err) {
      console.error("loadUnreadCount failed:", err?.response?.status || err);
      setUnreadCount(0);
    }
  };

  // Socket + Load unread count khi auth sẵn sàng
  useEffect(() => {
    if (authLoading) return;
    
    if (!isAuthenticated) {
      setUnreadCount(0); // Reset khi logout
      return;
    }

    const token = sessionStorage.getItem("accessToken");
    if (!token) return;

    // LẤY readerId để join room (KHÔNG dùng accountId)
    const readerId =
      user?.readerId ||
      JSON.parse(sessionStorage.getItem("profile") || "{}")?.readerId;

    if (!readerId) return;

    // ✅ THÊM: Load unread count ngay khi mount
    loadUnreadCount();

    const baseUrl = getSocketBaseUrl();

    // Clear socket cũ
    if (socketRef.current) {
      try { socketRef.current.disconnect(); } catch {}
      socketRef.current = null;
    }

    const socket = io(baseUrl, {
      auth: { token },
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    // --- ĐỊNH NGHĨA HÀM ---
    const onConnect = () => {
      console.log("✅ Socket connected");
    socket.emit("register", readerId);

    };

    const onConnectError = (err) => {
      console.error("❌ Socket connect_error:", err);
    };

    const onNewNotification = () => {
      console.log("🔔 New notification received");
      setUnreadCount((v) => v + 1);
    };

    // --- BIND ---
    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
    socket.on("notification:new", onNewNotification);

    // --- CLEANUP ---
    return () => {
      try {
        socket.off("connect", onConnect);
        socket.off("connect_error", onConnectError);
        socket.off("notification:new", onNewNotification);
        socket.disconnect();
      } catch {}
      socketRef.current = null;
    };
  }, [authLoading, isAuthenticated, user?.readerId]);

  // Mark read/unread/markAll
  const markRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/mark-read`);
      setUnreadCount((v) => Math.max(0, v - 1));
    } catch (err) {
      console.error("markRead error:", err?.response?.status || err);
      throw err;
    }
  };

  const markUnread = async (id) => {
    try {
      await api.post(`/notifications/${id}/mark-unread`);
      setUnreadCount((v) => v + 1);
    } catch (err) {
      console.error("markUnread error:", err?.response?.status || err);
      throw err;
    }
  };

  const markAllRead = async () => {
    try {
      await api.post("/notifications/mark-all-read");
      setUnreadCount(0);
    } catch (err) {
      console.error("markAllRead error:", err?.response?.status || err);
      throw err;
    }
  };

  // Giá trị context
  const ctxValue = {
    unreadCount,
    loadUnreadCount,
    markRead,
    markUnread,
    markAllRead,
  };

  return (
    <NotificationContext.Provider value={ctxValue}>
      <SnackbarProvider
        maxSnack={4}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        autoHideDuration={2600}
        preventDuplicate
        variant="info"
        action={(snackbarId) => (
          <IconButton size="small" onClick={() => closeSnackbar(snackbarId)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      >
        {children}
      </SnackbarProvider>
    </NotificationContext.Provider>
  );
}