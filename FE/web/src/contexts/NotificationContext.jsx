// src/contexts/NotificationContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import api from "../services/api";

const NotificationContext = createContext();

export function useNotification() {
  return useContext(NotificationContext);
}

// EXPORT ĐÚNG TÊN -> KHỚP App.jsx
export function NotificationProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);

  // Lấy số thông báo chưa đọc
  const loadUnreadCount = async () => {
    try {
      const res = await api.get("/notifications", {
        page: 1,
        limit: 1,
        isRead: 0,
      });

      setUnreadCount(res.data?.total || 0);
    } catch {
      setUnreadCount(0);
    }
  };

  // Load đầu tiên
  useEffect(() => {
    loadUnreadCount();
  }, []);

  // Kết nối realtime Socket.IO
  useEffect(() => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return;

    const accountId = sessionStorage.getItem("accountId");
    if (!accountId) return;

    const socket = io("http://localhost:8080", {
      auth: { token },
    });

    // Join đúng room
    socket.emit("join", `user_${accountId}`);

    // Khi có thông báo mới -> tăng số chưa đọc
    socket.on("notification:new", () => {
      setUnreadCount((v) => v + 1);
    });

    return () => socket.disconnect();
  }, []);

  // API: đánh dấu đã đọc
  const markRead = async (id) => {
    await api.post(`/notifications/${id}/mark-read`);
    setUnreadCount((v) => Math.max(0, v - 1));
  };

  // API: đánh dấu chưa đọc
  const markUnread = async (id) => {
    await api.post(`/notifications/${id}/mark-unread`);
    setUnreadCount((v) => v + 1);
  };

  // API: đánh dấu tất cả đã đọc
  const markAllRead = async () => {
    await api.post("/notifications/mark-all-read");
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        loadUnreadCount,
        markRead,
        markUnread,
        markAllRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
