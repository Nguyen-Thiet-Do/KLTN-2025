import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  IconButton,
  Box,
  Card,
  CardContent,
  Button
} from "@mui/material";
import { Close } from "@mui/icons-material";

export default function ViewLibrarianDetail({ open = true, librarian = {}, onClose }) {
  const infoRow = (label, value) => (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        mb: 1.5,
        p: 1.2,
        backgroundColor: "rgba(102,126,234,0.04)",
        borderRadius: 2,
      }}
    >
      <Typography sx={{ fontWeight: 600, color: "#444" }}>{label}:</Typography>
      <Typography sx={{ fontWeight: 500, textAlign: "right", ml: 2 }}>
        {value || "-"}
      </Typography>
    </Box>
  );

  const genderText = (() => {
    const g = librarian.gender;
    if (g === null || g === undefined) return "-";
    const x = typeof g === "object"
      ? g?.data?.[0] ?? (g instanceof Uint8Array ? g[0] : undefined)
      : Number(g);

    if (x === 1) return "Nam";
    if (x === 0) return "Nữ";
    return "Khác";
  })();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          background: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
          color: "white",
          py: 2,
          textAlign: "center",
          position: "relative",
        }}
      >
        <Typography variant="h5" fontWeight={700}>
          Thông Tin Chi Tiết Thủ Thư
        </Typography>

        <IconButton
          onClick={onClose}
          sx={{
            position: "absolute",
            right: 16,
            top: "50%",
            transform: "translateY(-50%)",
            color: "white",
          }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      {/* CONTENT */}
      <DialogContent sx={{ p: 0 }}>
        <Card elevation={0} sx={{ borderRadius: 0 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography
              variant="h6"
              fontWeight={600}
              sx={{ mb: 3, color: "#667EEA" }}
            >
              Thông Tin Cá Nhân
            </Typography>

            {infoRow("Mã thủ thư", librarian.librarianCode || `TT${librarian.librarianId}`)}
            {infoRow("Họ và tên", librarian.fullName)}
            {infoRow("Email", librarian.email)}
            {infoRow("Giới tính", genderText)}

            {infoRow(
              "Ngày sinh",
              librarian.dateOfBirth
                ? new Date(librarian.dateOfBirth).toLocaleDateString("vi-VN")
                : "-"
            )}

            {infoRow("Số điện thoại", librarian.phoneNumber)}
            {infoRow("CCCD", librarian.cccd)}
            {infoRow("Địa chỉ", librarian.address)}

            {/* Lương */}
            {/* <Typography
              variant="h6"
              fontWeight={600}
              sx={{ mt: 4, mb: 3, color: "#667EEA" }}
            >
              Thông Tin Lương
            </Typography> */}

            {/* {infoRow(
              "Lương cơ bản",
              librarian.basicSalary
                ? librarian.basicSalary.toLocaleString("vi-VN") + " ₫"
                : "-"
            )}

            {infoRow(
              "Hệ số lương",
              librarian.salaryCoefficient || "-"
            )} */}

            {/* Ghi chú */}
            {/* <Typography
              variant="h6"
              fontWeight={600}
              sx={{ mt: 4, mb: 3, color: "#667EEA" }}
            >
              Ghi Chú
            </Typography>

            {infoRow("Ghi chú", librarian.note)} */}
          </CardContent>
        </Card>
      </DialogContent>

      {/* FOOTER */}
      <DialogActions sx={{ p: 3 }}>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            borderRadius: 2,
            px: 4,
            py: 1,
            background: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
            fontWeight: 600,
            color: "white",
          }}
        >
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  );
}
