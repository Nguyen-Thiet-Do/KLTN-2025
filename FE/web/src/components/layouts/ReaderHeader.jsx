import { useMemo, useState, useEffect } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import { useFavorite } from "../../contexts/FavoriteContext";
import { useNotification } from "../../contexts/NotificationContext";
import ChatWindow from "../../pages/chat/ChatWindow";

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
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Search,
  NotificationsOutlined,
  BookmarkBorder,
  History,
  AccountCircle,
  Settings,
  ExitToApp,
  ShoppingCartOutlined, 
  FavoriteBorder,
  Menu as MenuIcon,
  Close as CloseIcon,
  Home,
  MenuBook,
  Newspaper,
  Article,
} from "@mui/icons-material";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";

export default function ReaderHeader() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();

  const [anchorEl, setAnchorEl] = useState(null);
  const [elevated, setElevated] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [openChat, setOpenChat] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const maxContentWidth = 1280;
  const { count } = useCart();
  const { favoriteCount } = useFavorite();
  const { unreadCount } = useNotification();

  useEffect(() => {
    console.log("🔔 ReaderHeader - unreadCount changed:", unreadCount);
  }, [unreadCount]);

  const tabs = useMemo(
    () => [
      { path: "/", label: "Trang chủ", icon: "🏠", iconComponent: <Home /> },
      { path: "/books", label: "Sách", icon: "📚", iconComponent: <MenuBook /> },
      { path: "/newspapers", label: "Báo", icon: "📰", iconComponent: <Newspaper /> },
      { path: "/magazines", label: "Tạp chí", icon: "🎯", iconComponent: <Article /> },
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
        gap: { xs: 1, sm: 2 },
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <Box
        component="img"
        src="/logoo.png"
        alt="Logo"
        sx={{
          width: { xs: 32, sm: 40 },
          height: { xs: 32, sm: 40 },
          objectFit: "contain",
          borderRadius: 1,
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
        }}
      />
      {!isSmall && (
        <Typography
          variant="h6"
          sx={{
            fontWeight: 800,
            fontSize: { xs: "0.9rem", sm: "1.1rem" },
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
      )}
    </Box>
  );

  const Center = !isMobile && (
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
        gap: { xs: 0.5, sm: 1 },
        flexShrink: 0,
      }}
    >
      {!isAuthenticated ? (
        <>
          {!isSmall && (
            <Button
              variant="text"
              onClick={() => navigate("/login")}
              sx={{ 
                fontWeight: 600,
                fontSize: { xs: "0.85rem", sm: "0.9rem" }
              }}
            >
              Đăng nhập
            </Button>
          )}
          <Button
            variant="contained"
            disableElevation
            sx={{
              borderRadius: 3,
              px: { xs: 2, sm: 3 },
              fontWeight: 600,
              fontSize: { xs: "0.85rem", sm: "0.9rem" },
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
            <IconButton size="small" onClick={() => navigate("/notifications")}>
              <Badge badgeContent={unreadCount} color="error">
                <NotificationsOutlined fontSize="small" />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title="Giỏ sách">
            <IconButton size="small" onClick={() => navigate("/cart")}>
              <Badge badgeContent={count} color="primary">
                <ShoppingCartOutlined fontSize="small" />
              </Badge>
            </IconButton>
          </Tooltip>

          {!isSmall && (
            <>
              <Tooltip title="Yêu thích">
                <IconButton size="small" onClick={() => navigate("/favorite")}>
                  <Badge badgeContent={favoriteCount} color="error">
                    <FavoriteBorder fontSize="small" />
                  </Badge>
                </IconButton>
              </Tooltip>

              <Tooltip title="Chat hỗ trợ">
                <IconButton size="small" onClick={() => setOpenChat(true)}>
                  <Badge color="error" variant="dot">
                    <ChatBubbleOutlineIcon fontSize="small" />
                  </Badge>
                </IconButton>
              </Tooltip>

              <Tooltip title="Đã lưu">
                <IconButton size="small">
                  <BookmarkBorder fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}

          <Tooltip title={user?.fullName || user?.email}>
            <IconButton
              onClick={(e) => setAnchorEl(e.currentTarget)}
              size="small"
              sx={{
                ml: { xs: 0.5, sm: 1 },
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
                  width: { xs: 32, sm: 36 },
                  height: { xs: 32, sm: 36 },
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
                if (oldUserId) {
                  localStorage.removeItem(`cart_${oldUserId}`);
                }
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

  const MobileMenu = (
    <Drawer
      anchor="left"
      open={mobileMenuOpen}
      onClose={() => setMobileMenuOpen(false)}
      PaperProps={{
        sx: {
          width: 280,
          background: "linear-gradient(180deg, #667eea 0%, #764ba2 100%)",
        },
      }}
    >
      <Box sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h6" sx={{ color: "white", fontWeight: 700 }}>
          Menu
        </Typography>
        <IconButton onClick={() => setMobileMenuOpen(false)} sx={{ color: "white" }}>
          <CloseIcon />
        </IconButton>
      </Box>
      
      <Divider sx={{ borderColor: "rgba(255,255,255,0.2)" }} />
      
      <List sx={{ px: 1 }}>
        {tabs.map((tab) => (
          <ListItemButton
            key={tab.path}
            selected={currentTab === tab.path}
            onClick={() => {
              navigate(tab.path);
              setMobileMenuOpen(false);
            }}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              color: "white",
              "&.Mui-selected": {
                bgcolor: "rgba(255,255,255,0.2)",
              },
              "&:hover": {
                bgcolor: "rgba(255,255,255,0.1)",
              },
            }}
          >
            <ListItemIcon sx={{ color: "white", minWidth: 40 }}>
              {tab.iconComponent}
            </ListItemIcon>
            <ListItemText primary={tab.label} />
          </ListItemButton>
        ))}
      </List>

      {isAuthenticated && (
        <>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.2)", my: 1 }} />
          
          <List sx={{ px: 1 }}>
            <ListItemButton
              onClick={() => {
                navigate("/profile");
                setMobileMenuOpen(false);
              }}
              sx={{ borderRadius: 2, color: "white", "&:hover": { bgcolor: "rgba(255,255,255,0.1)" } }}
            >
              <ListItemIcon sx={{ color: "white", minWidth: 40 }}>
                <AccountCircle />
              </ListItemIcon>
              <ListItemText primary="Hồ sơ" />
            </ListItemButton>

            <ListItemButton
              onClick={() => {
                navigate("/reader/loans/my");
                setMobileMenuOpen(false);
              }}
              sx={{ borderRadius: 2, color: "white", "&:hover": { bgcolor: "rgba(255,255,255,0.1)" } }}
            >
              <ListItemIcon sx={{ color: "white", minWidth: 40 }}>
                <History />
              </ListItemIcon>
              <ListItemText primary="Lịch sử" />
            </ListItemButton>

            <ListItemButton
              onClick={() => {
                navigate("/settings");
                setMobileMenuOpen(false);
              }}
              sx={{ borderRadius: 2, color: "white", "&:hover": { bgcolor: "rgba(255,255,255,0.1)" } }}
            >
              <ListItemIcon sx={{ color: "white", minWidth: 40 }}>
                <Settings />
              </ListItemIcon>
              <ListItemText primary="Cài đặt" />
            </ListItemButton>

            <ListItemButton
              onClick={async () => {
                setMobileMenuOpen(false);
                const oldUserId = localStorage.getItem("userId");
                if (oldUserId) {
                  localStorage.removeItem(`cart_${oldUserId}`);
                }
                localStorage.removeItem("userId");
                await logout();
                navigate("/");
              }}
              sx={{ borderRadius: 2, color: "white", "&:hover": { bgcolor: "rgba(255,255,255,0.1)" } }}
            >
              <ListItemIcon sx={{ color: "white", minWidth: 40 }}>
                <ExitToApp />
              </ListItemIcon>
              <ListItemText primary="Đăng xuất" />
            </ListItemButton>
          </List>
        </>
      )}
    </Drawer>
  );

  return (
    <>
      <AppBar
        position="sticky"
        elevation={elevated ? 4 : 0}
        color="transparent"
        sx={{
          backdropFilter: "saturate(180%) blur(10px)",
          backgroundColor: "rgba(255,255,255,0.95)",
          borderBottom: (t) => `1px solid ${t.palette.divider}`,
        }}
      >
        <Box
          sx={{
            width: "100%",
            px: { xs: 1.5, sm: 2, md: 3 },
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
              minHeight: { xs: 56, sm: 64 },
              gap: { xs: 1, sm: 2 },
            }}
          >
            {isMobile && (
              <IconButton
                onClick={() => setMobileMenuOpen(true)}
                sx={{ mr: 1 }}
              >
                <MenuIcon />
              </IconButton>
            )}
            
            {Left}
            {Center}
            {Right}
          </Toolbar>
        </Box>
      </AppBar>

      {MobileMenu}

      {openChat && (
        <Box
          sx={{
            position: "fixed",
            bottom: { xs: 10, sm: 20 },
            right: { xs: 10, sm: 20 },
            width: { xs: "calc(100% - 20px)", sm: 360 },
            height: { xs: "70vh", sm: 480 },
            maxWidth: 360,
            bgcolor: "white",
            borderRadius: 2,
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            zIndex: 2000,
            overflow: "hidden",
          }}
        >
          <ChatWindow />
          <IconButton
            onClick={() => setOpenChat(false)}
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              bgcolor: "rgba(0,0,0,0.05)",
            }}
          >
            ✕
          </IconButton>
        </Box>
      )}
    </>
  );
}