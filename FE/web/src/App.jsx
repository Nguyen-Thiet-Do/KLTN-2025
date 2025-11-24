// App.jsx
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";
import { router } from "./routes";
import { FavoriteProvider } from "./contexts/FavoriteContext";
import { NotificationProvider } from "./contexts/NotificationContext";

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <CartProvider>
          <FavoriteProvider>
            <RouterProvider router={router} />
          </FavoriteProvider>
        </CartProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
