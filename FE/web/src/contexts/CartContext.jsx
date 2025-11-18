import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [count, setCount] = useState(0);

  const loadCart = async () => {
    try {
      const res = await api.get("/cart");
      setCount(Array.isArray(res.data) ? res.data.length : 0);
    } catch {
      setCount(0);
    }
  };

  useEffect(() => {
    loadCart();
  }, []);

  return (
    <CartContext.Provider value={{ count, setCount, loadCart }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);