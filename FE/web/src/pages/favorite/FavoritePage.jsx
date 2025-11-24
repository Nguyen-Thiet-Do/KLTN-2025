import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Button,
  Divider,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Tooltip,
  Snackbar,
  Alert
} from "@mui/material";

import { Delete } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

import api from "../../services/api";
import { useFavorite } from "../../contexts/FavoriteContext";

import ReaderHeader from "../../components/layouts/ReaderHeader";
import ReaderFooter from "../../components/layouts/ReaderFooter";

export default function FavoritePage() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem("accessToken");

  const [items, setItems] = useState([]);
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  const { loadFavorite } = useFavorite();

  const load = async () => {
    try {
      const res = await api.get("/favorite");
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setItems([]);
    }
  };

  useEffect(() => {
    if (token) load();
  }, [token]);

  const removeItem = async (documentId) => {
    try {
      await api.delete(`/favorite/${documentId}`);
      load();
      loadFavorite();
    } catch (err) {}
  };

  const clearAll = async () => {
    try {
      await api.delete("/favorite");
      load();
      loadFavorite();
    } catch (err) {}
  };

  if (!token) {
    return (
      <>
        <ReaderHeader />
        <Box sx={{ maxWidth: 900, mx: "auto", mt: 4 }}>
          <Alert severity="warning">Vui lòng đăng nhập để xem yêu thích.</Alert>
        </Box>
      </>
    );
  }

  return (
    <>
      <ReaderHeader />

      <Box sx={{ maxWidth: 900, mx: "auto", mt: 4, px: 2, mb: 6 }}>
        <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>
          Sách yêu thích
        </Typography>

        <Paper sx={{ borderRadius: 3, p: 2, mb: 3 }} elevation={2}>
          {items.length === 0 ? (
            <Typography sx={{ p: 3, textAlign: "center" }}>
              Chưa có sách yêu thích.
            </Typography>
          ) : (
            <>
              <List>
                {items.map((item) => (
                  <ListItem
                    key={item.documentId}
                    button
                    onClick={() =>
                      navigate(`/reader/documents/${item.documentId}`)
                    }
                    sx={{
                      "&:hover": { backgroundColor: "rgba(0,0,0,0.04)" },
                    }}
                    secondaryAction={
                      <Tooltip title="Xóa khỏi yêu thích">
                        <IconButton
                          edge="end"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeItem(item.documentId);
                          }}
                        >
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar
                        src={item.coverPhoto}
                        alt={item.title}
                        sx={{ width: 48, height: 48, borderRadius: 1 }}
                      >
                        {item.title?.[0] || "?"}
                      </Avatar>
                    </ListItemAvatar>

                    <ListItemText primary={item.title} />
                  </ListItem>
                ))}
              </List>

              <Divider sx={{ my: 2 }} />

              <Button variant="outlined" color="error" onClick={clearAll}>
                Xóa toàn bộ
              </Button>
            </>
          )}
        </Paper>

        <Snackbar
          open={snack.open}
          autoHideDuration={3000}
          onClose={() => setSnack({ ...snack, open: false })}
        >
          <Alert severity={snack.severity} variant="filled">
            {snack.message}
          </Alert>
        </Snackbar>
      </Box>

      <ReaderFooter />
    </>
  );
}
