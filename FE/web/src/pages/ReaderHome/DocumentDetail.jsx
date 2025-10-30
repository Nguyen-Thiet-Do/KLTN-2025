// src/pages/ReaderHome/DocumentDetail.jsx
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    Box, Stack, Typography, Chip, Divider, Button,
    Alert, Paper, Breadcrumbs, Link, CircularProgress,
    alpha, useTheme
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
        <Box sx={{
            color: 'primary.main',
            mt: 0.5,
            minWidth: 24
        }}>
            {icon}
        </Box>
        <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                {label}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.5 }}>
                {value}
            </Typography>
        </Box>
    </Stack>
);

export default function DocumentDetail() {
    const theme = useTheme();
    const { id } = useParams();
    const navigate = useNavigate();

    const [doc, setDoc] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [similar, setSimilar] = useState([]);
    const [loadingSimilar, setLoadingSimilar] = useState(false);

    const abortDetailRef = useRef(null);
    const abortSimilarRef = useRef(null);

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
        setLoading(true);
        setError("");
        try {
            const signal = newDetailSignal();
            const detail = await documentApi.getDocumentDetail(Number(id), { signal });
            setDoc(detail);
        } catch (e) {
            if (!isAbort(e)) setError(e?.response?.data?.message || e?.message || "Không tải được chi tiết tài liệu");
        } finally {
            setLoading(false);
        }
    };

    const loadSimilar = async () => {
        setLoadingSimilar(true);
        try {
            const signal = newSimilarSignal();
            const { items } = await documentApi.getSimilarDocuments(Number(id), { limit: 8, signal });
            setSimilar(items || []);
        } catch {
            /* ignore */
        } finally {
            setLoadingSimilar(false);
        }
    };

    useEffect(() => {
        load();
        loadSimilar();
        return () => {
            abortDetailRef.current?.abort();
            abortSimilarRef.current?.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const openEbook = async () => {
        try {
            const { ebookUrl } = await documentApi.getEbookUrl(Number(id));
            if (ebookUrl) window.open(ebookUrl, "_blank");
        } catch (e) {
            alert(e?.response?.data?.message || e?.message || "Không lấy được URL ebook");
        }
    };

    // ---- Mapping an toàn từ payload của bạn ----
    const title = doc?.title ?? "—";
    const language = doc?.language ?? "—";
    const publicationYear = doc?.publicationYear ?? "—";

    // objects
    const categoryName = doc?.category?.name ?? "—";
    const publisherName = doc?.publisher?.name ?? "—";

    // book.*
    const isbn = doc?.book?.isbn ?? "—";
    const edition = doc?.book?.edition ?? "—";
    const pageCount = doc?.book?.pageCount ?? "—";

    // deposit.*
    const minDeposit = doc?.deposit?.minDeposit ?? null;
    const maxDeposit = doc?.deposit?.maxDeposit ?? null;

    // copies
    const available = doc?.availableCopiesEffective ?? 0;
    const total = doc?.totalCopies ?? doc?.numberOfCopy ?? 0;

    // authors[]
    const authorNames = (doc?.authors || [])
        .sort((a, b) => (a?.ord ?? 0) - (b?.ord ?? 0))
        .map(a => a?.fullName)
        .filter(Boolean)
        .join(", ") || "—";

    // genres[]
    const genres = (doc?.genres || []).map(g => g?.name).filter(Boolean);

    return (
        <>
            <ReaderHeader />

            <Box sx={{ 
                px: { xs: 2, md: 3 }, 
                py: 3, 
                maxWidth: 1280, 
                mx: "auto",
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                minHeight: '100vh'
            }}>
                {/* Breadcrumbs với glass effect */}
                <Paper sx={{ 
                    p: 2, 
                    mb: 3,
                    background: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: 3,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.3)'
                }}>
                    <Breadcrumbs sx={{ mb: 1 }}>
                        <Link 
                            underline="hover" 
                            color="inherit" 
                            onClick={() => navigate(-1)} 
                            sx={{ 
                                cursor: "pointer",
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                fontWeight: 600,
                                color: 'primary.main',
                                '&:hover': {
                                    color: 'primary.dark'
                                }
                            }}
                        >
                            <ArrowBackIcon fontSize="small" />
                            Quay lại
                        </Link>
                        <Typography color="text.primary" fontWeight={600}>
                            Chi tiết tài liệu
                        </Typography>
                    </Breadcrumbs>
                </Paper>

                {loading ? (
                    <Box sx={{ 
                        display: "flex", 
                        justifyContent: "center", 
                        alignItems: "center",
                        py: 12,
                        background: 'rgba(255,255,255,0.8)',
                        borderRadius: 4,
                        backdropFilter: 'blur(10px)'
                    }}>
                        <Stack spacing={2} alignItems="center">
                            <CircularProgress size={60} thickness={4} />
                            <Typography variant="h6" color="text.secondary">
                                Đang tải thông tin...
                            </Typography>
                        </Stack>
                    </Box>
                ) : error ? (
                    <Alert 
                        severity="error" 
                        sx={{ 
                            borderRadius: 3,
                            background: 'rgba(255,255,255,0.9)',
                            backdropFilter: 'blur(10px)',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                            fontWeight: 500
                        }}
                    >
                        {error}
                    </Alert>
                ) : !doc ? (
                    <Alert 
                        severity="warning"
                        sx={{ 
                            borderRadius: 3,
                            background: 'rgba(255,255,255,0.9)',
                            backdropFilter: 'blur(10px)'
                        }}
                    >
                        Không tìm thấy tài liệu.
                    </Alert>
                ) : (
                    <Stack spacing={3}>
                        {/* Main Content Card */}
                        <Paper sx={{ 
                            p: { xs: 2, md: 4 },
                            background: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(20px)',
                            borderRadius: 4,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                            border: '1px solid rgba(255, 255, 255, 0.3)'
                        }}>
                            <Stack direction={{ xs: "column", md: "row" }} spacing={4}>
                                {/* Book Cover */}
                                <Box sx={{ 
                                    width: { xs: '100%', md: 280 },
                                    flexShrink: 0,
                                    position: 'relative'
                                }}>
                                    <Box
                                        component="img"
                                        src={doc.coverPhoto || "/no-cover.png"}
                                        alt={title}
                                        onError={(e) => { e.currentTarget.src = "/no-cover.png"; }}
                                        sx={{ 
                                            width: 1, 
                                            height: 380, 
                                            objectFit: "cover", 
                                            borderRadius: 3,
                                            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                                            transition: 'all 0.3s ease',
                                            '&:hover': {
                                                transform: 'translateY(-4px)',
                                                boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
                                            }
                                        }}
                                    />
                                    {/* Availability Badge */}
                                    <Chip
                                        label={`Sẵn có: ${available}/${total}`}
                                        size="small"
                                        color={available > 0 ? "success" : "error"}
                                        sx={{
                                            position: 'absolute',
                                            top: 12,
                                            right: 12,
                                            fontWeight: 700,
                                            background: available > 0 
                                                ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                                                : 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                                            color: 'white',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                        }}
                                    />
                                </Box>

                                {/* Book Details */}
                                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                    <Typography 
                                        variant="h3" 
                                        fontWeight={800} 
                                        gutterBottom
                                        sx={{
                                            background: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
                                            backgroundClip: 'text',
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent',
                                            lineHeight: 1.2,
                                            fontSize: { xs: '2rem', md: '2.5rem' }
                                        }}
                                    >
                                        {title}
                                    </Typography>

                                    {/* Tags */}
                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
                                        {language && language !== "—" && (
                                            <Chip 
                                                icon={<LanguageIcon />}
                                                label={language} 
                                                size="small" 
                                                variant="outlined"
                                                sx={{
                                                    borderColor: 'primary.main',
                                                    color: 'primary.main',
                                                    fontWeight: 600
                                                }}
                                            />
                                        )}
                                        {publicationYear && publicationYear !== "—" && (
                                            <Chip 
                                                icon={<CalendarIcon />}
                                                label={publicationYear} 
                                                size="small"
                                                variant="outlined"
                                                sx={{
                                                    borderColor: 'secondary.main',
                                                    color: 'secondary.main',
                                                    fontWeight: 600
                                                }}
                                            />
                                        )}
                                        {edition !== "—" && (
                                            <Chip 
                                                icon={<LibraryIcon />}
                                                label={`Tái bản ${edition}`} 
                                                size="small"
                                                sx={{
                                                    background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
                                                    color: 'white',
                                                    fontWeight: 600
                                                }}
                                            />
                                        )}
                                        {pageCount !== "—" && (
                                            <Chip 
                                                label={`${pageCount} trang`} 
                                                size="small"
                                                sx={{
                                                    background: 'rgba(100, 116, 139, 0.1)',
                                                    color: 'slate.600',
                                                    fontWeight: 600
                                                }}
                                            />
                                        )}
                                    </Stack>

                                    {/* Genres */}
                                    {genres.length > 0 && (
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
                                            {genres.map((genre, index) => (
                                                <Chip 
                                                    key={genre}
                                                    label={genre}
                                                    size="small"
                                                    sx={{
                                                        background: index % 2 === 0 
                                                            ? 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)'
                                                            : 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
                                                        color: 'white',
                                                        fontWeight: 600,
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                                    }}
                                                />
                                            ))}
                                        </Stack>
                                    )}

                                    <Divider sx={{ 
                                        my: 3,
                                        background: 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.3) 50%, transparent 100%)',
                                        height: 2
                                    }} />

                                    {/* Information Grid */}
                                    <Box sx={{ 
                                        display: 'grid',
                                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                                        gap: 3,
                                        mb: 4
                                    }}>
                                        <InfoItem 
                                            icon={<PersonIcon />}
                                            label="Tác giả"
                                            value={authorNames}
                                        />
                                        <InfoItem 
                                            icon={<BusinessIcon />}
                                            label="Nhà xuất bản"
                                            value={publisherName}
                                        />
                                        <InfoItem 
                                            icon={<LocalLibraryIcon />}
                                            label="Thể loại"
                                            value={categoryName}
                                        />
                                        <InfoItem 
                                            icon={<MenuBookIcon />}
                                            label="ISBN"
                                            value={isbn}
                                        />
                                        <InfoItem 
                                            icon={<CalendarIcon />}
                                            label="Giá bìa"
                                            value={fmtVND(doc.coverPrice)}
                                        />
                                        <InfoItem 
                                            icon={<LibraryIcon />}
                                            label="Tiền cọc"
                                            value={`${fmtVND(minDeposit)} – ${fmtVND(maxDeposit)}`}
                                        />
                                    </Box>

                                    {/* Action Buttons */}
                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 4 }}>
                                        <Button 
                                            variant="contained" 
                                            onClick={openEbook} 
                                            disabled={!doc.ebookUrl && !doc.hasEbook}
                                            startIcon={<EbookIcon />}
                                            sx={{
                                                borderRadius: 3,
                                                px: 4,
                                                py: 1.5,
                                                background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
                                                fontWeight: 700,
                                                fontSize: '1rem',
                                                boxShadow: '0 4px 20px rgba(102,126,234,0.4)',
                                                transition: 'all 0.3s ease',
                                                '&:hover': {
                                                    background: 'linear-gradient(135deg, #5A67D8 0%, #6B46C1 100%)',
                                                    boxShadow: '0 8px 30px rgba(102,126,234,0.6)',
                                                    transform: 'translateY(-2px)'
                                                },
                                                '&:disabled': {
                                                    background: 'grey.300',
                                                    boxShadow: 'none'
                                                }
                                            }}
                                        >
                                            Đọc Ebook
                                        </Button>
                                        <Button 
                                            variant="outlined" 
                                            onClick={() => navigate(-1)}
                                            startIcon={<ArrowBackIcon />}
                                            sx={{
                                                borderRadius: 3,
                                                px: 4,
                                                py: 1.5,
                                                borderColor: 'slate.300',
                                                color: 'slate.700',
                                                fontWeight: 600,
                                                fontSize: '1rem',
                                                '&:hover': {
                                                    borderColor: 'primary.main',
                                                    backgroundColor: 'rgba(99,102,241,0.04)',
                                                    transform: 'translateY(-2px)',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                                }
                                            }}
                                        >
                                            Quay lại
                                        </Button>
                                    </Stack>
                                </Box>
                            </Stack>
                        </Paper>

                        {/* Description Section */}
                        {doc.description && (
                            <Paper sx={{ 
                                p: { xs: 2, md: 4 },
                                background: 'rgba(255, 255, 255, 0.95)',
                                backdropFilter: 'blur(20px)',
                                borderRadius: 4,
                                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                                border: '1px solid rgba(255, 255, 255, 0.3)'
                            }}>
                                <Typography 
                                    variant="h5" 
                                    fontWeight={700} 
                                    gutterBottom
                                    sx={{
                                        background: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
                                        backgroundClip: 'text',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1
                                    }}
                                >
                                    <MenuBookIcon color="primary" />
                                    Mô tả
                                </Typography>
                                <Typography 
                                    variant="body1" 
                                    whiteSpace="pre-line" 
                                    sx={{ 
                                        lineHeight: 1.7,
                                        color: 'text.primary',
                                        fontSize: '1.1rem'
                                    }}
                                >
                                    {doc.description}
                                </Typography>
                            </Paper>
                        )}

                        {/* Similar Documents Section */}
                        <Paper sx={{ 
                            p: { xs: 2, md: 4 },
                            background: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(20px)',
                            borderRadius: 4,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                            border: '1px solid rgba(255, 255, 255, 0.3)'
                        }}>
                            <Typography 
                                variant="h5" 
                                fontWeight={700} 
                                gutterBottom
                                sx={{
                                    background: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
                                    backgroundClip: 'text',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    mb: 3
                                }}
                            >
                                <LocalLibraryIcon color="primary" />
                                Sách tương tự
                            </Typography>
                            {loadingSimilar ? (
                                <Box sx={{ 
                                    display: "flex", 
                                    justifyContent: "center", 
                                    alignItems: "center",
                                    py: 6 
                                }}>
                                    <Stack spacing={2} alignItems="center">
                                        <CircularProgress size={40} />
                                        <Typography variant="body2" color="text.secondary">
                                            Đang tải sách tương tự...
                                        </Typography>
                                    </Stack>
                                </Box>
                            ) : similar.length === 0 ? (
                                <Typography 
                                    variant="body1" 
                                    color="text.secondary" 
                                    textAlign="center"
                                    sx={{ py: 4 }}
                                >
                                    Chưa có sách tương tự được đề xuất.
                                </Typography>
                            ) : (
                                <Box sx={{ 
                                    display: "grid", 
                                    gap: 3, 
                                    gridTemplateColumns: { 
                                        xs: "1fr", 
                                        sm: "repeat(2, 1fr)", 
                                        md: "repeat(3, 1fr)",
                                        lg: "repeat(4, 1fr)"
                                    } 
                                }}>
                                    {similar.map((s) => (
                                        <ReaderCard key={s.documentId} doc={s} />
                                    ))}
                                </Box>
                            )}
                        </Paper>
                    </Stack>
                )}
            </Box>

            <ReaderFooter maxContentWidth={1280} />
        </>
    );
}