import { useEffect, useState } from "react";
import { documentApi } from "../../services/documentApi";
import {
  Box,
  Paper,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Alert,
  Divider,
} from "@mui/material";

export default function ReaderSidebar({
  selected,
  onSelect,
  title = "Danh mục",
  showAllOption = true,
  elevation = 2,
}) {
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <Paper elevation={elevation} sx={{ p: 2, borderRadius: 2 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        {title}
      </Typography>
      <Divider sx={{ mb: 1 }} />

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : genres.length === 0 ? (
        <Alert severity="info">Chưa có thể loại.</Alert>
      ) : (
        <List dense disablePadding>
          {showAllOption && (
            <ListItemButton
              selected={!selected}
              onClick={() => onSelect?.(null)}
              sx={{ borderRadius: 1, mb: 0.5 }}
            >
              <ListItemText primary="Tất cả" />
            </ListItemButton>
          )}

          {genres.map((g) => (
            <ListItemButton
              key={g.genreId}
              selected={selected === g.genreId}
              onClick={() => onSelect?.(g.genreId)}
              sx={{ borderRadius: 1, mb: 0.5 }}
            >
              <ListItemText primary={g.name} />
            </ListItemButton>
          ))}
        </List>
      )}
    </Paper>
  );
}
