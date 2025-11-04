import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Grid,
  Stack,
  TextField,
  Button,
  MenuItem,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  InputAdornment,
  Alert,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardMedia,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  Avatar,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon,
  Image as ImageIcon,
  Description as DescriptionIcon,
  LibraryBooks as LibraryBooksIcon,
  Person as PersonIcon,
  Category as CategoryIcon,
  LocalLibrary as LocalLibraryIcon,
  CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";
import Autocomplete from "@mui/material/Autocomplete";
import { useSnackbar } from "notistack";
import { createBook } from "../../../services/bookService";
import {
  getAllAuthors,
  getAllGenres,
  getAllPublishers,
} from "../../../services/metadataService";

const STATUS_OPTIONS = [
  { value: "AVAILABLE", label: "Sẵn sàng", color: "success" },
  { value: "BORROWED", label: "Đang mượn", color: "warning" },
  { value: "MAINTENANCE", label: "Bảo trì", color: "error" },
  { value: "LOST", label: "Đã mất", color: "default" },
];

const STEPS = ["Thông tin cơ bản", "Chi tiết & Tác giả", "Media & Bản sao"];

const init = {
  title: "",
  language: "Vietnamese",
  publicationYear: new Date().getFullYear(),
  coverPrice: "",
  description: "",
  shelfLocation: "",
  publisherName: "",
  bookData: { isbn: "", edition: "", pageCount: "" },
  authors: [{ fullName: "", role: "main", ord: 1 }],
  genres: [],
  coverFile: null,
  ebookFile: null,
  coverUrl: "",
  ebookViewUrl: "",
  initialCopies: [],
  initialCopiesCount: 0,
};

const strEqual = (o, v) => String(o || "") === String(v || "");

const autoSlots = {
  popper: { sx: { minWidth: 360 } },
  paper: { sx: { minWidth: 360 } },
  listbox: { sx: { "& li": { whiteSpace: "nowrap" } } },
};

/** Hỗ trợ ebook: PDF/EPUB */
const SUPPORTED_EBOOK_MIME = ["application/pdf", "application/epub+zip"];
const SUPPORTED_EBOOK_EXT = [".pdf", ".epub"];
const isSupportedEbook = (file) => {
  if (!file) return true;
  const okMime = SUPPORTED_EBOOK_MIME.includes(file.type);
  const name = (file.name || "").toLowerCase();
  const okExt = SUPPORTED_EBOOK_EXT.some((ext) => name.endsWith(ext));
  return okMime || okExt; // đề phòng browser không set đúng mime
};

