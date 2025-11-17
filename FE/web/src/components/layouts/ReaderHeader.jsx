import { useMemo, useState, useEffect } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  AppBar,
  Toolbar,
  Box,
  Tabs,
  Tab,
  Button,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Typography,
  Tooltip,
  InputBase,
  Paper,
  Badge,
} from "@mui/material";
import {
  Search,
  NotificationsOutlined,
  BookmarkBorder,
  History,
  AccountCircle,
  Settings,
  ExitToApp,
  ShoppingCartOutlined,      // CART ICON ADDED
} from "@mui/icons-material";

export default function ReaderHeader() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();

  const [anchorEl, setAnchorEl] = useState(null);
  const [elevated, setElevated] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const maxContentWidth = 1280;

  const tabs = useMemo(
    () => [
      { path: "/", label: "Trang chủ", icon: "🏠" },
      { path: "/books", label: "Sách", icon: "📚" },
      { path: "/newspapers", label: "Báo", icon: "📰" },
      { path: "/magazines", label: "Tạp chí", icon: "🎯" },
    ],
    []
  );

  const currentTab = useMemo(
    () => tabs.find((t) => t.path === pathname)?.path ?? false,
    [pathname, tabs]
  );

  useEffect(() => {
    const onScroll = () => setElevated(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const initials = (user?.fullName?.[0] || user?.email?.[0] || "U").toUpperCase();

  const handleSearch = (e) => {
    if (e.key === "Enter" && searchValue.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchValue.trim())}`);
    }
  };

  const Left = (
    <Box
      onClick={() => navigate("/")}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        cursor: "pointer",
        minWidth: 200,
        flexShrink: 0,
      }}
    >
      <Box
        component="img"
        src="/logoo.png"
        alt="Logo"
        sx={{
          width: 40,
          height: 40,
          objectFit: "contain",
          borderRadius: 1,
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
        }}
      />
      <Typography
        variant="h6"
        sx={{
          fontWeight: 800,
          letterSpacing: 0.2,
          whiteSpace: "nowrap",
          lineHeight: 1,
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Book-Tech Library
      </Typography>
    </Box>
  );

  const Center = (
    <Box
      sx={{
        flexGrow: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
      }}
    >
      <Tabs
        value={currentTab}
        textColor="primary"
        indicatorColor="primary"
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{
          "& .MuiTabs-indicator": {
            height: 3,
            borderRadius: 3,
            backgroundColor: "primary.main",
          },
          "& .MuiTab-root": {
            textTransform: "none",
            fontWeight: 600,
            minHeight: 48,
            px: 2,
            mx: 0.5,
            borderRadius: 2,
            color: "text.secondary",
            fontSize: "0.9rem",
            "&.Mui-selected": {
              color: "primary.main",
              backgroundColor: "action.selected",
            },
            "&:hover": {
              backgroundColor: "action.hover",
              color: "primary.main",
            },
          },
        }}
      >
        {tabs.map((t) => (
          <Tab
            key={t.path}
            value={t.path}
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <span>{t.icon}</span>
                {t.label}
              </Box>
            }
            component={RouterLink}
            to={t.path}
          />
        ))}
      </Tabs>
    </Box>
  );

  const Right = (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        minWidth: 200,
        justifyContent: "flex-end",
      }}
    >
      {!isAuthenticated ? (
        <>
          <Button
            variant="text"
            onClick={() => navigate("/login")}
            sx={{ fontWeight: 600 }}
          >
            Đăng nhập
          </Button>
          <Button
            variant="contained"
            disableElevation
            sx={{
              borderRadius: 3,
              px: 3,
              fontWeight: 600,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            }}
            onClick={() => navigate("/signup")}
          >
            Đăng ký
          </Button>
        </>
      ) : (
        <>
          <Tooltip title="Thông báo">
            <IconButton size="small">
              <Badge badgeContent={3} color="error">
                <NotificationsOutlined />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* CART ICON ADDED */}
          <Tooltip title="Giỏ sách">
            <IconButton size="small" onClick={() => navigate("/cart")}>
              <Badge badgeContent={0} color="primary">
                <ShoppingCartOutlined />
              </Badge>
            </IconButton>
          </Tooltip>
          {/* END CART ICON */}

          <Tooltip title="Đã lưu">
            <IconButton size="small">
              <BookmarkBorder />
            </IconButton>
          </Tooltip>

          <Tooltip title={user?.fullName || user?.email}>
            <IconButton
              onClick={(e) => setAnchorEl(e.currentTarget)}
              size="small"
              sx={{
                ml: 1,
                border: (t) => `2px solid ${t.palette.divider}`,
                borderRadius: 2,
                transition: "all 0.2s ease",
                "&:hover": {
                  borderColor: "primary.main",
                },
              }}
            >
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: "primary.main",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                }}
              >
                {initials}
              </Avatar>
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            PaperProps={{
              sx: {
                width: 240,
                borderRadius: 2,
                mt: 1,
                boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={700} noWrap>
                {user?.fullName || "Người dùng"}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {user?.email}
              </Typography>
            </Box>

            <Divider />

            <MenuItem
              component={RouterLink}
              to="/profile"
              onClick={() => setAnchorEl(null)}
            >
              <AccountCircle sx={{ mr: 2, fontSize: 20 }} /> Hồ sơ
            </MenuItem>

            <MenuItem
              component={RouterLink}
              to="/reader/loans/my"
              onClick={() => setAnchorEl(null)}
            >
              <History sx={{ mr: 2, fontSize: 20 }} /> Lịch sử
            </MenuItem>

            <MenuItem
              component={RouterLink}
              to="/settings"
              onClick={() => setAnchorEl(null)}
            >
              <Settings sx={{ mr: 2, fontSize: 20 }} /> Cài đặt
            </MenuItem>

            <Divider />

    <MenuItem
  onClick={async () => {
    setAnchorEl(null);

    const oldUserId = localStorage.getItem("userId");

    // 🧹 Xóa đúng giỏ của user đang đăng xuất
    if (oldUserId) {
      localStorage.removeItem(`cart_${oldUserId}`);
    }

    // 🧹 Xóa userId
    localStorage.removeItem("userId");

    await logout();
    navigate("/");
  }}
>
  <ExitToApp sx={{ mr: 2, fontSize: 20 }} /> Đăng xuất
</MenuItem>


          </Menu>
        </>
      )}
    </Box>
  );

  return (
    <AppBar
      position="sticky"
      elevation={elevated ? 4 : 0}
      color="transparent"
      sx={{
        backdropFilter: "saturate(180%) blur(10px)",
        backgroundColor: "rgba(255,255,255,0.95)",
        borderBottom: (t) => `1px solid ${t.palette.divider}`,
        transition: (t) =>
          t.transitions.create(["box-shadow", "background-color"]),
      }}
    >
      <Box
        sx={{
          width: "100%",
          px: { xs: 2, sm: 3 },
          ...(maxContentWidth
            ? { maxWidth: maxContentWidth, mx: "auto" }
            : null),
        }}
      >
        <Toolbar
          disableGutters
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            py: 1,
            gap: 2,
          }}
        >
          {Left}
          {Center}
          {Right}
        </Toolbar>
      </Box>
    </AppBar>
  );
}
