// menu.ts/js
import { FaBookReader, FaUserTie, FaBook, FaExchangeAlt, FaChartBar, FaBookOpen, FaNewspaper, FaBookmark } from "react-icons/fa";

export const adminMenuItems = [
  { path: "/admin/readers", icon: FaBookReader, label: "Độc giả" },
  { path: "/admin/librarians", icon: FaUserTie, label: "Thủ thư" },

  {
    path: "/admin/documents",
    icon: FaBook,
    label: "Tài liệu",
    children: [
      { path: "/admin/documents/books", label: "Sách", icon: FaBookOpen },
      { path: "/admin/documents/newspapers", label: "Báo", icon: FaNewspaper },
      { path: "/admin/documents/magazines", label: "Tạp chí", icon: FaBookmark },
    ],
  },

  { path: "/admin/borrow", icon: FaExchangeAlt, label: "Mượn trả" },
  { path: "/admin/statistics", icon: FaChartBar, label: "Thống kê" },
];
