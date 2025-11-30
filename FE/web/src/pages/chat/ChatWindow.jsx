import { useState, useRef, useEffect } from "react";
import {
  Box,
  TextField,
  IconButton,
  CircularProgress,
  Stack,
  Typography,
  Avatar,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";

export default function ChatWindow({ onUnread }) {
  const [messages, setMessages] = useState([
    { from: "bot", text: "Xin chào! Tôi có thể giúp gì cho bạn?" },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const API_URL = import.meta.env.VITE_API_URL;

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = { from: "user", text: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.text }),
      });

      const data = await res.json();
      const botMsg = { from: "bot", text: data.reply || "..." };

      setMessages((prev) => [...prev, botMsg]);
      onUnread?.();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: "Không thể kết nối tới server." },
      ]);
    }

    setLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") sendMessage();
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        bgcolor: "linear-gradient(180deg, #fafafa 0%, #f0f0ff 100%)",
      }}
    >
      {/* HEADER */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderBottom: "1px solid rgba(0,0,0,0.1)",
          background: "white",
        }}
      >
        <Avatar
          src="/bot_avatar.png"
          sx={{ width: 36, height: 36, bgcolor: "#667EEA" }}
        >
          B
        </Avatar>

        <Box>
          <Typography sx={{ fontWeight: 700 }}>Bot hỗ trợ</Typography>
          <Typography sx={{ fontSize: "0.8rem", color: "green" }}>
            ● Đang hoạt động
          </Typography>
        </Box>
      </Box>

      {/* DANH SÁCH TIN NHẮN */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          px: 2,
          py: 2,
          background: "linear-gradient(0deg, #ffffff, #f6f7ff)",
        }}
      >
        {messages.map((msg, i) => (
          <Stack
            key={i}
            direction="row"
            spacing={1}
            sx={{
              mb: 2,
              justifyContent: msg.from === "user" ? "flex-end" : "flex-start",
            }}
          >
            {/* Avatar bot/user */}
            {msg.from === "bot" && (
              <Avatar sx={{ width: 32, height: 32, bgcolor: "#667EEA" }}>B</Avatar>
            )}

      <Box
  sx={{
    maxWidth: "75%",
    p: 1.2,
    borderRadius: 3,
    background:
      msg.from === "user"
        ? "linear-gradient(135deg, #667EEA, #764BA2)"
        : "white",
    color: msg.from === "user" ? "white" : "black",
    boxShadow:
      msg.from === "user"
        ? "0 3px 10px rgba(102,126,234,0.3)"
        : "0 2px 6px rgba(0,0,0,0.1)",
  }}
>
  <Typography sx={{ fontSize: "0.9rem" }}>{msg.text}</Typography>
</Box>

            {msg.from === "user" && (
              <Avatar sx={{ width: 32, height: 32, bgcolor: "#764BA2" }}>U</Avatar>
            )}
          </Stack>
        ))}

        <div ref={bottomRef} />
      </Box>

      {/* KHU VỰC NHẬP TIN NHẮN */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 1,
          borderTop: "1px solid rgba(0,0,0,0.1)",
          background: "white",
        }}
      >
        <TextField
          fullWidth
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Nhập tin nhắn..."
          size="small"
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 3,
              background: "#f5f6ff",
              "& fieldset": { border: "none" },
              "&:hover fieldset": { border: "none" },
              "&.Mui-focused fieldset": {
                border: "2px solid #667EEA",
              },
            },
          }}
        />

        <IconButton
          onClick={sendMessage}
          sx={{
            width: 45,
            height: 45,
            borderRadius: 3,
            background: "linear-gradient(135deg, #667EEA, #764BA2)",
            color: "white",
            "&:hover": {
              transform: "scale(1.05)",
              boxShadow: "0 4px 12px rgba(102,126,234,0.4)",
            },
            transition: "0.15s",
          }}
        >
          {loading ? <CircularProgress size={22} color="inherit" /> : <SendIcon />}
        </IconButton>
      </Box>
    </Box>
  );
}
