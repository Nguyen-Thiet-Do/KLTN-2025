const sequelize = require("../config/database");
const {
  Document,
  DocumentCopy,
  Reader,
  LoanSlip,
  LoanDetail,
} = require("../model");
const { Op } = require("sequelize");

// ============================================================
// 🔹 Thống kê tổng hợp thư viện
// ============================================================
const getLibraryStatistics = async () => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [
      totalDocuments,
      totalCopies,
      totalReaders,
      totalLoans,
      monthlyLoans,
      borrowedCopies,
      overdueLoans,

      totalBorrowedBooks,       
      monthlyBorrowedBooks     
    ] = await Promise.all([
      Document.count({ where: { deleted: false } }),
      DocumentCopy.count({ where: { deleted: false } }),
      Reader.count({ where: { deleted: false } }),
      LoanSlip.count({ where: { deleted: false } }),

      LoanSlip.count({
        where: {
          created_at: { [Op.between]: [startOfMonth, endOfMonth] },
          deleted: false,
        },
      }),

      DocumentCopy.count({ where: { status: "BORROWED", deleted: false } }),

      LoanDetail.count({
        include: [{ model: LoanSlip, required: true, where: { deleted: false } }],
        where: {
          deleted: false,
          returnDate: null,
          "$LoanSlip.dueDate$": { [Op.lt]: new Date() },
        },
      }),

      // ⭐ Tổng số cuốn sách đã mượn
      LoanDetail.count({
        where: { deleted: false }
      }),

      // ⭐ Số cuốn sách được mượn trong tháng
      LoanDetail.count({
        include: [
          {
            model: LoanSlip,
            required: true,
            where: {
              deleted: false,
              created_at: { [Op.between]: [startOfMonth, endOfMonth] }
            }
          }
        ],
        where: { deleted: false }
      })
    ]);

    // 🔹 Thể loại phổ biến nhất
    const [rows] = await sequelize.query(`
      SELECT g.name, COUNT(dgm.documentId) AS count
      FROM DocumentGenreMaps dgm
      INNER JOIN Genres g ON g.genreId = dgm.genreId
      WHERE dgm.deleted = FALSE
      GROUP BY g.genreId, g.name
      ORDER BY count DESC
      LIMIT 1;
    `);

    const topGenre = rows?.[0] || null;

    return {
      totalDocuments,
      totalCopies,
      totalReaders,
      totalLoans,
      monthlyLoans,
      borrowedCopies,
      overdueLoans,
      totalBorrowedBooks,       
      monthlyBorrowedBooks,     
      mostPopularGenre: topGenre ? topGenre.name : null,
    };
  } catch (error) {
    console.error("❌ Lỗi getLibraryStatistics:", error);
    throw error;
  }
};

// ============================================================
// 🔹 Thống kê số lượt mượn theo 12 tháng (LoanSlips)
// ============================================================
const getMonthlyLoans = async () => {
  try {
    const year = new Date().getFullYear();
    const [rows] = await sequelize.query(`
      SELECT 
        MONTH(created_at) AS month, 
        COUNT(*) AS total
      FROM LoanSlips
      WHERE YEAR(created_at) = ${year} AND deleted = FALSE
      GROUP BY MONTH(created_at)
      ORDER BY month;
    `);

    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const found = rows.find(r => r.month === month);
      return { month, total: found ? parseInt(found.total) : 0 };
    });

    return monthlyData;
  } catch (error) {
    console.error("❌ Lỗi getMonthlyLoans:", error);
    throw error;
  }
};

// ============================================================
// 🔹 Thống kê số sách theo danh mục
// ============================================================
const getCategoryStatistics = async () => {
  try {
    const [rows] = await sequelize.query(`
      SELECT g.name AS category, COUNT(dgm.documentId) AS total
      FROM DocumentGenreMaps dgm
      INNER JOIN Genres g ON g.genreId = dgm.genreId
      WHERE dgm.deleted = FALSE AND g.deleted = FALSE
      GROUP BY g.genreId, g.name
      ORDER BY total DESC;
    `);

    return rows.map(r => ({
      category: r.category,
      total: parseInt(r.total),
    }));
  } catch (error) {
    console.error("❌ Lỗi getCategoryStatistics:", error);
    throw error;
  }
};

// ============================================================
// 🔹 Top 5 sách mượn nhiều nhất
// ============================================================
const getTop5MostBorrowedBooks = async () => {
  try {
    const [rows] = await sequelize.query(`
      SELECT d.title AS title, COUNT(*) AS total
      FROM LoanDetails ld
      INNER JOIN DocumentCopys dc ON dc.documentCopyId = ld.documentCopyId
      INNER JOIN Documents d ON d.documentId = dc.documentId
      WHERE ld.deleted = FALSE AND dc.deleted = FALSE AND d.deleted = FALSE
      GROUP BY d.documentId, d.title
      ORDER BY total DESC
      LIMIT 5;
    `);

    return rows.map(r => ({
      title: r.title,
      total: parseInt(r.total),
    }));
  } catch (error) {
    console.error("❌ Lỗi getTop5MostBorrowedBooks:", error);
    throw error;
  }
};

module.exports = {
  getLibraryStatistics,
  getMonthlyLoans,
  getCategoryStatistics,
  getTop5MostBorrowedBooks
};
