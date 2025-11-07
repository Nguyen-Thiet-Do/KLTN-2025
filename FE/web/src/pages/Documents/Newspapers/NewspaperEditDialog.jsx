import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Grid, Stack, TextField, Button, MenuItem, Chip, IconButton, Tooltip,
  Alert, LinearProgress, Stepper, Step, StepLabel,
  Card, CardMedia, Typography, Paper, FormControl, InputLabel, Select, Avatar
} from "@mui/material";
import {
  Upload as UploadIcon,
  Image as ImageIcon,
  Description as DescriptionIcon,
  LibraryBooks as LibraryBooksIcon,
  Person as PersonIcon,
  Category as CategoryIcon,
  LocalLibrary as LocalLibraryIcon,
  CheckCircle as CheckCircleIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import Autocomplete from "@mui/material/Autocomplete";
import { useSnackbar } from "notistack";
import { getNewspaperById, updateNewspaper } from "../../../services/newpaperService";
import { getAllAuthors, getAllGenres, getAllPublishers } from "../../../services/metadataService";

const STEPS = ["Thông tin cơ bản", "Chi tiết & Tác giả", "Media"];

const strEqual = (o, v) => String(o || "") === String(v || "");
const autoSlots = {
  popper: { sx: { minWidth: 360 } },
  paper: { sx: { minWidth: 360 } },
  listbox: { sx: { "& li": { whiteSpace: "nowrap" } } },
};

const SUPPORTED_EBOOK_MIME = ["application/pdf", "application/epub+zip"];
const SUPPORTED_EBOOK_EXT = [".pdf", ".epub"];
const isSupportedEbook = (file) => {
  if (!file) return true;
  const okMime = SUPPORTED_EBOOK_MIME.includes(file.type);
  const name = (file.name || "").toLowerCase();
  const okExt = SUPPORTED_EBOOK_EXT.some((ext) => name.endsWith(ext));
  return okMime || okExt;
};

export default function NewspaperEditDialog({ open, id, initialItem, onClose, onUpdated }) {
  const { enqueueSnackbar } = useSnackbar();

  // dữ liệu gốc để hiện preview
  const [base, setBase] = useState(initialItem || null);

  // metadata
  const [genresOpt, setGenresOpt] = useState([]);
  const [authorsOpt, setAuthorsOpt] = useState([]);
  const [pubsOpt, setPubsOpt] = useState([]);

  // trạng thái
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // form sửa – chỉ field thay đổi mới gửi
  const [form, setForm] = useState({
    title: undefined,
    language: undefined,
    publicationYear: undefined,
    coverPrice: undefined,
    description: undefined,
    shelfLocation: undefined,
    publisherName: undefined,
    authors: undefined,         // [] để xoá hết
    genres: undefined,          // [] để xoá hết
    newspaperData: undefined,   // { issn?, issueDate?, issueNumber? }
    coverFile: undefined,
    ebookFile: undefined,
    coverUrl: undefined,        // ""/null để xoá
    ebookViewUrl: undefined,    // ""/null để xoá
  });

  // local state riêng cho UI tác giả & thể loại
  const [authorsUI, setAuthorsUI] = useState([]); // [{fullName, role, ord}]
  const [genresUI, setGenresUI] = useState([]);   // [string]
  const [authorsTouched, setAuthorsTouched] = useState(false);
  const [genresTouched, setGenresTouched] = useState(false);

  // preview ảnh bìa
  const coverPreview = useMemo(() => {
    if (form.coverFile) return URL.createObjectURL(form.coverFile);
    if (typeof form.coverUrl === "string" && form.coverUrl.trim()) return form.coverUrl.trim();
    return base?.coverPhoto || "";
  }, [form.coverFile, form.coverUrl, base?.coverPhoto]);

  const canSubmit = useMemo(
    () =>
      Object.values(form).some(v => v !== undefined) ||
      authorsTouched || genresTouched,
    [form, authorsTouched, genresTouched]
  );

  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const setNP = (k, v) =>
    setForm((p) => ({ ...p, newspaperData: { ...(p.newspaperData || {}), [k]: v } }));

  // helpers cho authors UI
  const addAuthor = () => {
    setAuthorsUI((p) => [
      ...p,
      { fullName: "", role: "main", ord: p.length + 1 },
    ]);
    setAuthorsTouched(true);
  };
  const rmAuthor = (i) => {
    setAuthorsUI((p) => {
      const next = p.filter((_, idx) => idx !== i)
        .map((a, idx) => ({ ...a, ord: idx + 1 }));
      return next;
    });
    setAuthorsTouched(true);
  };
  const upAuthor = (i, k, v) => {
    setAuthorsUI((p) => p.map((a, idx) => (idx === i ? { ...a, [k]: v } : a)));
    setAuthorsTouched(true);
  };

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setError("");
        setActiveStep(0);
        setForm({
          title: undefined,
          language: undefined,
          publicationYear: undefined,
          coverPrice: undefined,
          description: undefined,
          shelfLocation: undefined,
          publisherName: undefined,
          authors: undefined,
          genres: undefined,
          newspaperData: undefined,
          coverFile: undefined,
          ebookFile: undefined,
          coverUrl: undefined,
          ebookViewUrl: undefined,
        });
        setAuthorsTouched(false);
        setGenresTouched(false);

        setLoading(true);
        const [g, a, p] = await Promise.all([
          getAllGenres(),
          getAllAuthors(),
          getAllPublishers(),
        ]);

        setGenresOpt(g.map((x) => (typeof x === "string" ? x : x?.name)).filter(Boolean));
        setAuthorsOpt(a.map((x) => (typeof x === "string" ? x : x?.fullName)).filter(Boolean));
        setPubsOpt(p.map((x) => (typeof x === "string" ? x : x?.name)).filter(Boolean));

        if (!initialItem) {
          const full = await getNewspaperById(id);
          setBase(full);

          const au = (full.authors || [])
            .slice()
            .sort((x, y) => (x.ord ?? 0) - (y.ord ?? 0))
            .map(a => ({ fullName: a.fullName || "", role: a.role || "main", ord: a.ord ?? 1 }));
          setAuthorsUI(au.length ? au : [{ fullName: "", role: "main", ord: 1 }]);

          const ge = (full.genres || []).map(g => g.name || g).filter(Boolean);
          setGenresUI(ge);
        } else {
          setBase(initialItem);

          const au = (initialItem.authors || [])
            .slice()
            .sort((x, y) => (x.ord ?? 0) - (y.ord ?? 0))
            .map(a => ({ fullName: a.fullName || "", role: a.role || "main", ord: a.ord ?? 1 }));
          setAuthorsUI(au.length ? au : [{ fullName: "", role: "main", ord: 1 }]);

          const ge = (initialItem.genres || []).map(g => g.name || g).filter(Boolean);
          setGenresUI(ge);
        }
      } catch (e) {
        setError(e.message || "Không tải được dữ liệu báo.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, id, initialItem]);

  const handleNext = () => setActiveStep((s) => Math.min(s + 1, STEPS.length - 1));
  const handleBack = () => setActiveStep((s) => Math.max(s - 1, 0));
  const handleClose = () => { if (!saving) onClose?.(); };

  const submit = async () => {
    try {
      setSaving(true);
      setError("");

      const payload = { ...form };

      if (authorsTouched) {
        payload.authors = authorsUI
          .map((a, idx) => ({
            fullName: String(a.fullName || "").trim(),
            role: a.role || "main",
            ord: Number(a.ord || idx + 1),
          }))
          .filter(a => a.fullName);
      }
      if (genresTouched) {
        payload.genres = (genresUI || []).map(g => String(g || "").trim()).filter(Boolean);
      }

      if (!payload.ebookFile && typeof payload.ebookViewUrl === "string" && payload.ebookViewUrl.trim()) {
        const u = payload.ebookViewUrl.trim().toLowerCase();
        if (!(u.endsWith(".pdf") || u.endsWith(".epub"))) {
          throw new Error("URL ebook phải là PDF hoặc EPUB (.pdf/.epub).");
        }
      }
      if (payload.ebookFile) {
        const f = payload.ebookFile;
        const name = (f.name || "").toLowerCase();
        const okMime = SUPPORTED_EBOOK_MIME.includes(f.type);
        const okExt = SUPPORTED_EBOOK_EXT.some((ext) => name.endsWith(ext));
        if (!(okMime || okExt)) {
          throw new Error("Ebook chỉ hỗ trợ PDF hoặc EPUB.");
        }
      }

      const res = await updateNewspaper(id, payload);
      if (!res?.ok) throw new Error(res?.message || "Cập nhật thất bại.");

      enqueueSnackbar("Cập nhật báo thành công!", { variant: "success" });
      onUpdated?.(res.data);
      onClose?.();
    } catch (e) {
      setError(e.message || "Cập nhật thất bại.");
      enqueueSnackbar(e.message || "Cập nhật thất bại.", { variant: "error" });
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
      <DialogTitle sx={{ position: "relative", pr: 6 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar sx={{ bgcolor: "primary.main" }}>
            <LibraryBooksIcon />
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Sửa thông tin báo
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Chỉ sửa những mục bạn muốn thay đổi — mục trống sẽ giữ nguyên
            </Typography>
          </Box>
        </Stack>

        <IconButton
          aria-label="Đóng"
          onClick={handleClose}
          disabled={saving}
          size="small"
          sx={{ position: "absolute", right: 8, top: 8, color: (theme) => theme.palette.grey[500] }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {saving && <LinearProgress />}

      <DialogContent dividers sx={{ p: 0 }}>
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
          {loading && (
            <Typography variant="body2" color="text.secondary">
              Đang tải dữ liệu…
            </Typography>
          )}

          {base && !loading && (
            <>
              {/* Step 1 */}
              {activeStep === 0 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={8}>
                    <Stack spacing={3}>
                      <Card elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                        <Stack spacing={2}>
                          <Typography variant="h6" fontWeight={600} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <LibraryBooksIcon color="primary" />
                            Thông tin cơ bản
                          </Typography>

                          <TextField
                            label="Tiêu đề"
                            value={form.title ?? base.title ?? ""}
                            onChange={(e) => setF("title", e.target.value)}
                            placeholder="(Để trống để giữ nguyên)"
                            fullWidth
                          />

                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              <FormControl fullWidth>
                                <InputLabel>Ngôn ngữ</InputLabel>
                                <Select
                                  label="Ngôn ngữ"
                                  value={form.language ?? base.language ?? ""}
                                  onChange={(e) => setF("language", e.target.value)}
                                >
                                  <MenuItem value=""><em>Giữ nguyên</em></MenuItem>
                                  {["Vietnamese", "English", "Chinese", "French", "Japanese", "Korean"].map((l) => (
                                    <MenuItem key={l} value={l}>{l}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                label="Năm xuất bản"
                                type="number"
                                value={form.publicationYear ?? base.publicationYear ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setF("publicationYear", v === "" ? undefined : Number(v));
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
                                value={form.coverPrice ?? base.coverPrice ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setF("coverPrice", v === "" ? undefined : Number(v));
                                }}
                                InputProps={{ endAdornment: <Box component="span" sx={{ ml: 1 }}>VND</Box> }}
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                label="Vị trí kệ"
                                value={form.shelfLocation ?? base.shelfLocation ?? ""}
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
                            value={form.description ?? base.description ?? ""}
                            onChange={(e) => setF("description", e.target.value)}
                            placeholder="(Để trống để giữ nguyên)"
                            fullWidth
                          />
                        </Stack>
                      </Card>

                      <Card elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                        <Stack spacing={2}>
                          <Typography variant="h6" fontWeight={600} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
                            inputValue={form.publisherName ?? (base?.publisher?.name || "")}
                            onInputChange={(_, val) => setF("publisherName", val)}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Nhà xuất bản"
                                placeholder="(Để trống để giữ nguyên; nhập rỗng để xoá)"
                              />
                            )}
                          />
                        </Stack>
                      </Card>
                    </Stack>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Card elevation={1} sx={{ p: 3, borderRadius: 2, position: "sticky", top: 20 }}>
                      <Stack spacing={2}>
                        <Typography variant="h6" fontWeight={600} color="primary">
                          Gợi ý
                        </Typography>
                        <Typography variant="body2" color="text.secondary">• Chỉ nhập các trường muốn thay đổi.</Typography>
                        <Typography variant="body2" color="text.secondary">• Để trống: giữ nguyên.</Typography>
                        <Typography variant="body2" color="text.secondary">• Một số trường có thể xoá bằng chuỗi rỗng.</Typography>
                      </Stack>
                    </Card>
                  </Grid>
                </Grid>
              )}

              {/* Step 2 */}
              {activeStep === 1 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={8}>
                    <Stack spacing={3}>
                      <Card elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                        <Stack spacing={2}>
                          <Typography variant="h6" fontWeight={600} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <DescriptionIcon color="primary" />
                            Chi tiết phát hành
                          </Typography>

                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="ISSN"
                                value={form.newspaperData?.issn ?? base.newspaper?.issn ?? ""}
                                onChange={(e) => setNP("issn", e.target.value)}
                                placeholder="(Để trống để giữ nguyên; rỗng để xoá)"
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="Số phát hành"
                                type="number"
                                value={form.newspaperData?.issueNumber ?? base.newspaper?.issueNumber ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setNP("issueNumber", v === "" ? undefined : Number(v));
                                }}
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="Ngày phát hành"
                                type="date"
                                value={(form.newspaperData?.issueDate ?? base.newspaper?.issueDate ?? "").slice(0, 10)}
                                onChange={(e) => setNP("issueDate", e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                fullWidth
                              />
                            </Grid>
                          </Grid>
                        </Stack>
                      </Card>

                      {/* Tác giả */}
                      <Card elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                        <Stack spacing={2}>
                          <Typography variant="h6" fontWeight={600} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <PersonIcon color="primary" />
                            Tác giả & Đóng góp
                          </Typography>

                          <Stack spacing={2}>
                            {authorsUI.map((a, i) => (
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
                                        <TextField {...params} label="Họ tên tác giả" placeholder="Nhập tên tác giả..." />
                                      )}
                                    />
                                  </Grid>

                                  <Grid item xs={6} sm={3}>
                                    <FormControl fullWidth>
                                      <InputLabel>Vai trò</InputLabel>
                                      <Select
                                        value={a.role || "main"}
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
                                        upAuthor(i, "ord", Math.max(1, Number(e.target.value || 1)))
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
                                          disabled={authorsUI.length === 1}
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

                            <Button variant="outlined" startIcon={<CheckCircleIcon />} onClick={addAuthor} sx={{ alignSelf: "flex-start" }}>
                              Thêm tác giả
                            </Button>

                            <Typography variant="caption" color="text.secondary">
                              • Bỏ trống toàn bộ phần tác giả → giữ nguyên. • Xoá hết (để danh sách trống) → gửi mảng rỗng để xoá toàn bộ.
                            </Typography>
                          </Stack>
                        </Stack>
                      </Card>

                      {/* Thể loại */}
                      <Card elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                        <Stack spacing={2}>
                          <Typography variant="h6" fontWeight={600} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
                            value={genresUI}
                            onChange={(_, newVal) => {
                              setGenresUI((newVal || []).map(x => String(x || "")).filter(Boolean));
                              setGenresTouched(true);
                            }}
                            renderInput={(params) => (
                              <TextField {...params} label="Thể loại báo" placeholder="Nhập thể loại và Enter..." />
                            )}
                            renderTags={(value, getTagProps) =>
                              value.map((option, index) => (
                                <Chip {...getTagProps({ index })} key={index} label={option} variant="outlined" />
                              ))
                            }
                          />
                          <Typography variant="caption" color="text.secondary">
                            • Bỏ trống (không chỉnh) → giữ nguyên. • Đặt về mảng rỗng → xoá hết thể loại.
                          </Typography>
                        </Stack>
                      </Card>
                    </Stack>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Card elevation={1} sx={{ p: 3, borderRadius: 2, position: "sticky", top: 20 }}>
                      <Stack spacing={2}>
                        <Typography variant="h6" fontWeight={600} color="primary">
                          Lưu ý
                        </Typography>
                        <Typography variant="body2" color="text.secondary">• Thứ tự tác giả (ord) sẽ lưu đúng như bạn nhập.</Typography>
                        <Typography variant="body2" color="text.secondary">• Tên tác giả/thể loại mới sẽ được tạo nếu chưa tồn tại.</Typography>
                      </Stack>
                    </Card>
                  </Grid>
                </Grid>
              )}

              {/* Step 3 */}
              {activeStep === 2 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={8}>
                    <Stack spacing={3}>
                      <Card elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                        <Stack spacing={3}>
                          <Typography variant="h6" fontWeight={600} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <ImageIcon color="primary" />
                            Ảnh bìa & Tài liệu số
                          </Typography>

                          <Grid container spacing={3}>
                            {/* Ảnh bìa */}
                            <Grid item xs={12} md={6}>
                              <Stack spacing={2}>
                                <Typography variant="subtitle1" fontWeight={600}>Ảnh bìa</Typography>

                                {coverPreview ? (
                                  <Box sx={{ position: "relative" }}>
                                    <CardMedia
                                      component="img"
                                      image={coverPreview}
                                      alt="Preview cover"
                                      sx={{ height: 200, borderRadius: 2, objectFit: "cover" }}
                                    />
                                    {(form.coverFile || form.coverUrl) && (
                                      <IconButton
                                        size="small"
                                        onClick={() => setForm((p) => ({ ...p, coverFile: undefined, coverUrl: undefined }))}
                                        sx={{
                                          position: "absolute", top: 8, right: 8,
                                          backgroundColor: "rgba(0,0,0,0.5)", color: "white",
                                          "&:hover": { backgroundColor: "rgba(0,0,0,0.7)" },
                                        }}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    )}
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
                                      <Typography color="grey.500" variant="body2">Chưa có ảnh bìa</Typography>
                                    </Stack>
                                  </Card>
                                )}

                                <Stack direction="row" spacing={1} flexWrap="wrap">
                                  <Button component="label" startIcon={<UploadIcon />} variant="outlined" size="small">
                                    Tải ảnh lên
                                    <input
                                      type="file"
                                      accept="image/*"
                                      hidden
                                      onChange={(e) => setF("coverFile", e.target.files?.[0])}
                                    />
                                  </Button>

                                  <TextField
                                    size="small"
                                    label="Hoặc URL ảnh (trống = giữ, rỗng = xoá)"
                                    value={form.coverUrl ?? ""}
                                    onChange={(e) => setF("coverUrl", e.target.value)}
                                    placeholder="https://example.com/cover.jpg"
                                    sx={{ flexGrow: 1, minWidth: 200 }}
                                  />
                                </Stack>
                              </Stack>
                            </Grid>

                            {/* Ebook */}
                            <Grid item xs={12} md={6}>
                              <Stack spacing={2}>
                                <Typography variant="subtitle1" fontWeight={600}>Tài liệu số (PDF/EPUB)</Typography>

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
                                        : base?.ebookUrl
                                          ? "Đang có ebook (URL cũ)"
                                          : "Chưa có file PDF/EPUB"}
                                    </Typography>
                                  </Stack>
                                </Card>

                                <Stack direction="row" spacing={1} flexWrap="wrap">
                                  <Button component="label" startIcon={<UploadIcon />} variant="outlined" size="small">
                                    Tải PDF/EPUB lên
                                    <input
                                      type="file"
                                      accept="application/pdf,application/epub+zip,.pdf,.epub"
                                      hidden
                                      onChange={(e) => {
                                        const f = e.target.files?.[0] || null;
                                        if (f && !isSupportedEbook(f)) {
                                          enqueueSnackbar("Chỉ hỗ trợ PDF hoặc EPUB.", { variant: "warning" });
                                          e.target.value = "";
                                          return;
                                        }
                                        setF("ebookFile", f || undefined);
                                      }}
                                    />
                                  </Button>

                                  <TextField
                                    size="small"
                                    label="Hoặc URL PDF/EPUB (trống = giữ, rỗng = xoá)"
                                    value={form.ebookViewUrl ?? ""}
                                    onChange={(e) => setF("ebookViewUrl", e.target.value)}
                                    placeholder="https://example.com/ebook.pdf | .epub"
                                    sx={{ flexGrow: 1, minWidth: 200 }}
                                  />
                                </Stack>
                              </Stack>
                            </Grid>
                          </Grid>
                        </Stack>
                      </Card>
                    </Stack>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Card elevation={1} sx={{ p: 3, borderRadius: 2, position: "sticky", top: 20 }}>
                      <Stack spacing={2}>
                        <Typography variant="h6" fontWeight={600} color="primary">
                          Hoàn tất
                        </Typography>
                        <Typography variant="body2" color="text.secondary">• Nếu không nhập gì, dữ liệu sẽ giữ nguyên.</Typography>
                        <Typography variant="body2" color="text.secondary">• Một số trường có thể xoá bằng cách gửi chuỗi rỗng.</Typography>
                      </Stack>
                    </Card>
                  </Grid>
                </Grid>
              )}
            </>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button onClick={handleClose} disabled={saving}>Huỷ</Button>
        <Box sx={{ flex: 1 }} />
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={saving}>
            Quay lại
          </Button>
        )}
        {activeStep < STEPS.length - 1 ? (
          <Button variant="outlined" onClick={handleNext} disabled={loading || saving}>
            Tiếp theo
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={submit}
            disabled={!canSubmit || saving}
            startIcon={saving ? null : <CheckCircleIcon />}
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
