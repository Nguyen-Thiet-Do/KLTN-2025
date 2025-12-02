// EditCopyDialog.jsx
import React, { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, Stack
} from "@mui/material";
import { useSnackbar } from "notistack";
import { updateCopy } from "../../../services/bookService"; // đường dẫn điều chỉnh theo project

const STATUS_OPTIONS = [
  "AVAILABLE", "BORROWED", "MAINTENANCE", "REPAIR", "LOST"
];

export default function EditCopyDialog({ open, onClose, copy, onUpdated }) {
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState({
    barCode: "",
    status: "AVAILABLE",
    conditionNote: "",
    entryDate: ""
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!copy) return;
    setForm({
      barCode: copy.barCode || "",
      status: (copy.status || "AVAILABLE").toUpperCase(),
      conditionNote: copy.conditionNote ?? "",
      entryDate: copy.entryDate ? (new Date(copy.entryDate)).toISOString().slice(0,10) : ""
    });
  }, [copy]);

  const handleChange = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!copy?.documentCopyId) return;
    setSaving(true);
    try {
      // payload chỉ gửi các trường cần sửa
      const payload = {
        barCode: form.barCode || undefined,
        status: form.status || undefined,
        conditionNote: form.conditionNote !== "" ? form.conditionNote : null,
        entryDate: form.entryDate || undefined
      };

      const res = await updateCopy(copy.documentCopyId, payload);
      // res dự kiến: { ok:true, data: { ...copyData } } theo BE.
      enqueueSnackbar("Cập nhật bản sao thành công", { variant: "success" });
      onUpdated && onUpdated(res?.data ?? res?.data?.data ?? res);
      onClose();
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "Cập nhật thất bại";
      enqueueSnackbar(msg, { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Sửa bản sao</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Barcode"
            value={form.barCode}
            onChange={handleChange("barCode")}
            fullWidth
          />
          <TextField
            select
            label="Trạng thái"
            value={form.status}
            onChange={handleChange("status")}
            fullWidth
          >
            {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <TextField
            label="Ghi chú tình trạng"
            value={form.conditionNote}
            onChange={handleChange("conditionNote")}
            fullWidth
            multiline
            rows={2}
          />
          <TextField
            label="Ngày nhập"
            type="date"
            value={form.entryDate}
            onChange={handleChange("entryDate")}
            InputLabelProps={{ shrink: true }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Huỷ</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving}>
          Lưu
        </Button>
      </DialogActions>
    </Dialog>
  );
}
