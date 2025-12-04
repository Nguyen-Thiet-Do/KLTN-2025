// src/pages/ReaderHome/ReaderHome.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { documentApi } from "../../services/documentApi";
import ReaderHeader from "../../components/layouts/ReaderHeader";
import ReaderSidebar from "../../components/layouts/ReaderSidebar";
import ReaderCard from "../../components/layouts/ReaderCard";
import ReaderFooter from "../../components/layouts/ReaderFooter";
import { 
  Box, Typography, Alert, Stack, Paper, Button, TextField,
  Drawer, IconButton, Divider
} from "@mui/material";
import { FilterList as FilterIcon, Close as CloseIcon } from "@mui/icons-material";
import ButtonLoader from "../../components/Loading/ButtonLoader";

const isAbort = (e) =>
  e?.code === "ERR_CANCELED" ||
  e?.name === "CanceledError" ||
  e?.name === "AbortError" ||
  e?.message?.includes?.("canceled") ||
  e?.message?.includes?.("aborted");

const PAGE_SIZE = 20;

export default function ReaderHome({ type = "all" }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Mobile filter drawer
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // abort + chống race
  const abortRef = useRef(null);
  const loadIdRef = useRef(0);
  const newSignal = () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  };

  // sentinel cho lazy load
  const sentinelRef = useRef(null);
  const ioRef = useRef(null);

  const title = useMemo(() => {
    switch (type) {
      case "book": return "Danh sách Sách";
      case "magazine": return "Tạp chí";
      case "newspaper": return "Báo";
      default: return "Tài liệu mới nhất";
    }
  }, [type]);

  // reset khi đổi tab/genre
  useEffect(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    setError("");
    setLoading(true);
  }, [type, selectedGenre, searchQuery]);

  // load page hiện tại
  useEffect(() => {
    let mounted = true;
    const myId = ++loadIdRef.current;

    const run = async () => {
      const isFirst = page === 1 && items.length === 0 && loading === true;
      if (!isFirst) setLoadingMore(true);
      setError("");

      try {
        const signal = newSignal();
        const { items: newItems, pagination } = await documentApi.fetchDocuments({
          type,
          page,
          limit: PAGE_SIZE,
          genreId: selectedGenre ?? null,
          match: "any",
          search: searchQuery,
          signal,
        });

        if (!mounted || myId !== loadIdRef.current) return;

        setItems(prev => page === 1 ? (newItems || []) : [...prev, ...(newItems || [])]);

        // xác định còn nữa không: ưu tiên từ pagination backend
        let more = true;
        if (pagination?.totalPages && pagination?.page) {
          more = pagination.page < pagination.totalPages;
        } else {
          more = (newItems?.length || 0) === PAGE_SIZE;
        }
        setHasMore(more);
      } catch (e) {
        if (isAbort(e)) return;
        if (mounted && myId === loadIdRef.current) {
          setError(e?.response?.data?.message || e?.message || "Không tải được danh sách");
        }
      } finally {
        if (mounted && myId === loadIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    };

    run();
    return () => {
      mounted = false;
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, type, selectedGenre, searchQuery]);

  // IntersectionObserver cho lazy load
  useEffect(() => {
    if (!sentinelRef.current) return;
    if (ioRef.current) {
      ioRef.current.disconnect();
      ioRef.current = null;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e.isIntersecting && hasMore && !loadingMore && !loading) {
          setPage((p) => p + 1);
        }
      },
      { root: null, rootMargin: "600px 0px", threshold: 0.01 }
    );
    io.observe(sentinelRef.current);
    ioRef.current = io;
    return () => io.disconnect();
  }, [hasMore, loadingMore, loading]);

  const handleGenreSelect = async (genreId) => {
    setSelectedGenre(genreId || null);
    setMobileFilterOpen(false); // Đóng drawer sau khi chọn
  };

  return (
    <>
      <ReaderHeader />

      <Box sx={{ px: { xs: 2, md: 3 }, py: 3 }}>
        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: "flex-start", gap: 3 }}>
          
          {/* SIDEBAR - Ẩn trên mobile, hiện trên desktop */}
          <Box 
            sx={{ 
              width: 300, 
              flexShrink: 0, 
              position: { md: "sticky" }, 
              top: { md: 80 },
              display: { xs: "none", md: "block" }
            }}
          >
            <ReaderSidebar selected={selectedGenre} onSelect={handleGenreSelect} />
          </Box>

          {/* CONTENT */}
          <Box sx={{ flexGrow: 1, minWidth: 0, width: "100%" }}>
            <Paper elevation={0} sx={{ p: { xs: 2, sm: 2 }, mb: 2, borderRadius: 2 }}>
              <Stack spacing={2}>
                
                {/* Header với title */}
                <Stack 
                  direction={{ xs: "column", sm: "row" }} 
                  alignItems={{ xs: "flex-start", sm: "center" }} 
                  justifyContent="space-between" 
                  spacing={1}
                >
                  <Typography variant="h5" fontWeight={800}>{title}</Typography>
                  
                  {selectedGenre && (
                    <Typography variant="body2" sx={{ opacity: 0.75, display: { xs: "none", sm: "block" } }}>
                      Đang lọc theo thể loại ID: <strong>{selectedGenre}</strong>
                    </Typography>
                  )}
                </Stack>

                {/* Filter button (mobile only) + Search box */}
                <Stack 
                  direction={{ xs: "column", sm: "row" }} 
                  spacing={1.5} 
                  alignItems="stretch"
                >
                  {/* Mobile filter button */}
                  <Box sx={{ display: { xs: "block", md: "none" } }}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<FilterIcon />}
                      onClick={() => setMobileFilterOpen(true)}
                      sx={{ 
                        borderRadius: 2,
                        borderColor: "#667EEA",
                        color: "#667EEA",
                        fontWeight: 600,
                        py: 1
                      }}
                    >
                      Lọc thể loại {selectedGenre && `(đã chọn)`}
                    </Button>
                  </Box>

                  {/* Search box - full width trên mobile */}
                  <Box sx={{ flex: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Tìm theo tên sách…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 2,
                          "&:hover fieldset": { borderColor: "#667EEA" }
                        }
                      }}
                    />
                  </Box>
                </Stack>

                {/* Chip hiển thị genre đã chọn trên mobile */}
                {selectedGenre && (
                  <Box sx={{ display: { xs: "block", sm: "none" } }}>
                    <Typography variant="caption" color="text.secondary">
                      Đang lọc: <strong>Thể loại ID {selectedGenre}</strong>
                    </Typography>
                  </Box>
                )}

              </Stack>
            </Paper>

            {/* lỗi chỉ hiện nếu không có cái gì để xem */}
            {error && items.length === 0 && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>
            )}

            {loading && items.length === 0 ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                <ButtonLoader />
              </Box>
            ) : items.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>Không có tài liệu nào.</Alert>
            ) : (
              <>
                <Box
                  sx={{
                    display: "grid",
                    gap: { xs: 1.5, sm: 2 },
                    gridTemplateColumns: {
                      xs: "repeat(2, 1fr)", // 2 cột trên mobile
                      sm: "repeat(3, 1fr)", // 3 cột trên tablet
                      md: "repeat(auto-fill, minmax(200px, 1fr))", // Flexible trên desktop
                    },
                  }}
                >
                  {items.map((d) => (
                    <Box key={d.documentId}>
                      <ReaderCard doc={d} />
                    </Box>
                  ))}
                </Box>

                {/* Loader đáy danh sách (lazy load) */}
                {loadingMore && (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                    <ButtonLoader />
                  </Box>
                )}

                {/* Nút tải thêm (fallback hoặc chủ động) */}
                {!loadingMore && hasMore && (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                    <Button 
                      variant="outlined" 
                      onClick={() => setPage(p => p + 1)}
                      sx={{ borderRadius: 2 }}
                    >
                      Tải thêm
                    </Button>
                  </Box>
                )}

                {/* Sentinel để IO bắt sự kiện lăn chuột */}
                <div ref={sentinelRef} />
              </>
            )}
          </Box>
        </Box>
      </Box>

      {/* Mobile Filter Drawer */}
      <Drawer
        anchor="left"
        open={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: "80%",
            maxWidth: 320,
          }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" fontWeight={700}>Lọc thể loại</Typography>
            <IconButton onClick={() => setMobileFilterOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <ReaderSidebar selected={selectedGenre} onSelect={handleGenreSelect} />
        </Box>
      </Drawer>

      <ReaderFooter maxContentWidth={1280} />
    </>
  );
}