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
import { Delete, ShoppingCartCheckout } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import api from "../../services/api";

import ReaderHeader from "../../components/layouts/ReaderHeader";

export default function CartPage() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem("accessToken");
  const [cart, setCart] = useState([]);
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    severity: "info",
  });

const loadCart = async () => {
  try {
    const res = await api.get("/cart");
    setCart(Array.isArray(res.data) ? res.data : []);
  } catch (err) {
    console.log("Cart load error", err);
    setCart([]);
  }
};




  useEffect(() => {
    if (token) loadCart();
  }, [token]);

  // ⭐ REMOVE 1 ITEM
 const removeItem = async (documentId) => {
  try {
    await api.delete(`/cart/${documentId}`);
    loadCart();
  } catch (err) {}
};


  // ⭐ CLEAR ALL
const clearCart = async () => {
  await api.delete("/cart");
  loadCart();
};


  // ⭐ BORROW BOOKS
const borrowBooks = async () => {
  if (cart.length === 0) {
    setSnack({ open: true, message: "Giỏ sách trống", severity: "warning" });
    return;
  }

  try {
    await api.post("/loans/reader/loans/reserve", {
      items: cart.map(i => ({ documentId: i.documentId })),
      note: ""
    });

    setSnack({
      open: true,
      message: "Gửi yêu cầu thành công!",
      severity: "success",
    });

    await clearCart();

    // ⚡ CHUYỂN NGAY TỚI LỊCH SỬ
    navigate("/reader/loans/my");

  } catch (err) {
    setSnack({
      open: true,
      message: err.message || "Lỗi",
      severity: "error",
    });
  }
};


  if (!token) {
    return (
      <>
        <ReaderHeader />
        <Box sx={{ maxWidth: 900, mx: "auto", mt: 4 }}>
          <Alert severity="warning">Vui lòng đăng nhập!</Alert>
        </Box>
      </>
    );
  }

  return (
    <>
      <ReaderHeader />

      <Box sx={{ maxWidth: 900, mx: "auto", mt: 4, px: 2, mb: 6 }}>
        <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>
          Giỏ sách của bạn
        </Typography>

        <Paper sx={{ borderRadius: 3, p: 2, mb: 3 }} elevation={2}>
          {cart.length === 0 ? (
            <Typography sx={{ p: 3, textAlign: "center" }}>
              Giỏ sách đang trống.
            </Typography>
          ) : (
            <>
              <List>
                {cart.map((item) => (
                  <ListItem
                    key={item.documentId}
                    button
                    onClick={() => navigate(`/reader/documents/${item.documentId}`)}
                    sx={{ "&:hover": { backgroundColor: "rgba(0,0,0,0.04)" } }}
                    secondaryAction={
                      <Tooltip title="Xóa khỏi giỏ">
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

              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Button variant="outlined" color="error" onClick={clearCart}>
                  Xóa toàn bộ
                </Button>

                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<ShoppingCartCheckout />}
                  onClick={borrowBooks}
                >
                  Mượn sách
                </Button>
              </Box>
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
    </>
  );
}
