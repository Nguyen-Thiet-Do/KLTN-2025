// src/routes/index.js
import { createBrowserRouter } from "react-router-dom";
import { authRoutes } from "./authRoutes";
import { adminRoutes } from "./adminRoutes";
import { librarianRoutes } from "./librarianRoutes";
import Unauthorized from "../pages/Unauthorized";
import NotFound from "../pages/NotFound";

// Reader FE
import ReaderHome from "../pages/ReaderHome/ReaderHome";
import LibraryHome from "../pages/LibraryHome";
import DocumentDetail from "../pages/ReaderHome/DocumentDetail";
import EbookReader from "../pages/ReaderHome/EbookReader";

// ▼ ADD: Cart
import CartPage from "../pages/cart";

import LoanHistoryPage from "../pages/reader/LoanHistoryPage";


export const router = createBrowserRouter([
  {
    path: "/",
    
    children: [
      { index: true, element: <LibraryHome /> },
      { path: "books", element: <ReaderHome type="book" /> },
      { path: "newspapers", element: <ReaderHome type="newspaper" /> },
      { path: "magazines", element: <ReaderHome type="magazine" /> },

      // ▼ ADD CART ROUTE
      { path: "cart", element: <CartPage /> },
{ path: "reader/loans/my", element: <LoanHistoryPage /> },

      // ▼ Chi tiết tài liệu
      { path: "reader/documents/:id", element: <DocumentDetail /> },
      { path: "/reader/ebook/:id", element: <EbookReader /> },
    ],
  },

  // Auth / Admin / Librarian
  ...authRoutes,
  adminRoutes,
  librarianRoutes,

  { path: "/unauthorized", element: <Unauthorized /> },
  { path: "*", element: <NotFound /> },
]);