export default function BookCreateDialog({ open, onClose, onCreated }) {
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState(init);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeStep, setActiveStep] = useState(0);

  const [genresOpt, setGenresOpt] = useState([]);
  const [authorsOpt, setAuthorsOpt] = useState([]);
  const [pubsOpt, setPubsOpt] = useState([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [g, a, p] = await Promise.all([
          getAllGenres(),
          getAllAuthors(),
          getAllPublishers(),
        ]);
        setGenresOpt(
          g
            .map((x) => (typeof x === "string" ? x : x?.name))
            .filter(Boolean)
        );
        setAuthorsOpt(
          a
            .map((x) => (typeof x === "string" ? x : x?.fullName))
            .filter(Boolean)
        );
        setPubsOpt(
          p
            .map((x) => (typeof x === "string" ? x : x?.name))
            .filter(Boolean)
        );
      } catch (e) {
        console.warn("Load metadata lỗi:", e);
      }
    })();
  }, [open]);

  // Reset form khi mở/đóng dialog
  useEffect(() => {
    if (open) {
      setForm(init);
      setActiveStep(0);
      setError("");
    }
  }, [open]);

  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const setBD = (k, v) =>
    setForm((p) => ({ ...p, bookData: { ...p.bookData, [k]: v } }));

  const addAuthor = () =>
    setForm((p) => ({
      ...p,
      authors: [
        ...p.authors,
        { fullName: "", role: "main", ord: p.authors.length + 1 },
      ],
    }));

  const rmAuthor = (i) =>
    setForm((p) => ({ ...p, authors: p.authors.filter((_, idx) => idx !== i) }));

  const upAuthor = (i, k, v) =>
    setForm((p) => ({
      ...p,
      authors: p.authors.map((a, idx) => (idx === i ? { ...a, [k]: v } : a)),
    }));

  const addCopy = () =>
    setForm((p) => ({
      ...p,
      initialCopies: [
        ...(p.initialCopies || []),
        {
          barCode: "",
          status: "AVAILABLE",
          conditionNote: "100",
          entryDate: new Date().toISOString().slice(0, 10),
        },
      ],
    }));

  const rmCopy = (i) =>
    setForm((p) => ({
      ...p,
      initialCopies: (p.initialCopies || []).filter((_, idx) => idx !== i),
    }));

  const upCopy = (i, k, v) =>
    setForm((p) => ({
      ...p,
      initialCopies: (p.initialCopies || []).map((c, idx) =>
        idx === i ? { ...c, [k]: v } : c
      ),
    }));

  const coverPreview = useMemo(
    () =>
      form.coverFile
        ? URL.createObjectURL(form.coverFile)
        : form.coverUrl?.trim() || "",
    [form.coverFile, form.coverUrl]
  );

  const canSubmit = useMemo(
    () => !!form.title.trim() && (form.coverFile || form.coverUrl?.trim()),
    [form]
  );

  const handleClose = () => {
    if (!saving) {
      onClose?.();
      setActiveStep(0);
    }
  };

  const resetAll = () => {
    setForm(init);
    setError("");
    setActiveStep(0);
  };

  const handleNext = () => {
    setActiveStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const submit = async () => {
    try {
      setSaving(true);
      setError("");

      // Kiểm tra URL ebook nếu không upload file
      if (!form.ebookFile && form.ebookViewUrl) {
        const u = form.ebookViewUrl.trim().toLowerCase();
        if (!(u.endsWith(".pdf") || u.endsWith(".epub"))) {
          throw new Error("URL ebook phải là PDF hoặc EPUB (.pdf/.epub).");
        }
      }

      const payload = {
        ...form,
        authors: (form.authors || [])
          .map((a) => ({
            fullName: String(a.fullName || "").trim(),
            role: a.role || "main",
            ord: Number(a.ord || 1),
          }))
          .filter((a) => a.fullName),
        genres: (form.genres || [])
          .map((g) => String(g || "").trim())
          .filter(Boolean),
        initialCopiesCount: 0,
        initialCopies: (form.initialCopies || []).map((c) => ({
          barCode: (c.barCode || "").trim() || undefined,
          status: c.status || "AVAILABLE",
          conditionNote: c.conditionNote ? String(c.conditionNote) : "100",
          entryDate: c.entryDate || new Date().toISOString().slice(0, 10),
        })),
        coverUrl: form.coverFile ? "" : form.coverUrl,
        ebookViewUrl: form.ebookFile ? "" : form.ebookViewUrl,
      };

      const res = await createBook(payload);
      if (!res?.ok) throw new Error(res?.message || "Không tạo được sách.");

      onCreated?.(res.data);
      enqueueSnackbar("Tạo sách thành công!", { variant: "success" });
      handleClose();
      resetAll();
    } catch (e) {
      setError(e.message || "Không tạo được sách.");
      enqueueSnackbar(e.message || "Không tạo được sách.", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const StepIcon = ({ step }) => {
    const icons = [<LibraryBooksIcon />, <PersonIcon />, <ImageIcon />];
    return icons[step] || <CheckCircleIcon />;
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="lg" scroll="paper">
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar sx={{ bgcolor: "primary.main" }}>
            <LibraryBooksIcon />
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Thêm Sách Mới
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Hoàn thành các bước để thêm sách vào thư viện
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      {saving && <LinearProgress />}

      <DialogContent dividers sx={{ p: 0 }}>
        {/* Stepper */}
        <Paper elevation={0} sx={{ px: 3, py: 2, borderBottom: 1, borderColor: "divider" }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {STEPS.map((label, index) => (
              <Step key={label}>
                <StepLabel StepIconComponent={() => <StepIcon step={index} />}>
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>

        {!!error && (
          <Alert severity="error" sx={{ m: 2, mb: 0 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        <Box sx={{ p: 3 }}>
          {/* Step 1: Basic Information */}
          {activeStep === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Stack spacing={3}>
                  {/* Basic Info Card */}
                  <Card elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                    <Stack spacing={2}>
                      <Typography
                        variant="h6"
                        fontWeight={600}
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <LibraryBooksIcon color="primary" />
                        Thông tin cơ bản
                      </Typography>

                      <TextField
                        required
                        label="Tiêu đề sách"
                        value={form.title}
                        onChange={(e) => setF("title", e.target.value)}
                        placeholder="Nhập tiêu đề sách..."
                        fullWidth
                      />

                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <FormControl fullWidth>
                            <InputLabel>Ngôn ngữ</InputLabel>
                            <Select
                              value={form.language}
                              label="Ngôn ngữ"
                              onChange={(e) => setF("language", e.target.value)}
                            >
                              <MenuItem value="Vietnamese">Tiếng Việt</MenuItem>
                              <MenuItem value="English">Tiếng Anh</MenuItem>
                              <MenuItem value="Chinese">Tiếng Trung</MenuItem>
                              <MenuItem value="French">Tiếng Pháp</MenuItem>
                              <MenuItem value="Japanese">Tiếng Nhật</MenuItem>
                              <MenuItem value="Korean">Tiếng Hàn</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Năm xuất bản"
                            type="number"
                            value={form.publicationYear}
                            onChange={(e) => setF("publicationYear", e.target.value)}
                            InputProps={{
                              inputProps: {
                                min: 1900,
                                max: new Date().getFullYear() + 1,
                              },
                            }}
                            fullWidth
                          />
                        </Grid>
                      </Grid>

                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Giá bìa"
                            type="number"
                            value={form.coverPrice}
                            onChange={(e) => setF("coverPrice", e.target.value)}
                            InputProps={{
                              endAdornment: (
                                <InputAdornment position="end">VND</InputAdornment>
                              ),
                              inputProps: { min: 0 },
                            }}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Vị trí kệ"
                            value={form.shelfLocation}
                            onChange={(e) => setF("shelfLocation", e.target.value)}
                            placeholder="Ví dụ: A1.02"
                            fullWidth
                          />
                        </Grid>
                      </Grid>

                      <TextField
                        label="Mô tả"
                        multiline
                        rows={3}
                        value={form.description}
                        onChange={(e) => setF("description", e.target.value)}
                        placeholder="Mô tả ngắn về nội dung sách..."
                        fullWidth
                      />
                    </Stack>
                  </Card>

                  {/* Publisher Card */}
                  <Card elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                    <Stack spacing={2}>
                      <Typography
                        variant="h6"
                        fontWeight={600}
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <LocalLibraryIcon color="primary" />
                        Thông tin xuất bản
                      </Typography>

                      <Autocomplete
                        freeSolo
                        options={pubsOpt}
                        loading={!pubsOpt.length}
                        isOptionEqualToValue={strEqual}
                        openOnFocus
                        slotProps={autoSlots}
                        value={form.publisherName || ""}
                        onChange={(_, val) =>
                          setF("publisherName", typeof val === "string" ? val : "")
                        }
                        onInputChange={(_, val) => setF("publisherName", val)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Nhà xuất bản"
                            placeholder="Tìm hoặc nhập tên nhà xuất bản..."
                          />
                        )}
                      />
                    </Stack>
                  </Card>
                </Stack>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card
                  elevation={1}
                  sx={{ p: 3, borderRadius: 2, position: "sticky", top: 20 }}
                >
                  <Stack spacing={2}>
                    <Typography variant="h6" fontWeight={600} color="primary">
                      Hướng dẫn
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Tiêu đề sách là bắt buộc
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Chọn ngôn ngữ phù hợp với nội dung
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Vị trí kệ giúp quản lý kho dễ dàng
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Mô tả chi tiết giúp người đọc hiểu rõ hơn
                    </Typography>

                    <Divider />

                    <Alert severity="info" icon={false}>
                      <Typography variant="body2" fontWeight={600}>
                        Tiếp theo: Thêm thông tin chi tiết và tác giả
                      </Typography>
                    </Alert>
                  </Stack>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Step 2: Details & Authors */}
          {activeStep === 1 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Stack spacing={3}>
                  {/* Book Details Card */}
                  <Card elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                    <Stack spacing={2}>
                      <Typography
                        variant="h6"
                        fontWeight={600}
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <DescriptionIcon color="primary" />
                        Thông tin chi tiết
                      </Typography>

                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="ISBN"
                            value={form.bookData.isbn}
                            onChange={(e) => setBD("isbn", e.target.value)}
                            placeholder="978-3-16-148410-0"
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Lần tái bản"
                            type="number"
                            value={form.bookData.edition}
                            onChange={(e) => setBD("edition", e.target.value)}
                            InputProps={{ inputProps: { min: 1 } }}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Số trang"
                            type="number"
                            value={form.bookData.pageCount}
                            onChange={(e) => setBD("pageCount", e.target.value)}
                            InputProps={{ inputProps: { min: 1 } }}
                            fullWidth
                          />
                        </Grid>
                      </Grid>
                    </Stack>
                  </Card>

                  {/* Authors Card */}
                  <Card elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                    <Stack spacing={2}>
                      <Typography
                        variant="h6"
                        fontWeight={600}
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <PersonIcon color="primary" />
                        Tác giả & Đóng góp
                      </Typography>

                      <Stack spacing={2}>
                        {form.authors.map((a, i) => (
                          <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                            <Grid container spacing={2} alignItems="center">
                              <Grid item xs={12} sm={5}>
                                <Autocomplete
                                  freeSolo
                                  options={authorsOpt}
                                  loading={!authorsOpt.length}
                                  isOptionEqualToValue={strEqual}
                                  openOnFocus
                                  slotProps={autoSlots}
                                  value={a.fullName || ""}
                                  onChange={(_, val) =>
                                    upAuthor(i, "fullName", typeof val === "string" ? val : "")
                                  }
                                  onInputChange={(_, val) => upAuthor(i, "fullName", val)}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      label="Họ tên tác giả"
                                      placeholder="Nhập tên tác giả..."
                                    />
                                  )}
                                />
                              </Grid>

                              <Grid item xs={6} sm={3}>
                                <FormControl fullWidth>
                                  <InputLabel>Vai trò</InputLabel>
                                  <Select
                                    value={a.role}
                                    label="Vai trò"
                                    onChange={(e) => upAuthor(i, "role", e.target.value)}
                                  >
                                    <MenuItem value="main">Tác giả chính</MenuItem>
                                    <MenuItem value="co">Đồng tác giả</MenuItem>
                                    <MenuItem value="editor">Biên tập</MenuItem>
                                    <MenuItem value="translator">Dịch giả</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>

                              <Grid item xs={4} sm={2}>
                                <TextField
                                  label="Thứ tự"
                                  type="number"
                                  value={a.ord}
                                  onChange={(e) =>
                                    upAuthor(i, "ord", Number(e.target.value || 1))
                                  }
                                  InputProps={{ inputProps: { min: 1 } }}
                                  fullWidth
                                />
                              </Grid>

                              <Grid item xs={2} sm={2}>
                                <Tooltip title="Xoá tác giả">
                                  <span>
                                    <IconButton
                                      size="small"
                                      onClick={() => rmAuthor(i)}
                                      disabled={form.authors.length === 1}
                                      color="error"
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </Grid>
                            </Grid>
                          </Paper>
                        ))}

                        <Button
                          variant="outlined"
                          startIcon={<AddIcon />}
                          onClick={addAuthor}
                          sx={{ alignSelf: "flex-start" }}
                        >
                          Thêm tác giả
                        </Button>
                      </Stack>
                    </Stack>
                  </Card>

                  {/* Genres Card */}
                  <Card elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                    <Stack spacing={2}>
                      <Typography
                        variant="h6"
                        fontWeight={600}
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <CategoryIcon color="primary" />
                        Thể loại
                      </Typography>

                      <Autocomplete
                        multiple
                        freeSolo
                        options={genresOpt}
                        loading={!genresOpt.length}
                        isOptionEqualToValue={strEqual}
                        openOnFocus
                        slotProps={autoSlots}
                        value={form.genres}
                        onChange={(_, newVal) =>
                          setForm((p) => ({
                            ...p,
                            genres: (newVal || [])
                              .map((x) => String(x || ""))
                              .filter(Boolean),
                          }))
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Thể loại sách"
                            placeholder="Nhập thể loại và Enter..."
                          />
                        )}
                        renderTags={(value, getTagProps) =>
                          value.map((option, index) => (
                            <Chip
                              {...getTagProps({ index })}
                              key={index}
                              label={option}
                              variant="outlined"
                            />
                          ))
                        }
                      />
                    </Stack>
                  </Card>
                </Stack>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card
                  elevation={1}
                  sx={{ p: 3, borderRadius: 2, position: "sticky", top: 20 }}
                >
                  <Stack spacing={2}>
                    <Typography variant="h6" fontWeight={600} color="primary">
                      Thông tin bổ sung
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • ISBN giúp định danh duy nhất cho sách
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Thêm đầy đủ thông tin tác giả và vai trò
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Chọn thể loại phù hợp để dễ dàng tìm kiếm
                    </Typography>

                    <Divider />

                    <Alert severity="info" icon={false}>
                      <Typography variant="body2" fontWeight={600}>
                        Tiếp theo: Tải ảnh bìa và thêm bản sao
                      </Typography>
                    </Alert>
                  </Stack>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Step 3: Media & Copies */}
          {activeStep === 2 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Stack spacing={3}>
                  {/* Media Card */}
                  <Card elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                    <Stack spacing={3}>
                      <Typography
                        variant="h6"
                        fontWeight={600}
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <ImageIcon color="primary" />
                        Hình ảnh & Tài liệu số
                      </Typography>

                      <Grid container spacing={3}>
                        {/* Cover Image */}
                        <Grid item xs={12} md={6}>
                          <Stack spacing={2}>
                            <Typography variant="subtitle1" fontWeight={600}>
                              Ảnh bìa sách *
                            </Typography>

                            {coverPreview ? (
                              <Box sx={{ position: "relative" }}>
                                <CardMedia
                                  component="img"
                                  image={coverPreview}
                                  alt="Preview cover"
                                  sx={{
                                    height: 200,
                                    borderRadius: 2,
                                    objectFit: "cover",
                                  }}
                                />
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    setForm((p) => ({ ...p, coverFile: null, coverUrl: "" }))
                                  }
                                  sx={{
                                    position: "absolute",
                                    top: 8,
                                    right: 8,
                                    backgroundColor: "rgba(0,0,0,0.5)",
                                    color: "white",
                                    "&:hover": { backgroundColor: "rgba(0,0,0,0.7)" },
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            ) : (
                              <Card
                                variant="outlined"
                                sx={{
                                  height: 200,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  borderRadius: 2,
                                  backgroundColor: "grey.50",
                                }}
                              >
                                <Stack alignItems="center" spacing={1}>
                                  <ImageIcon sx={{ fontSize: 48, color: "grey.400" }} />
                                  <Typography color="grey.500" variant="body2">
                                    Chưa có ảnh bìa
                                  </Typography>
                                </Stack>
                              </Card>
                            )}

                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              <Button
                                component="label"
                                startIcon={<UploadIcon />}
                                variant="outlined"
                                size="small"
                              >
                                Tải ảnh lên
                                <input
                                  type="file"
                                  accept="image/*"
                                  hidden
                                  onChange={(e) =>
                                    setForm((p) => ({
                                      ...p,
                                      coverFile: e.target.files?.[0] || null,
                                    }))
                                  }
                                />
                              </Button>

                              <TextField
                                size="small"
                                label="Hoặc URL ảnh"
                                value={form.coverUrl}
                                onChange={(e) =>
                                  setForm((p) => ({ ...p, coverUrl: e.target.value }))
                                }
                                placeholder="https://example.com/cover.jpg"
                                sx={{ flexGrow: 1, minWidth: 200 }}
                              />
                            </Stack>
                          </Stack>
                        </Grid>

                        {/* Ebook */}
                        <Grid item xs={12} md={6}>
                          <Stack spacing={2}>
                            <Typography variant="subtitle1" fontWeight={600}>
                              Tài liệu số (PDF/EPUB)
                            </Typography>

                            <Card
                              variant="outlined"
                              sx={{
                                height: 200,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 2,
                                backgroundColor: "grey.50",
                              }}
                            >
                              <Stack alignItems="center" spacing={1}>
                                <DescriptionIcon sx={{ fontSize: 48, color: "grey.400" }} />
                                <Typography color="grey.500" variant="body2" textAlign="center">
                                  {form.ebookFile
                                    ? form.ebookFile.name
                                    : "Chưa có file PDF/EPUB"}
                                </Typography>
                              </Stack>
                            </Card>

                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              <Button
                                component="label"
                                startIcon={<UploadIcon />}
                                variant="outlined"
                                size="small"
                              >
                                Tải PDF/EPUB lên
                                <input
                                  type="file"
                                  accept="application/pdf,application/epub+zip,.pdf,.epub"
                                  hidden
                                  onChange={(e) => {
                                    const f = e.target.files?.[0] || null;
                                    if (f && !isSupportedEbook(f)) {
                                      enqueueSnackbar("Chỉ hỗ trợ PDF hoặc EPUB.", {
                                        variant: "warning",
                                      });
                                      e.target.value = "";
                                      return;
                                    }
                                    setForm((p) => ({ ...p, ebookFile: f }));
                                  }}
                                />
                              </Button>

                              <TextField
                                size="small"
                                label="Hoặc URL PDF/EPUB"
                                value={form.ebookViewUrl}
                                onChange={(e) =>
                                  setForm((p) => ({ ...p, ebookViewUrl: e.target.value }))
                                }
                                placeholder="https://example.com/ebook.pdf hoặc https://example.com/ebook.epub"
                                sx={{ flexGrow: 1, minWidth: 200 }}
                              />
                            </Stack>
                          </Stack>
                        </Grid>
                      </Grid>

                      {!form.coverFile && !form.coverUrl && (
                        <Alert severity="warning">
                          Ảnh bìa là <b>bắt buộc</b>. Vui lòng tải ảnh lên hoặc nhập URL.
                        </Alert>
                      )}
                    </Stack>
                  </Card>

                  {/* Copies Card */}
                  <Card elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                    <Stack spacing={2}>
                      <Typography
                        variant="h6"
                        fontWeight={600}
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <LibraryBooksIcon color="primary" />
                        Quản lý bản sao
                      </Typography>

                      <Stack spacing={2}>
                        {(form.initialCopies || []).map((c, i) => (
                          <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                            <Grid container spacing={2} alignItems="center">
                              <Grid item xs={12}>
                                <Typography variant="subtitle2" fontWeight={600} color="primary">
                                  Bản sao #{i + 1}
                                </Typography>
                              </Grid>

                              <Grid item xs={12} sm={6}>
                                <TextField
                                  label="Mã vạch"
                                  value={c.barCode || ""}
                                  onChange={(e) => upCopy(i, "barCode", e.target.value)}
                                  placeholder="Để trống để tự sinh"
                                  fullWidth
                                />
                              </Grid>

                              <Grid item xs={12} sm={3}>
                                <FormControl fullWidth>
                                  <InputLabel>Trạng thái</InputLabel>
                                  <Select
                                    value={c.status || "AVAILABLE"}
                                    label="Trạng thái"
                                    onChange={(e) => upCopy(i, "status", e.target.value)}
                                  >
                                    {STATUS_OPTIONS.map((s) => (
                                      <MenuItem key={s.value} value={s.value}>
                                        <Chip
                                          label={s.label}
                                          size="small"
                                          color={s.color}
                                          variant="outlined"
                                        />
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Grid>

                              <Grid item xs={12} sm={2}>
                                <TextField
                                  label="Tình trạng (%)"
                                  type="number"
                                  value={c.conditionNote || "100"}
                                  onChange={(e) => upCopy(i, "conditionNote", e.target.value)}
                                  InputProps={{ inputProps: { min: 0, max: 100 } }}
                                  fullWidth
                                />
                              </Grid>

                              <Grid item xs={12} sm={10}>
                                <TextField
                                  label="Ngày nhập"
                                  type="date"
                                  value={(c.entryDate || "").slice(0, 10)}
                                  onChange={(e) => upCopy(i, "entryDate", e.target.value)}
                                  InputLabelProps={{ shrink: true }}
                                  fullWidth
                                />
                              </Grid>

                              <Grid item xs={12} sm={2}>
                                <Tooltip title="Xoá bản sao">
                                  <IconButton size="small" onClick={() => rmCopy(i)} color="error">
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Grid>
                            </Grid>
                          </Paper>
                        ))}

                        <Button
                          startIcon={<AddIcon />}
                          onClick={addCopy}
                          variant="outlined"
                          sx={{ alignSelf: "flex-start" }}
                        >
                          Thêm bản sao
                        </Button>
                      </Stack>
                    </Stack>
                  </Card>
                </Stack>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card
                  elevation={1}
                  sx={{ p: 3, borderRadius: 2, position: "sticky", top: 20 }}
                >
                  <Stack spacing={2}>
                    <Typography variant="h6" fontWeight={600} color="primary">
                      Hoàn tất
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Ảnh bìa chất lượng giúp thu hút người đọc
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Thêm bản sao để theo dõi số lượng
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Kiểm tra kỹ thông tin trước khi lưu
                    </Typography>

                    <Divider />

                    <Alert severity={canSubmit ? "success" : "warning"} icon={false}>
                      <Typography variant="body2" fontWeight={600}>
                        {canSubmit
                          ? "Tất cả thông tin đã sẵn sàng!"
                          : "Cần thêm ảnh bìa để hoàn tất"}
                      </Typography>
                    </Alert>
                  </Stack>
                </Card>
              </Grid>
            </Grid>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button onClick={handleClose} disabled={saving}>
          Huỷ bỏ
        </Button>

        <Box sx={{ flex: 1 }} />

        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={saving}>
            Quay lại
          </Button>
        )}

        {activeStep < STEPS.length - 1 ? (
          <Button variant="outlined" onClick={handleNext}>
            Tiếp theo
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={submit}
            disabled={!canSubmit || saving}
            startIcon={saving ? null : <CheckCircleIcon />}
          >
            {saving ? "Đang lưu..." : "Hoàn tất"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}