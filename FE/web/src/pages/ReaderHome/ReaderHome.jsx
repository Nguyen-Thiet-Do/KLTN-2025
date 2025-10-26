import { useEffect, useState, useMemo } from "react";
import { documentApi } from "../../services/documentApi";
import ReaderHeader from "../../components/layouts/ReaderHeader";
import ReaderSidebar from "../../components/layouts/ReaderSidebar";
import ReaderCard from "../../components/layouts/ReaderCard";
import ReaderFooter from "../../components/layouts/ReaderFooter";


import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Stack,
  Paper,
} from "@mui/material";

export default function ReaderHome({ type = "all" }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState(null);

  const title = useMemo(() => {
    switch (type) {
      case "book": return "Danh sách Sách";
      case "magazine": return "Tạp chí";
      case "newspaper": return "Báo";
      default: return "Tài liệu mới nhất";
    }
  }, [type]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await documentApi.list({ page: 1, limit: 12, type });
      setDocs(res?.data?.data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleGenreSelect = async (genreId) => {
    setSelectedGenre(genreId);
    setLoading(true);
    try {
      if (!genreId) { await loadDocuments(); return; }
      const res = await documentApi.byGenre({
        genreIds: genreId, match: "any", page: 1, limit: 12, type,
      });
      setDocs(res?.data?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedGenre(null);
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  return (
    <>
      <ReaderHeader />

      {/* Full-width layout */}
      <Box sx={{ px: { xs: 2, md: 3 }, py: 3 }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            alignItems: "flex-start",
            gap: 3,
          }}
        >
          {/* SIDEBAR (trái) */}
          <Box
            sx={{
              width: { xs: "100%", md: 300 },
              flexShrink: 0,
              position: { md: "sticky" },
              top: { md: 80 }, // chỉnh theo chiều cao header thực tế
            }}
          >
            <ReaderSidebar selected={selectedGenre} onSelect={handleGenreSelect} />
          </Box>

          {/* CONTENT (phải) */}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Paper elevation={0} sx={{ p: { xs: 1, sm: 2 }, mb: 2 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                alignItems={{ xs: "flex-start", sm: "center" }}
                justifyContent="space-between"
                spacing={1}
              >
                <Typography variant="h5" fontWeight={800}>
                  {title}
                </Typography>
                {selectedGenre && (
                  <Typography variant="body2" sx={{ opacity: 0.75 }}>
                    Đang lọc theo thể loại ID: <strong>{selectedGenre}</strong>
                  </Typography>
                )}
              </Stack>
            </Paper>

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                <CircularProgress />
              </Box>
            ) : docs.length === 0 ? (
              <Alert severity="info">Không có tài liệu nào.</Alert>
            ) : (
              /* Lưới card: bề ngang CỐ ĐỊNH 260px ở md+,
                 tự wrap; mobile 1 cột, tablet 2 cột linh hoạt */
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                    md: "repeat(auto-fill, 260px)", // 👈 card rộng 260px
                  },
                  justifyContent: { md: "start" },
                }}
              >
                {docs.map((d) => (
                  <Box key={d.documentId}>
                    <ReaderCard doc={d} />
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      
      
      <ReaderFooter maxContentWidth={1280} />
    </>
  );
}
