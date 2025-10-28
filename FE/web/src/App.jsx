// App.jsx
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { router } from "./routes";
import NotificationsProvider from "./notifications/NotificationsProvider"; // <— file đã tạo

function App() {
  return (
    <NotificationsProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </NotificationsProvider>
  );
}

export default App;
