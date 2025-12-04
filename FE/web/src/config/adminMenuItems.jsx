// menu.ts/js
import { 
  FaBookReader, 
  FaUserTie, 
  FaBook, 
  FaExchangeAlt, 
  FaChartBar, 
  FaBookOpen, 
  FaNewspaper, 
  FaBookmark, 
  FaClipboardList,
  FaMoneyBillWave, 
  FaChartLine       
} from "react-icons/fa";

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
  
 
  {
    path: "/admin/dashboard",
    icon: FaChartBar,
    label: "Thống kê",
    children: [
      { path: "/admin/dashboard", label: "Tổng quan", icon: FaChartLine },
      { path: "/admin/fine-statistics", label: "Thống kê tiền phạt", icon: FaMoneyBillWave },
    ],
  },

  { path: "/admin/reports", icon: FaClipboardList, label: "Báo cáo" ,
     children: [
      { path: "/admin/reports", label: "Tổng quan", icon: FaChartLine },
      { path: "/admin/borrow-return-report", label: "Báo Cáo Mượn Trả", icon: FaExchangeAlt },
    ],
  },
];