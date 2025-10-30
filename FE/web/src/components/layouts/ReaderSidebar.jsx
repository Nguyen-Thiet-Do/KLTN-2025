import { useEffect, useState } from "react";
import { documentApi } from "../../services/documentApi";
import {
  Box,
  Paper,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Alert,
  Divider,
  Chip,
  Stack,
  Collapse,
  IconButton,
} from "@mui/material";
import {
  ExpandLess,
  ExpandMore,
  FilterList,
  Category,
} from "@mui/icons-material";
import ButtonLoader from "../../components/Loading/ButtonLoader";

export default function ReaderSidebar({
  selected,
  onSelect,
  title = "Lọc theo thể loại",
  showAllOption = true,
  elevation = 1,
}) {
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await documentApi.genres();
        if (!ignore) setGenres(res?.data?.data || []);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();
    return () => { ignore = true; };
  }, []);

  const handleToggle = () => {
    setExpanded(!expanded);
  };

  return (
    <Paper 
      elevation={elevation} 
      sx={{ 
        borderRadius: 3,
        overflow: "hidden",
        border: (t) => `1px solid ${t.palette.divider}`,
      }}
    >
      {/* Header */}
      <Box 
        sx={{ 
          p: 2, 
          backgroundColor: (t) => t.palette.background.default,
          borderBottom: (t) => `1px solid ${t.palette.divider}`,
        }}
      >
        <Stack 
          direction="row" 
          alignItems="center" 
          justifyContent="space-between"
          sx={{ cursor: "pointer" }}
          onClick={handleToggle}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <FilterList color="primary" />
            <Typography variant="h6" fontWeight={700}>
              {title}
            </Typography>
            <Chip 
              label={genres.length} 
              size="small" 
              color="primary" 
              variant="outlined"
            />
          </Stack>
          <IconButton size="small">
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Stack>
      </Box>

      {/* Content */}
      <Collapse in={expanded}>
        <Box sx={{ p: 2 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <ButtonLoader size={60} />
            </Box>
          ) : genres.length === 0 ? (
            <Alert 
              severity="info" 
              sx={{ 
                borderRadius: 2,
                "& .MuiAlert-message": { width: "100%" }
              }}
            >
              Chưa có thể loại nào.
            </Alert>
          ) : (
            <List dense disablePadding>
              {showAllOption && (
                <ListItemButton
                  selected={!selected}
                  onClick={() => onSelect?.(null)}
                  sx={{ 
                    borderRadius: 2, 
                    mb: 1,
                    border: (t) => !selected ? `2px solid ${t.palette.primary.main}` : "2px solid transparent",
                    backgroundColor: !selected ? "action.selected" : "transparent",
                    "&:hover": {
                      backgroundColor: "action.hover",
                    },
                  }}
                >
                  <ListItemText 
                    primary={
                      <Typography fontWeight={!selected ? 700 : 500}>
                        Tất cả thể loại
                      </Typography>
                    } 
                  />
                  <Chip 
                    label={genres.length} 
                    size="small" 
                    variant="outlined"
                  />
                </ListItemButton>
              )}

              <Divider sx={{ my: 1 }} />

              {genres.map((g) => (
                <ListItemButton
                  key={g.genreId}
                  selected={selected === g.genreId}
                  onClick={() => onSelect?.(g.genreId)}
                  sx={{ 
                    borderRadius: 2, 
                    mb: 1,
                    border: (t) => selected === g.genreId ? `2px solid ${t.palette.primary.main}` : "2px solid transparent",
                    backgroundColor: selected === g.genreId ? "action.selected" : "transparent",
                    "&:hover": {
                      backgroundColor: "action.hover",
                    },
                  }}
                >
                  <ListItemText 
                    primary={
                      <Typography fontWeight={selected === g.genreId ? 700 : 500}>
                        {g.name}
                      </Typography>
                    } 
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}