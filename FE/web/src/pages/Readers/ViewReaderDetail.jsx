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

export default function ViewReaderDetail({ open = true, reader = {}, onClose }) {
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
      <Typography sx={{ fontWeight: 500 }}>{value || "-"}</Typography>
    </Box>
  );

  const genderText = (() => {
    const g = reader.gender;
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
          position: "relative",
          textAlign: "center",
        }}
      >
        <Typography variant="h5" fontWeight={700}>
          Thông Tin Chi Tiết Độc Giả
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
        {/* CARD */}
        <Card elevation={0} sx={{ borderRadius: 0 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography
              variant="h6"
              fontWeight={600}
              sx={{ mb: 3, color: "#667EEA" }}
            >
              Thông Tin Cá Nhân
            </Typography>

            {infoRow("Mã độc giả", `DG${reader.readerId}`)}
            {infoRow("Họ tên", reader.fullName)}
            {infoRow("Email", reader.email)}
            {infoRow("Giới tính", genderText)}
            {infoRow(
              "Ngày sinh",
              reader.dateOfBirth
                ? new Date(reader.dateOfBirth).toLocaleDateString("vi-VN")
                : "-"
            )}
            {infoRow("Số điện thoại", reader.phoneNumber)}
            {infoRow("CCCD", reader.cccd)}
            {infoRow("Địa chỉ", reader.address)}
            {/* {infoRow("Ghi chú", reader.note)} */}

            {/* Nếu có thẻ thành viên
            <Box sx={{ mt: 4 }}>
              <Typography
                variant="h6"
                fontWeight={600}
                sx={{ mb: 3, color: "#667EEA" }}
              >
                Thông Tin Thẻ Thành Viên
              </Typography>

              {reader.memberCard ? (
                <>
                  {infoRow("Loại thẻ", reader.memberCard.cardTypeName)}
                  {infoRow("Ngày tạo", new Date(reader.memberCard.createdAt).toLocaleDateString("vi-VN"))}
                  {infoRow("Ngày hết hạn", new Date(reader.memberCard.expiryDate).toLocaleDateString("vi-VN"))}
                  {infoRow("Trạng thái", reader.memberCard.status)}
                </>
              ) : (
                <Typography sx={{ fontStyle: "italic", color: "#666" }}>
                  Độc giả chưa có thẻ thành viên.
                </Typography>
              )}
            </Box> */}

           
            {/* {reader.stats && (
              <Box sx={{ mt: 4 }}>
                <Typography
                  variant="h6"
                  fontWeight={600}
                  sx={{ mb: 3, color: "#667EEA" }}
                >
                  Thống Kê Mượn Sách
                </Typography>

                {infoRow("Đang mượn", reader.stats.borrowedCount || 0)}
                {infoRow("Đang chờ", (reader.stats.pendingCount || 0) + (reader.stats.waitingForPickupCount || 0))}
                {infoRow("Quá hạn", reader.stats.overdueCount || 0)}
              </Box>
            )} */}
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
