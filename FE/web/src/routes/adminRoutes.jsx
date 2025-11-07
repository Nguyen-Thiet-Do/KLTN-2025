import AdminLayout from "../components/page-layouts/AdminLayout";
import Dashboard from "../pages/Dashboard/Dashboard";
import Readers from "../pages/Readers/Readers";
import Librarians from "../pages/Librarians/Librarians";
import Borrow from "../pages/Borrow/Borrow";
import Book from "../pages/Documents/Books/Book";
import ProtectedRoute from "./ProtectedRoute";
import Newspaper from "../pages/Documents/Newspapers/Newspaper";
import Magazine from "../pages/Documents/Magazines/Magazine";

import AdminDashboard from "../pages/AdminDashboard/AdminDashboard";

export const adminRoutes = {
  path: "/admin",
  element: <ProtectedRoute allowedRoles={[1]} />,
  children: [
    {
      element: <AdminLayout />,
      children: [
        { index: true, element: <Dashboard /> },
        { path: "readers", element: <Readers /> },
        { path: "librarians", element: <Librarians /> },
        { path: "documents/books", element: <Book /> },
        { path: "documents/newspapers", element: <Newspaper/> },
        { path: "documents/magazines", element: <Magazine/>  },
        { path: "dashboard", element: <AdminDashboard /> }, 
        { path: "borrow", element: <Borrow /> },
      ],
    },
  ],
};