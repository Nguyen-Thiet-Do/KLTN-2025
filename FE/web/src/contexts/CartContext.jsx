import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "./AuthContext";

const CartContext = createContext();

export function CartProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [count, setCount] = useState(0);

  const loadCart = async () => {
    if (!isAuthenticated || !user?.readerId) {
      setCount(0);
      return;
    }
    try {
      const res = await api.get("/cart");
      setCount(Array.isArray(res.data) ? res.data.length : 0);
    } catch {
      setCount(0);
    }
  };

  useEffect(() => {
    loadCart();
  }, [user]); // reload cart khi user login/logout hoặc thay đổi

  return (
    <CartContext.Provider value={{ count, setCount, loadCart }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
