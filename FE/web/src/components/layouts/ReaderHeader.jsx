// src/components/layouts/ReaderHeader.jsx
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
} from "@mui/material";

export default function ReaderHeader() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();

  const [anchorEl, setAnchorEl] = useState(null);
  const [elevated, setElevated] = useState(false);

  // ===== Config nhanh =====
  const maxContentWidth = 1280; // 0 = full-bleed hoàn toàn

  // Tabs
  const tabs = useMemo(
    () => [
      { path: "/", label: "Trang chủ" },
      { path: "/books", label: "Sách" },
      { path: "/newspapers", label: "Báo" },
      { path: "/magazines", label: "Tạp chí" },
    ],
    []
  );
  const currentTab = useMemo(() => tabs.find((t) => t.path === pathname)?.path ?? false, [pathname, tabs]);

  // Elevation khi cuộn
  useEffect(() => {
    const onScroll = () => setElevated(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const initials = (user?.fullName?.[0] || user?.email?.[0] || "U").toUpperCase();

  const Left = (
    <Box
      onClick={() => navigate("/")}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        cursor: "pointer",
        minWidth: 220,
        flexShrink: 0,
      }}
    >
      <Box
        component="img"
        src="/logoo.png"
        alt="Logo"
        sx={{ width: 36, height: 36, objectFit: "contain", borderRadius: 1 }}
      />
      <Typography
        variant="h6"
        sx={{
          fontWeight: 800,
          letterSpacing: 0.2,
          whiteSpace: "nowrap",
          lineHeight: 1,
        }}
      >
        Thư Viện{" "}
        <Box component="span" sx={{ color: "primary.main" }}>
          Book-Tech
        </Box>
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
        px: { xs: 1, md: 2 },
      }}
    >
      <Tabs
        value={currentTab}
        textColor="primary"
        indicatorColor="primary"
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{
          "& .MuiTabs-indicator": { height: 3, borderRadius: 3 },
          "& .MuiTab-root": {
            textTransform: "none",
            fontWeight: 600,
            minHeight: 44,
            px: 1.25,
            mx: 0.25,
            borderRadius: 1.5,
            color: "text.secondary",
            "&.Mui-selected": { color: "primary.main" },
            "&:hover": { backgroundColor: "action.hover" },
          },
        }}
      >
        {tabs.map((t) => (
          <Tab key={t.path} value={t.path} label={t.label} component={RouterLink} to={t.path} />
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
        minWidth: 220,
        justifyContent: "flex-end",
        flexShrink: 0,
      }}
    >
      {!isAuthenticated ? (
        <>
          <Button variant="text" onClick={() => navigate("/login")}>
            Đăng nhập
          </Button>
          <Button
            variant="contained"
            disableElevation
            sx={{ borderRadius: 999, px: 2 }}
            onClick={() => navigate("/signup")}
          >
            Đăng ký
          </Button>
        </>
      ) : (
        <>
          <Tooltip title={user?.fullName || user?.email}>
            <IconButton
              onClick={(e) => setAnchorEl(e.currentTarget)}
              size="small"
              sx={{
                ml: 1,
                border: (t) => `1px solid ${t.palette.divider}`,
                borderRadius: 2,
              }}
            >
              <Avatar sx={{ width: 36, height: 36, bgcolor: "primary.main", fontWeight: 700 }}>
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
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                {user?.fullName || "User"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.email}
              </Typography>
              {user?.roleName && (
                <Typography variant="caption" color="text.secondary">
                  {user.roleName}
                </Typography>
              )}
            </Box>
            <Divider />
            <MenuItem component={RouterLink} to="/profile" onClick={() => setAnchorEl(null)}>
              Profile
            </MenuItem>
            <MenuItem component={RouterLink} to="/settings" onClick={() => setAnchorEl(null)}>
              Settings
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={async () => {
                setAnchorEl(null);
                await logout();
                navigate("/");
              }}
            >
              Logout
            </MenuItem>
          </Menu>
        </>
      )}
    </Box>
  );

  return (
    <AppBar
      position="sticky"
      elevation={elevated ? 2 : 0}
      color="transparent"
      sx={{
        backdropFilter: "saturate(180%) blur(6px)",
        backgroundColor: "rgba(255,255,255,0.9)",
        borderBottom: (t) => `1px solid ${t.palette.divider}`,
        transition: (t) => t.transitions.create("box-shadow"),
      }}
    >
      {/* khung giữa: full-bleed nhưng có maxContentWidth nếu muốn */}
      <Box
        sx={{
          width: "100%",
          px: { xs: 1.5, sm: 2, md: 3 },
          ...(maxContentWidth ? { maxWidth: maxContentWidth, mx: "auto" } : null),
        }}
      >
        <Toolbar
          disableGutters
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            py: 1.1,
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
