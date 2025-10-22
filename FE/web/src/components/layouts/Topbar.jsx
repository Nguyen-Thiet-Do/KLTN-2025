import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  IconButton,
  InputBase,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Typography,
  Box,
  Badge,
  ListItemIcon,
  CircularProgress,
} from "@mui/material";
import { styled, alpha } from "@mui/material/styles";
import {
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
} from "@mui/icons-material";
import { useAuth } from "../../contexts/AuthContext";
import { authService } from "../../services/authService";
import { getRoleName } from "../../constants/roles";

const SIDEBAR_WIDTH = 280;

// Styled AppBar với marginLeft để tránh Sidebar
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: "white",
  color: theme.palette.text.primary,
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
  zIndex: theme.zIndex.drawer - 1, // Thấp hơn drawer để không đè lên
  marginLeft: SIDEBAR_WIDTH,
  width: `calc(100% - ${SIDEBAR_WIDTH}px)`,
}));

// Search Container
const Search = styled("div")(({ theme }) => ({
  position: "relative",
  borderRadius: theme.shape.borderRadius * 3,
  backgroundColor: alpha(theme.palette.primary.main, 0.08),
  "&:hover": {
    backgroundColor: alpha(theme.palette.primary.main, 0.12),
  },
  marginLeft: 0,
  width: "100%",
  maxWidth: 500,
  transition: "all 0.3s ease",
  [theme.breakpoints.up("sm")]: {
    marginLeft: theme.spacing(3),
    width: "auto",
  },
}));

const SearchIconWrapper = styled("div")(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: "100%",
  position: "absolute",
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: theme.palette.primary.main,
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: "inherit",
  width: "100%",
  "& .MuiInputBase-input": {
    padding: theme.spacing(1.5, 1.5, 1.5, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create("width"),
    width: "100%",
    [theme.breakpoints.up("md")]: {
      width: "40ch",
      "&:focus": {
        width: "50ch",
      },
    },
  },
}));

// User Avatar Button
const UserAvatarButton = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
  padding: theme.spacing(0.5, 1.5, 0.5, 0.5),
  borderRadius: theme.shape.borderRadius * 3,
  cursor: "pointer",
  transition: "all 0.3s ease",
  "&:hover": {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
  },
}));

// Styled Menu
const StyledMenu = styled(Menu)(({ theme }) => ({
  "& .MuiPaper-root": {
    borderRadius: theme.shape.borderRadius * 2,
    marginTop: theme.spacing(1),
    minWidth: 280,
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
  },
}));

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isMenuOpen = Boolean(anchorEl);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await authService.logout();
      logout();
      handleMenuClose();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      logout();
      navigate("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const userInitials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const roleName = getRoleName(user?.roleId);

  return (
    <StyledAppBar position="fixed">
      <Toolbar sx={{ justifyContent: "space-between" }}>
        {/* Search Bar - Logo đã ở Sidebar nên không cần ở đây */}
        <Search>
          <SearchIconWrapper>
            <SearchIcon />
          </SearchIconWrapper>
          <StyledInputBase
            placeholder="Search..."
            inputProps={{ "aria-label": "search" }}
          />
        </Search>

        {/* Right Side */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {/* Notification Button */}
          <IconButton
            size="large"
            sx={{
              color: "text.primary",
              "&:hover": {
                backgroundColor: alpha("#000", 0.04),
              },
            }}
          >
            <Badge badgeContent={4} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>

          {/* User Menu */}
          <UserAvatarButton onClick={handleMenuOpen}>
            <Avatar
              sx={{
                width: 40,
                height: 40,
                bgcolor: "primary.main",
                fontWeight: 600,
                fontSize: "0.95rem",
              }}
            >
              {userInitials}
            </Avatar>
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, lineHeight: 1.2 }}
              >
                {user?.fullName || "User"}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", lineHeight: 1.2 }}
              >
                {roleName}
              </Typography>
            </Box>
          </UserAvatarButton>
        </Box>

        {/* Dropdown Menu */}
        <StyledMenu
          anchorEl={anchorEl}
          open={isMenuOpen}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "right",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "right",
          }}
        >
          {/* User Info Header */}
          <Box sx={{ px: 2, py: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Avatar
                sx={{
                  width: 48,
                  height: 48,
                  bgcolor: "primary.main",
                  fontWeight: 600,
                }}
              >
                {userInitials}
              </Avatar>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {user?.fullName || "User"}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontSize: "0.85rem" }}
                >
                  {user?.email || ""}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: "primary.main",
                    fontWeight: 500,
                    fontSize: "0.75rem",
                  }}
                >
                  {roleName}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Divider />

          {/* Menu Items */}
          <MenuItem
            onClick={handleMenuClose}
            sx={{
              py: 1.5,
              px: 2,
              "&:hover": {
                backgroundColor: alpha("#000", 0.04),
              },
            }}
          >
            <ListItemIcon>
              <PersonIcon fontSize="small" />
            </ListItemIcon>
            <Typography variant="body2">Profile</Typography>
          </MenuItem>

          <MenuItem
            onClick={handleMenuClose}
            sx={{
              py: 1.5,
              px: 2,
              "&:hover": {
                backgroundColor: alpha("#000", 0.04),
              },
            }}
          >
            <ListItemIcon>
              <SettingsIcon fontSize="small" />
            </ListItemIcon>
            <Typography variant="body2">Settings</Typography>
          </MenuItem>

          <Divider />

          <MenuItem
            onClick={handleLogout}
            disabled={isLoggingOut}
            sx={{
              py: 1.5,
              px: 2,
              color: "error.main",
              "&:hover": {
                backgroundColor: alpha("#f44336", 0.08),
              },
            }}
          >
            <ListItemIcon>
              {isLoggingOut ? (
                <CircularProgress size={20} color="error" />
              ) : (
                <LogoutIcon fontSize="small" color="error" />
              )}
            </ListItemIcon>
            <Typography variant="body2">
              {isLoggingOut ? "Logging out..." : "Logout"}
            </Typography>
          </MenuItem>
        </StyledMenu>
      </Toolbar>
    </StyledAppBar>
  );
}