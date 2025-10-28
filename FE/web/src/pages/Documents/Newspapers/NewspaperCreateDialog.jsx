// src/pages/Documents/Newspapers/NewspaperCreateDialog.jsx
import { useEffect, useMemo, useState } from "react";
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Box, Grid, Stack, TextField, Button, MenuItem, Chip,
    IconButton, Tooltip, Divider, InputAdornment, Alert,
    LinearProgress, Snackbar
} from "@mui/material";
import { Add as AddIcon, Delete as DeleteIcon, Upload as UploadIcon } from "@mui/icons-material";
import Autocomplete from "@mui/material/Autocomplete";
import { createNewspaper } from "../../../services/newpaperService";
import { getAllAuthors, getAllGenres, getAllPublishers } from "../../../services/metadataService";

const RADIUS = 2;
const STATUS_OPTIONS = ["AVAILABLE", "BORROWED", "MAINTENANCE", "LOST"];
const isOptEq = (o, v) => String(o || "") === String(v || "");

// dùng chung cho mọi Autocomplete
const autoSlots = {
    popper: { sx: { minWidth: 360 } },
    paper: { sx: { minWidth: 360 } },
    listbox: { sx: { "& li": { whiteSpace: "nowrap" } } }
};

const init = {
    title: "", language: "", publicationYear: "", coverPrice: "",
    description: "", shelfLocation: "",
    publisherName: "",
    authors: [{ fullName: "", role: "main", ord: 1 }],
    genres: [],
    coverFile: null, ebookFile: null,
    coverUrl: "", ebookViewUrl: "",
    newspaperData: { issn: "", issueDate: "", issueNumber: "" },
    initialCopies: [],
    initialCopiesCount: 0
};

