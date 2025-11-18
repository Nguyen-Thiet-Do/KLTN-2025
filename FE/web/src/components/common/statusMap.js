export const statusLabel = {
  // Phiếu mượn – LoanSlip
  PENDING: "Chờ duyệt",
  WAITING_FOR_PICKUP: "Chờ nhận sách",
  BORROWING: "Đang mượn",
  RETURNED: "Đã trả",
  OVERDUE: "Quá hạn",

  // LoanDetail (nếu dùng)
  LOST: "Mất",
  DAMAGED: "Hư hỏng",

  // DocumentCopy status (nếu dùng)
  AVAILABLE: "Có sẵn",
  BORROWED: "Đang được mượn",
};

export const statusColor = {
  PENDING: "warning",
  WAITING_FOR_PICKUP: "info",
  BORROWING: "primary",
  RETURNED: "success",
  OVERDUE: "error",
  LOST: "error",
  DAMAGED: "warning",
  AVAILABLE: "success",
  BORROWED: "primary",
};
