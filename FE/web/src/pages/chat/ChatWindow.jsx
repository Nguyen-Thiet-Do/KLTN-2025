import { useState, useRef, useEffect } from "react";
import {
  Box,
  TextField,
  IconButton,
  CircularProgress,
  Stack,
  Typography,
  Avatar,
  Paper,
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

      // ==== BOT TRẢ VỀ DANH SÁCH SÁCH ====
      if (data.books) {
        setMessages((prev) => [
          ...prev,
          { from: "bot", text: data.reply, books: data.books },
        ]);

        onUnread?.();
        setLoading(false);
        return;
      }

      // ==== BOT TRẢ VỀ TEXT THƯỜNG ====
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
              <Avatar sx={{ width: 32, height: 32, bgcolor: "#667EEA" }}>
                B
              </Avatar>
            )}

            <Box>
              {/* Bubble */}
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

              {/* HIỆN GỢI Ý SÁCH */}
              {msg.books && (
                <Box sx={{ mt: 1 }}>
                  {msg.books.map((b) => (
                    <Paper
                      key={b.documentId}
                      onClick={() =>
                        (window.location.href = `/reader/documents/${b.documentId}`)
                      }
                      sx={{
                        p: 1.5,
                        my: 1,
                        borderRadius: 2,
                        cursor: "pointer",
                        width: "75%",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                        "&:hover": {
                          background: "#f3f3ff",
                          transform: "scale(1.02)",
                        },
                        transition: "0.15s",
                      }}
                    >
                      <Typography fontWeight={700} sx={{ mb: 0.5 }}>
                        {b.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {b.authors?.map((a) => a.fullName).join(", ")}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              )}
            </Box>

            {msg.from === "user" && (
              <Avatar sx={{ width: 32, height: 32, bgcolor: "#764BA2" }}>
                U
              </Avatar>
            )}
          </Stack>
        ))}

        <div ref={bottomRef} />
      </Box>

      {/* INPUT */}
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
          {loading ? (
            <CircularProgress size={22} color="inherit" />
          ) : (
            <SendIcon />
          )}
        </IconButton>
      </Box>
    </Box>
  );
}
