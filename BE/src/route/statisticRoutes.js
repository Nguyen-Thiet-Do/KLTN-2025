const express = require("express");
const router = express.Router();
const statisticController = require("../controller/statisticController");

// 🔹 Tổng hợp
router.get("/", statisticController.getAllStatistics);

// 🔹 Biểu đồ 12 tháng
router.get("/monthly", statisticController.getMonthlyStatistics);

router.get("/category", statisticController.getCategoryStatistics);
router.get("/top-books", statisticController.getTop5MostBorrowedBooks);

module.exports = router;
