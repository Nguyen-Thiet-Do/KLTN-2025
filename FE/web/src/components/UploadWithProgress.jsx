// components/UploadWithProgress.jsx
import { useState } from "react";
import { Button, LinearProgress, Typography } from "@mui/material";

export default function UploadWithProgress({ label, accept, onPick }) {
  const [prog, setProg] = useState(0);
  const [url, setUrl] = useState("");

  const handle = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setProg(0);
    const { url } = await onPick(f, setProg); // onPick phải return {url}
    setUrl(url);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <Button component="label" variant="outlined">
        {label}
        <input hidden type="file" accept={accept} onChange={handle} />
      </Button>
      {prog > 0 && prog < 100 && <LinearProgress variant="determinate" value={prog} />}
      {url && <Typography variant="caption" sx={{ mt: 0.5, display: "block" }}>Đã tải: {url}</Typography>}
    </div>
  );
}
