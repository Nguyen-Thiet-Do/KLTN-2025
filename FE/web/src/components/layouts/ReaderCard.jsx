import {
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Chip,
  Stack,
  Box,
  Tooltip,
} from "@mui/material";

export default function ReaderCard({ doc = {} }) {
  const {
    title = "",
    categoryName,
    coverPhoto,
    minDeposit,
    maxDeposit,
    availableCopies = 0,
    totalCopies = 0,
  } = doc;

  const cover = coverPhoto || "/no-cover.png";
  const inStock = totalCopies > 0 && availableCopies > 0;

  const fmtVND = (v) =>
    typeof v === "number"
      ? `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(v)}₫`
      : null;

  const depositText =
    typeof minDeposit === "number" && typeof maxDeposit === "number"
      ? `${fmtVND(minDeposit)} - ${fmtVND(maxDeposit)}`
      : "—";

  return (
    <Card
      elevation={2}
      sx={{
        width: 1,                 // chiếm hết chiều ngang cột grid (260px)
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <CardActionArea sx={{ alignItems: "stretch" }}>
        {/* KHUNG ẢNH CỐ ĐỊNH CHIỀU CAO -> bìa đồng nhất */}
        <Box
          sx={{
            position: "relative",
            width: 1,
            height: { xs: 220, sm: 240, md: 260 }, // chỉnh size bìa tại đây
            bgcolor: "grey.100",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <Box
            component="img"
            src={cover}
            alt={title}
            loading="lazy"
            sx={{
              position: "absolute",
              inset: 0,
              width: 1,
              height: 1,
              objectFit: "cover",
              display: "block",
            }}
          />
        </Box>

        <CardContent sx={{ flexGrow: 1 }}>
          <Stack spacing={1.25}>
            {/* Tiêu đề: xuống dòng tối đa 2 dòng */}
            <Tooltip title={title} placement="top" arrow>
              <Typography
                variant="subtitle1"
                fontWeight={700}
                component="div"
                sx={{
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  overflow: "hidden",
                  lineHeight: 1.35,
                  minHeight: "2.7em",
                }}
              >
                {title}
              </Typography>
            </Tooltip>

            {categoryName ? (
              <Chip size="small" label={categoryName} sx={{ width: "fit-content" }} />
            ) : null}

            <Typography variant="body2" component="div">
              <strong>Cọc:</strong> {depositText}
            </Typography>

            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2" component="span">
                <strong>Sẵn có:</strong> {Number(availableCopies)}/{Number(totalCopies)}
              </Typography>
              <Chip
                size="small"
                label={inStock ? "Có sẵn" : "Hết / Chờ"}
                color={inStock ? "success" : "default"}
              />
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
