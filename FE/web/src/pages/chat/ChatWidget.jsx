import { useState } from "react";
import { Box, IconButton, Tooltip, Badge } from "@mui/material";
import ChatIcon from "@mui/icons-material/Chat";
import CloseIcon from "@mui/icons-material/Close";
import ChatWindow from "./ChatWindow";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const handleOpen = () => {
    setOpen(true);
    setUnread(0);
  };

  return (
    <>
      {!open && (
        <Tooltip title="Chat hỗ trợ">
          <Box
            sx={{
              position: "fixed",
              bottom: 24,
              right: 24,
              zIndex: 2000,
            }}
          >
            <Badge color="error" badgeContent={unread}>
              <IconButton
                onClick={handleOpen}
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,#667EEA,#764BA2)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                  color: "white",
                  "&:hover": { opacity: 0.9 },
                }}
              >
                <ChatIcon fontSize="large" />
              </IconButton>
            </Badge>
          </Box>
        </Tooltip>
      )}

      {open && (
        <Box
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            width: 380,
            height: 520,
            zIndex: 2000,
            background: "white",
            borderRadius: 3,
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              p: 2,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "linear-gradient(135deg,#667EEA,#764BA2)",
              color: "white",
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
            }}
          >
            Chat hỗ trợ
            <IconButton sx={{ color: "white" }} onClick={() => setOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>

          <ChatWindow onUnread={() => setUnread(unread + 1)} />
        </Box>
      )}
    </>
  );
}
