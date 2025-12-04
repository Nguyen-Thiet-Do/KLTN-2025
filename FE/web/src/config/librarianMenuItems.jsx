import { 
  FaBookReader, 
  FaUserTie, 
  FaBook, 
  FaExchangeAlt, 
  FaChartBar, 
  FaBookOpen, 
  FaNewspaper, 
  FaBookmark,
  FaMoneyBillWave,  
  FaChartLine       
} from "react-icons/fa";

export const librarianMenuItems = [
  { path: "/librarian/readers", icon: FaBookReader, label: "Độc giả" },
  
  {
    path: "/librarian/documents",
    icon: FaBook,
    label: "Tài liệu",
    children: [
      { path: "/librarian/documents/books", label: "Sách", icon: FaBookOpen },
      { path: "/librarian/documents/newspapers", label: "Báo", icon: FaNewspaper },
      { path: "/librarian/documents/magazines", label: "Tạp chí", icon: FaBookmark },
    ],
  },

  { path: "/librarian/borrow", icon: FaExchangeAlt, label: "Mượn trả" },
  

  {
    path: "/librarian/statistics",
    icon: FaChartBar,
    label: "Thống kê",
    children: [
      { path: "/librarian/statistics", label: "Tổng quan", icon: FaChartLine },
      { path: "/librarian/fine-statistics", label: "Thống kê tiền phạt", icon: FaMoneyBillWave },
    ],
  },
];