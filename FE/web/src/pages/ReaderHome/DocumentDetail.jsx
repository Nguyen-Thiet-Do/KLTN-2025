import { useEffect, useRef, useState } from "react";
import axios from "axios";
import api from "../../services/api";

import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Stack, Typography, Chip, Divider, Button,
  Alert, Paper, Breadcrumbs, Link, Snackbar
} from "@mui/material";


import {
  ArrowBack as ArrowBackIcon,
  MenuBook as MenuBookIcon,
  CalendarToday as CalendarIcon,
  Language as LanguageIcon,
  LibraryBooks as LibraryIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  LocalLibrary as LocalLibraryIcon,
  AutoStories as EbookIcon
} from "@mui/icons-material";

import ReaderHeader from "../../components/layouts/ReaderHeader";
import ReaderFooter from "../../components/layouts/ReaderFooter";
import ReaderCard from "../../components/layouts/ReaderCard";
import { documentApi } from "../../services/documentApi";
import ButtonLoader from "../../components/Loading/ButtonLoader";

const isAbort = (e) =>
  e?.code === "ERR_CANCELED" ||
  e?.name === "CanceledError" ||
  e?.name === "AbortError" ||
  e?.message?.includes?.("canceled") ||
  e?.message?.includes?.("aborted");

const fmtVND = (v) => {
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(n)}₫`;
};

const InfoItem = ({ icon, label, value }) => (
  <Stack direction="row" spacing={2} alignItems="flex-start">
    <Box sx={{ color: 'primary.main', mt: 0.5, minWidth: 24 }}>{icon}</Box>
    <Box sx={{ flex: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.5 }}>
        {value}
      </Typography>
    </Box>
  </Stack>
);

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [similar, setSimilar] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  const [userId, setUserId] = useState(sessionStorage.getItem("userId"));

  const [snack, setSnack] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const abortDetailRef = useRef(null);
  const abortSimilarRef = useRef(null);
  const loadDetailIdRef = useRef(0);
  const loadSimilarIdRef = useRef(0);

  // ⭐ ĐỒNG BỘ USERID KHI THAY ĐỔI (storage event từ tab khác)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "userId") {
        const newUserId = e.newValue;
        console.log("DocumentDetail: userId changed from storage event:", newUserId);
        
        if (newUserId !== userId) {
          setUserId(newUserId);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [userId]);

  // ⭐ KIỂM TRA USERID KHI COMPONENT MOUNT
  useEffect(() => {
    const currentUserId = sessionStorage.getItem("userId");
    if (currentUserId !== userId) {
      console.log("DocumentDetail: userId changed on mount:", currentUserId);
      setUserId(currentUserId);
    }
  }, []);

  const newDetailSignal = () => {
    if (abortDetailRef.current) abortDetailRef.current.abort();
    abortDetailRef.current = new AbortController();
    return abortDetailRef.current.signal;
  };

  const newSimilarSignal = () => {
    if (abortSimilarRef.current) abortSimilarRef.current.abort();
    abortSimilarRef.current = new AbortController();
    return abortSimilarRef.current.signal;
  };

  const load = async () => {
    const myId = ++loadDetailIdRef.current;
    setLoading(true);
    setError("");

    try {
      const signal = newDetailSignal();
      const detail = await documentApi.getDocumentDetail(Number(id), { signal });

      if (myId === loadDetailIdRef.current) setDoc(detail);
    } catch (e) {
      if (!isAbort(e) && myId === loadDetailIdRef.current) {
        setError(e?.response?.data?.message || "Không tải được chi tiết tài liệu");
      }
    } finally {
      if (myId === loadDetailIdRef.current) setLoading(false);
    }
  };

  const loadSimilar = async () => {
    const myId = ++loadSimilarIdRef.current;
    setLoadingSimilar(true);

    try {
      const signal = newSimilarSignal();
      const { items } = await documentApi.getSimilarDocuments(Number(id), { limit: 8, signal });

      if (myId === loadSimilarIdRef.current) setSimilar(items || []);
    } catch { }
    finally {
      if (myId === loadSimilarIdRef.current) setLoadingSimilar(false);
    }
  };

  useEffect(() => {
    load();
    loadSimilar();
    return () => {
      abortDetailRef.current?.abort();
      abortSimilarRef.current?.abort();
    };
  }, [id]);

  const openEbook = async () => {
    try {
      const { ebookUrl } = await documentApi.getEbookUrl(Number(id));
      if (ebookUrl) navigate(`/reader/ebook/${id}`);
    } catch {
      alert("Không lấy được URL ebook");
    }
  };

   const addToCart = async () => {
    const token = sessionStorage.getItem("accessToken");

    if (!token) {
      setSnack({
        open: true,
        message: "Vui lòng đăng nhập để thêm sách vào giỏ!",
        severity: "error"
      });
      return;
    }

    try {


    await api.post("/cart/add", {
      documentId: doc.documentId 
     });

      setSnack({
        open: true,
        message: "Đã thêm vào giỏ sách!",
        severity: "success",
      });

    } catch (err) {
      setSnack({
        open: true,
        message: err.message || "Không thể thêm vào giỏ",
        severity: "error",
      });
    }
  };


  const title = doc?.title ?? "—";
  const language = doc?.language ?? "—";
  const publicationYear = doc?.publicationYear ?? "—";
  const categoryName = doc?.category?.name ?? "—";
  const publisherName = doc?.publisher?.name ?? "—";
  const isbn = doc?.book?.isbn ?? "—";
  const edition = doc?.book?.edition ?? "—";
  const pageCount = doc?.book?.pageCount ?? "—";
  const available = doc?.availableCopiesEffective ?? 0;
  const total = doc?.totalCopies ?? doc?.numberOfCopy ?? 0;

  const authorNames = (doc?.authors || [])
    .sort((a, b) => (a?.ord ?? 0) - (b?.ord ?? 0))
    .map(a => a?.fullName)
    .filter(Boolean)
    .join(", ") || "—";

  const genres = (doc?.genres || []).map(g => g?.name).filter(Boolean);

  return (
    <>
      <ReaderHeader />

      <Box sx={{
        px: { xs: 2, md: 3 },
        py: 3,
        maxWidth: 1280,
        mx: "auto",
        minHeight: "100vh"
      }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
            <ButtonLoader size={60} />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : !doc ? (
          <Alert severity="warning">Không tìm thấy tài liệu.</Alert>
        ) : (
          <Stack spacing={3}>

            <Paper sx={{ p: 4, borderRadius: 4 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={4}>
                
                {/* ẢNH BÌA */}
                <Box sx={{ width: 280 }}>
                  <Box
                    component="img"
                    src={doc.coverPhoto || "/no-cover.png"}
                    alt={title}
                    sx={{ width: 1, height: 380, objectFit: "cover", borderRadius: 3 }}
                  />
                  <Chip
                    label={`Sẵn có: ${available}/${total}`}
                    color={available > 0 ? "success" : "error"}
                    sx={{ mt: 1 }}
                  />
                </Box>

                {/* THÔNG TIN */}
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h3" fontWeight={800}>
                    {title}
                  </Typography>

                  <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
                    {language !== "—" && <Chip label={language} />}
                    {publicationYear !== "—" && <Chip label={publicationYear} />}
                    {edition !== "—" && <Chip label={`Tái bản ${edition}`} />}
                    {pageCount !== "—" && <Chip label={`${pageCount} trang`} />}
                  </Stack>

                  <Divider sx={{ my: 3 }} />

                  <Box sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 3
                  }}>
                    <InfoItem icon={<PersonIcon />} label="Tác giả" value={authorNames} />
                    <InfoItem icon={<BusinessIcon />} label="Nhà xuất bản" value={publisherName} />
                    <InfoItem icon={<LocalLibraryIcon />} label="Thể loại" value={categoryName} />
                    <InfoItem icon={<MenuBookIcon />} label="ISBN" value={isbn} />
                    <InfoItem icon={<CalendarIcon />} label="Giá bìa" value={fmtVND(doc.coverPrice)} />
                  </Box>

                  {/* BUTTONS */}
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 4 }}>
                    <Button variant="contained" onClick={openEbook}>
                      Đọc Ebook
                    </Button>

                    <Button
                      variant="contained"
                      color="success"
                      onClick={addToCart}
                    >
                      Thêm vào giỏ sách
                    </Button>

                    <Button variant="outlined" onClick={() => navigate(-1)}>
                      Quay lại
                    </Button>
                  </Stack>
                </Box>
              </Stack>
            </Paper>

            {/* MÔ TẢ */}
            {doc.description && (
              <Paper sx={{ p: 4, borderRadius: 4 }}>
                <Typography variant="h5" fontWeight={700} gutterBottom>
                  Mô tả
                </Typography>
                <Typography>{doc.description}</Typography>
              </Paper>
            )}

            {/* SÁCH TƯƠNG TỰ */}
            <Paper sx={{ p: 4, borderRadius: 4 }}>
              <Typography variant="h5" fontWeight={700} mb={2}>
                Sách tương tự
              </Typography>

              {loadingSimilar ? (
                <ButtonLoader size={40} />
              ) : similar.length === 0 ? (
                <Typography textAlign="center">Chưa có sách tương tự.</Typography>
              ) : (
                <Box
                  sx={{
                    display: "grid",
                    gap: 3,
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(2, 1fr)",
                      md: "repeat(3, 1fr)",
                      lg: "repeat(4, 1fr)"
                    }
                  }}
                >
                  {similar.map((s) => (
                    <ReaderCard key={s.documentId} doc={s} />
                  ))}
                </Box>
              )}
            </Paper>
          </Stack>
        )}
      </Box>

      <ReaderFooter />

      {/* SNACKBAR */}
      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack({ ...snack, open: false })}
      >
        <Alert severity={snack.severity} variant="filled">
          {snack.message}
        </Alert>
      </Snackbar>
    </>
  );
}