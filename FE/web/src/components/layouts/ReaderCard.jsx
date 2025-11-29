import {
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Chip,
  Stack,
  Box,
  Tooltip,
  Rating,
  AvatarGroup,
  Avatar,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import {
  Person,
  CalendarToday,
  ImportContacts,
  Star,
  BookmarkBorder
} from "@mui/icons-material";

export default function ReaderCard({ doc = {} }) {
  const {
    documentId,
    title = "",
    categoryName,
    coverPhoto,
    availableCopies = 0,
    totalCopies = 0,
    author,
    publishYear,
    reviewCount = 12,
    shelfLocation,
  } = doc;

  const cover = coverPhoto || "/no-cover.png";
  const inStock = totalCopies > 0 && availableCopies > 0;
  const stockPercentage = totalCopies > 0 ? (availableCopies / totalCopies) * 100 : 0;

  const to = documentId ? `/reader/documents/${documentId}` : undefined;

  return (
    <Card
      elevation={1}
      sx={{
        width: 1,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 3,
        overflow: "hidden",
        transition: "all 0.3s ease-in-out",
        "&:hover": {
          transform: "translateY(-4px)",
          elevation: 8,
          boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
        },
      }}
    >
      <CardActionArea
        component={to ? RouterLink : "div"}
        to={to}
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch"
        }}
      >
        {/* Cover Image */}
        <Box sx={{ position: "relative" }}>
          <Box
            sx={{
              width: 1,
              height: 200,
              bgcolor: "grey.100",
              overflow: "hidden",
            }}
          >
            <Box
              component="img"
              src={cover}
              alt={title}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.src = "/no-cover.png";
              }}
              sx={{
                width: 1,
                height: 1,
                objectFit: "cover",
                transition: "transform 0.3s ease",
                "&:hover": {
                  transform: "scale(1.05)",
                },
              }}
            />
          </Box>

          {/* Stock Status Badge */}
          <Chip
            size="small"
            label={inStock ? "Có sẵn" : "Hết sách"}
            color={inStock ? "success" : "default"}
            sx={{
              position: "absolute",
              top: 12,
              right: 12,
              fontWeight: 600,
            }}
          />

          {/* Category Badge */}
          {categoryName && (
            <Chip
              size="small"
              label={categoryName}
              variant="filled"
              sx={{
                position: "absolute",
                top: 12,
                left: 12,
                backgroundColor: "rgba(0,0,0,0.7)",
                color: "white",
                fontWeight: 500,
              }}
            />
          )}
        </Box>

        <CardContent sx={{ flexGrow: 1, p: 2.5 }}>
          <Stack spacing={2}>
            {/* Title */}
            <Tooltip title={title} placement="top" arrow>
              <Typography
                variant="h6"
                fontWeight={700}
                component="div"
                sx={{
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  overflow: "hidden",
                  lineHeight: 1.3,
                  minHeight: "2.6em",
                  fontSize: "1rem",
                }}
              >
                {title}
              </Typography>
            </Tooltip>

            {/* Author & Year */}
            <Stack spacing={1}>
              {(author || publishYear) && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ opacity: 0.8 }}>
                  {author && (
                    <>
                      <Person sx={{ fontSize: 16 }} />
                      <Typography variant="body2" noWrap flex={1}>
                        {author}
                      </Typography>
                    </>
                  )}
                  {publishYear && (
                    <>
                      <CalendarToday sx={{ fontSize: 16 }} />
                      <Typography variant="body2">
                        {publishYear}
                      </Typography>
                    </>
                  )}
                </Stack>
              )}
            </Stack>

            {/* Deposit & Stock Info */}
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ opacity: 0.8 }}>
                <BookmarkBorder sx={{ fontSize: 16 }} />
                <Typography variant="body2" noWrap flex={1}>
                  Kệ: {shelfLocation || "Chưa xác định"}
                </Typography>
              </Stack>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" fontWeight={600}>
                    Số bản có sẵn:
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {availableCopies}
                  </Typography>
                </Stack>

                {/* Stock Progress Bar */}
                <Box sx={{
                  width: "100%",
                  height: 4,
                  backgroundColor: "grey.200",
                  borderRadius: 2,
                  overflow: "hidden"
                }}>
                  <Box
                    sx={{
                      height: "100%",
                      backgroundColor: inStock ? "success.main" : "error.main",
                      width: `${stockPercentage}%`,
                      transition: "width 0.3s ease"
                    }}
                  />
                </Box>
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}