// src/routes/index.js
import { createBrowserRouter } from "react-router-dom";
import { authRoutes } from "./authRoutes";
import { adminRoutes } from "./adminRoutes";
import { librarianRoutes } from "./librarianRoutes";
import Unauthorized from "../pages/Unauthorized";
import NotFound from "../pages/NotFound";

// === Import thêm các trang Reader (FE cho độc giả) ===
import ReaderHome from "../pages/ReaderHome/ReaderHome";
import LibraryHome from "../pages/LibraryHome";

// === Định nghĩa router chính ===
export const router = createBrowserRouter([
  // --- ROUTES CHO ĐỘC GIẢ / TRANG CHỦ ---
  {
    path: "/",
    children: [
      { index: true, element: <LibraryHome /> },
      { path: "books", element: <ReaderHome type="book" /> },
      { path: "newspapers", element: <ReaderHome type="newspaper" /> },
      { path: "magazines", element: <ReaderHome type="magazine" /> },
      
    ],
  },

  // --- ROUTES ĐĂNG NHẬP / ADMIN / THỦ THƯ ---
  ...authRoutes,
  adminRoutes,
  librarianRoutes,

  // --- ROUTES KHÁC ---
  {
    path: "/unauthorized",
    element: <Unauthorized />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);
