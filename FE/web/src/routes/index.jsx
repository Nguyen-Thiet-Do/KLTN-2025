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

import FavoritePage from "../pages/favorite";

import NotificationPage from "../pages/reader/NotificationPage";
import NotificationDetailPage from "../pages/reader/NotificationDetailPage";

import LoanHistoryPage from "../pages/reader/LoanHistoryPage";

import ProfilePage from "../pages/reader/ProfilePage";

import Settings from "../pages/reader/Settings";

import LibraryRules from "../pages/reader/LibraryRules";

export const router = createBrowserRouter([
  {
    path: "/",

    children: [
      { index: true, element: <LibraryHome /> },
      { path: "books", element: <ReaderHome type="book" /> },
      { path: "newspapers", element: <ReaderHome type="newspaper" /> },
      { path: "magazines", element: <ReaderHome type="magazine" /> },
      { path: "/reader/rules", element: <LibraryRules /> },
      // ▼ ADD CART ROUTE
      { path: "cart", element: <CartPage /> },
      { path: "favorite", element: <FavoritePage /> },
      { path: "reader/loans/my", element: <LoanHistoryPage /> },
      { path: "notifications", element: <NotificationPage /> },
      { path: "notifications/:id", element: <NotificationDetailPage /> },
      // ▼ Chi tiết tài liệu
      { path: "reader/documents/:id", element: <DocumentDetail /> },
      { path: "/reader/ebook/:id", element: <EbookReader /> },

      { path: "profile", element: <ProfilePage /> },
      { path: "settings", element: <Settings /> },
    ],
  },

  // Auth / Admin / Librarian
  ...authRoutes,
  adminRoutes,
  librarianRoutes,

  { path: "/unauthorized", element: <Unauthorized /> },
  { path: "*", element: <NotFound /> },
]);
