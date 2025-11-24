import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "./AuthContext";

const FavoriteContext = createContext();

export function FavoriteProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [favoriteCount, setFavoriteCount] = useState(0);

  const loadFavorite = async () => {
    if (!isAuthenticated || !user?.readerId) {
      setFavoriteCount(0);
      return;
    }

    try {
      const res = await api.get("/favorite");
      setFavoriteCount(res.data.length || 0);
    } catch {
      setFavoriteCount(0);
    }
  };

  useEffect(() => {
    loadFavorite();
  }, [user]);

  return (
    <FavoriteContext.Provider value={{ favoriteCount, loadFavorite }}>
      {children}
    </FavoriteContext.Provider>
  );
}

export const useFavorite = () => useContext(FavoriteContext);
