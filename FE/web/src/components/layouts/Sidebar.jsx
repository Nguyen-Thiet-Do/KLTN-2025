import { Link, useLocation } from "react-router-dom";
import {
  Drawer, List, ListItem, ListItemIcon, ListItemText,
  Typography, Box, Avatar, Divider, Collapse, ListItemButton
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
import { ExpandLess, ExpandMore, FiberManualRecord } from "@mui/icons-material";

// Drawer
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
    overflowX: "hidden",
  },
}));

// ListItem: dùng $active (KHÔNG dùng TS generic trong .jsx)
const StyledListItem = styled(ListItem, {
  shouldForwardProp: (prop) => prop !== "$active",
})(({ theme, $active }) => ({
  borderRadius: 12,
  margin: "6px 12px",
  padding: 0, // dùng ListItemButton bên trong
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  position: "relative",
  overflow: "hidden",
  backgroundColor: $active ? "rgba(255, 255, 255, 0.15)" : "transparent",

  "&::before": {
    content: '""',
    position: "absolute",
    left: 0,
    top: 0,
    height: "100%",
    width: $active ? "4px" : 0,
    backgroundColor: "white",
    transition: "width 0.3s ease",
    borderRadius: "0 4px 4px 0",
  },

  "&:hover": {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    transform: "translateX(4px)",
    "&::before": { width: "4px" },
  },
}));

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
  const [open, setOpen] = useState({});

  // Tự mở nhóm nếu đang ở trang con
  const activeParents = useMemo(() => {
    const obj = {};
    menuItems.forEach((it) => {
      if (it.children?.length) {
        if (location.pathname === it.path || location.pathname.startsWith(it.path + "/")) {
          obj[it.path] = true;
        }
      }
    });
    return obj;
  }, [location.pathname, menuItems]);

  useEffect(() => {
    setOpen((prev) => ({ ...prev, ...activeParents }));
  }, [activeParents]);

  return (
    <StyledDrawer variant="permanent" anchor="left">
      {/* Header */}
      <Box sx={{ p: 3, pb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
          <StyledAvatar>{role?.charAt(0).toUpperCase()}</StyledAvatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>
              {role}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8, fontSize: "0.75rem" }}>
              Dashboard
            </Typography>
          </Box>
        </Box>
        <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.15)" }} />
      </Box>

      {/* Menu */}
      <List sx={{ px: 1, py: 2 }}>
        {menuItems.map((item) => {
          const isParent = !!item.children?.length;
          const isActiveParent =
            location.pathname === item.path || location.pathname.startsWith(item.path + "/");
          const isExactActive = location.pathname === item.path;

          if (!isParent) {
            return (
              <StyledListItem key={item.path} $active={isExactActive}>
                <ListItemButton
                  component={Link}
                  to={item.path}
                  sx={{ color: "inherit", textDecoration: "none", py: 1.5 }}
                >
                  {item.icon && (
                    <ListItemIcon sx={{ color: "inherit", minWidth: 44, opacity: isExactActive ? 1 : 0.8 }}>
                      <item.icon />
                    </ListItemIcon>
                  )}
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{ fontWeight: isExactActive ? 600 : 400, fontSize: "0.95rem" }}
                  />
                </ListItemButton>
              </StyledListItem>
            );
          }

          const expanded = open[item.path] ?? false;

          return (
            <Box key={item.path}>
              <StyledListItem $active={isActiveParent}>
                <ListItemButton
                  onClick={() => setOpen((prev) => ({ ...prev, [item.path]: !expanded }))}
                  sx={{ color: "inherit", py: 1.5 }}
                >
                  {item.icon && (
                    <ListItemIcon sx={{ color: "inherit", minWidth: 44, opacity: isActiveParent ? 1 : 0.8 }}>
                      <item.icon />
                    </ListItemIcon>
                  )}
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{ fontWeight: isActiveParent ? 600 : 400, fontSize: "0.95rem" }}
                  />
                  {expanded ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
              </StyledListItem>

              <Collapse in={expanded} timeout="auto" unmountOnExit>
                <List component="div" disablePadding sx={{ pb: 0.5 }}>
                  {item.children.map((child) => {
                    const isChildActive = location.pathname === child.path;
                    const ChildIcon = child.icon;
                    return (
                      <ListItem
                        key={child.path}
                        disablePadding
                        sx={{
                          mx: 2.5,
                          my: 0.5,
                          borderRadius: 10,
                          overflow: "hidden",
                          bgcolor: isChildActive ? "rgba(255,255,255,0.12)" : "transparent",
                          transition: "all .25s",
                          "&:hover": { bgcolor: "rgba(255,255,255,0.18)" },
                        }}
                      >
                        <ListItemButton component={Link} to={child.path} sx={{ color: "inherit", pl: 6.5, py: 1.1 }}>
                          <ListItemIcon sx={{ minWidth: 28, color: "inherit", opacity: 0.85 }}>
                            {ChildIcon ? <ChildIcon /> : <FiberManualRecord fontSize="small" />}
                          </ListItemIcon>
                          <ListItemText
                            primary={child.label}
                            primaryTypographyProps={{ fontWeight: isChildActive ? 600 : 400, fontSize: "0.9rem" }}
                          />
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>
              </Collapse>
            </Box>
          );
        })}
      </List>

      {/* Footer */}
      <Box sx={{ mt: "auto", p: 2, borderTop: "1px solid rgba(255, 255, 255, 0.15)" }}>
        <Typography variant="caption" sx={{ opacity: 0.6, display: "block", textAlign: "center" }}>
          © 2025 Dashboard
        </Typography>
      </Box>
    </StyledDrawer>
  );
}
