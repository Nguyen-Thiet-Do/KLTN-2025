// src/utils/pdfExport.js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportLibraryReportToPDF = async (data) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm', 
    format: 'a4',
    compress: true
  });
  
  // Courier hỗ trợ Unicode tốt hơn Helvetica
  doc.setFont("courier");
  
  const currentDate = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const currentMonth = new Date().toLocaleDateString('vi-VN', {
    month: '2-digit',
    year: 'numeric'
  });

  let yPos = 20;

  // ==================== HEADER ====================
  doc.setFontSize(18);
  doc.setTextColor(25, 118, 210);
  doc.text('BAO CAO THONG KE THU VIEN', 105, yPos, { align: 'center' });
  
  yPos += 10;
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Ngay xuat: ${currentDate}`, 105, yPos, { align: 'center' });
  
  yPos += 6;
  doc.text(`Ky bao cao: Thang ${currentMonth}`, 105, yPos, { align: 'center' });
  
  yPos += 5;
  doc.setDrawColor(25, 118, 210);
  doc.setLineWidth(1);
  doc.line(20, yPos, 190, yPos);
  
  yPos += 15;

  // Style chung cho tất cả bảng
  const commonTableStyles = {
    font: 'courier',
    fontSize: 9,
    cellPadding: 3
  };

  // ==================== 1. TỔNG QUAN ====================
  doc.setFontSize(13);
  doc.setTextColor(25, 118, 210);
  doc.setFillColor(227, 242, 253);
  doc.rect(20, yPos - 5, 170, 10, 'F');
  doc.text('1. TONG QUAN HE THONG', 25, yPos);
  
  yPos += 15;

  const overviewData = [
    ['Tong dau sach', data.stats.totalDocuments],
    ['Ban sao sach', data.stats.totalCopies],
    ['Nguoi doc', data.stats.totalReaders],
    ['Tong phieu muon', data.stats.totalLoans]
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['Chi so', 'So luong']],
    body: overviewData,
    theme: 'grid',
    styles: commonTableStyles,
    headStyles: {
      fillColor: [25, 118, 210],
      fontSize: 10,
      fontStyle: 'bold',
      textColor: [255, 255, 255]
    },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 70, halign: 'center', fontStyle: 'bold', textColor: [25, 118, 210] }
    }
  });

  yPos = doc.lastAutoTable.finalY + 15;

  // ==================== 2. CHI TIẾT MƯỢN ====================
  doc.setFontSize(13);
  doc.setTextColor(25, 118, 210);
  doc.setFillColor(227, 242, 253);
  doc.rect(20, yPos - 5, 170, 10, 'F');
  doc.text('2. THONG KE MUON SACH CHI TIET', 25, yPos);
  
  yPos += 15;

  const borrowData = [
    ['Tong so cuon duoc muon', data.stats.totalBorrowedBooks],
    ['Da tra', data.stats.returnedBooks],
    ['Dang muon', data.stats.borrowingBooks],
    ['Cho den lay', data.stats.waitingPickupBooks],
    ['Mat sach', data.stats.lostBooks],
    ['Dat cho', data.stats.pendingBooks],
    ['Sach qua han', data.stats.overdueLoans]
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['Trang thai', 'So luong']],
    body: borrowData,
    theme: 'grid',
    styles: commonTableStyles,
    headStyles: {
      fillColor: [25, 118, 210],
      fontSize: 10,
      fontStyle: 'bold',
      textColor: [255, 255, 255]
    },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 70, halign: 'center', fontStyle: 'bold' }
    },
    didParseCell: function(hookData) {
      if (hookData.section === 'body' && hookData.column.index === 1) {
        const rowIndex = hookData.row.index;
        if (rowIndex === 1) hookData.cell.styles.textColor = [76, 175, 80];
        if (rowIndex === 2) hookData.cell.styles.textColor = [255, 152, 0];
        if (rowIndex === 4 || rowIndex === 6) hookData.cell.styles.textColor = [244, 67, 54];
        if (rowIndex === 5) hookData.cell.styles.textColor = [156, 39, 176];
      }
    }
  });

  yPos = doc.lastAutoTable.finalY + 10;

  // Nhận xét
  const returnRate = ((data.stats.returnedBooks / data.stats.totalBorrowedBooks) * 100).toFixed(1);
  const overdueRate = data.stats.borrowingBooks > 0 
    ? ((data.stats.overdueLoans / data.stats.borrowingBooks) * 100).toFixed(1)
    : 0;

  doc.setFillColor(255, 243, 224);
  doc.setDrawColor(255, 152, 0);
  doc.setLineWidth(2);
  doc.rect(20, yPos, 170, 20, 'FD');
  
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('Nhan xet:', 25, yPos + 7);
  doc.text(`- Ty le tra dung han: ${returnRate}%`, 25, yPos + 13);
  doc.text(`- Sach qua han chiem: ${overdueRate}% tong so dang muon`, 25, yPos + 19);

  // ==================== TRANG MỚI ====================
  doc.addPage();
  yPos = 20;

  // ==================== 3. THEO THÁNG ====================
  doc.setFontSize(13);
  doc.setTextColor(25, 118, 210);
  doc.setFillColor(227, 242, 253);
  doc.rect(20, yPos - 5, 170, 10, 'F');
  doc.text('3. THONG KE PHIEU MUON THEO THANG (2025)', 25, yPos);
  
  yPos += 15;

  const monthlyTableData = data.monthly.map(m => [
    `Thang ${m.month}`,
    m.total
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Thang', 'So phieu muon']],
    body: monthlyTableData,
    theme: 'striped',
    styles: commonTableStyles,
    headStyles: {
      fillColor: [25, 118, 210],
      fontSize: 10,
      fontStyle: 'bold',
      textColor: [255, 255, 255]
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 50, halign: 'center', fontStyle: 'bold', textColor: [25, 118, 210] }
    }
  });

  yPos = doc.lastAutoTable.finalY + 15;

  // ==================== 4. TOP 5 SÁCH ====================
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(13);
  doc.setTextColor(25, 118, 210);
  doc.setFillColor(227, 242, 253);
  doc.rect(20, yPos - 5, 170, 10, 'F');
  doc.text('4. TOP 5 SACH DUOC MUON NHIEU NHAT', 25, yPos);
  
  yPos += 15;

  const topBooksData = data.topBooks.map((book, idx) => [
    idx + 1,
    book.title,
    book.total
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Hang', 'Ten sach', 'So lan muon']],
    body: topBooksData,
    theme: 'grid',
    styles: commonTableStyles,
    headStyles: {
      fillColor: [25, 118, 210],
      fontSize: 10,
      fontStyle: 'bold',
      textColor: [255, 255, 255]
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 120 },
      2: { cellWidth: 30, halign: 'center', fontStyle: 'bold', textColor: [25, 118, 210] }
    }
  });

  yPos = doc.lastAutoTable.finalY + 15;

  // ==================== 5. TOP 5 ĐỘC GIẢ ====================
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(13);
  doc.setTextColor(25, 118, 210);
  doc.setFillColor(227, 242, 253);
  doc.rect(20, yPos - 5, 170, 10, 'F');
  doc.text('5. TOP 5 DOC GIA MUON NHIEU NHAT', 25, yPos);
  
  yPos += 15;

  const topReadersData = data.topReaders.map((reader, idx) => [
    idx + 1,
    reader.reader,
    reader.total
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Hang', 'Ho va ten', 'So lan muon']],
    body: topReadersData,
    theme: 'grid',
    styles: commonTableStyles,
    headStyles: {
      fillColor: [25, 118, 210],
      fontSize: 10,
      fontStyle: 'bold',
      textColor: [255, 255, 255]
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 120 },
      2: { cellWidth: 30, halign: 'center', fontStyle: 'bold', textColor: [25, 118, 210] }
    }
  });

  yPos = doc.lastAutoTable.finalY + 15;

  // ==================== 6. THEO DANH MỤC ====================
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(13);
  doc.setTextColor(25, 118, 210);
  doc.setFillColor(227, 242, 253);
  doc.rect(20, yPos - 5, 170, 10, 'F');
  doc.text('6. THONG KE SO LUONG SACH THEO DANH MUC', 25, yPos);
  
  yPos += 15;

  const categoryTableData = data.categories.slice(0, 10).map((cat, idx) => [
    idx + 1,
    cat.category,
    cat.total
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['STT', 'Danh muc', 'So luong']],
    body: categoryTableData,
    theme: 'striped',
    styles: commonTableStyles,
    headStyles: {
      fillColor: [25, 118, 210],
      fontSize: 10,
      fontStyle: 'bold',
      textColor: [255, 255, 255]
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 120 },
      2: { cellWidth: 30, halign: 'center', fontStyle: 'bold' }
    }
  });

  yPos = doc.lastAutoTable.finalY + 20;

  // ==================== CHỮ KÝ ====================
  if (yPos > 220) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont("courier", "italic");
  doc.text('Bao cao duoc tao tu dong tu he thong quan ly thu vien', 105, yPos, { align: 'center' });
  
  yPos += 30;
  doc.setFont("courier", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text('Thu thu truong', 160, yPos, { align: 'center' });
  
  yPos += 30;
  doc.setFont("courier", "italic");
  doc.setFontSize(8);
  doc.text('(Ky ten va dong dau)', 160, yPos, { align: 'center' });

  // ==================== XUẤT FILE ====================
  const fileName = `BaoCaoThuVien_${currentDate.replace(/\//g, '-')}.pdf`;
  doc.save(fileName);
  
  return fileName;
};