import LibrarianLayout from "../components/page-layouts/LibrarianLayout";
import LibrarianDashboard from "../pages/Dashboard/LibrarianDashboard";
import Borrow from "../pages/Borrow/Borrow";
import Readers from "../pages/Readers/Readers";
import ProtectedRoute from "./ProtectedRoute";
import Book from "../pages/Documents/Books/Book";
import Newspaper from "../pages/Documents/Newspapers/Newspaper";
import Magazine from "../pages/Documents/Magazines/Magazine";
import AdminDashboard from "../pages/AdminDashboard/AdminDashboard";

export const librarianRoutes = {
  path: "/librarian",
  element: <ProtectedRoute allowedRoles={[2]} />,
  children: [
    {
      element: <LibrarianLayout />,
      children: [
        { index: true, element: <LibrarianDashboard /> },
        { path: "readers", element: <Readers /> },
        { path: "documents/books", element: <Book /> },
        { path: "documents/newspapers", element: <Newspaper /> },
        { path: "documents/magazines", element: <Magazine /> },
        { path: "borrow", element: <Borrow /> },
        { path: "statistics", element: <AdminDashboard />}
      ],
    },
  ],
};