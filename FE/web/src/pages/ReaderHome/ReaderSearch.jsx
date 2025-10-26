// src/pages/ReaderSearch.jsx
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { documentApi } from "../../services/documentApi";
import ReaderHeader from "../../components/layouts/ReaderHeader";
import ReaderCard from "../../components/layouts/ReaderCard";

// MUI
import {
  Box,
  Container,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Stack,
  Paper,
} from "@mui/material";

export default function ReaderSearch() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const query = params.get("q") || "";

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    const doSearch = async () => {
      if (!query) {
        setDocs([]);
        return;
      }
      setLoading(true);
      try {
        const res = await documentApi.search({ q: query, page: 1, limit: 12 });
        if (!ignore) setDocs(res?.data?.data || []);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    doSearch();
    return () => {
      ignore = true;
    };
  }, [query]);

  const showEmptyQuery = !query && !loading;

  return (
    <>
      <ReaderHeader />

      <Box sx={{ py: 3 }}>
        <Container maxWidth="lg">
          <Paper elevation={0} sx={{ p: { xs: 1, sm: 2 }, mb: 2 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "flex-start", sm: "center" }}
              justifyContent="space-between"
              spacing={1}
            >
              <Typography variant="h5" fontWeight={700}>
                Kết quả tìm kiếm
              </Typography>
              <Typography variant="body1">
                Từ khóa:{" "}
                <Box component="span" sx={{ color: "primary.main", fontWeight: 600 }}>
                  {query || "(trống)"}
                </Box>
              </Typography>
            </Stack>
          </Paper>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : showEmptyQuery ? (
            <Alert severity="info">Hãy nhập từ khóa để bắt đầu tìm kiếm.</Alert>
          ) : docs.length ? (
            <Grid container spacing={2}>
              {docs.map((d) => (
                <Grid key={d.documentId} item xs={12} sm={6} md={4}>
                  <ReaderCard doc={d} />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Alert severity="warning">Không tìm thấy tài liệu phù hợp.</Alert>
          )}
        </Container>
      </Box>
    </>
  );
}
