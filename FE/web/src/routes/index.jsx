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
import PdfJsViewer from "../pages/ReaderHome/PdfJsViewer";
import FlipBookViewer from "../pages/ReaderHome/FlipBookViewer";

export const router = createBrowserRouter([
  {
    path: "/",
    children: [
      { index: true, element: <LibraryHome /> },
      { path: "books", element: <ReaderHome type="book" /> },
      { path: "newspapers", element: <ReaderHome type="newspaper" /> },
      { path: "magazines", element: <ReaderHome type="magazine" /> },

      // ▼ Trang chi tiết tài liệu
      { path: "reader/documents/:id", element: <DocumentDetail /> },
      { path: "reader/ebook/:id", element: <PdfJsViewer /> },
      { path: "reader/flip/:id", element: <FlipBookViewer /> },
    ],
  },

  // Auth / Admin / Librarian
  ...authRoutes,
  adminRoutes,
  librarianRoutes,

  { path: "/unauthorized", element: <Unauthorized /> },
  { path: "*", element: <NotFound /> },
]);
