// ==========================================
// src/pages/ReaderHome/DocumentDetail.jsx
// ==========================================
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import {
Box,
Chip,
CircularProgress,
Divider,
Grid,
Link,
Paper,
Stack,
Tooltip,
Typography,
Alert,
Button,
Card,
CardContent,
} from "@mui/material";
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


function Label({ label, children }) {
return (
<Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="baseline">
<Typography variant="body2" sx={{ minWidth: 140, color: "text.secondary" }}>
{label}
</Typography>
<Box sx={{ flex: 1 }}>{children}</Box>
</Stack>
);
}


function CopyStatusChip({ status }) {
const map = {
AVAILABLE: { label: "Có sẵn", color: "success" },
BORROWED: { label: "Đang mượn", color: "warning" },
LOST: { label: "Mất", color: "default" },
DAMAGED: { label: "Hỏng", color: "default" },
};
const cfg = map[status] || { label: status, color: "default" };
return <Chip size="small" label={cfg.label} color={cfg.color} />;
}


export default function DocumentDetail() {
const { id } = useParams();


const [detail, setDetail] = useState(null);
const [similar, setSimilar] = useState([]);
const [loading, setLoading] = useState(true);
const [err, setErr] = useState("");


const abortRef = useRef(null);
const newSignal = () => {
if (abortRef.current) abortRef.current.abort();
abortRef.current = new AbortController();
return abortRef.current.signal;
};


const fmtVND = (v) =>
typeof v === "number"
? `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(v)}₫`
: null;


const title = useMemo(() => detail?.title || "Chi tiết tài liệu", [detail]);


useEffect(() => {
const signal = newSignal();
setLoading(true);
setErr("");
}