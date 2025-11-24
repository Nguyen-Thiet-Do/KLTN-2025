// App.jsx
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";    // <<< THÊM
import { router } from "./routes";
import { FavoriteProvider } from "./contexts/FavoriteContext";
import { NotificationProvider } from "./contexts/NotificationContext";

function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <CartProvider> 
          <FavoriteProvider>                      {/* <<< BỌC Ở ĐÂY */}
            <RouterProvider router={router} />
          </FavoriteProvider>
        </CartProvider>
      </AuthProvider>
    </NotificationProvider>
  );
}

export default App;
