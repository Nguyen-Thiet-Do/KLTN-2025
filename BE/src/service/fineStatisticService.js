// ==========================================
// 📁 service/fineStatisticService.js
// ==========================================
const sequelize = require("../config/database");
const { Violation, Payment, Reader, LoanSlip, LoanDetail } = require("../model");
const { Op } = require("sequelize");

// ============================================================
// 🔹 1. THỐNG KÊ TỔNG QUAN TIỀN PHẠT
// ============================================================
const getFineOverview = async () => {
  try {
    const [overview] = await sequelize.query(`
      SELECT 
        COUNT(*) as tongSoViPham,
        SUM(fineAmount) as tongTienPhat,
        SUM(CASE WHEN paymentStatus = 'paid' THEN fineAmount ELSE 0 END) as daThuDuoc,
        SUM(CASE WHEN paymentStatus = 'unpaid' THEN fineAmount ELSE 0 END) as conPhaiThu,
        AVG(fineAmount) as tienPhatTrungBinh,
        COUNT(DISTINCT readerId) as soDocGiaViPham
      FROM Violations
      WHERE deleted = FALSE;
    `);

    const result = overview[0] || {
      tongSoViPham: 0,
      tongTienPhat: 0,
      daThuDuoc: 0,
      conPhaiThu: 0,
      tienPhatTrungBinh: 0,
      soDocGiaViPham: 0
    };

    // Tính tỷ lệ thu hồi
    const tyLeThuHoi = result.tongTienPhat > 0 
      ? ((result.daThuDuoc / result.tongTienPhat) * 100).toFixed(2)
      : 0;

    return {
      ...result,
      tongTienPhat: parseFloat(result.tongTienPhat) || 0,
      daThuDuoc: parseFloat(result.daThuDuoc) || 0,
      conPhaiThu: parseFloat(result.conPhaiThu) || 0,
      tienPhatTrungBinh: parseFloat(result.tienPhatTrungBinh) || 0,
      tyLeThuHoi: parseFloat(tyLeThuHoi)
    };
  } catch (error) {
    console.error("❌ Lỗi getFineOverview:", error);
    throw error;
  }
};

// ============================================================
// 🔹 2. THỐNG KÊ THEO TRẠNG THÁI THANH TOÁN
// ============================================================
const getFineByPaymentStatus = async () => {
  try {
    const [rows] = await sequelize.query(`
      SELECT 
        paymentStatus as trangThai,
        COUNT(*) as soLuong,
        SUM(fineAmount) as tongTien
      FROM Violations
      WHERE deleted = FALSE
      GROUP BY paymentStatus
      ORDER BY tongTien DESC;
    `);

    // Việt hóa trạng thái
    return rows.map(r => ({
      trangThai: r.trangThai === 'paid' ? 'Đã thanh toán' : 
                 r.trangThai === 'unpaid' ? 'Chưa thanh toán' : 
                 r.trangThai === 'pending' ? 'Đang xử lý' : 
                 r.trangThai === 'PAID' ? 'Đã thanh toán' :
                 r.trangThai === 'UNPAID' ? 'Chưa thanh toán' :
                 'Không xác định',
      soLuong: parseInt(r.soLuong),
      tongTien: parseFloat(r.tongTien) || 0
    }));
  } catch (error) {
    console.error("❌ Lỗi getFineByPaymentStatus:", error);
    throw error;
  }
};

// ============================================================
// 🔹 3. THỐNG KÊ TIỀN PHẠT THEO THÁNG (12 THÁNG)
// ============================================================
const getMonthlyFines = async () => {
  try {
    // Lấy năm gần nhất có dữ liệu
    const [yearResult] = await sequelize.query(`
      SELECT YEAR(created_at) AS year
      FROM Violations
      WHERE deleted = FALSE
      ORDER BY created_at DESC
      LIMIT 1;
    `);

    const year = yearResult?.[0]?.year || new Date().getFullYear();

    const [rows] = await sequelize.query(`
      SELECT 
        MONTH(created_at) AS month,
        COUNT(*) AS soViPham,
        COALESCE(SUM(fineAmount), 0) AS tongTienPhat,
        COALESCE(SUM(CASE WHEN paymentStatus = 'paid' THEN fineAmount ELSE 0 END), 0) AS daThu
      FROM Violations
      WHERE YEAR(created_at) = ${year} AND deleted = FALSE
      GROUP BY MONTH(created_at)
      ORDER BY month;
    `);

    // Tạo dữ liệu đầy đủ 12 tháng
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const found = rows.find(r => r.month === month);
      return {
        month,
        soViPham: found ? parseInt(found.soViPham) : 0,
        tongTienPhat: found ? parseFloat(found.tongTienPhat) : 0,
        daThu: found ? parseFloat(found.daThu) : 0
      };
    });

    console.log('📊 Monthly fines data:', monthlyData); // Debug log

    return monthlyData;
  } catch (error) {
    console.error("❌ Lỗi getMonthlyFines:", error);
    throw error;
  }
};

