import { Link, useLocation } from "react-router-dom";
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Avatar,
  Divider,
} from "@mui/material";
import { styled } from "@mui/material/styles";

// Styled Drawer với gradient background
const StyledDrawer = styled(Drawer)(({ theme }) => ({
  width: 280,
  flexShrink: 0,
  "& .MuiDrawer-paper": {
    width: 280,
    boxSizing: "border-box",
    background: `linear-gradient(180deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
    color: "white",
    border: "none",
    boxShadow: "4px 0 24px rgba(0, 0, 0, 0.12)",
    overflowX: "hidden", // Ẩn thanh cuộn ngang
  },
}));

// Styled ListItem với animation mượt mà
const StyledListItem = styled(ListItem)(({ theme, active }) => ({
  borderRadius: 12,
  margin: "6px 12px",
  padding: "12px 16px",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  cursor: "pointer",
  position: "relative",
  overflow: "hidden",
  backgroundColor: active ? "rgba(255, 255, 255, 0.15)" : "transparent",
  
  "&::before": {
    content: '""',
    position: "absolute",
    left: 0,
    top: 0,
    height: "100%",
    width: active ? "4px" : "0",
    backgroundColor: "white",
    transition: "width 0.3s ease",
    borderRadius: "0 4px 4px 0",
  },
  
  "&:hover": {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    transform: "translateX(4px)",
    
    "&::before": {
      width: "4px",
    },
  },
}));

// Header Avatar với gradient border
const StyledAvatar = styled(Avatar)(({ theme }) => ({
  width: 48,
  height: 48,
  background: "white",
  color: theme.palette.primary.main,
  fontWeight: 600,
  fontSize: "1.25rem",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
}));

export default function Sidebar({ role, menuItems }) {
  const location = useLocation();

  return (
    <StyledDrawer variant="permanent" anchor="left">
      {/* Header Section với design hiện đại */}
      <Box
        sx={{
          p: 3,
          pb: 2,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            mb: 2,
          }}
        >
          <StyledAvatar>
            {role?.charAt(0).toUpperCase()}
          </StyledAvatar>
          <Box>
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 600,
                letterSpacing: 0.5,
              }}
            >
              {role}
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                opacity: 0.8,
                fontSize: "0.75rem",
              }}
            >
              Dashboard
            </Typography>
          </Box>
        </Box>
        <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.15)" }} />
      </Box>

      {/* Menu Items với active state */}
      <List sx={{ px: 1, py: 2 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          
          return (
            <StyledListItem
              key={item.path}
              component={Link}
              to={item.path}
              active={isActive ? 1 : 0}
              sx={{
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <ListItemIcon 
                sx={{ 
                  color: "inherit", 
                  minWidth: 44,
                  opacity: isActive ? 1 : 0.8,
                }}
              >
                <item.icon />
              </ListItemIcon>
              <ListItemText 
                primary={item.label}
                primaryTypographyProps={{
                  fontWeight: isActive ? 600 : 400,
                  fontSize: "0.95rem",
                }}
              />
            </StyledListItem>
          );
        })}
      </List>

      {/* Footer Section (optional) */}
      <Box
        sx={{
          mt: "auto",
          p: 2,
          borderTop: "1px solid rgba(255, 255, 255, 0.15)",
        }}
      >
        <Typography 
          variant="caption" 
          sx={{ 
            opacity: 0.6,
            display: "block",
            textAlign: "center",
          }}
        >
          © 2025 Dashboard
        </Typography>
      </Box>
    </StyledDrawer>
  );
}