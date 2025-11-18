// App.jsx
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";    // <<< THÊM
import { router } from "./routes";
import NotificationsProvider from "./notifications/NotificationsProvider";

function App() {
  return (
    <NotificationsProvider>
      <AuthProvider>
        <CartProvider>                       {/* <<< BỌC Ở ĐÂY */}
          <RouterProvider router={router} />
        </CartProvider>
      </AuthProvider>
    </NotificationsProvider>
  );
}

export default App;
