import { useEffect, useMemo, useRef, useState } from "react";
import { documentApi } from "../../services/documentApi";
import ReaderHeader from "../../components/layouts/ReaderHeader";
import ReaderSidebar from "../../components/layouts/ReaderSidebar";
import ReaderCard from "../../components/layouts/ReaderCard";
import ReaderFooter from "../../components/layouts/ReaderFooter";
import { Box, Typography, CircularProgress, Alert, Stack, Paper } from "@mui/material";
import ButtonLoader from "../../components/Loading/ButtonLoader";

// helper: nhận diện lỗi huỷ request của axios/fetch
const isAbort = (e) =>
  e?.code === "ERR_CANCELED" ||
  e?.name === "CanceledError" ||
  e?.name === "AbortError" ||
  e?.message?.includes?.("canceled") ||
  e?.message?.includes?.("aborted");

export default function ReaderHome({ type = "all" }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedGenre, setSelectedGenre] = useState(null);

  // Điều khiển huỷ request + chống race
  const abortRef = useRef(null);
  const loadIdRef = useRef(0);
  const newSignal = () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  };

  const title = useMemo(() => {
    switch (type) {
      case "book": return "Danh sách Sách";
      case "magazine": return "Tạp chí";
      case "newspaper": return "Báo";
      default: return "Tài liệu mới nhất";
    }
  }, [type]);

  const load = async ({ genreId = null } = {}) => {
    const myLoadId = ++loadIdRef.current;
    setLoading(true);
    setError("");
    try {
      const signal = newSignal();
      const { items } = await documentApi.fetchDocuments({
        type,
        page: 1,
        // limit: để trống -> documentApi tự chọn (12 khi lọc thể loại, 12000 khi không)
        genreId,
        match: "any",
        signal,
      });
      // nếu có request mới hơn thì bỏ
      if (myLoadId !== loadIdRef.current) return;
      setDocs(items);
    } catch (e) {
      if (isAbort(e)) return; // không set lỗi nếu là huỷ
      const apiMsg = e?.response?.data?.message || e?.message;
      setError(apiMsg ? `Không tải được danh sách tài liệu: ${apiMsg}` : "Không tải được danh sách tài liệu. Vui lòng thử lại.");
    } finally {
      if (myLoadId === loadIdRef.current) setLoading(false);
    }
  };

  const handleGenreSelect = async (genreId) => {
    setSelectedGenre(genreId || null);
    await load({ genreId: genreId || null });
  };

  useEffect(() => {
    setSelectedGenre(null);
    load({ genreId: null });
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  return (
    <>
      <ReaderHeader />

      <Box sx={{ px: { xs: 2, md: 3 }, py: 3 }}>
        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: "flex-start", gap: 3 }}>
          {/* SIDEBAR */}
          <Box sx={{ width: { xs: "100%", md: 300 }, flexShrink: 0, position: { md: "sticky" }, top: { md: 80 } }}>
            <ReaderSidebar selected={selectedGenre} onSelect={handleGenreSelect} />
          </Box>

          {/* CONTENT */}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Paper elevation={0} sx={{ p: { xs: 1, sm: 2 }, mb: 2 }}>
              <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between" spacing={1}>
                <Typography variant="h5" fontWeight={800}>{title}</Typography>
                {selectedGenre && (
                  <Typography variant="body2" sx={{ opacity: 0.75 }}>
                    Đang lọc theo thể loại ID: <strong>{selectedGenre}</strong>
                  </Typography>
                )}
              </Stack>
            </Paper>

            {/* Chỉ hiển thị lỗi khi không có dữ liệu */}
            {error && docs.length === 0 && (
              <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
            )}

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                <ButtonLoader />
              </Box>
            ) : docs.length === 0 ? (
              <Alert severity="info">Không có tài liệu nào.</Alert>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                    md: "repeat(auto-fill, 260px)", // card rộng 260px
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