export default function NewspaperCreateDialog({ open, onClose, onCreated }) {
    const [form, setForm] = useState(init);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [snack, setSnack] = useState("");

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
                setGenresOpt(g.map(x => (typeof x === "string" ? x : x?.name)).filter(Boolean));
                setAuthorsOpt(a.map(x => (typeof x === "string" ? x : x?.fullName)).filter(Boolean));
                setPubsOpt(p.map(x => (typeof x === "string" ? x : x?.name)).filter(Boolean));
            } catch (e) {
                console.warn("Load metadata lỗi:", e);
            }
        })();
    }, [open]);

    const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));
    const setNP = (k, v) => setForm((p) => ({ ...p, newspaperData: { ...p.newspaperData, [k]: v } }));

    // Authors
    const addAuthor = () =>
        setForm((p) => ({ ...p, authors: [...p.authors, { fullName: "", role: "main", ord: p.authors.length + 1 }] }));
    const rmAuthor = (i) =>
        setForm((p) => ({ ...p, authors: p.authors.filter((_, idx) => idx !== i) }));
    const upAuthor = (i, k, v) =>
        setForm((p) => ({ ...p, authors: p.authors.map((a, idx) => (idx === i ? { ...a, [k]: v } : a)) }));

    // Copies
    const addCopy = () =>
        setForm((p) => ({
            ...p,
            initialCopies: [
                ...(p.initialCopies || []),
                { barCode: "", status: "AVAILABLE", conditionNote: "100", entryDate: new Date().toISOString().slice(0, 10) }
            ],
        }));
    const rmCopy = (i) =>
        setForm((p) => ({ ...p, initialCopies: (p.initialCopies || []).filter((_, idx) => idx !== i) }));
    const upCopy = (i, k, v) =>
        setForm((p) => ({ ...p, initialCopies: (p.initialCopies || []).map((c, idx) => (idx === i ? { ...c, [k]: v } : c)) }));

    const coverPreview = useMemo(
        () => form.coverFile ? URL.createObjectURL(form.coverFile) : (form.coverUrl?.trim() || ""),
        [form.coverFile, form.coverUrl]
    );
    const canSubmit = useMemo(
        () => !!form.title.trim() && (form.coverFile || form.coverUrl?.trim()),
        [form]
    );

    const handleClose = () => { if (!saving) onClose?.(); };
    const resetAll = () => { setForm(init); setError(""); };

    const submit = async () => {
        try {
            setSaving(true); setError("");

            const payload = {
                ...form,
                authors: (form.authors || [])
                    .map(a => ({ fullName: String(a.fullName || "").trim(), role: a.role || "main", ord: Number(a.ord || 1) }))
                    .filter(a => a.fullName),
                genres: (form.genres || []).map(s => String(s || "").trim()).filter(Boolean),
                initialCopiesCount: 0,
                initialCopies: (form.initialCopies || []).map(c => ({
                    barCode: (c.barCode || "").trim() || undefined,
                    status: c.status || "AVAILABLE",
                    conditionNote: c.conditionNote ? String(c.conditionNote) : "100",
                    entryDate: c.entryDate || new Date().toISOString().slice(0, 10),
                })),
                coverUrl: form.coverFile ? "" : form.coverUrl,
                ebookViewUrl: form.ebookFile ? "" : form.ebookViewUrl,
            };

            const res = await createNewspaper(payload);
            if (!res?.ok) throw new Error(res?.message || "Không tạo được báo.");

            setSnack("Tạo báo thành công!");
            onCreated?.(res.data);
            handleClose();
            resetAll();
        } catch (e) {
            setError(e.message || "Không tạo được báo.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="lg"
            PaperProps={{ sx: { borderRadius: RADIUS } }}>
            <DialogTitle sx={{ pb: 1 }}>Thêm Báo</DialogTitle>
            {saving && <LinearProgress />}
            <DialogContent dividers sx={{ borderRadius: RADIUS }}>
                {!!error && <Alert severity="error" sx={{ mb: 2, borderRadius: RADIUS }}>{error}</Alert>}

                <Grid container spacing={2}>
                    {/* Trái */}
                    <Grid item xs={12} md={8}>
                        <Stack spacing={2}>
                            <TextField required label="Tiêu đề" value={form.title}
                                onChange={e => setF("title", e.target.value)}
                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }} />

                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <TextField label="Ngôn ngữ" value={form.language}
                                        onChange={e => setF("language", e.target.value)}
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }} />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField label="Năm xuất bản" type="number" value={form.publicationYear}
                                        onChange={e => setF("publicationYear", e.target.value)}
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }} />
                                </Grid>
                            </Grid>

                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label="Giá bìa" type="number" value={form.coverPrice}
                                        onChange={e => setF("coverPrice", e.target.value)}
                                        InputProps={{ endAdornment: <InputAdornment position="end">VND</InputAdornment> }}
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField label="Vị trí kệ" value={form.shelfLocation}
                                        onChange={e => setF("shelfLocation", e.target.value)}
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }} />
                                </Grid>
                            </Grid>

                            <TextField label="Mô tả" multiline minRows={3} value={form.description}
                                onChange={e => setF("description", e.target.value)}
                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }} />

                            {/* NXB */}
                            <Autocomplete
                                freeSolo
                                options={pubsOpt}
                                loading={!pubsOpt.length}
                                isOptionEqualToValue={isOptEq}
                                openOnFocus
                                slotProps={autoSlots}
                                value={form.publisherName || ""}
                                onChange={(_, val) => setF("publisherName", typeof val === "string" ? val : "")}
                                onInputChange={(_, val) => setF("publisherName", val)}
                                renderInput={(params) => (
                                    <TextField {...params} label="Nhà xuất bản"
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }} />
                                )}
                            />

                            <Divider textAlign="left">Thông tin phát hành</Divider>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={4}>
                                    <TextField label="ISSN" value={form.newspaperData.issn}
                                        onChange={e => setNP("issn", e.target.value)}
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }} />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <TextField label="Số phát hành" type="number" value={form.newspaperData.issueNumber}
                                        onChange={e => setNP("issueNumber", e.target.value)}
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }} />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <TextField label="Ngày phát hành" type="date"
                                        value={(form.newspaperData.issueDate || "").slice(0, 10)}
                                        onChange={e => setNP("issueDate", e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }} />
                                </Grid>
                            </Grid>

                            {/* Tác giả — giống Book */}
                            <Divider textAlign="left">Tác giả</Divider>
                            <Stack spacing={1}>
                                {form.authors.map((a, i) => (
                                    <Box
                                        key={i}
                                        sx={{
                                            display: "grid",
                                            gridTemplateColumns: { xs: "1fr", sm: "1fr 160px 120px auto" },
                                            alignItems: "center",
                                            gap: 1,
                                        }}
                                    >
                                        {/* Họ tên – nở hết */}
                                        <Autocomplete
                                            freeSolo
                                            fullWidth
                                            options={authorsOpt}
                                            loading={!authorsOpt.length}
                                            isOptionEqualToValue={(o, v) => String(o || "") === String(v || "")}
                                            openOnFocus
                                            slotProps={{
                                                popper: { sx: { minWidth: 360 } },
                                                paper: { sx: { minWidth: 360 } },
                                                listbox: { sx: { "& li": { whiteSpace: "nowrap" } } },
                                            }}
                                            value={a.fullName || ""}
                                            onChange={(_, val) => upAuthor(i, "fullName", typeof val === "string" ? val : "")}
                                            onInputChange={(_, val) => upAuthor(i, "fullName", val)}
                                            renderInput={(params) => <TextField {...params} label="Họ tên" fullWidth />}
                                        />

                                        {/* Vai trò – 160px */}
                                        <TextField
                                            label="Vai trò"
                                            select
                                            value={a.role}
                                            onChange={(e) => upAuthor(i, "role", e.target.value)}
                                            fullWidth
                                        >
                                            <MenuItem value="main">main</MenuItem>
                                            <MenuItem value="co">co</MenuItem>
                                            <MenuItem value="editor">editor</MenuItem>
                                        </TextField>

                                        {/* Thứ tự – 120px */}
                                        <TextField
                                            label="Thứ tự"
                                            type="number"
                                            value={a.ord}
                                            onChange={(e) => upAuthor(i, "ord", Number(e.target.value || 1))}
                                            fullWidth
                                        />

                                        {/* Nút xoá */}
                                        <Tooltip title="Xoá">
                                            <span>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => rmAuthor(i)}
                                                    disabled={form.authors.length === 1}
                                                    sx={{ ml: { xs: "auto", sm: 0 } }}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    </Box>
                                ))}

                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={addAuthor}
                                    sx={{ alignSelf: "flex-start" }}
                                >
                                    Thêm tác giả
                                </Button>
                            </Stack>


                            {/* Thể loại */}
                            <Divider textAlign="left">Thể loại</Divider>
                            <Autocomplete
                                multiple
                                freeSolo
                                options={genresOpt}
                                loading={!genresOpt.length}
                                isOptionEqualToValue={isOptEq}
                                openOnFocus
                                slotProps={autoSlots}
                                value={form.genres}
                                onChange={(_, newVal) => setF("genres", (newVal || []).map(x => String(x || "")).filter(Boolean))}
                                renderInput={(params) => (
                                    <TextField {...params} label="Nhập thể loại và Enter"
                                        placeholder="Ví dụ: Xã hội, Kinh tế..."
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }} />
                                )}
                                renderTags={(value, getTagProps) =>
                                    value.map((option, index) => (
                                        <Chip {...getTagProps({ index })} key={index} label={option} sx={{ borderRadius: RADIUS }} />
                                    ))
                                }
                            />
                        </Stack>
                    </Grid>

                    {/* Phải */}
                    <Grid item xs={12} md={4}>
                        <Stack spacing={2}>
                            <Divider textAlign="left">Ảnh bìa & eBook</Divider>

                            <Stack spacing={1}>
                                <Stack direction="row" spacing={1}>
                                    <Button component="label" startIcon={<UploadIcon />} variant="outlined" sx={{ borderRadius: RADIUS }}>
                                        Chọn ảnh bìa (file)
                                        <input type="file" accept="image/*" hidden onChange={(e) => setF("coverFile", e.target.files?.[0] || null)} />
                                    </Button>
                                    <Button variant="text" onClick={() => setF("coverFile", null)} disabled={!form.coverFile}
                                        sx={{ borderRadius: RADIUS }}>
                                        Bỏ file
                                    </Button>
                                </Stack>
                                <TextField label="Hoặc nhập Cover URL" value={form.coverUrl}
                                    onChange={(e) => setF("coverUrl", e.target.value)}
                                    helperText="Nếu đã chọn file, URL sẽ bị bỏ qua."
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }} />
                                {coverPreview && (
                                    <img src={coverPreview} alt="preview"
                                        style={{ width: "100%", maxHeight: 240, objectFit: "contain", borderRadius: RADIUS }} />
                                )}
                            </Stack>

                            <Stack spacing={1}>
                                <Stack direction="row" spacing={1}>
                                    <Button component="label" startIcon={<UploadIcon />} variant="outlined" sx={{ borderRadius: RADIUS }}>
                                        Chọn eBook (PDF)
                                        <input type="file" accept="application/pdf" hidden onChange={(e) => setF("ebookFile", e.target.files?.[0] || null)} />
                                    </Button>
                                    <Button variant="text" onClick={() => setF("ebookFile", null)} disabled={!form.ebookFile}
                                        sx={{ borderRadius: RADIUS }}>
                                        Bỏ file
                                    </Button>
                                </Stack>
                                <TextField label="Hoặc nhập eBook URL (view)" value={form.ebookViewUrl}
                                    onChange={(e) => setF("ebookViewUrl", e.target.value)}
                                    helperText="Nếu đã chọn file, URL sẽ bị bỏ qua."
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }} />
                            </Stack>

                            <Alert severity={(form.coverFile || form.coverUrl) ? "info" : "warning"}
                                sx={{ borderRadius: RADIUS }}>
                                Ảnh bìa là <b>bắt buộc</b>: chọn file hoặc nhập URL.
                            </Alert>

                            <Divider textAlign="left">Bản copy</Divider>
                            <Stack spacing={1}>
                                {(form.initialCopies || []).map((c, i) => (
                                    <Box key={i}
                                        sx={{ p: 1.5, border: (t) => `1px solid ${t.palette.divider}`, borderRadius: RADIUS }}>
                                        <Grid container spacing={1} alignItems="center">
                                            <Grid item xs={12}><strong>Bản #{i + 1}</strong></Grid>
                                            <Grid item xs={12}>
                                                <TextField label="BarCode (để trống để hệ thống tự sinh)" fullWidth
                                                    value={c.barCode || ""} onChange={(e) => upCopy(i, "barCode", e.target.value)}
                                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }} />
                                            </Grid>
                                            <Grid item xs={6}>
                                                <TextField label="Trạng thái" select fullWidth
                                                    value={c.status || "AVAILABLE"} onChange={(e) => upCopy(i, "status", e.target.value)}
                                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }}>
                                                    {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                                                </TextField>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <TextField label="Tình trạng (%)" type="number" fullWidth
                                                    value={c.conditionNote || "100"} onChange={(e) => upCopy(i, "conditionNote", e.target.value)}
                                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }} />
                                            </Grid>
                                            <Grid item xs={12}>
                                                <TextField label="Ngày nhập" type="date" fullWidth
                                                    value={(c.entryDate || "").slice(0, 10)}
                                                    onChange={(e) => upCopy(i, "entryDate", e.target.value)}
                                                    InputLabelProps={{ shrink: true }}
                                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }} />
                                            </Grid>
                                            <Grid item xs={12}>
                                                <Stack direction="row" justifyContent="flex-end">
                                                    <Tooltip title="Xoá bản này">
                                                        <IconButton size="small" onClick={() => rmCopy(i)}>
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Stack>
                                            </Grid>
                                        </Grid>
                                    </Box>
                                ))}
                                <Button startIcon={<AddIcon />} onClick={addCopy} variant="outlined"
                                    sx={{ borderRadius: RADIUS }}>
                                    Thêm bản copy
                                </Button>
                            </Stack>
                        </Stack>
                    </Grid>
                </Grid>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={handleClose} disabled={saving} sx={{ borderRadius: RADIUS }}>Huỷ</Button>
                <Button variant="contained" onClick={submit} disabled={!canSubmit || saving}
                    sx={{ borderRadius: RADIUS }}>
                    Lưu
                </Button>
            </DialogActions>

            <Snackbar open={!!snack} autoHideDuration={2200}
                onClose={() => setSnack("")} message={snack} />
        </Dialog>
    );
}
