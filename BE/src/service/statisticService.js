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
      returnedBooks,
      borrowingBooks,
      waitingPickupBooks,
      lostBooks,
      pendingBooks,
      pendingPaymentBooks,
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

      LoanDetail.count({ where: { deleted: false } }),
      LoanDetail.count({ where: { deleted: false, status: 'RETURNED' } }),
      LoanDetail.count({ where: { deleted: false, status: 'BORROWED' } }),
      LoanDetail.count({ where: { deleted: false, status: 'WAITING_FOR_PICKUP' } }),
      LoanDetail.count({ where: { deleted: false, status: 'LOST' } }),
      LoanDetail.count({ where: { deleted: false, status: 'PENDING' } }),
      LoanDetail.count({ where: { deleted: false, status: 'PENDING_PAYMENT' } }),

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
      mostPopularGenre: topGenre ? topGenre.name : null,
      totalBorrowedBooks,
      returnedBooks,
      borrowingBooks,
      waitingPickupBooks,
      lostBooks,
      pendingBooks,
      pendingPaymentBooks,
      monthlyBorrowedBooks,
    };
  } catch (error) {
    console.error("❌ Lỗi getLibraryStatistics:", error);
    throw error;
  }
};

// ============================================================
// 🔹 Thống kê số lượt mượn theo 12 tháng - ✅ TỰ ĐỘNG LẤY NĂM CÓ DỮ LIỆU
// ============================================================
const getMonthlyLoans = async () => {
  try {
    // ⭐ Lấy năm gần nhất có dữ liệu
    const [yearResult] = await sequelize.query(`
      SELECT YEAR(created_at) AS year
      FROM LoanSlips
      WHERE deleted = FALSE
      ORDER BY created_at DESC
      LIMIT 1;
    `);

    const year = yearResult?.[0]?.year || new Date().getFullYear();

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

// ============================================================
// 🔹 Top 5 độc giả mượn nhiều nhất
// ============================================================
const getTop5Readers = async () => {
  try {
    const [rows] = await sequelize.query(`
      SELECT r.fullName AS reader, COUNT(*) AS total
      FROM LoanSlips ls
      JOIN Readers r ON r.readerId = ls.readerId
      WHERE ls.deleted = FALSE
      GROUP BY r.readerId, r.fullName
      ORDER BY total DESC
      LIMIT 5;
    `);

    return rows.map(r => ({
      reader: r.reader,
      total: parseInt(r.total),
    }));
  } catch (error) {
    console.error("❌ Lỗi getTop5Readers:", error);
    throw error;
  }
};

// ============================================================
// 📅 Lượt mượn theo ngày trong tuần
// ============================================================
const getBorrowByDayOfWeek = async () => {
  try {
    const [rows] = await sequelize.query(`
      SELECT 
        DAYOFWEEK(created_at) AS dayOfWeek,
        COUNT(*) AS total
      FROM LoanSlips
      WHERE deleted = FALSE 
        AND YEAR(created_at) = YEAR(NOW())
      GROUP BY DAYOFWEEK(created_at)
      ORDER BY dayOfWeek;
    `);

    const daysMap = {
      1: 'Chủ nhật',
      2: 'Thứ 2', 
      3: 'Thứ 3',
      4: 'Thứ 4',
      5: 'Thứ 5',
      6: 'Thứ 6',
      7: 'Thứ 7'
    };

    const result = Array.from({ length: 7 }, (_, i) => {
      const dayNum = i + 1;
      const found = rows.find(r => r.dayOfWeek === dayNum);
      return {
        day: daysMap[dayNum],
        dayNum: dayNum,
        total: found ? parseInt(found.total) : 0
      };
    });

    return result;
  } catch (error) {
    console.error("❌ Lỗi getBorrowByDayOfWeek:", error);
    throw error;
  }
};

// ============================================================
// 📚 Sách chưa từng được mượn - ✅ FIXED
// ============================================================
const getNeverBorrowedBooks = async () => {
  try {
    const [rows] = await sequelize.query(`
      SELECT 
        d.documentId,
        d.title,
        d.publicationYear,
        COUNT(dc.documentCopyId) AS totalCopies
      FROM Documents d
      LEFT JOIN DocumentCopys dc 
        ON dc.documentId = d.documentId 
        AND dc.deleted = FALSE
      WHERE d.deleted = FALSE
        AND d.documentId NOT IN (
          SELECT DISTINCT dc2.documentId 
          FROM LoanDetails ld
          INNER JOIN DocumentCopys dc2 
            ON dc2.documentCopyId = ld.documentCopyId
          WHERE ld.deleted = FALSE 
            AND dc2.deleted = FALSE
        )
      GROUP BY d.documentId, d.title, d.publicationYear
      ORDER BY d.created_at DESC;
    `);

    return rows.map(r => ({
      documentId: r.documentId,
      title: r.title,
      author: null,
      publishYear: r.publicationYear,
      totalCopies: parseInt(r.totalCopies)
    }));
  } catch (error) {
    console.error("❌ Lỗi getNeverBorrowedBooks:", error);
    throw error;
  }
};

// ============================================================
// 👥 Độc giả không hoạt động - ✅ FIXED
// ============================================================
const getInactiveReaders = async () => {
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const [rows] = await sequelize.query(`
      SELECT 
        r.readerId,
        r.fullName,
        r.address,
        MAX(ls.created_at) AS lastBorrowDate,
        DATEDIFF(NOW(), MAX(ls.created_at)) AS daysSinceLastBorrow
      FROM Readers r
      LEFT JOIN LoanSlips ls ON ls.readerId = r.readerId AND ls.deleted = FALSE
      WHERE r.deleted = FALSE
      GROUP BY r.readerId, r.fullName, r.address
      HAVING lastBorrowDate IS NULL 
         OR lastBorrowDate < :threeMonthsAgo
      ORDER BY daysSinceLastBorrow DESC;
    `, {
      replacements: { threeMonthsAgo }
    });

    return rows.map(r => ({
      readerId: r.readerId,
      fullName: r.fullName,
      email: null,
      phoneNumber: r.address,
      lastBorrowDate: r.lastBorrowDate,
      daysSinceLastBorrow: r.daysSinceLastBorrow || 999
    }));
  } catch (error) {
    console.error("❌ Lỗi getInactiveReaders:", error);
    throw error;
  }
};

// ============================================================
// 📊 Tổng hợp báo cáo nhanh - ✅ FIXED
// ============================================================
const getReportSummary = async () => {
  try {
    const [borrowByDay, neverBorrowed, inactiveReaders] = await Promise.all([
      getBorrowByDayOfWeek(),
      getNeverBorrowedBooks(),
      getInactiveReaders()
    ]);

    console.log('📊 borrowByDay:', borrowByDay);

    // ✅ Kiểm tra nếu không có dữ liệu
    if (!borrowByDay || borrowByDay.length === 0) {
      return {
        totalNeverBorrowedBooks: neverBorrowed.length,
        totalInactiveReaders: inactiveReaders.length,
        busiestDay: { name: "Không có dữ liệu", count: 0 },
        quietestDay: { name: "Không có dữ liệu", count: 0 }
      };
    }

    // ✅ Tìm ngày đông nhất và vắng nhất
    const busiest = borrowByDay.reduce((max, day) => 
      day.total > max.total ? day : max
    , borrowByDay[0]);

    const quietest = borrowByDay.reduce((min, day) => 
      day.total < min.total ? day : min
    , borrowByDay[0]);

    console.log('📊 busiest:', busiest);
    console.log('📊 quietest:', quietest);

    return {
      totalNeverBorrowedBooks: neverBorrowed.length,
      totalInactiveReaders: inactiveReaders.length,
      busiestDay: {
        name: busiest.day,
        count: busiest.total
      },
      quietestDay: {
        name: quietest.day,
        count: quietest.total
      }
    };

  } catch (error) {
    console.error("❌ Lỗi getReportSummary:", error);
    throw error;
  }
};

module.exports = {
  getLibraryStatistics,
  getMonthlyLoans,
  getCategoryStatistics,
  getTop5MostBorrowedBooks,
  getTop5Readers,
  getBorrowByDayOfWeek,
  getNeverBorrowedBooks,
  getInactiveReaders,
  getReportSummary
};