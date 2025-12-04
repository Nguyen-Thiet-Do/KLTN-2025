import { useEffect, useRef, useState } from "react";
import axios from "axios";
import api from "../../services/api";
import { useCart } from "../../contexts/CartContext";
import { useFavorite } from "../../contexts/FavoriteContext";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Stack, Typography, Chip, Divider, Button,
  Alert, Paper, Breadcrumbs, Link, Snackbar,
  Rating, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, Avatar, IconButton, Pagination
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
  AutoStories as EbookIcon,
  FavoriteBorder, Favorite,
  Star as StarIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from "@mui/icons-material";

import ReaderHeader from "../../components/layouts/ReaderHeader";
import ReaderFooter from "../../components/layouts/ReaderFooter";
import ReaderCard from "../../components/layouts/ReaderCard";
import { documentApi } from "../../services/documentApi";
import { reviewApi } from "../../services/reviewApi";
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

  const [userId, setUserId] = useState(sessionStorage.getItem("accountId"));
  const { loadCart } = useCart();
  const { loadFavorite } = useFavorite();
  const [isFavorite, setIsFavorite] = useState(false);

  // Review states
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({ averageRating: 0, totalReviews: 0 });
  const [loadingReviews, setLoadingReviews] = useState(false);
  
  // ✅ PAGINATION STATES
  const [currentPage, setCurrentPage] = useState(1);
  const [reviewsPerPage] = useState(3);
  
  const [reviewDialog, setReviewDialog] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [editingReview, setEditingReview] = useState(null);
  const [myReview, setMyReview] = useState(null);

  const getCurrentAccountId = () => {
    try {
      const accountStr = sessionStorage.getItem("account");
      if (!accountStr) return null;
      const account = JSON.parse(accountStr);
      return account?.accountId ? Number(account.accountId) : null;
    } catch {
      return null;
    }
  };

  const [snack, setSnack] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const abortDetailRef = useRef(null);
  const abortSimilarRef = useRef(null);
  const loadDetailIdRef = useRef(0);
  const loadSimilarIdRef = useRef(0);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "accountId") {
        const newUserId = e.newValue;
        if (newUserId !== userId) {
          setUserId(newUserId);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [userId]);

  useEffect(() => {
    const currentUserId = sessionStorage.getItem("accountId");
    if (currentUserId !== userId) {
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

  const checkFavorite = async () => {
    try {
      const res = await api.get("/favorite");
      const exists = res.data.some(item => item.documentId === Number(id));
      setIsFavorite(exists);
    } catch { }
  };

  // ✅ Load reviews với pagination reset
  const loadReviews = async () => {
    setLoadingReviews(true);
    try {
      const response = await reviewApi.getReviews(Number(id));
      console.log("📥 Raw API Response:", response.data);
      
      if (response.data.success) {
        const { reviews: reviewList, stats } = response.data.data;
        
        setReviews(reviewList);
        setReviewStats(stats);
        setCurrentPage(1); // ✅ Reset về trang 1

        const currentAccountId = getCurrentAccountId();
        
        console.log("🔍 Current AccountId:", currentAccountId, `(type: ${typeof currentAccountId})`);
        
        console.log("📋 All Reviews Data:");
        reviewList.forEach((r, idx) => {
          const readerAccId = Number(r.Reader?.accountId);
          const isMatch = readerAccId === currentAccountId;
          
          console.log(`Review #${idx + 1}:`, {
            reviewId: r.reviewId,
            readerAccountId: readerAccId,
            readerAccountIdType: typeof r.Reader?.accountId,
            fullName: r.Reader?.fullName,
            currentAccountId: currentAccountId,
            isMatch: isMatch,
            calculation: `${readerAccId} === ${currentAccountId} = ${isMatch}`
          });
        });
        
        const userReview = reviewList.find(r => 
          Number(r.Reader?.accountId) === currentAccountId || 
          Number(r.readerAccountId) === currentAccountId
        );
        
        setMyReview(userReview || null);
        
        console.log("✅ My Review Result:", {
          found: !!userReview,
          reviewId: userReview?.reviewId || "N/A",
          myAccountId: currentAccountId
        });
      }
    } catch (error) {
      console.error("❌ Error loading reviews:", error);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    if (doc) {
      checkFavorite();
      loadReviews();
    }
  }, [doc]);

  useEffect(() => {
     window.scrollTo(0, 0);
    load();
    loadSimilar();
    return () => {
      abortDetailRef.current?.abort();
      abortSimilarRef.current?.abort();
    };
  }, [id]);

const openEbook = async () => {
  const token = sessionStorage.getItem("accessToken");

  if (!token) {
    setSnack({
      open: true,
      message: "Vui lòng đăng nhập để đọc ebook!",
      severity: "error"
    });
    return;
  }

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
      loadCart();
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

  const toggleFavorite = async () => {
    const token = sessionStorage.getItem("accessToken");

    if (!token) {
      setSnack({
        open: true,
        message: "Vui lòng đăng nhập để sử dụng yêu thích!",
        severity: "error",
      });
      return;
    }

    try {
      if (isFavorite) {
        await api.delete(`/favorite/${doc.documentId}`);
        setIsFavorite(false);
        loadFavorite();
        setSnack({
          open: true,
          message: "Đã xóa khỏi yêu thích",
          severity: "info",
        });
      } else {
        await api.post("/favorite/add", { documentId: doc.documentId });
        setIsFavorite(true);
        loadFavorite();
        setSnack({
          open: true,
          message: "Đã thêm vào yêu thích!",
          severity: "success",
        });
      }
    } catch {
      setSnack({
        open: true,
        message: "Lỗi thao tác yêu thích",
        severity: "error",
      });
    }
  };

  const handleOpenReviewDialog = (review = null) => {
    const token = sessionStorage.getItem("accessToken");

    if (!token) {
      setSnack({
        open: true,
        message: "Vui lòng đăng nhập để đánh giá!",
        severity: "error",
      });
      return;
    }

    if (review) {
      setEditingReview(review);
      setReviewForm({ rating: review.rating, comment: review.comment || "" });
    } else {
      setEditingReview(null);
      setReviewForm({ rating: 5, comment: "" });
    }
    setReviewDialog(true);
  };

  const handleCloseReviewDialog = () => {
    setReviewDialog(false);
    setEditingReview(null);
    setReviewForm({ rating: 5, comment: "" });
  };

  const handleSubmitReview = async () => {
    try {
      const currentAccountId = getCurrentAccountId();
      
      if (editingReview) {
        console.log("📝 Updating review:", editingReview.reviewId);
        await reviewApi.updateReview(editingReview.reviewId, reviewForm);
        
        setSnack({
          open: true,
          message: "✅ Đã cập nhật đánh giá!",
          severity: "success",
        });
      } else {
        console.log("📝 Creating new review with accountId:", currentAccountId);
        
        await reviewApi.addReview({
          documentId: Number(id),
          accountId: currentAccountId,
          rating: reviewForm.rating,
          comment: reviewForm.comment
        });
        
        setSnack({
          open: true,
          message: "✅ Đã thêm đánh giá!",
          severity: "success",
        });
      }
      
      handleCloseReviewDialog();
      await loadReviews();
      
    } catch (error) {
      console.error("❌ Error submitting review:", error);
      
      setSnack({
        open: true,
        message: error.response?.data?.message || "Lỗi khi gửi đánh giá",
        severity: "error",
      });
    }
  };

  const handleDeleteReview = async (reviewId) => {
    const confirmed = window.confirm(
      "Bạn có chắc chắn muốn xóa đánh giá này?\n\nHành động này không thể hoàn tác."
    );
    
    if (!confirmed) return;

    try {
      console.log("🗑️ Deleting review:", reviewId);
      
      await reviewApi.deleteReview(reviewId);
      
      setSnack({
        open: true,
        message: "✅ Đã xóa đánh giá!",
        severity: "success",
      });
      
      await loadReviews();
      
    } catch (error) {
      console.error("❌ Error deleting review:", error);
      
      setSnack({
        open: true,
        message: error.response?.data?.message || "Lỗi khi xóa đánh giá",
        severity: "error",
      });
    }
  };

  // ✅ PAGINATION LOGIC
  const indexOfLastReview = currentPage * reviewsPerPage;
  const indexOfFirstReview = indexOfLastReview - reviewsPerPage;
  const currentReviews = reviews.slice(indexOfFirstReview, indexOfLastReview);
  const totalPages = Math.ceil(reviews.length / reviewsPerPage);

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
    // Scroll về phần reviews
    document.getElementById('reviews-section')?.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'start' 
    });
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

                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h3" fontWeight={800}>
                    {title}
                  </Typography>

                  <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 2 }}>
                    <Rating 
                      value={parseFloat(reviewStats.averageRating) || 0} 
                      precision={0.1} 
                      readOnly 
                      size="large"
                    />
                    <Box>
                      <Typography variant="h6" fontWeight={700}>
                        {parseFloat(reviewStats.averageRating || 0).toFixed(1)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {reviewStats.totalReviews} đánh giá
                      </Typography>
                    </Box>
                  </Stack>

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

                    <Button
                      variant="outlined"
                      color="error"
                      onClick={toggleFavorite}
                      sx={{ minWidth: 56 }}
                    >
                      {isFavorite ? <Favorite /> : <FavoriteBorder />}
                    </Button>

                    <Button variant="outlined" onClick={() => navigate(-1)}>
                      Quay lại
                    </Button>
                  </Stack>
                </Box>
              </Stack>
            </Paper>

            {doc.description && (
              <Paper sx={{ p: 4, borderRadius: 4 }}>
                <Typography variant="h5" fontWeight={700} gutterBottom>
                  Mô tả
                </Typography>
                <Typography>{doc.description}</Typography>
              </Paper>
            )}

            {/* REVIEWS SECTION */}
            <Paper sx={{ p: 4, borderRadius: 4 }} id="reviews-section">
              <Stack 
                direction="row" 
                justifyContent="space-between" 
                alignItems="center" 
                mb={3}
              >
                <Box>
                  <Typography variant="h5" fontWeight={700} gutterBottom>
                    Đánh giá từ độc giả
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {reviewStats.totalReviews > 0 
                      ? `${reviewStats.totalReviews} đánh giá • Trung bình ${parseFloat(reviewStats.averageRating).toFixed(1)} ⭐`
                      : 'Chưa có đánh giá nào'
                    }
                    {totalPages > 1 && ` • Trang ${currentPage}/${totalPages}`}
                  </Typography>
                </Box>
                
                {!myReview && (
                  <Button
                    variant="contained"
                    startIcon={<StarIcon />}
                    onClick={() => handleOpenReviewDialog()}
                  >
                    Viết đánh giá
                  </Button>
                )}
                
                {myReview && (
                  <Chip 
                    icon={<StarIcon />}
                    label="Bạn đã đánh giá" 
                    color="success"
                    variant="outlined"
                  />
                )}
              </Stack>

              {loadingReviews ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <ButtonLoader size={40} />
                </Box>
              ) : reviews.length === 0 ? (
                <Typography textAlign="center" color="text.secondary" py={4}>
                  Chưa có đánh giá nào. Hãy là người đầu tiên!
                </Typography>
              ) : (
                <>
                  <Stack spacing={2}>
                    {currentReviews.map((review) => {
                      const currentAccountId = getCurrentAccountId();
                      const reviewAccountId = parseInt(review.Reader?.accountId, 10) || 0;
                      const isMyReview = currentAccountId !== null && reviewAccountId === currentAccountId;
                      
                      console.log(`Review ${review.reviewId} render check:`, {
                        currentAccountId: currentAccountId,
                        reviewAccountId: reviewAccountId,
                        readerAccountIdRaw: review.Reader?.accountId,
                        isMyReview: isMyReview,
                        calculation: `${reviewAccountId} === ${currentAccountId}`,
                        types: {
                          current: typeof currentAccountId,
                          reader: typeof reviewAccountId,
                          raw: typeof review.Reader?.accountId
                        }
                      });
                      
                      return (
                        <Paper
                          key={review.reviewId}
                          variant="outlined"
                          sx={{ 
                            p: 3, 
                            borderRadius: 2,
                            bgcolor: isMyReview ? 'primary.50' : 'transparent',
                            border: isMyReview ? '2px solid' : '1px solid',
                            borderColor: isMyReview ? 'primary.main' : 'divider'
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Stack direction="row" spacing={2} sx={{ flex: 1 }}>
                              <Avatar 
                                sx={{ 
                                  bgcolor: isMyReview ? 'primary.main' : 'grey.400',
                                  width: 40,
                                  height: 40
                                }}
                              >
                                {review.Reader?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                              </Avatar>
                              
                              <Box sx={{ flex: 1 }}>
                                <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                                  <Typography variant="subtitle1" fontWeight={600}>
                                    {review.Reader?.fullName || 'Người dùng ẩn danh'}
                                  </Typography>
                                  {isMyReview && (
                                    <Chip 
                                      label="Bạn" 
                                      size="small" 
                                      color="primary" 
                                      sx={{ height: 20 }}
                                    />
                                  )}
                                </Stack>
                                
                                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                                  <Rating 
                                    value={review.rating} 
                                    size="small" 
                                    readOnly 
                                  />
                                  <Typography variant="caption" color="text.secondary">
                                    • {new Date(review.created_at).toLocaleDateString('vi-VN', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    })}
                                  </Typography>
                                </Stack>
                                
                                {review.comment && (
                                  <Typography 
                                    variant="body2" 
                                    color="text.secondary"
                                    sx={{ mt: 1 }}
                                  >
                                    {review.comment}
                                  </Typography>
                                )}
                              </Box>
                            </Stack>

                            {isMyReview && (
                              <Stack direction="row" spacing={0.5}>
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => {
                                    console.log("✏️ Editing review:", review.reviewId);
                                    handleOpenReviewDialog(review);
                                  }}
                                  sx={{
                                    '&:hover': {
                                      bgcolor: 'primary.50'
                                    }
                                  }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    console.log("🗑️ Deleting review:", review.reviewId);
                                    handleDeleteReview(review.reviewId);
                                  }}
                                  sx={{
                                    '&:hover': {
                                      bgcolor: 'error.50'
                                    }
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Stack>
                            )}
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>

                  {/* ✅ PAGINATION COMPONENT */}
                  {totalPages > 1 && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                      <Pagination 
                        count={totalPages}
                        page={currentPage}
                        onChange={handlePageChange}
                        color="primary"
                        size="large"
                        showFirstButton
                        showLastButton
                        sx={{
                          '& .MuiPaginationItem-root': {
                            fontSize: '1rem',
                            fontWeight: 600
                          }
                        }}
                      />
                    </Box>
                  )}
                </>
              )}
            </Paper>

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

      {/* Review Dialog */}
      <Dialog open={reviewDialog} onClose={handleCloseReviewDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingReview ? "Chỉnh sửa đánh giá" : "Viết đánh giá"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="body2" gutterBottom>
                Đánh giá của bạn
              </Typography>
              <Rating
                value={reviewForm.rating}
                onChange={(e, newValue) =>
                  setReviewForm({ ...reviewForm, rating: newValue })
                }
                size="large"
              />
            </Box>
            <TextField
              label="Nhận xét (không bắt buộc)"
              multiline
              rows={4}
              fullWidth
              value={reviewForm.comment}
              onChange={(e) =>
                setReviewForm({ ...reviewForm, comment: e.target.value })
              }
              inputProps={{ maxLength: 1000 }}
              helperText={`${reviewForm.comment.length}/1000 ký tự`}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseReviewDialog}>Hủy</Button>
          <Button
            variant="contained"
            onClick={handleSubmitReview}
            disabled={!reviewForm.rating}
          >
            {editingReview ? "Cập nhật" : "Gửi đánh giá"}
          </Button>
        </DialogActions>
      </Dialog>

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