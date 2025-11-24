// App.jsx
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";    // <<< THÊM
import { router } from "./routes";
import { FavoriteProvider } from "./contexts/FavoriteContext";
import NotificationsProvider from "./notifications/NotificationsProvider";

function App() {
  return (
    <NotificationsProvider>
      <AuthProvider>
        <CartProvider> 
          <FavoriteProvider>                      {/* <<< BỌC Ở ĐÂY */}
            <RouterProvider router={router} />
          </FavoriteProvider>
        </CartProvider>
      </AuthProvider>
    </NotificationsProvider>
  );
}

export default App;