// ============================================================
// 🔹 4. TOP 10 ĐỘC GIẢ VI PHẠM NHIỀU NHẤT
// ============================================================
const getTopViolators = async () => {
  try {
    const [rows] = await sequelize.query(`
      SELECT 
        r.readerId,
        r.fullName,
        r.cccd,
        r.address,
        COUNT(v.violationId) as soLanViPham,
        SUM(v.fineAmount) as tongTienPhat,
        SUM(CASE WHEN v.paymentStatus = 'paid' THEN v.fineAmount ELSE 0 END) as daThu,
        SUM(CASE WHEN v.paymentStatus = 'unpaid' THEN v.fineAmount ELSE 0 END) as conNo
      FROM Readers r
      INNER JOIN Violations v ON r.readerId = v.readerId
      WHERE v.deleted = FALSE AND r.deleted = FALSE
      GROUP BY r.readerId, r.fullName, r.cccd, r.address
      ORDER BY tongTienPhat DESC
      LIMIT 10;
    `);

    return rows.map(r => ({
      readerId: r.readerId,
      fullName: r.fullName,
      cccd: r.cccd,
      address: r.address,
      soLanViPham: parseInt(r.soLanViPham),
      tongTienPhat: parseFloat(r.tongTienPhat) || 0,
      daThu: parseFloat(r.daThu) || 0,
      conNo: parseFloat(r.conNo) || 0
    }));
  } catch (error) {
    console.error("❌ Lỗi getTopViolators:", error);
    throw error;
  }
};

// ============================================================
// 🔹 5. THỐNG KÊ THEO LOẠI VI PHẠM
// ============================================================
const getFineByViolationType = async () => {
  try {
    const [rows] = await sequelize.query(`
      SELECT 
        type as loaiViPham,
        severity as mucDoNghiemTrong,
        COUNT(*) as soLuong,
        SUM(fineAmount) as tongTienPhat,
        AVG(fineAmount) as tienPhatTrungBinh,
        MIN(fineAmount) as tienPhatThapNhat,
        MAX(fineAmount) as tienPhatCaoNhat
      FROM Violations
      WHERE deleted = FALSE
      GROUP BY type, severity
      ORDER BY tongTienPhat DESC;
    `);

    // Việt hóa loại vi phạm và ghép với mức độ
    return rows.map(r => {
      const loaiViPhamBase = r.loaiViPham === 'OVERDUE' ? 'Trả trễ' :
                              r.loaiViPham === 'LOST' ? 'Mất sách' :
                              r.loaiViPham === 'DAMAGE' ? 'Hư hỏng' :
                              r.loaiViPham === 'DAMAGED' ? 'Hư hỏng' :
                              r.loaiViPham;
      
      const mucDo = r.mucDoNghiemTrong === 'LOW' ? 'Nhẹ' :
                    r.mucDoNghiemTrong === 'MEDIUM' ? 'Trung bình' :
                    r.mucDoNghiemTrong === 'HIGH' ? 'Nặng' :
                    r.mucDoNghiemTrong === 'CRITICAL' ? 'Nghiêm trọng' :
                    r.mucDoNghiemTrong;
      
      return {
        loaiViPham: `${loaiViPhamBase} (${mucDo})`,
        mucDoNghiemTrong: r.mucDoNghiemTrong,
        soLuong: parseInt(r.soLuong),
        tongTienPhat: parseFloat(r.tongTienPhat) || 0,
        tienPhatTrungBinh: parseFloat(r.tienPhatTrungBinh) || 0,
        tienPhatThapNhat: parseFloat(r.tienPhatThapNhat) || 0,
        tienPhatCaoNhat: parseFloat(r.tienPhatCaoNhat) || 0
      };
    });
  } catch (error) {
    console.error("❌ Lỗi getFineByViolationType:", error);
    throw error;
  }
};

// ============================================================
// 🔹 BONUS: Danh sách độc giả còn nợ tiền phạt
// ============================================================
const getUnpaidFines = async () => {
  try {
    const [rows] = await sequelize.query(`
      SELECT 
        r.readerId,
        r.fullName,
        r.cccd,
        r.address,
        COUNT(v.violationId) as soViPhamChuaTra,
        SUM(v.fineAmount) as tongNo
      FROM Readers r
      INNER JOIN Violations v ON r.readerId = v.readerId
      WHERE v.deleted = FALSE 
        AND v.paymentStatus = 'unpaid'
        AND r.deleted = FALSE
      GROUP BY r.readerId, r.fullName, r.cccd, r.address
      ORDER BY tongNo DESC;
    `);

    return rows.map(r => ({
      readerId: r.readerId,
      fullName: r.fullName,
      cccd: r.cccd,
      address: r.address,
      soViPhamChuaTra: parseInt(r.soViPhamChuaTra),
      tongNo: parseFloat(r.tongNo) || 0
    }));
  } catch (error) {
    console.error("❌ Lỗi getUnpaidFines:", error);
    throw error;
  }
};

// ============================================================
// 🔹 BONUS: Thống kê theo phương thức thanh toán
// ============================================================
const getFineByPaymentMethod = async () => {
  try {
    const [rows] = await sequelize.query(`
      SELECT 
        p.paymentMethod as phuongThuc,
        COUNT(*) as soGiaoDich,
        SUM(p.amount) as tongTien,
        AVG(p.amount) as trungBinh
      FROM Payments p
      WHERE p.deleted = FALSE
      GROUP BY p.paymentMethod
      ORDER BY tongTien DESC;
    `);

    return rows.map(r => ({
      phuongThuc: r.phuongThuc || 'Không xác định',
      soGiaoDich: parseInt(r.soGiaoDich),
      tongTien: parseFloat(r.tongTien) || 0,
      trungBinh: parseFloat(r.trungBinh) || 0
    }));
  } catch (error) {
    console.error("❌ Lỗi getFineByPaymentMethod:", error);
    throw error;
  }
};

module.exports = {
  getFineOverview,
  getFineByPaymentStatus,
  getMonthlyFines,
  getTopViolators,
  getFineByViolationType,
  getUnpaidFines,
  getFineByPaymentMethod
};